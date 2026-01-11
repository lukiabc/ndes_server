// 上传工具
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest'); // GitHub API 客户端
require('dotenv').config();

// 从 .env 读取配置
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_REPO || !GITHUB_TOKEN) {
    throw new Error('缺少 .env 中的 GITHUB_REPO 或 GITHUB_TOKEN');
}

// 解析仓库所有者和仓库名
const [owner, repo] = GITHUB_REPO.split('/');

// 初始化 GitHub API 客户端
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * 计算文件 MD5 哈希（用于去重和命名）
 * @param {Buffer} buffer - 文件二进制数据
 * @param {string} [algorithm='md5'] - 哈希算法（默认 MD5）
 * @returns {string} - 计算得到的哈希值（16进制字符串）
 */
function getHash(buffer, algorithm = 'md5') {
    return crypto.createHash(algorithm).update(buffer).digest('hex');
}

/**
 * 上传文件到 GitHub
 * @param {Buffer} buffer - 文件二进制数据
 * @param {string} filename - 目标文件名（包含路径）
 */
async function uploadToGitHub(buffer, filename) {
    try {
        // 检查文件是否已存在
        await octokit.repos.getContent({
            owner, // 仓库所有者
            repo, // 仓库名
            path: filename, // 文件路径
        });
        console.log(`文件已存在，跳过上传: ${filename}`);
        return;
    } catch (error) {
        if (error.status !== 404) {
            throw error;
        }
    }

    // 将 Buffer 转为 Base64 编码字符串
    const contentBase64 = buffer.toString('base64');

    // 创建或更新文件
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

/**
 * 上传中间件
 * @param {string} [fieldname='file'] - 表单字段名（默认 'file'）
 * @param {number} [maxCount=10] - 最大上传文件数（默认 10）
 * @returns {Array} - 包含 multer 中间件和自定义处理函数的数组
 */
function upload(fieldname = 'file', maxCount = 10) {
    // 配置 Multer 使用内存存储
    const uploads = multer({ storage: multer.memoryStorage() });

    return [
        // 解析 multipart 请求  将文件存入 req.files 数组
        uploads.array(fieldname, maxCount),
        // 处理中间件 异步上传到 GitHub
        async (req, res, next) => {
            if (!req.files || req.files.length === 0) {
                return next();
            }

            // 存储处理后的文件信息
            const processedFiles = [];

            // 遍历每个上传的文件
            for (const file of req.files) {
                // 1. 生成唯一的文件名 MD5 哈希值 + 原始扩展名
                const hash = getHash(file.buffer);
                const ext =
                    path.extname(file.originalname).toLowerCase() || '.bin';
                const filename = `${hash}${ext}`;

                // 2. 构造 GitHub 的文件路径
                const cdnUrl = `https://raw.githubusercontent.com/lukiabc/media/main/${filename}`;

                // 3. 尝试上传到 GitHub（自动去重）
                try {
                    await uploadToGitHub(file.buffer, filename);
                } catch (err) {
                    console.error(`上传失败 (${filename}):`, err.message);
                }

                // 4. 构造增强版文件对象  注入 url 字段供后续使用
                processedFiles.push({
                    ...file, // 保留原始文件属性
                    filename: filename,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    url: cdnUrl, // 公开访问链接
                });
            }

            // 替换 req.files 为处理后的数组
            req.files = processedFiles;
            next(); // 继续后续中间件处理
        },
    ];
}

module.exports = {
    upload,
    uploadToGitHub,
    getHash,
};
