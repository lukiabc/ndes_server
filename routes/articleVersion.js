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
            order: [
                ['article_id', 'ASC'],
                ['version_number', 'DESC'],
            ],
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

// 根据用户ID获取文章版本列表
router.get('/user/:user_id', async (req, res) => {
    const user_id = parseInt(req.params.user_id);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    if (isNaN(user_id) || user_id <= 0) {
        return res.status(400).json({ error: '无效的用户 ID' });
    }

    try {
        // 查出用户编辑过、且文章是草稿的所有版本
        const versions = await ArticleVersion.findAll({
            where: { user_id },
            include: [
                {
                    model: Article,
                    as: 'Article',
                    where: { status: '草稿' },
                    attributes: ['article_id', 'title', 'status'],
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
            order: [
                ['article_id', 'ASC'],
                ['version_number', 'DESC'],
            ],
            limit,
            offset,
        });

        if (versions.length === 0) {
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

        // 提取所有涉及的 article_id
        const articleIds = [...new Set(versions.map((v) => v.article_id))];

        // 批量统计每个 article_id 的总版本数
        const counts = await ArticleVersion.findAll({
            where: { article_id: articleIds },
            attributes: [
                'article_id',
                [sequelize.fn('COUNT', sequelize.col('version_id')), 'total'],
            ],
            group: ['article_id'],
            raw: true,
        });

        const totalMap = {};
        counts.forEach((row) => {
            totalMap[row.article_id] = parseInt(row.total, 10);
        });

        // 合并数据：包含 article 对象
        const enrichedVersions = versions.map((v) => ({
            version_id: v.version_id,
            article_id: v.article_id,
            user_id: v.user_id,
            version_number: v.version_number,
            title: v.title,
            editor: v.editor,
            content: v.content,
            created_at: v.created_at,
            total_versions: totalMap[v.article_id] || 1,
            article: {
                article_id: v.Article.article_id,
                title: v.Article.title,
                status: v.Article.status,
            },
        }));

        // 获取总数
        const totalCount = await ArticleVersion.count({
            where: { user_id },
            include: [
                {
                    model: Article,
                    as: 'Article',
                    where: { status: '草稿' },
                },
            ],
        });

        res.json({
            user_id,
            total_versions: totalCount,
            pagination: {
                current_page: page,
                page_size: limit,
                total_items: totalCount,
                total_pages: Math.ceil(totalCount / limit),
            },
            versions: enrichedVersions,
        });
    } catch (error) {
        console.error('查询用户可回溯版本失败:', error);
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

    const transaction = await sequelize.transaction();

    try {
        // 查询文章是否存在 & 状态是否为草稿
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
            order: [['version_number', 'DESC']],
            attributes: ['version_number'],
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
                created_at: new Date(),
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
            attributes: ['version_number', 'created_at'],
        });

        if (!latest) {
            return res.status(404).json({ error: '无版本记录' });
        }

        res.json({
            article_id,
            latest_version: latest.version_number,
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
