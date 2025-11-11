const { Jieba } = require('@node-rs/jieba');
const cut = (text) => new Jieba().cut(text); // 中文分词

const NodeCache = require('node-cache'); // 缓存敏感词
const { SensitiveWord } = require('./db'); // 敏感词模型

const wordCache = new NodeCache({ stdTTL: 0 }); // 缓存敏感词

// 缓存正则表达式
const regexCache = new Map();
let regexPatterns = []; // 正则表达式数组

// 加载敏感词
async function loadWords() {
    console.log('\n========== [DEBUG] 从数据库加载敏感词 ==========');
    try {
        console.log('[加载] 正在查询数据库...');
        const list = await SensitiveWord.findAll({ raw: true });
        console.log(`[加载] 从数据库查询到 ${list.length} 条记录`);

        // 清空旧缓存
        wordCache.flushAll();
        regexCache.clear();
        regexPatterns = [];
        console.log('[加载] 已清空旧缓存');

        let keywordCount = 0;
        let regexCount = 0;
        let invalidCount = 0;

        console.log('[加载] 开始处理敏感词...');
        list.forEach(({ word, type }, index) => {
            if (type === 'keyword') {
                wordCache.set(word, 1);
                keywordCount++;
                console.log(`  [${index + 1}] 关键词: "${word}"`);
            } else if (type === 'regex') {
                try {
                    const regex = new RegExp(word, 'gi');
                    regexCache.set(word, regex);
                    regexPatterns.push({
                        word,
                        regex,
                        replacement: '***',
                    });
                    regexCount++;
                    console.log(`  [${index + 1}] 正则: "${word}"`);
                } catch (e) {
                    invalidCount++;
                    console.warn(
                        `  [${index + 1}] ❌ 无效正则表达式跳过: "${word}" - ${e.message}`
                    );
                }
            }
        });

        console.log('\n[加载] ✓ 敏感词加载完成');
        console.log('[统计] 总计:', list.length, '条');
        console.log('[统计] 关键词:', keywordCount, '个');
        console.log('[统计] 正则:', regexCount, '个');
        if (invalidCount > 0) {
            console.log('[统计] 无效:', invalidCount, '个');
        }
        console.log('[缓存] 当前缓存关键词数量:', wordCache.keys().length);
        console.log('[缓存] 当前正则表达式数量:', regexPatterns.length);
        console.log('========== [DEBUG] 敏感词加载结束 ==========\n');
    } catch (err) {
        console.error('\n[加载] ❌ 加载敏感词失败:', err);
        console.error('[错误] 详情:', err.message);
        console.error('[错误] 堆栈:', err.stack);
        console.log('========== [DEBUG] 敏感词加载结束 ==========\n');
        throw err;
    }
}

// 过滤敏感词
function filter(text, debugMode = false) {
    if (!text || typeof text !== 'string') {
        if (debugMode) console.log('[过滤] 输入为空或非字符串，跳过过滤');
        return { text, hitWords: [] };
    }

    if (debugMode) {
        console.log('\n---------- [过滤] 开始过滤 ----------');
        console.log('[过滤] 输入文本长度:', text.length);
        console.log('[过滤] 输入文本:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    }

    let result = text;
    const hitWords = [];

    // 处理正则
    if (debugMode) {
        console.log(`[过滤] 开始正则匹配（共 ${regexPatterns.length} 个正则）`);
    }
    for (const { word, regex, replacement } of regexPatterns) {
        const matches = result.match(regex);
        if (matches) {
            hitWords.push(...matches);
            result = result.replace(regex, replacement);
            if (debugMode) {
                console.log(`  ✓ 正则 "${word}" 命中:`, matches);
            }
        }
    }
    if (debugMode && hitWords.length === 0) {
        console.log('  未命中任何正则');
    }

    // 【新增】处理完整关键词（字符串包含匹配）- 在分词之前进行
    // 这样可以避免"暴乱"被分词成"暴"和"乱"后无法匹配的问题
    if (debugMode) {
        console.log(`[过滤] 开始完整关键词匹配（缓存中有 ${wordCache.keys().length} 个关键词）`);
    }
    const allKeywords = wordCache.keys();
    let directHitCount = 0;
    for (const keyword of allKeywords) {
        if (result.includes(keyword)) {
            hitWords.push(keyword);
            directHitCount++;
            // 替换为星号
            result = result.split(keyword).join('*'.repeat(keyword.length));
            if (debugMode) {
                console.log(`  ✓ 完整关键词 "${keyword}" 命中`);
            }
        }
    }
    if (debugMode && directHitCount === 0) {
        console.log('  未命中任何完整关键词');
    }

    // 处理关键词（分词后匹配）- 用于匹配被分词器正确分出的词
    const words = cut(result);
    if (debugMode) {
        console.log(`[过滤] 中文分词结果 (${words.length} 个词):`, words.slice(0, 20));
        console.log(`[过滤] 开始分词关键词匹配`);
    }

    let keywordHitCount = 0;
    const filteredWords = words.map((w) => {
        if (wordCache.has(w)) {
            hitWords.push(w);
            keywordHitCount++;
            if (debugMode) {
                console.log(`  ✓ 分词关键词 "${w}" 命中`);
            }
            return '*'.repeat(w.length);
        }
        return w;
    });

    if (debugMode && keywordHitCount === 0) {
        console.log('  未命中任何分词关键词');
    }

    // 合并结果
    result = filteredWords.join('');

    const uniqueHitWords = [...new Set(hitWords)];

    if (debugMode) {
        console.log('[过滤] 过滤完成');
        console.log('[过滤] 命中敏感词数量:', uniqueHitWords.length);
        if (uniqueHitWords.length > 0) {
            console.log('[过滤] 命中的敏感词:', uniqueHitWords);
        }
        console.log('[过滤] 过滤后文本:', result.substring(0, 100) + (result.length > 100 ? '...' : ''));
        console.log('---------- [过滤] 结束过滤 ----------\n');
    }

    return {
        text: result,
        hitWords: uniqueHitWords, // 去重
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
