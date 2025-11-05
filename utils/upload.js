const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
    filename: (req, file, cb) => {
        // return cb(null, file.originalname);
        // 生成唯一的文件名，包含原始文件名和时间戳
        const uniqueSuffix = Date.now();
        const filename =
            file.originalname.split('.').slice(0, -1).join('.') +
            uniqueSuffix +
            '.' +
            file.originalname.split('.').pop();
        return cb(null, filename);
    },

    destination: (req, file, cb) => {
        // 当 dir 所对应目录不存在时，则自动创建该文件
        const dir = path.join(__dirname, '../uploads');
        try {
            // 检查文件是否存在
            // fs.accessSync(dir);
        } catch {
            // 不存在 创建文件夹
            fs.mkdirSync(dir);
        }
        return cb(null, dir);
    },
});

// multer 实例化对象的时候 使用storage
const upload = multer({
    storage: storage,
});

module.exports = upload;
