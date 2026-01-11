const crypto = require('crypto');

/**
 * 对输入字符串进行 MD5 加密
 * @param {string} pwd - 待加密的密码字符串
 * @returns {string} - 32 位十六进制 MD5 字符串
 */
const getMd5 = function (pwd) {
    // 创建一个 MD5 哈希实例
    const md5 = crypto.createHash('md5');
    // 更新哈希值，将密码字符串编码为 UTF-8 并计算哈希
    return md5.update(pwd).digest('hex');
};

module.exports = getMd5;
