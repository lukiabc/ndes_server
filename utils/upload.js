const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const dir = path.join(__dirname, '../uploads');

// const storage = multer.diskStorage({
//     filename: (req, file, cb) => {
//         // return cb(null, file.originalname);
//         // 生成唯一的文件名，包含原始文件名和时间戳
//         const uniqueSuffix = Date.now();
//         const filename =
//             file.originalname.split('.').slice(0, -1).join('.') +
//             uniqueSuffix +
//             '.' +
//             file.originalname.split('.').pop();
//         return cb(null, filename);
//     },

//     destination: (req, file, cb) => {
//         // 当 dir 所对应目录不存在时，则自动创建该文件
//         const dir = path.join(__dirname, '../uploads');
//         try {
//             // 检查文件是否存在
//             // fs.accessSync(dir);
//         } catch {
//             // 不存在 创建文件夹
//             fs.mkdirSync(dir);
//         }
//         return cb(null, dir);
//     },
// });

// // multer 实例化对象的时候 使用storage
// const upload = multer({
//     storage: storage,
// });

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
                // 1. 计算哈希
                const hash = getHash(file.buffer); // md5
                const ext =
                    path.extname(file.originalname).toLowerCase() || '.bin';
                const filename = `${hash}${ext}`;
                const filePath = path.join(dir, filename);

                // 2. 检查是否已存在
                let exists = false;
                try {
                    await fs.access(filePath);
                    exists = true;
                } catch {}

                // 3. 如果不存在，写入文件
                if (!exists) {
                    await fs.writeFile(filePath, file.buffer);
                }

                // 4. 替换 file 对象，使其符合后续逻辑（如你的 router 中的 req.files）
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
