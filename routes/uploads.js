var express = require('express');
var router = express.Router();
const { upload } = require('../utils/upload');

router.post('/', upload('file', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                errno: 1, // 非 0 表示失败
                message: '未上传任何文件',
            });
        }

        // 构造 wangEditor 要求的 data 数组
        const data = req.files.map((file) => ({
            url: file.url, // 必须是 url 字段
        }));

        // 返回标准格式：errno=0 表示成功，data 是数组
        res.json({
            errno: 0,
            data: data,
        });
    } catch (error) {
        console.error('上传接口错误:', error);
        res.status(500).json({
            errno: 1,
            message: '服务器内部错误',
        });
    }
});

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('uploads', { title: '上传文件' });
});

module.exports = router;
