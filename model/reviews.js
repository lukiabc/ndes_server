const { DataTypes, Model, Sequelize } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Review extends Model {}
    Review.init(
        {
            review_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                comment: '审核记录ID，主键，自增',
            },
            article_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: '文章ID，外键',
            },
            reviewer: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: '审核人ID（users.user_id）',
            },
            review_result: {
                type: DataTypes.ENUM('通过', '退回修订', '拒绝'),
                allowNull: false,
                comment: '审核结果',
            },
            review_comments: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: '审核意见',
            },
            review_time: {
                type: DataTypes.DATE,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                comment: '审核时间，默认当前时间',
            },
        },
        {
            sequelize,
            modelName: 'Review',
            tableName: 'reviews',
            timestamps: false,
        }
    );
    return Review;
};
