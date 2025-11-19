const { filter } = require('./sensitive');
const AipContentCensorClient = require('baidu-aip-sdk').contentCensor;
require('dotenv').config();

// 百度云内容审核客户端配置
const APP_ID = process.env.BAIDU_CLOUD_APP_ID;
const API_KEY = process.env.BAIDU_CLOUD_API_KEY;
const SECRET_KEY = process.env.BAIDU_CLOUD_SECRET_KEY;

// 创建百度云内容审核客户端
let baiduClient = null;
if (
    APP_ID &&
    API_KEY &&
    SECRET_KEY &&
    APP_ID !== 'your_app_id_here' &&
    API_KEY !== 'your_api_key_here' &&
    SECRET_KEY !== 'your_secret_key_here'
) {
    try {
        baiduClient = new AipContentCensorClient(APP_ID, API_KEY, SECRET_KEY);
        console.log('[AI-Review] 百度云内容审核客户端初始化成功');
    } catch (err) {
        console.error('[AI-Review] 百度云客户端初始化失败:', err.message);
    }
} else {
    console.warn('[AI-Review] 百度云密钥未配置，将仅使用本地敏感词检测');
}

/**
 * 使用百度云文本审核 API
 * @param {string} text - 待审核文本
 * @returns {Promise<Object>} 审核结果
 */
async function baiduTextCensor(text) {
    console.log('\n---------- [百度云审核] 开始 ----------');
    console.log('[百度云] 待审核文本长度:', text.length);
    console.log(
        '[百度云] 待审核文本:',
        text.substring(0, 200) + (text.length > 200 ? '...' : '')
    );

    if (!baiduClient) {
        console.log('[百度云] ⚠️  百度云客户端未配置，跳过云端审核');
        console.log('---------- [百度云审核] 结束 ----------\n');
        return { pass: true, message: '百度云未配置，跳过云端审核' };
    }

    try {
        console.log('[百度云] 正在调用百度云 API...');
        const result = await baiduClient.textCensorUserDefined(text);

        console.log('[百度云] ✓ API 调用成功');
        console.log('[百度云] 完整返回结果:', JSON.stringify(result, null, 2));

        // 检查是否有错误码
        if (result.error_code) {
            const errorMessages = {
                18: 'QPS 请求限制已达到（免费版限制），已降级为本地检测',
                110: 'Access Token 失效',
                111: 'Access Token 过期',
                216015: '模块关闭',
                216100: '非法参数',
                216101: '参数值错误',
                216200: '图片为空',
                216201: '图片大小错误',
                216202: '图片格式错误',
                216630: '识别错误',
                282000: '服务器内部错误',
            };

            const errorMsg =
                errorMessages[result.error_code] ||
                result.error_msg ||
                '未知错误';
            console.log(`[百度云] ❌ 审核错误 - 错误码: ${result.error_code}`);
            console.log(`[百度云] 错误信息: ${errorMsg}`);
            console.log('---------- [百度云审核] 结束 ----------\n');

            return {
                pass: 'error',
                message: errorMsg,
                detail: result,
            };
        }

        // 百度云返回结果结构：
        // conclusionType: 1-合规，2-不合规，3-疑似，4-审核失败
        // data: 包含详细的审核信息

        console.log('[百度云] conclusionType:', result.conclusionType);
        console.log('[百度云] conclusion:', result.conclusion);
        if (result.data && result.data.length > 0) {
            console.log('[百度云] 检测详情:');
            result.data.forEach((item, index) => {
                console.log(`  [${index + 1}] 类型: ${item.type || '未知'}`);
                console.log(`      子类型: ${item.subType || '未知'}`);
                console.log(`      结论: ${item.conclusion || '未知'}`);
                console.log(`      消息: ${item.msg || '无'}`);
                if (item.hits && item.hits.length > 0) {
                    console.log(`      命中词: ${JSON.stringify(item.hits)}`);
                }
            });
        } else {
            console.log('[百度云] 无详细检测数据');
        }

        if (result.conclusionType === 1) {
            console.log('[百度云] ✅ 审核结果: 合规');
            console.log('---------- [百度云审核] 结束 ----------\n');
            return {
                pass: true,
                message: '百度云审核通过',
                detail: result,
            };
        } else if (result.conclusionType === 2) {
            // 不合规
            const hits =
                result.data?.map((item) => item.msg).join('、') || '违规内容';
            console.log('[百度云] ❌ 审核结果: 不合规');
            console.log('[百度云] 违规内容:', hits);
            console.log('---------- [百度云审核] 结束 ----------\n');
            return {
                pass: false,
                message: `百度云检测到违规内容: ${hits}`,
                detail: result,
            };
        } else if (result.conclusionType === 3) {
            // 疑似违规，需要人工审核
            console.log('[百度云] ⚠️  审核结果: 疑似违规');
            console.log('---------- [百度云审核] 结束 ----------\n');
            return {
                pass: 'review',
                message: '百度云检测到疑似违规，需人工审核',
                detail: result,
            };
        } else {
            // 审核失败
            console.log('[百度云] ❌ 审核结果: 审核失败');
            console.log('[百度云] conclusionType:', result.conclusionType);
            console.log('---------- [百度云审核] 结束 ----------\n');
            return {
                pass: 'error',
                message: '百度云审核异常',
                detail: result,
            };
        }
    } catch (err) {
        console.error('[百度云] ❌ API 调用异常:', err);
        console.error('[百度云] 错误详情:', err.message);
        console.error('[百度云] 错误堆栈:', err.stack);
        console.log('---------- [百度云审核] 结束 ----------\n');
        return {
            pass: 'error',
            message: `百度云审核调用失败: ${err.message}`,
            error: err,
        };
    }
}

/**
 * 综合审核函数：本地敏感词 + 百度云审核
 * @param {string} title - 标题
 * @param {string} content - 内容
 * @param {boolean} isScheduled - 是否为定时发布
 * @returns {Promise<Object>} 审核结果
 */
async function performReview(title, content, isScheduled = false) {
    const safeTitle = typeof title === 'string' ? title : '';
    const safeContent = typeof content === 'string' ? content : '';

    // 第一层：本地敏感词检测（快速初筛）
    const titleCheck = filter(safeTitle);
    const contentCheck = filter(safeContent);

    const localHitWords = [
        ...new Set([...titleCheck.hitWords, ...contentCheck.hitWords]),
    ];

    if (localHitWords.length > 0) {
        // 本地敏感词不通过 - 返回拒绝状态
        const rejectReason = `内容包含本地敏感词: ${localHitWords.join(',')}`;
        console.log('[AI-Review] ❌ 本地敏感词检测未通过，标记为拒绝');
        return {
            status: '拒绝',
            rejected: true,
            rejectReason,
            reviewLog: {
                reviewer: 'system',
                review_result: '拒绝',
                review_comments: `[本地] ${rejectReason}`,
                review_time: new Date(),
            },
        };
    }

    // 第二层：百度云 AI 审核（深度检测）
    const combinedText = `${safeTitle}\n${safeContent}`;
    const baiduResult = await baiduTextCensor(combinedText);

    let status = '待审';
    let reviewComments = '[系统] 敏感词检测通过';
    let reviewResult = '通过初筛';
    let rejected = false;
    let rejectReason = null;

    if (baiduResult.pass === true) {
        // 百度云审核通过
        if (isScheduled) {
            // 定时发布 - 标记为待发布
            status = '待发布';
            reviewResult = '审核通过';
            reviewComments =
                '[系统] 本地敏感词检测通过，百度云审核通过，已设置定时发布。';
            console.log('[AI-Review] ✅ 审核完全通过，文章待定时发布');
        } else {
            // 立即发布 - 标记为已发布
            status = '已发布';
            reviewResult = '审核通过';
            reviewComments =
                '[系统] 本地敏感词检测通过，百度云审核通过，文章已自动发布。';
            console.log('[AI-Review] ✅ 审核完全通过，文章自动发布');
        }
    } else if (baiduResult.pass === false) {
        // 百度云检测到违规 - 标记为拒绝
        status = '拒绝';
        rejected = true;
        rejectReason = baiduResult.message;
        reviewResult = '拒绝';
        reviewComments = `[系统] ${baiduResult.message}`;
        console.log('[AI-Review] ❌ 百度云检测到违规内容，标记为拒绝');
    } else if (baiduResult.pass === 'review') {
        // 疑似违规 - 需人工审核
        status = '待审';
        reviewResult = '疑似违规';
        reviewComments = `[系统] 本地敏感词检测通过，但${baiduResult.message}`;
        console.log('[AI-Review] ⚠️  检测到疑似违规，进入人工审核队列');
    } else if (baiduResult.pass === 'error') {
        // 百度云异常 - 降级为人工审核
        status = '待审';
        reviewResult = '待人工审核';
        reviewComments = `[系统] 本地敏感词检测通过，云端审核异常（${baiduResult.message}），进入人工审核队列。`;
        console.warn('[AI-Review] ⚠️  云端审核异常，已降级为人工审核');
    }

    return {
        status,
        rejected,
        rejectReason,
        reviewLog: {
            reviewer: 'system',
            review_result: reviewResult,
            review_comments: reviewComments,
            review_time: new Date(),
        },
    };
}

module.exports = { performReview, baiduTextCensor };
