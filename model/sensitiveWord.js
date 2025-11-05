const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class SensitiveWord extends Model {}
    SensitiveWord.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                comment: '敏感词ID，主键自增',
            },
            word: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                comment: '敏感词内容，全局唯一',
            },
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                comment: '添加时间',
            },
            type: {
                type: DataTypes.ENUM('keyword', 'regex'),
                allowNull: false,
                defaultValue: 'keyword',
                comment: '敏感词类型，keyword:关键词，regex:正则表达式',
            },
        },
        {
            sequelize,
            modelName: 'SensitiveWord',
            tableName: 'sensitive_words',
            timestamps: false,
            underscored: true, // 下划线字段名
        }
    );
    return SensitiveWord;
};
