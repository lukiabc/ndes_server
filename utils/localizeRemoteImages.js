const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const { URL } = require('url');

// 配置项（建议从环境变量或 config 引入）
const MEDIA_BASE_URL = 'http://localhost:3000/uploads/';
const UPLOADS_DIR = path.join(__dirname, '../uploads'); // 根据你的项目结构调整

/**
 * 下载远程图片并替换 HTML 中的 src 为本地路径
 * @param {string} htmlContent - 原始 HTML 字符串
 * @returns {Promise<{ html: string, downloadedFiles: Array<{ originalUrl: string, localFilename: string }> }>}
 */
async function localizeRemoteImages(htmlContent) {
    const $ = cheerio.load(htmlContent, { decodeEntities: false });
    const downloadedFiles = [];
    const imgPromises = [];

    $('img').each((i, el) => {
        const src = $(el).attr('src');
        if (!src) return;

        // 跳过 base64 和本系统已有的本地图片
        if (src.startsWith('data:') || src.startsWith(MEDIA_BASE_URL)) {
            return;
        }

        // 尝试解析为合法 URL
        let remoteUrl;
        try {
            remoteUrl = new URL(src);
        } catch (err) {
            console.warn(`无效图片 URL，跳过: ${src}`);
            return;
        }

        // 只处理 http/https 图片
        if (!['http:', 'https:'].includes(remoteUrl.protocol)) {
            return;
        }

        // 创建下载任务
        const promise = (async () => {
            try {
                // 发起请求（设置 User-Agent 避免被拦截）
                const response = await axios.get(remoteUrl.href, {
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; MediaBot/1.0)',
                        Referer: remoteUrl.origin,
                    },
                });

                // 检查 Content-Type 是否为图片
                const contentType = response.headers['content-type'] || '';
                if (!contentType.startsWith('image/')) {
                    console.warn(
                        `非图片资源，跳过: ${remoteUrl.href} (Content-Type: ${contentType})`
                    );
                    return;
                }

                // 推荐扩展名
                const extFromHeader =
                    contentType.split('/')[1]?.split(';')[0] || '';
                const extFromPath = path
                    .extname(remoteUrl.pathname)
                    .split('?')[0]
                    .toLowerCase();
                const finalExt =
                    extFromPath ||
                    (extFromHeader && `.${extFromHeader}`) ||
                    '.jpg';

                // 生成唯一文件名（md5 内容哈希 + 扩展名）
                const hash = crypto
                    .createHash('md5')
                    .update(response.data)
                    .digest('hex');
                const filename = `${hash}${finalExt}`;
                const filePath = path.join(UPLOADS_DIR, filename);

                // 避免重复下载
                try {
                    await fs.access(filePath);
                } catch {
                    // 文件不存在，写入
                    await fs.mkdir(UPLOADS_DIR, { recursive: true });
                    await fs.writeFile(filePath, response.data);
                }

                // 替换为本地 URL
                const localUrl = `${MEDIA_BASE_URL}${filename}`;
                $(el).attr('src', localUrl);

                downloadedFiles.push({
                    originalUrl: remoteUrl.href,
                    localFilename: filename,
                });

                console.log(
                    `✅ 成功本地化图片: ${remoteUrl.href} → ${filename}`
                );
            } catch (err) {
                console.error(
                    `❌ 下载图片失败: ${remoteUrl.href}`,
                    err.message
                );
                // 可选：保留原链接 or 移除 img 标签
                // $(el).remove(); // 如果不想显示失效图
            }
        })();

        imgPromises.push(promise);
    });

    // 等待所有图片处理完成
    await Promise.all(imgPromises);

    return {
        html: $.html(),
        downloadedFiles,
    };
}

module.exports = { localizeRemoteImages };
