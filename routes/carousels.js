const express = require('express');
const router = express.Router();
const { sequelize, Carousel, Article } = require('../utils/db');
const { Op } = require('sequelize');

// 获取本地日期字符串
function getLocalDateStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 获取启用的轮播图列表
router.get('/active', async (req, res) => {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

    try {
        const carousels = await Carousel.findAll({
            where: {
                is_active: true,
                [Op.and]: [
                    // 开始时间：为空 或 <= today
                    {
                        [Op.or]: [
                            { start_play_date: null },
                            { start_play_date: { [Op.lte]: today } },
                        ],
                    },
                    // 结束时间：为空 或 >= today
                    {
                        [Op.or]: [
                            { end_play_date: null },
                            { end_play_date: { [Op.gte]: today } },
                        ],
                    },
                ],
            },
            order: [['sort_order', 'ASC']],
            attributes: [
                'carousel_id',
                'article_id',
                'cover_image',
                'title',
                'sort_order',
                'is_active',
                'start_play_date',
                'end_play_date',
                'created_at',
                'updated_at',
            ],
            include: [
                {
                    model: Article,
                    as: 'Article',
                    attributes: ['article_id', 'title', 'publish_date'],
                },
            ],
        });

        const list = carousels.map((c) => {
            const data = c.toJSON();
            return {
                carousel_id: data.carousel_id,
                article_id: data.article_id,
                cover_image: data.cover_image,
                title: data.title,
                sort_order: data.sort_order,
                is_active: data.is_active,
                start_play_date: data.start_play_date,
                end_play_date: data.end_play_date,
                created_at: data.created_at,
                updated_at: data.updated_at,
                article: {
                    article_id: data.Article?.article_id,
                    title: data.Article?.title,
                    publish_date: data.Article?.publish_date,
                },
            };
        });

        res.json({ list });
    } catch (error) {
        console.error('获取启用的轮播图失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 获取轮播图列表
router.get('/list', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
        50,
        Math.max(1, parseInt(req.query.pageSize) || 10)
    );
    const offset = (page - 1) * pageSize;

    try {
        const result = await Carousel.findAndCountAll({
            order: [['sort_order', 'ASC']],
            limit: pageSize,
            offset,
            attributes: [
                'carousel_id',
                'article_id',
                'cover_image',
                'title',
                'sort_order',
                'is_active',
                'start_play_date',
                'end_play_date',
                'created_at',
                'updated_at',
            ],
            include: [
                {
                    model: Article,
                    as: 'Article',
                    attributes: ['article_id', 'title'],
                },
            ],
        });

        res.json({
            total: result.count,
            page,
            pageSize,
            list: result.rows.map((row) => row.toJSON()),
        });
    } catch (error) {
        console.error('获取轮播图列表失败:', error);
        res.status(500).json({ error: '查询失败' });
    }
});

// 创建轮播图
router.post('/create', async (req, res) => {
    const {
        article_id,
        cover_image,
        title,
        sort_order = 0,
        is_active = true,
        start_play_date,
        end_play_date,
    } = req.body;

    if (!article_id || !cover_image || !title) {
        return res
            .status(400)
            .json({ error: 'article_id、cover_image、title 为必填项' });
    }

    const articleId = parseInt(article_id);
    if (isNaN(articleId)) {
        return res.status(400).json({ error: '无效的 article_id' });
    }

    // 校验日期格式
    const isValidDate = (dateStr) => {
        if (!dateStr) return true; // 允许为空
        const d = new Date(dateStr);
        return (
            d instanceof Date &&
            !isNaN(d) &&
            /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
        );
    };

    if (!isValidDate(start_play_date)) {
        return res
            .status(400)
            .json({ error: 'start_play_date 格式应为 YYYY-MM-DD 或留空' });
    }
    if (!isValidDate(end_play_date)) {
        return res
            .status(400)
            .json({ error: 'end_play_date 格式应为 YYYY-MM-DD 或留空' });
    }

    // 检查文章是否存在
    const article = await Article.findByPk(articleId);
    if (!article) {
        return res.status(400).json({ error: '关联的文章不存在' });
    }

    // 检查是否已存在该 article_id 的轮播图
    const exists = await Carousel.findOne({ where: { article_id: articleId } });
    if (exists) {
        return res.status(400).json({ error: '该文章已存在于轮播图中' });
    }

    // 检查当天已有的启用轮播图数量
    if (is_active) {
        let targetDate = getLocalDateStr(); // 默认使用当前日期

        if (start_play_date) {
            targetDate = start_play_date;
        }

        const activeCount = await Carousel.count({
            where: {
                is_active: true,
                [Op.or]: [
                    { start_play_date: null },
                    { start_play_date: { [Op.lte]: targetDate } },
                ],
                [Op.or]: [
                    { end_play_date: null },
                    { end_play_date: { [Op.gte]: targetDate } },
                ],
            },
        });

        if (activeCount >= 5) {
            return res
                .status(400)
                .json({ error: '所选日期已达到最大轮播图数量限制（最多5个）' });
        }
    }

    try {
        const carousel = await Carousel.create({
            article_id: articleId,
            cover_image,
            title,
            sort_order: parseInt(sort_order) || 0,
            is_active: Boolean(is_active),
            start_play_date: start_play_date || null,
            end_play_date: end_play_date || null,
        });

        res.json({ message: '轮播图创建成功', carousel });
    } catch (error) {
        console.error('创建轮播图失败:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: '该文章已添加到轮播图' });
        }
        res.status(500).json({ error: '创建失败' });
    }
});

// 更新轮播图
router.put('/edit/:carousel_id', async (req, res) => {
    const carousel_id = parseInt(req.params.carousel_id);
    if (isNaN(carousel_id)) {
        return res.status(400).json({ error: '无效的轮播图 ID' });
    }

    const {
        article_id,
        cover_image,
        title,
        sort_order,
        is_active,
        start_play_date,
        end_play_date,
    } = req.body;

    const carousel = await Carousel.findByPk(carousel_id);
    if (!carousel) {
        return res.status(404).json({ error: '轮播图不存在' });
    }

    // 日期格式校验
    const isValidDate = (dateStr) => {
        if (dateStr === undefined || dateStr === null) return true;
        return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr));
    };

    if (!isValidDate(start_play_date)) {
        return res
            .status(400)
            .json({ error: 'start_play_date 格式应为 YYYY-MM-DD 或 null' });
    }
    if (!isValidDate(end_play_date)) {
        return res
            .status(400)
            .json({ error: 'end_play_date 格式应为 YYYY-MM-DD 或 null' });
    }

    // 处理 article_id 变更
    let newArticleId = carousel.article_id;
    if (article_id !== undefined) {
        newArticleId = parseInt(article_id);
        if (isNaN(newArticleId)) {
            return res.status(400).json({ error: '无效的 article_id' });
        }
        const article = await Article.findByPk(newArticleId);
        if (!article) {
            return res.status(400).json({ error: '关联的文章不存在' });
        }
        const conflict = await Carousel.findOne({
            where: {
                article_id: newArticleId,
                carousel_id: { [Op.ne]: carousel_id },
            },
        });
        if (conflict) {
            return res.status(400).json({ error: '该文章已被其他轮播图使用' });
        }
    }

    // is_active=true 则需检查数量限制
    const willBeActive =
        is_active !== undefined ? Boolean(is_active) : carousel.is_active;

    if (willBeActive) {
        // 确定目标日期：优先使用传入的 start_play_date，否则用原记录的，再否则用今天
        let targetDate = getLocalDateStr(); // 默认今天

        if (start_play_date !== undefined) {
            // 如果用户明确传了 start_play_date（包括传 null），以传入值为准
            if (start_play_date) {
                targetDate = start_play_date;
            }
        } else {
            // 用户没传 start_play_date，沿用原值（如果原值存在）
            if (carousel.start_play_date) {
                targetDate = carousel.start_play_date;
            }
        }

        const activeCount = await Carousel.count({
            where: {
                is_active: true,
                carousel_id: { [Op.ne]: carousel_id }, // 排除自己
                [Op.or]: [
                    { start_play_date: null },
                    { start_play_date: { [Op.lte]: targetDate } },
                ],
                [Op.or]: [
                    { end_play_date: null },
                    { end_play_date: { [Op.gte]: targetDate } },
                ],
            },
        });

        if (activeCount >= 5) {
            return res
                .status(400)
                .json({ error: '所选日期已达到最大轮播图数量限制（最多5个）' });
        }
    }

    try {
        await carousel.update({
            article_id: newArticleId,
            cover_image:
                cover_image !== undefined ? cover_image : carousel.cover_image,
            title: title !== undefined ? title : carousel.title,
            sort_order:
                sort_order !== undefined
                    ? parseInt(sort_order)
                    : carousel.sort_order,
            is_active: willBeActive,
            start_play_date:
                start_play_date !== undefined
                    ? start_play_date || null
                    : carousel.start_play_date,
            end_play_date:
                end_play_date !== undefined
                    ? end_play_date || null
                    : carousel.end_play_date,
        });

        res.json({ message: '更新成功', carousel });
    } catch (error) {
        console.error('更新轮播图失败:', error);
        res.status(500).json({ error: '更新失败' });
    }
});

//删除轮播图
router.delete('/delete/:carousel_id', async (req, res) => {
    const carousel_id = parseInt(req.params.carousel_id);
    if (isNaN(carousel_id)) {
        return res.status(400).json({ error: '无效的轮播图 ID' });
    }

    try {
        const deleted = await Carousel.destroy({ where: { carousel_id } });
        if (deleted === 0) {
            return res.status(404).json({ error: '轮播图不存在' });
        }
        res.json({ message: '删除成功' });
    } catch (error) {
        console.error('删除轮播图失败:', error);
        res.status(500).json({ error: '删除失败' });
    }
});

module.exports = router;
