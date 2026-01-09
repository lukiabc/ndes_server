// utils/upload.js
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

// 从 .env 读取配置
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_REPO || !GITHUB_TOKEN) {
    throw new Error('缺少 .env 中的 GITHUB_REPO 或 GITHUB_TOKEN');
}

const [owner, repo] = GITHUB_REPO.split('/');

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// 计算文件 MD5 哈希（用于去重和命名）
function getHash(buffer, algorithm = 'md5') {
    return crypto.createHash(algorithm).update(buffer).digest('hex');
}

// 上传单个文件到 GitHub（若不存在）
async function uploadToGitHub(buffer, filename) {
    try {
        // 检查文件是否已存在
        await octokit.repos.getContent({
            owner,
            repo,
            path: filename,
        });
        console.log(`文件已存在，跳过上传: ${filename}`);
        return;
    } catch (error) {
        if (error.status !== 404) {
            throw error; // 其他错误（如权限、网络）抛出
        }
        // 404 表示文件不存在，继续上传
    }

    // 上传新文件
    const contentBase64 = buffer.toString('base64');
    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filename,
        message: `Upload media: ${filename}`,
        content: contentBase64,
        encoding: 'base64',
    });
    console.log(`成功上传到 GitHub: ${filename}`);
}

// 导出中间件
function upload(fieldname = 'file', maxCount = 10) {
    const uploads = multer({ storage: multer.memoryStorage() });

    return [
        uploads.array(fieldname, maxCount),
        async (req, res, next) => {
            if (!req.files || req.files.length === 0) {
                return next();
            }

            const processedFiles = [];

            for (const file of req.files) {
                // 1. 计算哈希名
                const hash = getHash(file.buffer);
                const ext =
                    path.extname(file.originalname).toLowerCase() || '.bin';
                const filename = `${hash}${ext}`;

                // 2. 生成 CDN 链接（无论是否上传成功都可用）
                const cdnUrl = `https://raw.githubusercontent.com/lukiabc/media/main/${filename}`;

                // 3. 尝试上传到 GitHub（自动去重）
                try {
                    await uploadToGitHub(file.buffer, filename);
                } catch (err) {
                    console.error(`⚠️ 上传失败 (${filename}):`, err.message);
                    // 即使失败也保留 CDN 链接（可能之前已存在）
                }

                // 4. 构造新文件对象，供路由使用
                processedFiles.push({
                    ...file,
                    filename: filename,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    url: cdnUrl,
                });
            }

            req.files = processedFiles;
            next();
        },
    ];
}

module.exports = {
    upload,
    uploadToGitHub,
    getHash,
};
