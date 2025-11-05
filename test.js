// routes/test.js
const express = require('express');
const router = express.Router();
const { scanText } = require('./utils/aliyun-green');

router.get('/scan', async (req, res) => {
    const text = req.query.text || '';
    if (!text) {
        return res
            .status(400)
            .json({ success: false, error: '缺少 text 参数' });
    }

    try {
        const result = await scanText(text);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('检测失败:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
