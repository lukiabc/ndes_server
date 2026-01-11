const cron = require('node-cron');
const { Article, sequelize } = require('../utils/db');
const { Sequelize } = require('sequelize');

/**
 * 定时任务模块
 * 用于定期检查并发布待发布的文章
 */
module.exports = () => {
    // 每分钟执行一次
    cron.schedule('*/1 * * * *', async () => {
        console.log(
            `[Scheduled Publish] 开始检查待发布文章: ${new Date().toLocaleString(
                'zh-CN'
            )}`
        );

        // 启动数据库事务：确保批量更新的原子性（要么全部成功，要么全部回滚）
        const transaction = await sequelize.transaction();

        try {
            // 检查所有满足条件的文章
            const articlesToPublish = await Article.findAll({
                where: {
                    status: '待发布',
                    scheduled_publish_date: {
                        [Sequelize.Op.lte]: new Date().toLocaleString('zh-CN'), //  使用当前时间比较
                    },
                },
                transaction,
                // 锁定更新行，防止并发任务重复处理同一篇文章
                lock: transaction.LOCK.UPDATE,
            });

            // 如果没有符合条件的文章，提交空事务并退出
            if (articlesToPublish.length === 0) {
                await transaction.commit();
                console.log('[Scheduled Publish] 无待发布文章');
                return;
            }

            console.log(
                `[Scheduled Publish] 发现 ${articlesToPublish.length} 篇文章需要发布`
            );

            // 构建批量更新 promise 将每篇文章状态改为“已发布”，并设置 publish_date
            const updatePromises = articlesToPublish.map((article) =>
                article.update(
                    {
                        status: '已发布',
                        publish_date: new Date().toLocaleString('zh-CN'),
                    },
                    { transaction }
                )
            );

            // 并发执行所有更新
            await Promise.all(updatePromises);
            // 提交事务 是所有更改生效
            await transaction.commit();

            console.log(
                `[Scheduled Publish] 成功发布 ${articlesToPublish.length} 篇文章`
            );
        } catch (error) {
            // 捕获异常，回滚事务
            await transaction.rollback();
            console.error('[Scheduled Publish] 执行失败:', error);
        }
    });
};
