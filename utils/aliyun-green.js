const https = require('https');
const crypto = require('crypto');

// 从环境变量读取配置
const ACCESS_KEY_ID = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
const ACCESS_KEY_SECRET = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
const ENDPOINT = 'green.cn-shanghai.aliyuncs.com';
const BIZ_TYPE = process.env.ALIBABA_CLOUD_BIZ_TYPE || 'default';

if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET) {
    throw new Error(
        '请设置环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID 和 ALIBABA_CLOUD_ACCESS_KEY_SECRET'
    );
}

/**
 * 生成标准 GMT 时间字符串（格式如：Mon, 03 Nov 2025 09:46:17 GMT）
 * 注意：个位数日期前为空格，不是 '0'（例如 " 3" 而不是 "03"）
 */
function getGMTDate() {
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ];
    const day = now.getUTCDate(); // 1-31
    const dayStr = day < 10 ? ` ${day}` : `${day}`; // 个位数前面加空格
    const timeStr = now.toTimeString().substr(0, 8); // HH:MM:SS

    return `${days[now.getUTCDay()]}, ${dayStr} ${
        months[now.getUTCMonth()]
    } ${now.getUTCFullYear()} ${timeStr} GMT`;
}

/**
 * 生成阿里云 Green 内容安全专用签名
 * 注意：Green 接口签名格式为非标准 REST，Content-Type 出现两次
 *
 * StringToSign =
 *   HTTP_METHOD + "\n" +
 *   CONTENT_TYPE + "\n" +
 *   CONTENT_MD5 + "\n" +
 *   CONTENT_TYPE + "\n" +   ← 重复一次
 *   DATE (GMT) + "\n" +
 *   RESOURCE_PATH
 *
 * @param {string} secret - AccessKeySecret
 * @param {string} verb - HTTP 方法，如 POST
 * @param {string} contentMd5 - 请求体的 MD5（base64 编码）
 * @param {string} contentType - 内容类型，如 application/json
 * @param {string} date - GMT 日期字符串
 * @param {string} uri - 请求路径，如 /green/text/scan
 * @returns {string} base64 编码的签名
 */
function signRequest(secret, verb, contentMd5, contentType, date, uri) {
    // 🔥 阿里云 Green 特有：Content-Type 出现两次
    const stringToSign = `${verb}\n${contentType}\n${contentMd5}\n${contentType}\n${date}\n${uri}`;

    console.log('=== 开始生成签名 ===');
    console.log('HTTP 方法:', verb);
    console.log('Content-Type:', contentType);
    console.log('Content-MD5:', contentMd5);
    console.log('Date (GMT):', date);
    console.log('请求路径:', uri);
    console.log('待签名字符串 (逐行):');
    console.log(`"${stringToSign.replace(/\n/g, '\\n')}"`);

    // 创建 HMAC-SHA1 签名，密钥末尾必须加 '&'
    const signature = crypto
        .createHmac('sha1', secret + '&')
        .update(stringToSign, 'utf8')
        .digest('base64');

    console.log('✅ 签名成功:', signature);
    return signature;
}

/**
 * 调用阿里云文本检测接口
 * @param {string} text - 要检测的文本
 * @returns {Promise<Object>} 检测结果
 */
async function scanText(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('待检测文本不能为空且必须是字符串');
    }

    console.log('=== 开始调用阿里云文本检测 ===');
    console.log('原始文本长度:', text.length);
    console.log('AccessKeyId:', ACCESS_KEY_ID);

    // 1. 构造请求体
    const uuid = `node_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 6)}`;
    const requestBody = {
        tasks: [
            {
                dataId: uuid,
                content: text,
            },
        ],
        scenes: ['antispam', 'terrorism', 'porn'],
        bizType: BIZ_TYPE,
    };

    const bodyStr = JSON.stringify(requestBody);
    console.log('请求体字符串:', bodyStr);

    // 2. 计算 Content-MD5（base64 编码）
    const contentMd5 = crypto
        .createHash('md5')
        .update(bodyStr, 'utf8')
        .digest('base64');
    console.log('Content-MD5:', contentMd5);

    const contentType = 'application/json';
    const method = 'POST';
    const uri = '/green/text/scan';
    const dateHeader = getGMTDate(); // 使用精确 GMT 格式

    // 3. 生成签名
    let signature;
    try {
        signature = signRequest(
            ACCESS_KEY_SECRET,
            method,
            contentMd5,
            contentType,
            dateHeader,
            uri
        );
    } catch (err) {
        console.error('❌ 签名失败:', err);
        throw new Error(`签名生成失败: ${err.message}`);
    }

    // 4. 构造请求头
    const headers = {
        'Content-Type': contentType,
        Accept: 'application/json',
        Date: dateHeader,
        'Content-MD5': contentMd5,
        Authorization: `acs ${ACCESS_KEY_ID}:${signature}`,
    };

    console.log('请求头:', headers);
    console.log('目标地址:', `https://${ENDPOINT}${uri}`);

    // 5. 发送 HTTPS 请求
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: ENDPOINT,
                port: 443,
                path: uri,
                method: method,
                headers: headers,
            },
            (res) => {
                console.log('收到响应状态码:', res.statusCode);
                console.log('响应头:', res.headers);

                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                    console.log('接收数据片段:', chunk.toString());
                });

                res.on('end', () => {
                    console.log('响应结束，完整数据:', responseData);

                    try {
                        if (!responseData) {
                            return reject(new Error('阿里云返回空响应'));
                        }

                        let result;
                        try {
                            result = JSON.parse(responseData);
                        } catch (parseErr) {
                            console.error('JSON 解析失败:', responseData);
                            return reject(
                                new Error(`响应不是合法 JSON: ${responseData}`)
                            );
                        }

                        // 成功响应：HTTP 200 且 code === 200
                        if (res.statusCode === 200 && result.code === 200) {
                            const taskResult = result.data?.results?.[0];
                            if (!taskResult) {
                                return reject(new Error('未找到检测结果'));
                            }

                            let systemStatus;
                            switch (taskResult.suggestion) {
                                case 'block':
                                    systemStatus = '拒绝';
                                    break;
                                case 'review':
                                    systemStatus = '待人工复审';
                                    break;
                                default:
                                    systemStatus = '通过';
                            }

                            resolve({
                                status: systemStatus,
                                suggestion: taskResult.suggestion,
                                reason: taskResult.label,
                                confidence: taskResult.score || null,
                                label: taskResult.label,
                                taskId: taskResult.taskId,
                                dataId: taskResult.dataId,
                            });
                        } else {
                            const msg =
                                result.message ||
                                result.Message ||
                                result.msg ||
                                result.errorMessage ||
                                '未知错误';
                            const code =
                                result.code || result.Code || res.statusCode;
                            console.error('阿里云返回错误:', {
                                code,
                                msg,
                                result,
                            });
                            reject(new Error(`API 调用失败: ${code} - ${msg}`));
                        }
                    } catch (err) {
                        console.error('处理响应失败:', err);
                        reject(err);
                    }
                });
            }
        );

        req.on('error', (err) => {
            console.error('HTTPS 请求错误:', err);
            reject(new Error(`网络请求失败: ${err.message}`));
        });

        // 6. 发送请求体
        req.write(bodyStr);
        console.log('已发送请求体');
        req.end();
    });
}

module.exports = { scanText };
