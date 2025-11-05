const { DataTypes, Model, Sequelize } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Role extends Model {}
    Role.init(
        {
            role_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                comment: '角色ID，主键，自增',
            },
            role_name: {
                type: DataTypes.STRING(50),
                allowNull: false,
                comment: '角色名称，如“管理员”或“发布者”',
            },
            permissions: {
                type: DataTypes.TEXT,
                allowNull: false,
                comment: '角色权限，存储为JSON格式的字符串',
            },
        },
        {
            sequelize,
            modelName: 'Role',
            tableName: 'roles',
            timestamps: false,
        }
    );
    return Role;
};
