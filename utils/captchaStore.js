// 验证码存储
// 开发环境用 Map 模拟 Redis（生产建议用 Redis）
const captchaStore = new Map();

// 导出单例
module.exports = captchaStore;
