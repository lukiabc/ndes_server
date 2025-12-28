//  上传文件
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const dir = path.join(__dirname, '../uploads');

// 确保上传目录存在
(async () => {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
})();

// 计算文件的哈希值
function getHash(buffer, algorithm = 'md5') {
    return crypto.createHash(algorithm).update(buffer).digest('hex');
}

function upload(fieldname = 'file', maxCount = 10) {
    const uploads = multer({ storage: multer.memoryStorage() });

    return [
        uploads.array(fieldname, maxCount),
        async (req, res, next) => {
            if (!req.files || req.files.length === 0) {
                return next();
            }

            const savedFiles = [];

            for (const file of req.files) {
                // 计算哈希
                const hash = getHash(file.buffer); // md5
                const ext =
                    path.extname(file.originalname).toLowerCase() || '.bin';
                const filename = `${hash}${ext}`;
                const filePath = path.join(dir, filename);

                //  检查是否已存在
                let exists = false;
                try {
                    await fs.access(filePath);
                    exists = true;
                } catch {}

                //  如果不存在，写入文件
                if (!exists) {
                    await fs.writeFile(filePath, file.buffer);
                }

                //  替换 file 对象，使其符合后续逻辑（如你的 router 中的 req.files）
                savedFiles.push({
                    ...file,
                    filename: filename, // 关键：使用哈希名
                    path: filePath,
                    mimetype: file.mimetype,
                    originalname: file.originalname,
                });
            }

            // 将处理后的文件挂回 req
            req.files = savedFiles;

            next();
        },
    ];
}

module.exports = upload;
