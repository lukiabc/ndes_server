// 发送邮件
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendEmail(to, subject, html) {
    if (!to) return false;
    const mailOptions = {
        from: `"系统通知" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 邮件已发送至: ${to}`);
        return true;
    } catch (error) {
        console.error('邮件发送失败:', error.message);
        return false;
    }
}

module.exports = { sendEmail };
