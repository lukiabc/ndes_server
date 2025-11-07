const express = require('express');
const router = express.Router();
const { Article, Reviews, User } = require('../utils/db');
const { sequelize } = require('../utils/db');

// 审核
router.post('/:article_id', async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    const { reviewer, review_result, review_comments } = req.body;

    // 校验参数
    if (!['通过', '退回修改', '拒绝'].includes(review_result)) {
        return res.status(400).json({ error: '审核结果非法' });
    }

    const t = await sequelize.transaction();
    try {
        // 新增审核记录
        await Reviews.create(
            {
                article_id,
                reviewer,
                review_result,
                review_comments,
            },
            { transaction: t }
        );

        // 文章状态映射
        const statusMap = { 通过: '已发布', 退回修改: '草稿', 拒绝: '草稿' };
        const newStatus = statusMap[review_result];

        // 更新文章状态
        const [rows] = await Article.update(
            { status: newStatus },
            { where: { article_id, status: '待审' }, transaction: t }
        );
        if (rows === 0) throw new Error('文章状态不符或不存在');
        await t.commit();

        res.json({ message: '审核完成', review_result, newStatus });
    } catch (e) {
        await t.rollback();
        res.status(500).json({ error: '更新失败: ' + e.message });
    }
});

// 查询审核记录
router.get('/query/:article_id', async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    try {
        const list = await Reviews.findAll({
            where: { article_id },
            order: [['review_time', 'DESC']],
            include: [
                { model: User, as: 'Reviewer', attributes: ['username'] },
            ],
        });
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/', function (req, res, next) {
    res.render('reviews', { title: '审核记录' });
});

module.exports = router;
