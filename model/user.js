const { DataTypes, Model, Sequelize } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class User extends Model {}
    User.init(
        {
            user_id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                comment: '用户ID，主键，自增',
            },
            username: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                comment: '用户名，唯一',
            },
            password: {
                type: DataTypes.STRING(255),
                allowNull: false,
                comment: '用户密码',
            },
            email: {
                type: DataTypes.STRING(100),
                allowNull: true,
                comment: '用户邮箱地址，可选',
            },
            role_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: '角色ID，外键，关联角色表',
            },
            avatar_url: {
                type: DataTypes.STRING(255),
                allowNull: true,
                comment: '用户头像图片URL，可选',
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
                comment: '用户创建时间',
            },
            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
                comment: '用户更新时间',
            },
        },
        {
            sequelize,
            modelName: 'User',
            tableName: 'users',
            timestamps: false,
        }
    );
    return User;
};
