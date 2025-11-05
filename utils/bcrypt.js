// 密码加密模块
const bcrypt = require('bcrypt');
const saltRounds = 10;

module.exports = {
    hashPassword: async (password) => {
        return await bcrypt.hash(password, saltRounds);
    },
    comparePassword: async (password, hashedPassword) => {
        return await bcrypt.compare(password, hashedPassword);
    },
};
