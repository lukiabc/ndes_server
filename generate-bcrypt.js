// 生成 bcrypt 哈希
const bcrypt = require('bcrypt');

const password = '123456'; // ← 改成你实际用的密码
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error('加密失败:', err);
        return;
    }
    console.log('\n 你的 bcrypt 哈希是:');
    console.log(hash);
    console.log('\n 请将此值复制到数据库的 password 字段中。\n');
});
