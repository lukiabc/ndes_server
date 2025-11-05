const crypto = require('crypto');

const getMd5 = function (pwd) {
    const md5 = crypto.createHash('md5');
    return md5.update(pwd).digest('hex');
};

module.exports = getMd5;
