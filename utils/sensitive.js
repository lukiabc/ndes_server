// 敏感词过滤系统（支持关键词和正则表达式）
// 引入高性能中文分词库
const { Jieba } = require('@node-rs/jieba');
// 创建分词函数 对输入的文本进行切词
const cut = (text) => new Jieba().cut(text);

const NodeCache = require('node-cache'); // 内存缓存库 用于存储关键词
const { SensitiveWord } = require('./db');

// 关键词缓存 stdTTL 0 表示永不过期
const wordCache = new NodeCache({ stdTTL: 0 });

// 正则表达式缓存 Map<原始正则字符串, 编译后的 RegExp 对象>
const regexCache = new Map();
// 正则规则列表：存储 { word, regex, replacement } 结构，便于遍历匹配
let regexPatterns = [];

/**
 * 从数据库加载敏感词
 * 1. 查询所有敏感词记录（关键词和正则表达式）
 * 2. 缓存关键词（永不过期）
 * 3. 编译并缓存正则表达式
 * 4. 构建正则规则列表（用于后续匹配）
 */
async function loadWords() {
    console.log('\n========== [DEBUG] 从数据库加载敏感词 ==========');
    try {
        console.log('[加载] 正在查询数据库...');
        // 从数据库中获取所有敏感词记录
        const list = await SensitiveWord.findAll({ raw: true });
        console.log(`[加载] 从数据库查询到 ${list.length} 条记录`);

        // 清空旧缓存
        wordCache.flushAll();
        regexCache.clear();
        regexPatterns = [];
        console.log('[加载] 已清空旧缓存');

        // 处理每个敏感词记录
        let keywordCount = 0;
        let regexCount = 0;
        let invalidCount = 0;

        console.log('[加载] 开始处理敏感词...');
        // 遍历每条记录 按类型分别处理
        list.forEach(({ word, type }, index) => {
            if (type === 'keyword') {
                // 关键词直接存入缓存 值为1 仅作为存在标志
                wordCache.set(word, 1);
                keywordCount++;
                console.log(`  [${index + 1}] 关键词: "${word}"`);
            } else if (type === 'regex') {
                try {
                    // 尝试编译正则表达式 全局匹配 忽略大小写
                    const regex = new RegExp(word, 'gi');
                    // 缓存编译结果
                    regexCache.set(word, regex);
                    // 加入匹配队列
                    regexPatterns.push({
                        word, // 原始字符串
                        regex, // 编译后的正则对象
                        replacement: '***',
                    });
                    regexCount++;
                    console.log(`  [${index + 1}] 正则: "${word}"`);
                } catch (e) {
                    invalidCount++; // 捕获无效正则（如 "[a-"），跳过并告警
                    console.warn(
                        `  [${index + 1}]  无效正则表达式跳过: "${word}" - ${
                            e.message
                        }`
                    );
                }
            }
        });

        console.log('\n[加载] 敏感词加载完成');
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
        console.error('\n[加载]  加载敏感词失败:', err);
        console.error('[错误] 详情:', err.message);
        console.error('[错误] 堆栈:', err.stack);
        console.log('========== [DEBUG] 敏感词加载结束 ==========\n');
        throw err;
    }
}

/**
 * 过滤文本中的敏感词
 * 三个阶段
 * 1. 正则匹配（优先处理复杂模式）
 * 2. 完整关键词匹配（防止分词破坏语义）
 * 3. 分词后关键词匹配（处理被正确切分的词）
 * @param {string} text - 待过滤的文本
 * @param {boolean} debugMode - 是否开启调试模式（默认false）
 * @returns {{ text: string, hitWords: string[] }} - 过滤后的文本和命中的敏感词数组（去重）
 */
function filter(text, debugMode = false) {
    if (!text || typeof text !== 'string') {
        if (debugMode) console.log('[过滤] 输入为空或非字符串，跳过过滤');
        return { text, hitWords: [] };
    }

    if (debugMode) {
        console.log('\n---------- [过滤] 开始过滤 ----------');
        console.log('[过滤] 输入文本长度:', text.length);
        console.log(
            '[过滤] 输入文本:',
            text.substring(0, 100) + (text.length > 100 ? '...' : '')
        );
    }

    let result = text; // 过滤后的文本
    const hitWords = []; // 命中的敏感词数组

    // 1. 正则匹配（优先处理复杂模式）
    if (debugMode) {
        console.log(`[过滤] 开始正则匹配（共 ${regexPatterns.length} 个正则）`);
    }

    // 遍历每个正则表达式 进行匹配替换
    for (const { word, regex, replacement } of regexPatterns) {
        const matches = result.match(regex); // 获取所有匹配项
        if (matches) {
            hitWords.push(...matches); // 合并所有匹配项（去重）
            result = result.replace(regex, replacement); // 全局替换所有匹配项
            if (debugMode) {
                console.log(`正则 "${word}" 命中:`, matches);
            }
        }
    }
    if (debugMode && hitWords.length === 0) {
        console.log('  未命中任何正则');
    }

    // 2. 完整关键词匹配（防止分词破坏语义）
    if (debugMode) {
        console.log(
            `[过滤] 开始完整关键词匹配（缓存中有 ${
                wordCache.keys().length
            } 个关键词）`
        );
    }
    const allKeywords = wordCache.keys(); // 获取所有缓存关键词
    let directHitCount = 0; // 直接命中的关键词数量
    for (const keyword of allKeywords) {
        // 检查是否直接命中关键词
        if (result.includes(keyword)) {
            hitWords.push(keyword); // 记录直接命中的关键词
            directHitCount++;
            // 替换为星号
            result = result.split(keyword).join('*'.repeat(keyword.length));
            if (debugMode) {
                console.log(`完整关键词 "${keyword}" 命中`);
            }
        }
    }
    if (debugMode && directHitCount === 0) {
        console.log('  未命中任何完整关键词');
    }

    // 3. 分词后关键词匹配（处理被正确切分的词）
    // 对当前结果进行中文分词
    const words = cut(result);
    if (debugMode) {
        console.log(
            `[过滤] 中文分词结果 (${words.length} 个词):`,
            words.slice(0, 20)
        );
        console.log(`[过滤] 开始分词关键词匹配`);
    }

    let keywordHitCount = 0;
    // 遍历每个分词后的词 检查是否命中缓存关键词
    const filteredWords = words.map((w) => {
        if (wordCache.has(w)) {
            hitWords.push(w);
            keywordHitCount++;
            if (debugMode) {
                console.log(`分词关键词 "${w}" 命中`);
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

    //合并所有命中的敏感词（去重）
    const uniqueHitWords = [...new Set(hitWords)];

    if (debugMode) {
        console.log('[过滤] 过滤完成');
        console.log('[过滤] 命中敏感词数量:', uniqueHitWords.length);
        if (uniqueHitWords.length > 0) {
            console.log('[过滤] 命中的敏感词:', uniqueHitWords);
        }
        console.log(
            '[过滤] 过滤后文本:',
            result.substring(0, 100) + (result.length > 100 ? '...' : '')
        );
        console.log('---------- [过滤] 结束过滤 ----------\n');
    }

    return {
        text: result, // 过滤后的文本
        hitWords: uniqueHitWords, // 去重后的敏感词数组
    };
}

/**
 * 添加敏感词
 * @param {string} word - 敏感词内容
 * @param {string} [type='keyword'] - 类型，'keyword' 或 'regex'
 */
async function addWord(word, type = 'keyword') {
    // 验证输入
    if (!word || typeof word !== 'string' || !word.trim()) {
        throw new Error('敏感词不能为空');
    }
    word = word.trim();

    // 检查是否已存在相同敏感词
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

    // 同步更新内存缓存
    if (type === 'keyword') {
        wordCache.set(word, 1);
    } else if (type === 'regex') {
        const regex = new RegExp(word, 'gi');
        regexCache.set(word, regex);
        regexPatterns.push({ word, regex, replacement: '***' });
    }
}

/**
 * 删除敏感词
 * @param {string} word - 敏感词内容
 */
async function removeWord(word) {
    // 查找数据库中是否存在该敏感词
    const record = await SensitiveWord.findOne({ where: { word } });
    if (!record) return;

    // 从数据库中删除
    await SensitiveWord.destroy({ where: { word } });

    // 同步清理缓存
    if (record.type === 'keyword') {
        wordCache.del(word);
    } else if (record.type === 'regex') {
        regexCache.delete(word);
        // 过滤掉对应规则
        regexPatterns = regexPatterns.filter((p) => p.word !== word);
    }
}
module.exports = { loadWords, filter, addWord, removeWord };
