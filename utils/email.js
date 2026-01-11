// 发送邮件
const nodemailer = require('nodemailer');

// 创建邮件发送器
const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com', // QQ 邮箱 SMTP 服务器
    port: 465, // SSL加密端口
    secure: true, // 启用 SSL 加密
    auth: {
        user: process.env.EMAIL_USER, // 发件人邮箱地址
        pass: process.env.EMAIL_PASS, // QQ 邮箱授权码
    },
});

/**
 * 发送邮件
 * @param {string} to - 收件人邮箱地址
 * @param {string} subject - 邮件主题
 * @param {string} html - 邮件内容（HTML格式）
 * @returns {Promise<boolean>} - 是否发送成功
 */
async function sendEmail(to, subject, html) {
    // 安全校验 防止空收件人导致异常
    if (!to) return false;

    // 构建邮件内容对象
    const mailOptions = {
        from: `"系统通知" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    };
    try {
        // 调用 Nodemailer 发送邮件
        await transporter.sendMail(mailOptions);
        console.log(`📧 邮件已发送至: ${to}`);
        return true;
    } catch (error) {
        console.error('邮件发送失败:', error.message);
        return false;
    }
}

module.exports = { sendEmail };
