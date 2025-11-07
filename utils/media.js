// 解析html中的媒体文件
const path = require('path');
const fs = require('fs').promises;
const cheerio = require('cheerio');

const MEDIA_BASE_URL = 'http://localhost:3000/uploads/';
const UPLOADS_DIR = path.join(__dirname, '../uploads');

/**
 * 从 HTML 内容中提取属于本系统的本地媒体文件名
 * @param {string} htmlContent - 富文本 HTML 字符串
 * @returns {Promise<Array<{ filename: string, tag: string }>>}
 */
async function extractLocalMediaFilenames(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const mediaSet = new Set(); // 使用 Set 避免重复

    // 1. 处理 <img>
    $('img').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith(MEDIA_BASE_URL)) {
            const filename = src.substring(MEDIA_BASE_URL.length);
            if (filename && !filename.includes('/')) {
                mediaSet.add(JSON.stringify({ filename, tag: 'img' }));
            }
        }
    });

    // 2. 处理 <video src=""> 和 <video><source src=""></video>
    $('video').each((i, el) => {
        let src = $(el).attr('src');
        if (src && src.startsWith(MEDIA_BASE_URL)) {
            const filename = src.substring(MEDIA_BASE_URL.length);
            if (filename && !filename.includes('/')) {
                mediaSet.add(JSON.stringify({ filename, tag: 'video' }));
            }
        }

        // 检查子 <source>
        $(el)
            .find('source')
            .each((j, sourceEl) => {
                const src = $(sourceEl).attr('src');
                if (src && src.startsWith(MEDIA_BASE_URL)) {
                    const filename = src.substring(MEDIA_BASE_URL.length);
                    if (filename && !filename.includes('/')) {
                        mediaSet.add(
                            JSON.stringify({ filename, tag: 'video' })
                        );
                    }
                }
            });
    });

    // 3. 处理 <audio src=""> 和 <audio><source src=""></audio>
    $('audio').each((i, el) => {
        let src = $(el).attr('src');
        if (src && src.startsWith(MEDIA_BASE_URL)) {
            const filename = src.substring(MEDIA_BASE_URL.length);
            if (filename && !filename.includes('/')) {
                mediaSet.add(JSON.stringify({ filename, tag: 'audio' }));
            }
        }

        $(el)
            .find('source')
            .each((j, sourceEl) => {
                const src = $(sourceEl).attr('src');
                if (src && src.startsWith(MEDIA_BASE_URL)) {
                    const filename = src.substring(MEDIA_BASE_URL.length);
                    if (filename && !filename.includes('/')) {
                        mediaSet.add(
                            JSON.stringify({ filename, tag: 'audio' })
                        );
                    }
                }
            });
    });

    // 附件链接
    $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith(MEDIA_BASE_URL)) {
            const filename = href.substring(MEDIA_BASE_URL.length);
            if (filename && !filename.includes('/')) {
                mediaSet.add(JSON.stringify({ filename, tag: 'attachment' }));
            }
        }
    });

    // 转为数组并去重
    const mediaList = Array.from(mediaSet).map((item) => JSON.parse(item));

    // 验证文件是否真实存在于 uploads 目录
    const validMedia = [];
    for (const { filename, tag } of mediaList) {
        const filePath = path.join(UPLOADS_DIR, filename);
        try {
            await fs.access(filePath);
            validMedia.push({ filename, tag });
        } catch (err) {
            console.warn(`本地媒体文件不存在，跳过: ${filePath}`);
        }
    }

    return validMedia;
}

module.exports = { extractLocalMediaFilenames };
