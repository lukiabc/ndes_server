const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Article, Reviews, User } = require('../utils/db');
const { sequelize } = require('../utils/db');

// 审核
router.post('/:article_id', async (req, res) => {
    const article_id = parseInt(req.params.article_id);
    const { reviewer, review_result, review_comments } = req.body;

    console.log('\n========== [DEBUG] 人工审核开始 ==========');
    console.log('[审核] 文章ID:', article_id);
    console.log('[审核] 审核人:', reviewer);
    console.log('[审核] 审核结果:', review_result);
    console.log('[审核] 审核意见:', review_comments);

    // 校验参数
    if (!['通过', '拒绝', '退回修订'].includes(review_result)) {
        console.log('[审核] ❌ 审核结果非法');
        console.log('========== [DEBUG] 人工审核结束 ==========\n');
        return res.status(400).json({
            error: '审核结果非法，仅支持：通过、拒绝、退回修订',
        });
    }

    const t = await sequelize.transaction();
    try {
        // 获取文章信息
        const article = await Article.findOne({
            where: { article_id, status: '待审' },
            transaction: t,
        });

        if (!article) {
            console.log('[审核] ❌ 文章不存在或状态不是待审');
            console.log('========== [DEBUG] 人工审核结束 ==========\n');
            throw new Error('文章不存在或状态不是待审');
        }

        console.log('[审核] 文章标题:', article.title);
        console.log('[审核] 定时发布时间:', article.scheduled_publish_date);

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
        console.log('[审核] ✓ 审核记录已保存');

        let newStatus = '';
        let publish_date = null;

        // 根据审核结果决定文章状态
        if (review_result === '通过') {
            // 检查是否有定时发布时间
            if (article.scheduled_publish_date) {
                const scheduledTime = new Date(article.scheduled_publish_date);
                const now = new Date();

                console.log(
                    '[审核] 对比时间 - 定时发布:',
                    scheduledTime.toISOString()
                );
                console.log('[审核] 对比时间 - 当前时间:', now.toISOString());

                if (scheduledTime > now) {
                    // 定时发布时间还未到 -> 待发布
                    newStatus = '待发布';
                    console.log(
                        '[审核] ✓ 审核通过，定时发布时间未到，状态设为：待发布'
                    );
                } else {
                    // 定时发布时间已过 -> 立即发布
                    newStatus = '已发布';
                    publish_date = now;
                    console.log(
                        '[审核] ✓ 审核通过，定时发布时间已到，立即发布'
                    );
                }
            } else {
                // 没有定时发布时间 -> 立即发布
                newStatus = '已发布';
                publish_date = new Date();
                console.log('[审核] ✓ 审核通过，无定时发布，立即发布');
            }
        } else if (review_result === '拒绝') {
            newStatus = '拒绝';
            console.log('[审核] ❌ 审核拒绝，状态设为：拒绝');
        } else if (review_result === '退回修订') {
            newStatus = '退回修订';
            console.log('[审核] ↩️  退回修订，状态设为：退回修订');
        }

        // 更新文章状态
        const updateData = { status: newStatus };
        if (publish_date) {
            updateData.publish_date = publish_date;
            console.log('[审核] 设置发布时间:', publish_date.toISOString());
        }

        await article.update(updateData, { transaction: t });
        console.log('[审核] ✓ 文章状态已更新');

        await t.commit();

        console.log('[审核结果] 最终状态:', newStatus);
        console.log('========== [DEBUG] 人工审核结束 ==========\n');

        res.json({
            message: '审核完成',
            review_result,
            newStatus,
            publish_date,
        });
    } catch (e) {
        await t.rollback();
        console.error('[审核] ❌ 审核失败:', e.message);
        console.log('========== [DEBUG] 人工审核结束 ==========\n');
        res.status(500).json({ error: '审核失败: ' + e.message });
    }
});

// 获取审核记录列表
router.get('/recordsList', async (req, res) => {
    try {
        const {
            page = 1,
            pageSize = 10,
            article_title,
            review_result,
            reviewer_id,
            article_id,
        } = req.query;

        const limit = parseInt(pageSize);
        const offset = (parseInt(page) - 1) * limit;

        // 构建 where 条件
        const where = {};

        // 审核结果筛选
        if (review_result) {
            where.review_result = review_result;
        }

        // 审核人筛选
        if (reviewer_id) {
            where.reviewer = parseInt(reviewer_id);
        }

        // 文章ID筛选
        if (article_id) {
            where.article_id = parseInt(article_id);
        }

        const { count, rows } = await Reviews.findAndCountAll({
            where,
            limit,
            offset,
            order: [['review_time', 'DESC']],
            include: [
                {
                    model: Article,
                    attributes: ['title'],
                },
                {
                    model: User,
                    as: 'Reviewer',
                    attributes: ['username'],
                },
            ],
        });

        res.json({
            code: 200,
            message: 'success',
            data: {
                total: count,
                page: parseInt(page),
                pageSize: limit,
                list: rows,
            },
        });
    } catch (e) {
        console.error('获取审核记录列表失败:', e);
        res.status(500).json({ error: '获取审核记录失败: ' + e.message });
    }
});

router.get('/', function (req, res, next) {
    res.render('reviews', { title: '审核记录' });
});

module.exports = router;
