const express = require('express');
const router = express.Router();
const upload = require('../utils/upload');
const { scanText } = require('../utils/aliyun-green');
const { performReview } = require('../utils/ai-review');

// 引入模型和工具
const {
    sequelize,
    Article,
    Media,
    Category,
    Reviews,
    ArticleVersion,
} = require('../utils/db');
const { Sequelize } = require('sequelize');
const { filter } = require('../utils/sensitive'); // 敏感词过滤器

// 根据状态查询文章
router.get('/status/:status', async (req, res) => {
    const { status } = req.params;

    //  校验状态合法性
    const validStatuses = ['草稿', '待审', '已发布'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            error: '无效的状态值，仅支持：草稿、待审、已发布',
        });
    }

    // 分页参数
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
        50,
        Math.max(1, parseInt(req.query.pageSize) || 10)
    );
    const offset = (page - 1) * pageSize;

    try {
        const result = await Article.findAndCountAll({
            where: { status }, // 按状态过滤
            include: [
                {
                    model: Category,
                    as: 'Category',
                    attributes: ['category_id', 'category_name'],
                    include: [
                        {
                            model: Category,
                            as: 'ParentCategory',
                            attributes: ['category_id', 'category_name'],
                        },
                    ],
                },
                {
                    model: Media,
                    attributes: [
                        'media_id',
                        'media_type',
                        'media_url',
                        'description',
                    ],
                },
            ],
            order: [['publish_date', 'DESC']],
            limit: pageSize,
            offset: offset,
            subQuery: false,
        });

        res.json({
            total: result.count,
            page,
            pageSize,
            list: result.rows,
        });
    } catch (error) {
        console.error('按状态查询失败:', error);
        res.status(500).json({
            error: '查询失败',
            detail:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
        });
    }
});

// 获取文章详情
router.get('/details/:article_id', async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    if (isNaN(article_id)) {
        return res.status(400).json({ error: '无效的文章 ID' });
    }

    try {
        const article = await Article.findOne({
            where: { article_id },
            include: [
                {
                    model: Category,
                    as: 'Category',
                    attributes: ['category_id', 'category_name'],
                    include: [
                        {
                            model: Category,
                            as: 'ParentCategory',
                            attributes: ['category_id', 'category_name'],
                        },
                    ],
                },
                {
                    model: Media,
                    attributes: [
                        'media_id',
                        'media_type',
                        'media_url',
                        'description',
                    ],
                },
            ],
        });

        if (!article) {
            return res.status(404).json({ error: '文章未找到' });
        }

        res.json(article);
    } catch (error) {
        console.error('获取详情失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 创建文章
router.post('/create', upload.array('file', 10), async (req, res) => {
    const { title, category_id, content, source, editor } = req.body;
    const as = req.query.as === 'draft' ? 'draft' : 'submit'; // 草稿 or 提交
    const scheduledTimeStr = req.body.scheduled_publish_date;

    // 必填校验
    if (!title || !content || !category_id) {
        return res.status(400).json({ error: '标题、内容、分类为必填项' });
    }

    // 类型转换
    const categoryId = parseInt(category_id);
    if (isNaN(categoryId)) {
        return res.status(400).json({ error: '无效的分类 ID' });
    }

    // 敏感词检测（本地规则引擎初筛）
    const titleFilter = filter(title);
    const contentFilter = filter(content);

    if (titleFilter.hitWords.length > 0 || contentFilter.hitWords.length > 0) {
        const hitWords = [
            ...new Set([...titleFilter.hitWords, ...contentFilter.hitWords]),
        ];
        return res.status(400).json({
            error: '内容包含敏感词，禁止提交',
            hitWords,
        });
    }

    let status = '草稿';
    let scheduled_publish_date = null;
    let publish_date = null;
    let reviewLog = null;

    // 非草稿：触发 AI 审核 或 设置定时发布
    if (as !== 'draft') {
        if (scheduledTimeStr) {
            scheduled_publish_date = new Date(scheduledTimeStr);
            if (
                isNaN(scheduled_publish_date.getTime()) ||
                scheduled_publish_date <= new Date()
            ) {
                return res
                    .status(400)
                    .json({ error: '定时发布时间必须晚于当前时间' });
            }
            status = '待发布';
        } else {
            // 执行审核
            try {
                const decision = await performReview(title, content); // 决策逻辑
                status = decision.status;
                publish_date = status === '已发布' ? new Date() : null;
                reviewLog = decision.reviewLog;
            } catch (err) {
                return res.status(400).json({
                    error: '内容审核未通过',
                    detail: err.message,
                });
            }
        }
    }

    const transaction = await sequelize.transaction();
    try {
        // 创建文章
        const article = await Article.create(
            {
                title,
                category_id: categoryId,
                content,
                source: source || null,
                editor: editor || null,
                status,
                scheduled_publish_date,
                publish_date,
            },
            { transaction }
        );

        // 保存初始版本
        await ArticleVersion.create(
            {
                article_id: article.article_id,
                version_number: 1,
                title,
                content,
                editor: editor || 'unknown',
                created_at: new Date(),
            },
            { transaction }
        );

        // 处理媒体文件
        let uploadedMedia = [];
        if (req.files && req.files.length > 0) {
            const mediaList = req.files.map((file) => ({
                article_id: article.article_id,
                media_type: file.mimetype.startsWith('image')
                    ? 'image'
                    : 'video',
                media_url: `http://localhost:3000/uploads/${file.filename}`,
                description: file.originalname,
                created_at: new Date(),
            }));
            const records = await Media.bulkCreate(mediaList, {
                transaction,
                returning: true,
            });
            uploadedMedia = records.map((r) => ({
                media_id: r.media_id,
                media_type: r.media_type,
                media_url: r.media_url,
                description: r.description,
            }));
        }

        await transaction.commit();

        res.json({
            message:
                as === 'draft'
                    ? '草稿已保存'
                    : status === '已发布'
                    ? '文章已发布'
                    : status === '待发布'
                    ? '已设置定时发布'
                    : '已提交，等待审核',
            article,
            uploadedMedia,
            status,
            scheduled_publish_date,
            publish_date,
        });
    } catch (error) {
        await transaction.rollback();
        console.error('创建文章失败:', error);
        res.status(500).json({
            error: '创建失败',
            detail:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
        });
    }
});

// 编辑文章
router.put('/edit/:article_id', upload.array('file', 10), async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    const { title, category_id, content, source, editor, action } = req.body;
    const act = action || 'submit';

    const validActions = ['save', 'submit', 'schedule'];
    if (!validActions.includes(act)) {
        return res.status(400).json({ error: '无效的操作类型' });
    }
    if (isNaN(article_id))
        return res.status(400).json({ error: '无效的文章 ID' });
    if (!title || !content || !category_id) {
        return res.status(400).json({ error: '标题、内容、分类为必填项' });
    }

    let status = '草稿';
    let scheduled_publish_date = null;
    let publish_date = null;
    let reviewLog = null;

    if (act !== 'save') {
        try {
            if (act === 'schedule') {
                const time = new Date(req.body.scheduled_publish_date);
                if (isNaN(time.getTime()) || time <= new Date()) {
                    return res
                        .status(400)
                        .json({ error: '定时发布时间必须晚于当前时间' });
                }
                scheduled_publish_date = time;
                status = '待发布';
            } else {
                // submit 提交：走审核流程
                const result = await performReview(title, content);
                status = result.status;
                publish_date = status === '已发布' ? new Date() : null;
                reviewLog = result.reviewLog;
            }
        } catch (err) {
            return res
                .status(400)
                .json({ error: '审核失败', detail: err.message });
        }
    }

    const transaction = await sequelize.transaction();
    try {
        const article = await Article.findByPk(article_id, { transaction });
        if (!article) {
            await transaction.rollback();
            return res.status(404).json({ error: '文章未找到' });
        }

        // 保存新版本
        const lastVersion = await ArticleVersion.findOne({
            where: { article_id },
            order: [['version_number', 'DESC']],
            transaction,
        });
        await ArticleVersion.create(
            {
                article_id,
                version_number: (lastVersion?.version_number || 0) + 1,
                title,
                content,
                editor: editor || 'unknown',
            },
            { transaction }
        );

        // 更新主表
        await article.update(
            {
                title,
                category_id: parseInt(category_id),
                content,
                source: source || null,
                editor: editor || null,
                status,
                scheduled_publish_date,
                publish_date,
            },
            { transaction }
        );

        // 删除旧媒体
        await Media.destroy({ where: { article_id }, transaction });

        // 添加新媒体
        let uploadedMedia = [];
        if (req.files && req.files.length > 0) {
            const mediaList = req.files.map((file) => ({
                article_id,
                media_type: file.mimetype,
                media_url: `http://localhost:3000/uploads/${file.filename}`,
                description: file.originalname,
            }));
            const records = await Media.bulkCreate(mediaList, {
                transaction,
                returning: true,
            });
            uploadedMedia = records.map((r, index) => ({
                media_id: r.media_id,
                media_url: r.media_url,
                description: r.description,
                filename: req.files[index].filename,
            }));
        }

        // 记录审核日志
        if (reviewLog) {
            reviewLog.article_id = article_id;
            try {
                await Reviews.create(reviewLog, { transaction });
            } catch (err) {
                console.warn(
                    `文章 ${article_id} 的审核日志写入失败`,
                    err.message
                );
            }
        }

        await transaction.commit();

        res.json({
            message: {
                save: '草稿已保存',
                submit: '文章已提交，等待审核',
                schedule: '文章已设置定时发布',
            }[act],
            article: article.toJSON(),
            uploadedMedia,
        });
    } catch (error) {
        await transaction.rollback();
        console.error('编辑失败:', error);
        res.status(500).json({ error: '更新失败: ' + error.message });
    }
});

// 删除文章
router.delete('/delete/:article_id', async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    if (isNaN(article_id)) {
        return res.status(400).json({ error: '无效的文章 ID' });
    }

    const transaction = await sequelize.transaction();

    try {
        // 先删媒体
        await Media.destroy({ where: { article_id }, transaction });

        const deleted = await Article.destroy({
            where: { article_id },
            transaction,
        });
        if (deleted === 0) {
            await transaction.rollback();
            return res.status(404).json({ error: '文章不存在' });
        }

        await transaction.commit();
        res.json({ message: '删除成功' });
    } catch (error) {
        await transaction.rollback();
        console.error('删除失败:', error);
        res.status(500).json({ error: '删除失败，可能是外键冲突' });
    }
});

// 获取所有文章列表
router.get('/list', async (req, res) => {
    // 分页参数
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
        50,
        Math.max(1, parseInt(req.query.pageSize) || 10)
    );
    const offset = (page - 1) * pageSize;

    try {
        const result = await Article.findAndCountAll({
            include: [
                {
                    model: Category,
                    as: 'Category',
                    attributes: ['category_id', 'category_name'],
                    include: [
                        {
                            model: Category,
                            as: 'ParentCategory',
                            attributes: ['category_id', 'category_name'],
                        },
                    ],
                },
                {
                    model: Media,
                    attributes: [
                        'media_id',
                        'media_type',
                        'media_url',
                        'description',
                    ],
                },
            ],
            order: [['publish_date', 'DESC']],
            limit: pageSize,
            offset: offset,
            subQuery: false,
        });

        res.json({
            total: result.count,
            page,
            pageSize,
            list: result.rows, // 使用 list 更语义化
        });
    } catch (error) {
        console.error('获取文章列表失败:', error);
        res.status(500).json({
            error: '获取文章列表失败',
            detail:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
        });
    }
});

// 获取指定分类下的文章列表
router.get('/list/:category_id', async (req, res) => {
    const category_id = parseInt(req.params.category_id);
    if (isNaN(category_id)) {
        return res.status(400).json({ error: '无效的分类 ID' });
    }

    // 分页参数
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
        50,
        Math.max(1, parseInt(req.query.pageSize) || 10)
    );
    const offset = (page - 1) * pageSize;

    try {
        const { count, rows } = await Article.findAndCountAll({
            where: {
                category_id: category_id,
            },
            include: [
                {
                    model: Category,
                    as: 'Category',
                    attributes: ['category_id', 'category_name'],
                    include: [
                        {
                            model: Category,
                            as: 'ParentCategory',
                            attributes: ['category_id', 'category_name'],
                        },
                    ],
                },
                {
                    model: Media,
                    attributes: [
                        'media_id',
                        'media_type',
                        'media_url',
                        'description',
                    ],
                },
            ],
            order: [['publish_date', 'DESC']],
            limit: pageSize,
            offset: offset,
        });

        // 返回结果包含总数量、当前页码和文章列表
        res.json({
            total: count,
            page: page,
            pageSize: pageSize,
            list: rows,
        });
    } catch (error) {
        console.error('查询分类文章失败:', error);
        res.status(500).json({
            error: '查询失败',
            detail:
                error.name === 'SequelizeDatabaseError' ? error.message : null,
        });
    }
});

// 搜索文章（全文检索）
router.get('/searchAll', async (req, res) => {
    const words = req.query.words?.trim();
    if (!words) return res.status(400).json({ error: '关键词不能为空' });

    // 敏感词过滤
    const { text: replacedQ, hit } = filter(words);

    // 分页参数
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
        50,
        Math.max(1, parseInt(req.query.pageSize) || 10)
    );
    const offset = (page - 1) * pageSize;

    try {
        let results;

        // 判断是否为短词（中文单字、双字 或 英文短词）
        const isShortWord = replacedQ.length <= 2;

        // 前端传： status=published 表示只查已发布
        const wantPublishedOnly = req.query.status === 'published';

        if (isShortWord) {
            // 一：短词使用 LIKE 模糊匹配
            console.log(`[SEARCH] 使用 LIKE 模式搜索短词: ${replacedQ}`);

            const whereConditions = {
                [Sequelize.Op.and]: [
                    {
                        [Sequelize.Op.or]: [
                            {
                                title: {
                                    [Sequelize.Op.like]: `%${replacedQ}%`,
                                },
                            },
                            {
                                content: {
                                    [Sequelize.Op.like]: `%${replacedQ}%`,
                                },
                            },
                        ],
                    },
                    //  动态添加：只有前端要求时才加状态过滤
                    ...(wantPublishedOnly ? [{ status: '已发布' }] : []),
                ],
            };

            results = await Article.findAndCountAll({
                where: whereConditions,
                include: [
                    {
                        model: Category,
                        attributes: ['category_name'],
                        as: 'Category',
                        include: [
                            {
                                model: Category,
                                as: 'ParentCategory',
                                attributes: ['category_id', 'category_name'],
                            },
                        ],
                    },
                    {
                        model: Media,
                        attributes: [
                            'media_id',
                            'media_type',
                            'media_url',
                            'description',
                        ],
                    },
                ],
                attributes: [
                    'article_id',
                    'title',
                    'content',
                    'publish_date',
                    'status',
                    // 手动加一个 score 字段用于排序（简单相关性）
                    [
                        Sequelize.literal(`
                            (CASE 
                                WHEN INSTR(title, '${replacedQ}') > 0 AND INSTR(content, '${replacedQ}') > 0 THEN 2
                                WHEN INSTR(title, '${replacedQ}') > 0 THEN 1.5
                                WHEN INSTR(content, '${replacedQ}') > 0 THEN 1
                                ELSE 0
                            END)
                        `),
                        'score',
                    ],
                ],
                order: [
                    [Sequelize.literal('score'), 'DESC'],
                    ['publish_date', 'DESC'],
                ],
                limit: pageSize,
                offset: offset,
                subQuery: false,
            });
        } else {
            // 二：长词使用 FULLTEXT 索引
            console.log(`[SEARCH] 使用 FULLTEXT 模式: ${replacedQ}`);

            // 动态构建 WHERE 条件：只有 wantPublishedOnly 为 true 时才加 AND status = '已发布'
            const statusCondition = wantPublishedOnly
                ? "AND status = '已发布'"
                : '';
            const fulltextWhere = Sequelize.literal(
                `MATCH(title, content) AGAINST('+${replacedQ}*' IN BOOLEAN MODE) ${statusCondition}`
            );

            results = await Article.findAndCountAll({
                where: fulltextWhere,
                include: [
                    {
                        model: Category,
                        attributes: ['category_name'],
                        as: 'Category',
                        include: [
                            {
                                model: Category,
                                as: 'ParentCategory',
                                attributes: ['category_id', 'category_name'],
                            },
                        ],
                    },
                    {
                        model: Media,
                        attributes: [
                            'media_id',
                            'media_type',
                            'media_url',
                            'description',
                        ],
                    },
                ],
                attributes: [
                    'article_id',
                    'title',
                    'content',
                    'publish_date',
                    'status',
                    [
                        Sequelize.literal(
                            `MATCH(title, content) AGAINST('${replacedQ}')`
                        ),
                        'score',
                    ],
                ],
                order: [[Sequelize.literal('score'), 'DESC']],
                limit: pageSize,
                offset: offset,
                subQuery: false,
            });
        }

        // 高亮函数（支持正则特殊字符转义）
        const escapeRegExp = (string) => {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        const highlight = (txt, key) => {
            const escapedKey = escapeRegExp(key);
            const regex = new RegExp(`(${escapedKey})`, 'gi');
            return (txt || '').replace(regex, '<mark>$1</mark>');
        };

        // 处理结果：高亮 + 截取摘要
        const list = results.rows.map((row) => {
            const data = row.toJSON();
            return {
                ...data,
                title: highlight(data.title, replacedQ),
                content: highlight(
                    data.content ? data.content.substring(0, 200) + '...' : '',
                    replacedQ
                ),
            };
        });

        res.json({
            total: results.count,
            page,
            pageSize,
            keyword: replacedQ,
            sensitive_hit: hit,
            list,
        });
    } catch (e) {
        console.error('搜索出错:', e.message);
        res.status(500).json({
            error: '检索失败，请检查是否添加了 FULLTEXT 索引',
            detail: e.message,
        });
    }
});

router.get('/', (req, res) => {
    res.render('article', { title: '文章管理' });
});

module.exports = router;
