const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ArticleVersion extends Model {}
    ArticleVersion.init(
        {
            version_id: {
                type: DataTypes.BIGINT,
                autoIncrement: true,
                primaryKey: true,
                comment: '版本记录的唯一标识符',
            },
            article_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: '关联的文章ID',
                references: {
                    model: 'articles',
                    key: 'article_id',
                },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: '编辑者用户ID',
                references: {
                    model: 'users',
                    key: 'user_id',
                },
                onDelete: 'RESTRICT',
                onUpdate: 'CASCADE',
            },
            version_number: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: '版本号 从1开始递增 表示文章的修订次序',
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: '文章标题的快照',
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: '文章内容的完整快照',
            },
            editor: {
                type: DataTypes.STRING(255),
                allowNull: true,
                comment: '编辑者姓名或用户标识',
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                comment: '版本创建时间戳',
            },
        },
        {
            sequelize,
            modelName: 'ArticleVersion',
            tableName: 'articleversion',
            timestamps: false,
            indexes: [
                {
                    unique: true,
                    fields: ['article_id', 'version_number'],
                    name: 'unique_article_version',
                    comment: '确保同一文章的每个版本号唯一',
                },
            ],
        }
    );
    return ArticleVersion;
};
