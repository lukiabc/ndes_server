const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Article extends Model {}

    Article.init(
        {
            article_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                comment: '文章ID 自增',
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: '文章作者ID,外键',
                references: {
                    model: 'users',
                    key: 'user_id',
                },
                onDelete: 'RESTRICT',
                onUpdate: 'CASCADE',
            },
            category_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: '分类ID,外键',
                references: {
                    model: 'categories',
                    key: 'category_id',
                },
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: '文章标题',
            },
            source: {
                type: DataTypes.STRING(255),
                allowNull: true,
                comment: '来源',
            },
            editor: {
                type: DataTypes.STRING(255),
                allowNull: true,
                comment: '责任编辑',
            },
            publish_date: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: '实际发布时间，文章正式上线的时间',
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: '文章内容',
            },
            status: {
                type: DataTypes.ENUM(
                    '草稿',
                    '待审',
                    '待发布',
                    '已发布',
                    '退回修订',
                    '拒绝'
                ),
                defaultValue: '草稿',
                comment: '稿件状态',
            },
            scheduled_publish_date: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: '计划发布时间，可为空表示立即发布',
            },
        },
        {
            sequelize,
            modelName: 'Article',
            tableName: 'articles',
            timestamps: false,
        }
    );

    return Article;
};
