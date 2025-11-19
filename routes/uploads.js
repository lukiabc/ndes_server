var express = require('express');
var router = express.Router();
const upload = require('../utils/upload');

router.post('/', upload('file', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '未上传任何文件',
            });
        }

        // 构造返回给 wangEditor 的数据
        const files = req.files.map((file) => ({
            url: `${req.protocol}://${req.get('host')}/uploads/${
                file.filename
            }`,
            originalname: file.originalname,
            filename: file.filename,
        }));

        res.json({
            success: true,
            message: '上传成功',
            files: files,
        });
    } catch (error) {
        console.error('上传接口错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
        });
    }
});

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('uploads', { title: '上传文件' });
});

module.exports = router;
