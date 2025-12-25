// 验证码路由
const express = require('express');
const router = express.Router();
const svgCaptcha = require('svg-captcha');
const captchaStore = require('../utils/captchaStore');

router.get('/', (req, res) => {
    const cap = svgCaptcha.create({
        size: 4,
        noise: 1,
        width: 100,
        height: 40,
        fontSize: 40,
        ignoreChars: '0Oo1ilI',
    });

    const captchaId =
        Date.now().toString(36) + Math.random().toString(36).slice(2);
    captchaStore.set(captchaId, cap.text);

    // 5 分钟后自动清除
    setTimeout(() => captchaStore.delete(captchaId), 5 * 60 * 1000);

    res.json({
        captchaId,
        svg: cap.data,
    });
});

module.exports = router;
