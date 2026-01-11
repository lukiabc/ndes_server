// 媒体资源提取工具
const cheerio = require('cheerio');

/**
 * 从 HTML 中提取所有媒体资源
 * @param {string} htmlContent  - 待提取的 HTML 内容
 * @returns {Array} - 提取到的所有媒体资源数组
 */
function extractAllMediaUrls(htmlContent) {
    // 使用 Cheerio 加载 HTML 内容，生成可查询的 DOM 树
    const $ = cheerio.load(htmlContent);
    // 使用 Set 自动去重
    const mediaSet = new Set();

    /**
     * 定义媒体提取规则列表
     * 每个规则包含选择器、属性名和资源类型
     */
    const handlers = [
        { selector: 'img', attr: 'src', type: 'image' },
        { selector: 'video', attr: 'src', type: 'video' },
        { selector: 'video source', attr: 'src', type: 'video' },
        { selector: 'audio', attr: 'src', type: 'audio' },
        { selector: 'audio source', attr: 'src', type: 'audio' },
        { selector: 'a[href]', attr: 'href', type: 'attachment' },
    ];

    // 遍历每种媒体类型规则
    for (const { selector, attr, type } of handlers) {
        //使用 Cheerio 查询所有匹配元素
        $(selector).each((i, el) => {
            // 获取元素的指定属性值（如 src、href）
            let url = $(el).attr(attr);
            if (url) {
                // 过滤无效 URL（如 javascript:、#、空）
                if (!url.startsWith('http')) return;

                // 提取文件名用于 description
                let description = 'unknown';
                try {
                    // 使用原生 URL 构造函数解析连接
                    const u = new URL(url);
                    const pathname = u.pathname;
                    const parts = pathname.split('/');
                    description = parts[parts.length - 1] || 'media';
                } catch (e) {
                    // 如果 URL 无效，截取前 100 个字符作为描述
                    description = url.substring(0, 100);
                }

                mediaSet.add(
                    JSON.stringify({
                        media_url: url, // 完整的媒体链接
                        tag: type, // 资源类型
                        description, // 资源描述
                    })
                );
            }
        });
    }

    // 将 Set 转换为数组 并将每个 JSON 字符串解析返回对象
    return Array.from(mediaSet).map((item) => JSON.parse(item));
}

module.exports = { extractAllMediaUrls };
