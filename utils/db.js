const { Sequelize } = require('sequelize');
// 数据库连接配置
const sequelize = new Sequelize('ndes_db', 'root', '127280', {
    host: 'localhost',
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});

const User = require('../model/user')(sequelize, Sequelize);
const Role = require('../model/role')(sequelize, Sequelize);
const Article = require('../model/article')(sequelize, Sequelize);
const Media = require('../model/media')(sequelize, Sequelize);
const Category = require('../model/category')(sequelize, Sequelize);
const Reviews = require('../model/reviews')(sequelize, Sequelize);
const SensitiveWord = require('../model/sensitiveWord')(sequelize, Sequelize);
const ArticleVersion = require('../model/articleVersion')(sequelize, Sequelize);
const Carousel = require('../model/carousels')(sequelize, Sequelize);

// 关联 User 和 Role
User.belongsTo(Role, { foreignKey: 'role_id' });

// 用户 和 文章（一对多）
User.hasMany(Article, {
    foreignKey: 'user_id',
    as: 'Articles',
});
Article.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'Author',
});

// 用户 和 文章版本（一对多）
User.hasMany(ArticleVersion, {
    foreignKey: 'user_id',
    as: 'EditedVersions',
});
ArticleVersion.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'EditorUser',
});

// 关联 Article 和 Media
Article.hasMany(Media, { foreignKey: 'article_id' });
Media.belongsTo(Article, { foreignKey: 'article_id' });

// 用户 和 审核记录 一对多
User.hasMany(Reviews, {
    foreignKey: 'reviewer', // 外键字段名
    sourceKey: 'user_id', // 源表中的主键/关联字段名
    onDelete: 'CASCADE', // 当用户被删除时，其所有审核记录也自动删除
    onUpdate: 'CASCADE', // 如果 reviewer 字段被更新（不常见），审核记录也更新
});
Reviews.belongsTo(User, {
    foreignKey: 'reviewer',
    targetKey: 'user_id',
    as: 'Reviewer',
});

// 文章 和 审核记录 一对多
Article.hasMany(Reviews, {
    foreignKey: 'article_id',
    sourceKey: 'article_id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
});
Reviews.belongsTo(Article, {
    foreignKey: 'article_id',
    targetKey: 'article_id',
});

// 文章 和 分类
Article.belongsTo(Category, {
    foreignKey: 'category_id',
    as: 'Category',
});

//父分类和子分类自联
Category.belongsTo(Category, {
    as: 'ParentCategory',
    foreignKey: 'parent_id',
    targetKey: 'category_id',
});

// 一篇文章 可以有多个版本
Article.hasMany(ArticleVersion, {
    foreignKey: 'article_id', // ArticleVersion 表中的外键字段名
    sourceKey: 'article_id', // Article 表中的主键/关联字段名
    as: 'Versions',
    onDelete: 'CASCADE', // 当文章被删除时，其所有版本也自动删除
    onUpdate: 'CASCADE', // 如果 article_id 被更新（不常见），版本记录也更新
});

// 每个版本都属于某一篇文章
ArticleVersion.belongsTo(Article, {
    foreignKey: 'article_id', // ArticleVersion 表中的外键字段名
    targetKey: 'article_id', // Article 表中的目标字段名（通常是主键）
    as: 'Article',
});

//轮播图 和 文章
Carousel.belongsTo(Article, {
    foreignKey: 'article_id',
    as: 'Article',
    onDelete: 'CASCADE',
});

// 测试数据库连接
sequelize
    .authenticate()
    .then(() => {
        console.log('数据库连接成功');
    })
    .catch((err) => {
        console.error('数据库连接失败：', err);
    });

module.exports = {
    sequelize,
    User,
    Role,
    Article,
    Media,
    Category,
    Reviews,
    SensitiveWord,
    ArticleVersion,
    Carousel,
};
