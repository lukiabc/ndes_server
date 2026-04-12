var express = require('express');
var router = express.Router();
const { sequelize, Article, ArticleVersion } = require('../utils/db');

// 历史版本列表
router.get('/list/:article_id', async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    if (isNaN(article_id)) {
        return res.status(400).json({ error: '无效的 article_id' });
    }

    try {
        const result = await ArticleVersion.findAndCountAll({
            where: { article_id },
            attributes: [
                'version_id',
                'article_id',
                'version_number',
                'title',
                'editor',
                'content',
                'created_at',
            ],
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset,
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ message: '该文章暂无历史版本' });
        }

        res.json({
            article_id,
            total_versions: result.count,
            pagination: {
                current_page: page,
                page_size: limit,
                total_items: result.count,
                total_pages: Math.ceil(result.count / limit),
            },
            versions: result.rows.map((v) => ({
                version_id: v.version_id,
                article_id: v.article_id,
                version_number: v.version_number,
                title: v.title,
                editor: v.editor,
                created_at: v.created_at,
                content: v.content,
            })),
        });
    } catch (error) {
        console.error('查询历史版本失败:', error);
        res.status(500).json({ error: '服务器内部错误: ' + error.message });
    }
});

//根据用户ID获取文章版本列表（仅包含非最新且版本号>=2的历史版本）
router.get('/user/:user_id', async (req, res) => {
    const user_id = parseInt(req.params.user_id);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    if (isNaN(user_id) || user_id <= 0) {
        return res.status(400).json({ error: '无效的用户 ID' });
    }

    try {
        // 1. 第一步：找出该用户参与过哪些文章（用于后续筛选）
        // 这里我们不再直接分页，而是先获取该用户涉及的所有文章ID
        const userVersionRecords = await ArticleVersion.findAll({
            where: { user_id },
            attributes: ['article_id'],
            raw: true,
        });

        const articleIds = [
            ...new Set(userVersionRecords.map((v) => v.article_id)),
        ];

        // 如果用户没有任何版本记录，直接返回空
        if (articleIds.length === 0) {
            return res.json({
                user_id,
                total_versions: 0,
                pagination: {
                    current_page: page,
                    page_size: limit,
                    total_items: 0,
                    total_pages: 0,
                },
                versions: [],
            });
        }

        // 2. 第二步：针对这些文章，找出所有非最新、且版本号>=2的版本
        // 我们需要先知道每篇文章的最新版本号是多少
        const latestVersionSubQuery = `
      SELECT article_id, MAX(version_number) as max_version 
      FROM ArticleVersions 
      WHERE article_id IN (${articleIds.join(',')})
      GROUP BY article_id
    `;

        // 查询符合条件的版本（版本号 >= 2 且 < 最新版本号）
        // 使用 Sequelize.raw 或直接使用 query（为了逻辑清晰，这里使用 findAll 配合复杂 where）
        // 由于 Sequelize 处理跨表聚合比较复杂，这里推荐使用 raw query 或分步查询
        // 为了保持代码结构，我们采用分步查询逻辑：

        let allEligibleVersions = [];

        // 遍历每篇文章，查询其历史版本（倒数第二版及更早的版本）
        for (const aid of articleIds) {
            const versions = await ArticleVersion.findAll({
                where: { article_id: aid },
                include: [
                    {
                        model: Article,
                        as: 'Article',
                        attributes: ['article_id', 'title', 'status'],
                        // 确保文章状态是草稿
                        where: { status: '草稿' },
                    },
                ],
                attributes: [
                    'version_id',
                    'article_id',
                    'user_id',
                    'version_number',
                    'title',
                    'editor',
                    'content',
                    'created_at',
                ],
                order: [['created_at', 'DESC']],
                // 关键逻辑：查询版本号 >= 2 且 不是最新版的数据
                // 我们需要先查出最新版，然后 offset 1 limit 999 (或者直接在 SQL 中写 version_number < max)
            });

            // 过滤掉最新版本（即 versions[0] 是最新版，我们不要）
            // 并且只保留 version_number >= 2 的
            const historicalVersions =
                versions.length >= 2 ? versions.slice(1) : [];

            allEligibleVersions =
                allEligibleVersions.concat(historicalVersions);
        }
        // 合并所有版本后，按创建时间降序排序
        allEligibleVersions.sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });

        // 3. 第三步：处理分页（因为我们是在内存中聚合了多篇文章的数据，需要手动分页）
        const totalCount = allEligibleVersions.length;
        const paginatedVersions = allEligibleVersions.slice(
            offset,
            offset + limit
        );

        // 4. 第四步：构建返回数据
        if (paginatedVersions.length === 0) {
            return res.json({
                user_id,
                total_versions: totalCount,
                pagination: {
                    current_page: page,
                    page_size: limit,
                    total_items: totalCount,
                    total_pages: Math.ceil(totalCount / limit) || 1,
                },
                versions: [],
            });
        }

        // 构建最终响应结构
        res.json({
            user_id,
            total_versions: totalCount,
            pagination: {
                current_page: page,
                page_size: limit,
                total_items: totalCount,
                total_pages: Math.ceil(totalCount / limit),
            },
            versions: paginatedVersions.map((v) => ({
                version_id: v.version_id,
                article_id: v.article_id,
                user_id: v.user_id,
                version_number: v.version_number,
                title: v.title,
                editor: v.editor,
                content: v.content,
                created_at: v.created_at,
                // 如果需要 total_versions 字段，可以额外查询或计算
                article: {
                    article_id: v.Article.article_id,
                    title: v.Article.title,
                    status: v.Article.status,
                },
            })),
        });
    } catch (error) {
        console.error('查询用户历史版本失败:', error);
        res.status(500).json({ error: '服务器内部错误: ' + error.message });
    }
});

// 恢复到指定版本  仅允许草稿状态的文章回溯
router.put('/revert/:article_id', async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    const { version_number, user_id } = req.body;

    if (
        isNaN(article_id) ||
        !version_number ||
        version_number < 1 ||
        !user_id
    ) {
        return res.status(400).json({
            error: '缺少必要参数：article_id、version_number 或 user_id',
        });
    }

    // 检查目标版本是否存在
    const transaction = await sequelize.transaction();

    try {
        // 查询文章是否存在且状态是否为草稿
        const article = await Article.findOne({
            where: { article_id },
            attributes: ['article_id', 'title', 'status', 'editor'],
            transaction,
        });

        if (!article) {
            await transaction.rollback();
            return res.status(404).json({ error: '文章未找到' });
        }

        if (article.status !== '草稿') {
            await transaction.rollback();
            return res.status(403).json({
                error: `仅“草稿”状态的文章允许版本回溯，当前状态为：${article.status}`,
            });
        }

        // 检查版本总数是否 ≥2
        const versionCount = await ArticleVersion.count({
            where: { article_id },
            transaction,
        });

        if (versionCount < 2) {
            await transaction.rollback();
            return res.status(400).json({
                error: '文章版本数不足，无法执行回溯操作',
                hint: '至少需要两个历史版本才能回溯',
            });
        }

        // 查找目标版本
        const targetVersion = await ArticleVersion.findOne({
            where: { article_id, version_number },
            transaction,
        });

        if (!targetVersion) {
            await transaction.rollback();
            return res.status(404).json({ error: '指定的版本不存在' });
        }

        //  获取当前最新版本号
        const latestVersion = await ArticleVersion.findOne({
            where: { article_id },
            order: [['created_at', 'DESC']],
            attributes: ['version_id', 'version_number', 'created_at'],
            transaction,
        });

        // 禁止回溯到最新版本
        if (targetVersion.version_number === latestVersion.version_number) {
            await transaction.rollback();
            return res.status(400).json({
                error: '无法回溯到当前最新版本',
                hint: '请选择更早的历史版本',
            });
        }

        //更新文章内容
        await Article.update(
            {
                title: targetVersion.title,
                content: targetVersion.content,
                editor: targetVersion.editor || article.editor,
                status: '草稿',
                publish_date: null,
                scheduled_publish_date: null,
            },
            { where: { article_id }, transaction }
        );

        // 创建新版本
        const newVersionNumber = latestVersion.version_number + 1;
        await ArticleVersion.create(
            {
                article_id,
                user_id,
                version_number: newVersionNumber,
                title: targetVersion.title,
                content: targetVersion.content,
                editor: req.body.editor || 'system',
            },
            { transaction }
        );

        await transaction.commit();

        res.json({
            message: `已成功回溯到 v${version_number}，并生成新草稿版本 v${newVersionNumber}`,
            newVersion: newVersionNumber,
        });
    } catch (error) {
        await transaction.rollback();
        console.error('版本回溯失败:', error);
        res.status(500).json({ error: '服务器内部错误，请稍后再试' });
    }
});

// 获取指定版本详情
router.get('/:version_id', async (req, res) => {
    const version_id = parseInt(req.params.version_id);
    if (isNaN(version_id)) {
        return res.status(400).json({ error: '无效的 version_id' });
    }

    try {
        const version = await ArticleVersion.findOne({
            where: { version_id },
            include: [
                {
                    model: Article,
                    as: 'Article',
                    attributes: ['article_id', 'title', 'status'],
                },
            ],
        });

        if (!version) {
            return res.status(404).json({ error: '版本未找到' });
        }

        res.json({
            version_id: version.version_id,
            article_id: version.article_id,
            user_id: version.user_id,
            version_number: version.version_number,
            title: version.title,
            editor: version.editor,
            content: version.content,
            created_at: version.created_at,
            article: version.Article,
        });
    } catch (error) {
        console.error('获取版本详情失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 获取文章最新版本号
router.get('/latest/:article_id', async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    if (isNaN(article_id)) {
        return res.status(400).json({ error: '无效的 article_id' });
    }

    try {
        const latest = await ArticleVersion.findOne({
            where: { article_id },
            order: [['version_number', 'DESC']],
            attributes: ['version_id', 'version_number', 'created_at'],
        });

        if (!latest) {
            return res.status(404).json({ error: '无版本记录' });
        }

        res.json({
            article_id,
            latest_version: latest.version_number,
            version_id: latest.version_id,
            created_at: latest.created_at,
        });
    } catch (error) {
        res.status(500).json({ error: '查询失败' });
    }
});

router.get('/', function (req, res, next) {
    res.render('articleVersion', { title: 'Article Version' });
});

module.exports = router;
