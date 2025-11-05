const { DataTypes, Model, Sequelize } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Category extends Model {}
    Category.init(
        {
            category_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                comment: '分类ID，主键，自增',
            },
            parent_id: {
                type: DataTypes.INTEGER,
                defaultValue: null,
                comment: '父分类ID，null表示顶级分类',
            },
            category_name: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: '分类名称',
            },
            sort_order: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                comment: '同级排序，升序',
            },
        },
        {
            sequelize,
            modelName: 'Category',
            tableName: 'categories',
            timestamps: false,
        }
    );
    return Category;
};
