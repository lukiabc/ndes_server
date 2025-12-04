const express = require('express');
const router = express.Router();
const { performReview } = require('../utils/ai-review');
const { extractLocalMediaFilenames } = require('../utils/media');
const { localizeRemoteImages } = require('../utils/localizeRemoteImages');
const { Op } = require('sequelize');

const { Sequelize } = require('sequelize');
const { filter } = require('../utils/sensitive');
const MEDIA_BASE_URL = 'http://localhost:3000/uploads/';
const {
    sequelize,
    Article,
    Media,
    Category,
    Reviews,
    ArticleVersion,
} = require('../utils/db');

// ai 审核 id
const AI_REVIEWER_ID = parseInt(process.env.AI_REVIEWER_ID, 10) || 0;

// 模糊搜索“待审”状态的文章（标题或内容）
router.get('/pending/search', async (req, res) => {
    const keyword = req.query.keyword?.trim() || '';
    if (!keyword) {
        return res.status(400).json({ error: '关键词不能为空' });
    }

    // 分页参数
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
        50,
        Math.max(1, parseInt(req.query.pageSize) || 10)
    );
    const offset = (page - 1) * pageSize;

    try {
        const where = {
            status: '待审',
            [Op.or]: [
                { title: { [Op.like]: `%${keyword}%` } },
                { content: { [Op.like]: `%${keyword}%` } },
            ],
        };

        const result = await Article.findAndCountAll({
            where,
            distinct: true,
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
            keyword,
            total: result.count,
            page,
            pageSize,
            list: result.rows,
        });
    } catch (error) {
        console.error('搜索待审文章失败:', error);
        res.status(500).json({
            error: '搜索失败',
            detail:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
        });
    }
});

// 根据用户id标题模糊查询文章
router.get('/user/:user_id/search', async (req, res) => {
    const user_id = parseInt(req.params.user_id);
    const titleKeyword = req.query.title?.trim() || '';

    if (isNaN(user_id) || user_id <= 0) {
        return res.status(400).json({ error: '无效的用户 ID' });
    }

    // 分页参数
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
        50,
        Math.max(1, parseInt(req.query.pageSize) || 10)
    );
    const offset = (page - 1) * pageSize;

    try {
        const where = { user_id };
        if (titleKeyword) {
            where.title = { [Op.like]: `%${titleKeyword}%` };
        }

        const result = await Article.findAndCountAll({
            where,
            distinct: true,
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

        res.json({
            user_id,
            keyword: titleKeyword,
            total: result.count,
            page,
            pageSize,
            list: result.rows,
        });
    } catch (error) {
        console.error('用户文章标题搜索失败:', error);
        res.status(500).json({
            error: '搜索失败',
            detail:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
        });
    }
});

// 获取所有文章状态及其数量统计
router.get('/status-counts', async (req, res) => {
    try {
        const counts = await Article.findAll({
            attributes: [
                'status',
                [Sequelize.fn('COUNT', Sequelize.col('article_id')), 'count'],
            ],
            group: ['status'],
            raw: true,
        });
        const allStatuses = [
            '草稿',
            '待审',
            '待发布',
            '已发布',
            '退回修订',
            '拒绝',
        ];
        const result = allStatuses.map((status) => {
            const found = counts.find((item) => item.status === status);
            return {
                status,
                count: found ? parseInt(found.count, 10) : 0,
            };
        });

        res.json(result);
    } catch (error) {
        console.error('获取状态统计失败:', error);
        res.status(500).json({
            error: '服务器内部错误',
            detail:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
        });
    }
});

// 根据状态查询文章
router.get('/status/:status', async (req, res) => {
    const { status } = req.params;

    //  校验状态合法性
    const validStatuses = [
        '草稿',
        '待审',
        '待发布',
        '已发布',
        '退回修订',
        '拒绝',
    ];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            error: '无效的状态值，仅支持：草稿、待审、待发布、已发布、退回修订、拒绝',
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
            subQuery: false, //不使用子查询
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
router.post('/create', async (req, res) => {
    const {
        title,
        category_id,
        content,
        source,
        editor,
        user_id,
        action = 'submit', // ← 新增！默认 submit
        scheduled_publish_date: scheduledTimeStr, // ← 重命名避免冲突
    } = req.body;

    const validActions = ['save', 'submit', 'schedule'];
    if (!validActions.includes(action)) {
        return res
            .status(400)
            .json({ error: '无效的操作类型，仅支持 save / submit / schedule' });
    }

    // 必填校验（注意：草稿可考虑放宽，但你当前要求必填，保留）
    if (!title || !content || !category_id || !user_id) {
        return res
            .status(400)
            .json({ error: '标题、内容、分类、用户ID为必填项' });
    }

    const categoryId = parseInt(category_id);
    if (isNaN(categoryId)) {
        return res.status(400).json({ error: '无效的分类 ID' });
    }

    // 非草稿模式：校验分类必须是子分类
    if (action !== 'save') {
        try {
            const category = await Category.findByPk(categoryId, {
                attributes: ['category_id', 'category_name', 'parent_id'],
            });

            if (!category) {
                return res.status(400).json({
                    error: '分类不存在',
                    detail: `分类ID ${categoryId} 不存在`,
                });
            }

            if (category.parent_id === null) {
                return res.status(400).json({
                    error: '不能使用根分类发布文章',
                    detail: `分类"${category.category_name}"是根分类，请选择具体的子分类`,
                });
            }

            console.log('[分类校验] ✓ 分类有效，父分类ID:', category.parent_id);
        } catch (err) {
            return res.status(500).json({
                error: '分类校验失败',
                detail: err.message,
            });
        }
    }

    let status = '草稿';
    let scheduled_publish_date = null;
    let publish_date = null;
    let reviewLog = null;

    // 非草稿才走审核流程
    if (action !== 'save') {
        console.log('\n========== [DEBUG] 内容审核开始 ==========');
        console.log('[输入] 标题:', title);
        console.log(
            '[输入] 内容:',
            content.substring(0, 100) + (content.length > 100 ? '...' : '')
        );

        if (action === 'schedule') {
            // 定时发布
            if (!scheduledTimeStr) {
                return res
                    .status(400)
                    .json({ error: '定时发布必须提供 scheduled_publish_date' });
            }

            scheduled_publish_date = new Date(scheduledTimeStr);
            if (
                isNaN(scheduled_publish_date.getTime()) ||
                scheduled_publish_date <= new Date()
            ) {
                console.log('[定时发布] ❌ 定时发布时间无效');
                console.log('========== [DEBUG] 内容审核结束 ==========\n');
                return res
                    .status(400)
                    .json({ error: '定时发布时间必须晚于当前时间' });
            }

            console.log('[定时发布] 开始内容审核（定时发布模式）...');
            const decision = await performReview(title, content, true); // 第三个参数表示定时发布
            status = decision.status;
            reviewLog = decision.reviewLog;

            if (status === '待发布') {
                publish_date = null;
                console.log(
                    '[定时发布] ✓ 审核通过，已设置定时发布:',
                    scheduled_publish_date
                );
            } else if (status === '拒绝') {
                scheduled_publish_date = null;
                console.log('[定时发布] ❌ 审核拒绝，文章将标记为拒绝状态');
            } else if (status === '待审') {
                console.log('[定时发布] ⚠️ 审核疑似违规，需要人工审核');
            }
        } else if (action === 'submit') {
            // 立即投稿
            console.log('[投稿发布] 开始内容审核...');
            const decision = await performReview(title, content, false);
            status = decision.status;
            publish_date = status === '已发布' ? new Date() : null;
            reviewLog = decision.reviewLog;

            if (status === '已发布') {
                console.log('[投稿发布] ✅ 审核完全通过，文章将自动发布');
            } else if (status === '待审') {
                console.log('[投稿发布] ⚠️ 审核疑似违规，需要人工审核');
            } else if (status === '拒绝') {
                console.log('[投稿发布] ❌ 审核拒绝，文章将标记为拒绝状态');
            }
        }

        if (reviewLog) {
            reviewLog = {
                ...reviewLog,
                reviewer: AI_REVIEWER_ID,
                review_time: new Date(),
            };
        }

        console.log('[审核结果] 状态:', status);
        console.log('[审核结果] 备注:', reviewLog?.review_comments || '无');
        console.log('========== [DEBUG] 内容审核结束 ==========\n');
    } else {
        console.log('\n========== [DEBUG] 草稿模式 ==========');
        console.log('[草稿模式] 跳过内容审核');
        console.log('========== [DEBUG] 草稿模式结束 ==========\n');
    }

    // 本地化外链图片
    let finalContent = content;
    if (content) {
        try {
            const { html: localizedHtml } = await localizeRemoteImages(content);
            finalContent = localizedHtml;
        } catch (err) {
            console.warn('⚠️ 图片本地化失败，使用原始内容:', err.message);
        }
    }

    const transaction = await sequelize.transaction();
    try {
        // 创建文章
        const article = await Article.create(
            {
                title,
                user_id,
                category_id: categoryId,
                content: finalContent,
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
                user_id,
                version_number: 1,
                title,
                content: finalContent, // 注意：这里应存处理后的 content（含本地图）
                editor: editor || 'unknown',
                created_at: new Date(),
            },
            { transaction }
        );

        // 处理媒体文件
        let uploadedMedia = [];
        if (finalContent) {
            try {
                const mediaFiles = await extractLocalMediaFilenames(
                    finalContent
                );
                if (mediaFiles.length > 0) {
                    const mediaList = mediaFiles.map(({ filename, tag }) => ({
                        article_id: article.article_id,
                        media_type:
                            tag === 'img'
                                ? 'image'
                                : tag === 'video'
                                ? 'video'
                                : tag === 'audio'
                                ? 'audio'
                                : 'attachment',
                        media_url: `${MEDIA_BASE_URL}${filename}`,
                        description: filename,
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
            } catch (err) {
                console.warn('解析 HTML 媒体失败:', err);
            }
        }

        // 记录审核日志
        if (reviewLog) {
            reviewLog.article_id = article.article_id;
            try {
                await Reviews.create(reviewLog, { transaction });
                console.log(
                    `[创建文章] ✓ AI 审核日志已保存（审核人ID: ${AI_REVIEWER_ID})`
                );
            } catch (err) {
                console.warn(
                    `[创建文章] 文章 ${article.article_id} 的审核日志写入失败`,
                    err.message
                );
            }
        }

        await transaction.commit();

        // 返回消息
        let message = '操作成功';
        if (action === 'save') {
            message = '草稿已保存';
        } else if (status === '已发布') {
            message = '审核通过，文章已自动发布';
        } else if (status === '待发布') {
            message = '审核通过，已设置定时发布';
        } else if (status === '待审') {
            message = '已提交，内容疑似违规，等待人工审核';
        } else if (status === '拒绝') {
            message = '审核未通过，文章已被拒绝';
        }

        res.json({
            message,
            article,
            uploadedMedia,
            status,
            scheduled_publish_date,
            publish_date,
            rejectReason: reviewLog?.review_comments || null,
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
router.put('/edit/:article_id', async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    const { title, category_id, content, source, editor, action, user_id } =
        req.body;
    const act = action || 'submit';

    const validActions = ['save', 'submit', 'schedule'];
    if (!validActions.includes(act)) {
        return res.status(400).json({ error: '无效的操作类型' });
    }
    if (isNaN(article_id))
        return res.status(400).json({ error: '无效的文章 ID' });
    if (!title || !content || !category_id || !user_id) {
        return res
            .status(400)
            .json({ error: '标题、内容、分类、用户ID为必填项' });
    }

    // 类型转换
    const categoryId = parseInt(category_id);
    if (isNaN(categoryId)) {
        return res.status(400).json({ error: '无效的分类 ID' });
    }

    // 非草稿模式：校验分类必须是子分类（不能是根分类）
    if (act !== 'save') {
        try {
            const category = await Category.findByPk(categoryId, {
                attributes: ['category_id', 'category_name', 'parent_id'],
            });

            if (!category) {
                return res.status(400).json({
                    error: '分类不存在',
                    detail: `分类ID ${categoryId} 不存在`,
                });
            }

            if (category.parent_id === null) {
                return res.status(400).json({
                    error: '不能使用根分类发布文章',
                    detail: `分类"${category.category_name}"是根分类，请选择具体的子分类`,
                });
            }

            console.log('[分类校验] ✓ 分类有效，父分类ID:', category.parent_id);
        } catch (err) {
            return res.status(500).json({
                error: '分类校验失败',
                detail: err.message,
            });
        }
    }

    let status = '草稿';
    let scheduled_publish_date = null;
    let publish_date = null;
    let reviewLog = null;

    if (act !== 'save') {
        console.log('\n========== [DEBUG] 编辑文章 - 内容审核开始 ==========');
        console.log('[输入] 标题:', title);
        console.log(
            '[输入] 内容:',
            content.substring(0, 100) + (content.length > 100 ? '...' : '')
        );

        if (act === 'schedule') {
            // 定时发布：需要审核
            const time = new Date(req.body.scheduled_publish_date);
            if (isNaN(time.getTime()) || time <= new Date()) {
                console.log('[定时发布] ❌ 定时发布时间无效');
                console.log('========== [DEBUG] 内容审核结束 ==========\n');
                return res
                    .status(400)
                    .json({ error: '定时发布时间必须晚于当前时间' });
            }

            console.log('[定时发布] 开始内容审核（定时发布模式）...');
            const decision = await performReview(title, content, true);
            scheduled_publish_date = time;
            status = decision.status;
            reviewLog = decision.reviewLog;

            if (status === '待发布') {
                publish_date = null;
                console.log(
                    '[定时发布] ✓ 审核通过，已设置定时发布:',
                    scheduled_publish_date
                );
            } else if (status === '拒绝') {
                scheduled_publish_date = null;
                console.log('[定时发布] ❌ 审核拒绝，文章将标记为拒绝状态');
            } else if (status === '待审') {
                console.log('[定时发布] ⚠️  审核疑似违规，需要人工审核');
            }
        } else {
            // submit 提交：走审核流程
            console.log('[投稿发布] 开始内容审核...');
            const decision = await performReview(title, content, false);
            status = decision.status;
            publish_date = status === '已发布' ? new Date() : null;
            reviewLog = decision.reviewLog;

            if (status === '已发布') {
                console.log('[投稿发布] ✅ 审核完全通过，文章将自动发布');
            } else if (status === '待审') {
                console.log('[投稿发布] ⚠️  审核疑似违规，需要人工审核');
            } else if (status === '拒绝') {
                console.log('[投稿发布] ❌ 审核拒绝，文章将标记为拒绝状态');
            }
        }

        console.log('[审核结果] 状态:', status);
        console.log('[审核结果] 备注:', reviewLog.review_comments);
        console.log('========== [DEBUG] 内容审核结束 ==========\n');
    } else {
        console.log('\n========== [DEBUG] 编辑文章 - 草稿模式 ==========');
        console.log('[草稿模式] 跳过内容审核');
        console.log('========== [DEBUG] 草稿模式结束 ==========\n');
    }

    // ====== 本地化外链图片 ======
    let finalContent = content;
    if (content) {
        try {
            const { html: localizedHtml } = await localizeRemoteImages(content);
            finalContent = localizedHtml;
        } catch (err) {
            console.warn('⚠️ 编辑时图片本地化失败，使用原始内容:', err.message);
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
                user_id,
                version_number: (lastVersion?.version_number || 0) + 1,
                title,
                content: finalContent,
                editor: editor || 'unknown',
            },
            { transaction }
        );

        // 更新主表
        await article.update(
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

        // 删除旧媒体
        await Media.destroy({ where: { article_id }, transaction });

        // 添加新媒体
        let uploadedMedia = [];
        if (finalContent) {
            try {
                const mediaFiles = await extractLocalMediaFilenames(
                    finalContent
                ); // ←
                if (mediaFiles.length > 0) {
                    const mediaList = mediaFiles.map(({ filename, tag }) => ({
                        article_id,
                        media_type:
                            tag === 'img'
                                ? 'image'
                                : tag === 'video'
                                ? 'video'
                                : tag === 'audio'
                                ? 'audio'
                                : 'attachment',
                        media_url: `${MEDIA_BASE_URL}${filename}`,
                        description: filename,
                        created_at: new Date(),
                    }));

                    const records = await Media.bulkCreate(mediaList, {
                        transaction,
                        returning: true,
                    });

                    uploadedMedia = records.map((r, i) => ({
                        media_id: r.media_id,
                        media_url: r.media_url,
                        description: r.description,
                        filename: mediaFiles[i].filename,
                    }));
                }
            } catch (err) {
                console.warn('编辑时解析 HTML 媒体失败:', err);
            }
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

        // 根据状态返回不同的消息
        let message = '操作成功';
        if (act === 'save') {
            message = '草稿已保存';
        } else if (status === '已发布') {
            message = '审核通过，文章已自动发布';
        } else if (status === '待发布') {
            message = '审核通过，已设置定时发布';
        } else if (status === '待审') {
            message = '已提交，内容疑似违规，等待人工审核';
        } else if (status === '拒绝') {
            message = '审核未通过，文章已被拒绝';
        }

        res.json({
            message,
            article: article.toJSON(),
            uploadedMedia,
            status,
            rejectReason: reviewLog?.review_comments || null,
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
            distinct: true,
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

        res.json({
            total: result.count,
            page,
            pageSize,
            list: result.rows,
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

// 根据用户ID获取文章列表
router.get('/user/:user_id', async (req, res) => {
    const user_id = parseInt(req.params.user_id);

    if (isNaN(user_id) || user_id <= 0) {
        return res.status(400).json({ error: '无效的用户 ID' });
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
            where: { user_id },
            distinct: true,
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

        res.json({
            user_id,
            total: result.count,
            page,
            pageSize,
            list: result.rows,
        });
    } catch (error) {
        console.error('获取用户文章列表失败:', error);
        res.status(500).json({
            error: '获取用户文章列表失败',
            detail:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
        });
    }
});

// 获取指定子分类下的文章列表
router.get('/list/:category_id', async (req, res) => {
    const category_id = parseInt(req.params.category_id);
    if (isNaN(category_id)) {
        return res.status(400).json({ error: '无效的分类 ID' });
    }

    if (!Number.isInteger(category_id) || category_id <= 0) {
        return res.status(400).json({ error: '分类 ID 必须为正整数' });
    }

    try {
        // 检查该分类是否存在，且 parent_id 不为 null
        const category = await Category.findByPk(category_id, {
            attributes: ['category_id', 'parent_id', 'category_name'],
        });

        if (!category) {
            return res.status(404).json({ error: '分类不存在' });
        }

        if (category.parent_id === null) {
            return res.status(400).json({
                error: '该分类为顶级分类，不支持直接查询文章列表',
                detail: '请使用子分类 ID',
            });
        }

        // 分页参数
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(
            50,
            Math.max(1, parseInt(req.query.pageSize) || 10)
        );
        const offset = (page - 1) * pageSize;

        // 查询文章
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
            distinct: true,
        });

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

// 获取指定父分类下所有子分类的文章列表
router.get('/listByParent/:parent_id', async (req, res) => {
    const parent_id = parseInt(req.params.parent_id, 10);

    if (!Number.isInteger(parent_id) || parent_id <= 0) {
        return res.status(400).json({ error: '父分类 ID 必须为正整数' });
    }

    try {
        // 检查父分类是否存在
        const parentCategory = await Category.findByPk(parent_id);
        if (!parentCategory) {
            return res.status(404).json({ error: '父分类不存在' });
        }

        // 获取该父分类下的所有直接子分类 ID
        const subCategories = await Category.findAll({
            where: { parent_id: parent_id },
            attributes: ['category_id'],
        });

        const subCategoryIds = subCategories.map((c) => c.category_id);

        // 如果没有子分类，直接返回空
        if (subCategoryIds.length === 0) {
            return res.json({
                total: 0,
                page: 1,
                pageSize: 10,
                list: [],
            });
        }

        // 分页参数
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(
            50,
            Math.max(1, parseInt(req.query.pageSize, 10) || 10)
        );
        const offset = (page - 1) * pageSize;

        // 查询这些子分类下的所有文章
        const { count, rows } = await Article.findAndCountAll({
            where: {
                category_id: { [Op.in]: subCategoryIds },
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
            distinct: true,
        });

        res.json({
            total: count,
            page,
            pageSize,
            list: rows,
        });
    } catch (error) {
        console.error('查询父分类下文章失败:', error);
        res.status(500).json({
            error: '服务器内部错误',
            detail:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
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

    // ===== 辅助函数（纯文本处理 + 句子提取）=====
    function stripHtml(html) {
        if (!html) return '';
        // 移除所有 HTML 标签，替换为单个空格
        return html
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function extractSentenceWithKeyword(text, keyword) {
        if (!text || !keyword) return '';

        // 支持的句子结束符（中文+英文）
        const sentenceEndings = /[。.？?!！]/g;
        const sentences = [];
        let start = 0;
        let match;

        // 重置 lastIndex（防止全局正则残留状态）
        sentenceEndings.lastIndex = 0;

        while ((match = sentenceEndings.exec(text)) !== null) {
            const end = match.index + 1;
            const sentence = text.substring(start, end).trim();
            if (sentence) sentences.push(sentence);
            start = end;
        }

        // 处理最后一段（可能没有结束标点）
        if (start < text.length) {
            const lastPart = text.substring(start).trim();
            if (lastPart) sentences.push(lastPart);
        }

        // 转义关键词用于安全正则匹配
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedKeyword, 'i'); // 不区分大小写

        // 查找第一个包含关键词的句子
        for (const sentence of sentences) {
            if (regex.test(sentence)) {
                return sentence;
            }
        }

        // 降级：返回前80字符
        return text.length > 80 ? text.substring(0, 80) + '...' : text;
    }

    // 高亮函数（支持正则特殊字符转义）
    const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const highlight = (txt, key) => {
        if (!txt || !key) return txt || '';
        const escapedKey = escapeRegExp(key);
        const regex = new RegExp(`(${escapedKey})`, 'gi');
        return txt.replace(regex, '<mark>$1</mark>');
    };
    // ============================================

    try {
        let results;
        const isShortWord = replacedQ.length <= 2;
        const wantPublishedOnly = req.query.status === 'published';

        if (isShortWord) {
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
                    'source',
                    'editor',
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
            console.log(`[SEARCH] 使用 FULLTEXT 模式: ${replacedQ}`);

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
                    'source',
                    'editor',
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

        // 处理结果：提取句子 + 高亮
        const list = results.rows.map((row) => {
            const data = row.toJSON();

            //去除 HTML 标签
            const plainText = stripHtml(data.content || '');

            // 提取包含关键词的完整句子
            const sentence = extractSentenceWithKeyword(plainText, replacedQ);

            //  高亮关键词
            const highlightedTitle = highlight(data.title || '', replacedQ);
            const highlightedContent = highlight(sentence, replacedQ);

            return {
                ...data,
                title: highlightedTitle,
                content: highlightedContent, //  只返回命中的句子
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
