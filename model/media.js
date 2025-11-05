const { DataTypes, Model, Sequelize } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Media extends Model {}
    Media.init(
        {
            media_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                comment: '多媒体ID，主键，自增',
            },
            article_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: '文章ID，外键',
            },
            media_type: {
                type: DataTypes.STRING(50),
                allowNull: true,
                comment: '媒体类型',
            },
            media_url: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: '媒体文件URL',
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: '媒体描述',
            },
        },
        {
            sequelize,
            modelName: 'Media',
            tableName: 'media',
            timestamps: false,
        }
    );
    return Media;
};
