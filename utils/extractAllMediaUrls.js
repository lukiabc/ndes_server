// utils/extractAllMediaUrls.js
const cheerio = require('cheerio');

function extractAllMediaUrls(htmlContent) {
    const $ = cheerio.load(htmlContent);
    const mediaSet = new Set();

    const handlers = [
        { selector: 'img', attr: 'src', type: 'image' },
        { selector: 'video', attr: 'src', type: 'video' },
        { selector: 'video source', attr: 'src', type: 'video' },
        { selector: 'audio', attr: 'src', type: 'audio' },
        { selector: 'audio source', attr: 'src', type: 'audio' },
        { selector: 'a[href]', attr: 'href', type: 'attachment' },
    ];

    for (const { selector, attr, type } of handlers) {
        $(selector).each((i, el) => {
            let url = $(el).attr(attr);
            if (url) {
                // 可选：过滤无效 URL（如 javascript:、#、空）
                if (!url.startsWith('http')) return;

                // 提取文件名用于 description（尽量）
                let description = 'unknown';
                try {
                    const u = new URL(url);
                    const pathname = u.pathname;
                    const parts = pathname.split('/');
                    description = parts[parts.length - 1] || 'media';
                } catch (e) {
                    description = url.substring(0, 100);
                }

                mediaSet.add(
                    JSON.stringify({
                        media_url: url,
                        tag: type,
                        description,
                    })
                );
            }
        });
    }

    return Array.from(mediaSet).map((item) => JSON.parse(item));
}

module.exports = { extractAllMediaUrls };
