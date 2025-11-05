const cron = require('node-cron');
const { Article, sequelize } = require('../utils/db');
const { Sequelize } = require('sequelize');

module.exports = () => {
    cron.schedule('*/1 * * * *', async () => {
        const nowUTC = new Date();
        const nowBeijing = new Date(nowUTC.getTime() + 8 * 60 * 60 * 1000); // 北京时间
        console.log(
            `[Scheduled Publish] 开始检查待发布文章: ${nowBeijing.toLocaleString(
                'zh-CN'
            )}`
        );

        // 检查并发布待发布文章
        const transaction = await sequelize.transaction();

        try {
            const articlesToPublish = await Article.findAll({
                where: {
                    status: '待发布',
                    scheduled_publish_date: {
                        [Sequelize.Op.lte]: nowBeijing, //  使用北京时间比较
                    },
                },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (articlesToPublish.length === 0) {
                await transaction.commit();
                console.log('[Scheduled Publish] 无待发布文章');
                return;
            }

            console.log(
                `[Scheduled Publish] 发现 ${articlesToPublish.length} 篇文章需要发布`
            );

            const updatePromises = articlesToPublish.map((article) =>
                article.update(
                    {
                        status: '已发布',
                        publish_date: nowBeijing,
                    },
                    { transaction }
                )
            );

            await Promise.all(updatePromises);
            await transaction.commit();

            console.log(
                `[Scheduled Publish] 成功发布 ${articlesToPublish.length} 篇文章`
            );
        } catch (error) {
            await transaction.rollback();
            console.error('[Scheduled Publish] 执行失败:', error);
        }
    });
};
