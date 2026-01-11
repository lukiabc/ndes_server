// 密码加密模块
const bcrypt = require('bcrypt');
const saltRounds = 10; // 加密成本因子，值越高加密越慢

module.exports = {
    /**
     * 对明文密码进行哈希
     * @param {string} password - 待加密的密码
     * @returns {Promise<string>} 加密后的密码哈希值
     */
    hashPassword: async (password) => {
        // 内部随机生成 salt 并使用指定成本因子进行哈希
        return await bcrypt.hash(password, saltRounds);
    },
    /**
     * 验证密码是否匹配哈希值
     * @param {string} password - 待验证的密码
     * @param {string} hashedPassword - 存储的哈希值
     * @returns {Promise<boolean>} 是否匹配
     */
    comparePassword: async (password, hashedPassword) => {
        // bcrypt.compare 内部会自动从 hashedPassword 中提取 salt 并验证 再对 password 进行哈希对比
        return await bcrypt.compare(password, hashedPassword);
    },
};
