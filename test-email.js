// test-email.js
require('dotenv').config();
const { sendEmail } = require('./utils/email');

sendEmail('3520448189@qq.com', '测试邮件', '<h1>这是一封测试邮件</h1>')
    .then((ok) => console.log('发送结果:', ok ? '成功' : '失败'))
    .catch((err) => console.error(err));
