const { Jieba } = require('@node-rs/jieba');
const cut = (text) => new Jieba().cut(text); // 中文分词

const NodeCache = require('node-cache'); // 缓存敏感词
const { SensitiveWord } = require('./db'); // 敏感词模型

const wordCache = new NodeCache({ stdTTL: 0 }); // 缓存敏感词

// 缓存正则表达式示例
const regexCache = new Map();

// 加载敏感词
async function loadWords() {
    try {
        const list = await SensitiveWord.findAll({ raw: true });
        // 清空旧缓存
        wordCache.flushAll();
        regexCache.clear();
        regexPatterns = [];

        list.forEach(({ word, type }) => {
            if (type === 'keyword') {
                wordCache.set(word, 1);
            } else if (type === 'regex') {
                try {
                    const regex = new RegExp(word, 'gi');
                    regexCache.set(word, regex);
                    regexPatterns.push({
                        word,
                        regex,
                        replacement: '***',
                    });
                } catch (e) {
                    console.warn(
                        `[Sensitive] 无效正则表达式跳过: "${word}"`,
                        e.message
                    );
                }
            }
        });

        console.log(
            `[Sensitive] 加载 ${list.length} 个敏感词 (${
                wordCache.keys().length
            } 关键词, ${regexPatterns.length} 正则)`
        );
    } catch (err) {
        console.error('[Sensitive] 加载敏感词失败:', err);
        throw err;
    }
}

// 过滤敏感词
function filter(text) {
    if (!text || typeof text !== 'string') return { text, hitWords: [] };

    let result = text;
    const hitWords = [];

    // 处理正则
    for (const { word, regex, replacement } of regexPatterns) {
        const matches = result.match(regex);
        if (matches) {
            hitWords.push(...matches);
            result = result.replace(regex, replacement);
        }
    }

    // 处理关键词
    const words = cut(result);
    const filteredWords = words.map((w) => {
        if (wordCache.has(w)) {
            hitWords.push(w);
            return '*'.repeat(w.length);
        }
        return w;
    });

    // 合并结果
    result = filteredWords.join('');

    return {
        text: result,
        hitWords: [...new Set(hitWords)], // 去重
    };
}

// 添加敏感词
async function addWord(word, type = 'keyword') {
    // 验证输入
    if (!word || typeof word !== 'string' || !word.trim()) {
        throw new Error('敏感词不能为空');
    }
    word = word.trim();

    // 检查是否已存在
    const exists = await SensitiveWord.findOne({ where: { word } });
    if (exists) {
        throw new Error('敏感词已存在');
    }

    // 如果是正则，先尝试编译
    if (type === 'regex') {
        try {
            new RegExp(word, 'gi');
        } catch (e) {
            throw new Error(`正则表达式无效: ${e.message}`);
        }
    }

    // 写入数据库
    await SensitiveWord.create({ word, type });

    // 更新缓存
    if (type === 'keyword') {
        wordCache.set(word, 1);
    } else if (type === 'regex') {
        const regex = new RegExp(word, 'gi');
        regexCache.set(word, regex);
        regexPatterns.push({ word, regex, replacement: '***' });
    }
}

// 删除敏感词
async function removeWord(word) {
    const record = await SensitiveWord.findOne({ where: { word } });
    if (!record) return;

    await SensitiveWord.destroy({ where: { word } });

    if (record.type === 'keyword') {
        wordCache.del(word);
    } else if (record.type === 'regex') {
        regexCache.delete(word);
        regexPatterns = regexPatterns.filter((p) => p.word !== word);
    }
}
module.exports = { loadWords, filter, addWord, removeWord };
