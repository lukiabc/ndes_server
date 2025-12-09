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
            order: [['version_number', 'DESC']],
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
        const result = await ArticleVersion.findAndCountAll({
            where: { user_id },
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
            include: [
                {
                    model: Article,
                    as: 'Article',
                    attributes: ['article_id', 'title', 'status'],
                },
            ],
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset,
        });

        res.json({
            user_id,
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
                user_id: v.user_id,
                version_number: v.version_number,
                title: v.title,
                editor: v.editor,
                created_at: v.created_at,
                content: v.content,
                article: v.Article,
            })),
        });
    } catch (error) {
        console.error('查询用户文章版本失败:', error);
        res.status(500).json({ error: '服务器内部错误: ' + error.message });
    }
});

// 恢复到指定版本
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
            error: '无效的参数：article_id、version_number 或 user_id',
        });
    }

    const transaction = await sequelize.transaction();

    try {
        // 检查文章是否存在
        const article = await Article.findOne({
            where: { article_id },
            transaction,
        });
        if (!article) {
            await transaction.rollback();
            return res.status(404).json({ error: '文章未找到' });
        }

        // 查询指定的历史版本
        const targetVersion = await ArticleVersion.findOne({
            where: {
                article_id,
                version_number,
            },
            transaction,
        });

        if (!targetVersion) {
            await transaction.rollback();
            return res.status(404).json({ error: '指定的版本不存在' });
        }

        // 更新文章内容为该版本的内容
        await Article.update(
            {
                title: targetVersion.title,
                content: targetVersion.content,
                editor: targetVersion.editor || article.editor,
                status: '待审', // 恢复后需重新审核（也可根据业务设为“草稿”）
                publish_date: null,
                scheduled_publish_date: null,
            },
            {
                where: { article_id },
                transaction,
            }
        );

        // 记录一次新的版本
        const lastVersion = await ArticleVersion.findOne({
            where: { article_id },
            order: [['version_number', 'DESC']],
            transaction,
        });

        const newVersionNumber = lastVersion
            ? lastVersion.version_number + 1
            : 1;

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
            message: `已成功恢复到版本 v${version_number}，新版本号为 v${newVersionNumber}`,
            newVersion: newVersionNumber,
        });
    } catch (error) {
        await transaction.rollback();
        console.error('版本回溯失败:', error);
        res.status(500).json({ error: '恢复失败: ' + error.message });
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
