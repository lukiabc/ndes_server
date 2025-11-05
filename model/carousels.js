const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Carousel extends Model {}
    Carousel.init(
        {
            carousel_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false,
                comment: '轮播图ID',
            },
            article_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: '关联的文章ID',
            },
            cover_image: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: '轮播封面图URL（可冗余存储，避免每次JOIN查）',
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: '轮播标题（可冗余，提升性能）',
            },
            sort_order: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                comment: '排序值，越小越靠前',
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                comment: '是否启用',
            },
            start_play_date: {
                type: DataTypes.DATEONLY,
                allowNull: true,
                comment: '轮播图开始播放日期',
            },
            end_play_date: {
                type: DataTypes.DATEONLY,
                allowNull: true,
                comment: '轮播图结束播放日期',
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                comment: '创建时间',
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                onUpdate: DataTypes.NOW,
                comment: '更新时间',
            },
        },
        {
            sequelize,
            modelName: 'Carousel',
            tableName: 'carousels',
            timestamps: true,
            updatedAt: 'updated_at',
            createdAt: 'created_at',
            indexes: [
                {
                    unique: true,
                    fields: ['article_id'],
                },
            ],
        }
    );

    return Carousel;
};
