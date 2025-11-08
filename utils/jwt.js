const { expressjwt } = require('express-jwt');

const jwtAuth = expressjwt({
    secret: 'suibian', // 加密的密钥
    algorithms: ['HS256'], // 采用 HS256 加密算法
    credentialsRequired: false, // 白名单路径无需token
}).unless({
    // 设置白名单，除了排除的这些接口不需要验证 token，其他接口都要验证
    path: ['/users/login'],
});

module.exports = jwtAuth;
