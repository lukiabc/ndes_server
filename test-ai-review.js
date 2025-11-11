/**
 * 百度 AI 违禁词审核功能测试
 * 测试各种内容是否能被正确识别
 */

const { performReview, baiduTextCensor } = require('./utils/ai-review');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testReview() {
    console.log('========== 百度 AI 违禁词审核测试 ==========\n');

    // 测试用例 1: 正常内容
    console.log('【测试 1】正常技术内容');
    try {
        const result1 = await baiduTextCensor('Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境');
        console.log('✓ 审核结果:', result1.pass === true ? '通过' : result1.pass === false ? '违规' : '疑似/异常');
        console.log('  说明:', result1.message);
    } catch (err) {
        console.log('✗ 调用失败:', err.message);
    }

    await sleep(1000);
    console.log('\n' + '-'.repeat(60) + '\n');

    // 测试用例 2: 测试政治敏感内容
    console.log('【测试 2】政治相关内容');
    try {
        const result2 = await baiduTextCensor('台独分子企图破坏国家统一');
        console.log('✓ 审核结果:', result2.pass === true ? '通过' : result2.pass === false ? '违规' : '疑似/异常');
        console.log('  说明:', result2.message);
    } catch (err) {
        console.log('✗ 调用失败:', err.message);
    }

    await sleep(1000);
    console.log('\n' + '-'.repeat(60) + '\n');

    // 测试用例 3: 色情低俗内容
    console.log('【测试 3】低俗内容');
    try {
        const result3 = await baiduTextCensor('黄色网站免费观看');
        console.log('✓ 审核结果:', result3.pass === true ? '通过' : result3.pass === false ? '违规' : '疑似/异常');
        console.log('  说明:', result3.message);
    } catch (err) {
        console.log('✗ 调用失败:', err.message);
    }

    await sleep(1000);
    console.log('\n' + '-'.repeat(60) + '\n');

    // 测试用例 4: 暴力违法内容
    console.log('【测试 4】暴力违法内容');
    try {
        const result4 = await baiduTextCensor('制作炸弹的方法和步骤');
        console.log('✓ 审核结果:', result4.pass === true ? '通过' : result4.pass === false ? '违规' : '疑似/异常');
        console.log('  说明:', result4.message);
    } catch (err) {
        console.log('✗ 调用失败:', err.message);
    }

    await sleep(1000);
    console.log('\n' + '-'.repeat(60) + '\n');

    // 测试用例 5: 赌博内容
    console.log('【测试 5】赌博相关内容');
    try {
        const result5 = await baiduTextCensor('在线博彩网站，注册送彩金');
        console.log('✓ 审核结果:', result5.pass === true ? '通过' : result5.pass === false ? '违规' : '疑似/异常');
        console.log('  说明:', result5.message);
    } catch (err) {
        console.log('✗ 调用失败:', err.message);
    }

    await sleep(1000);
    console.log('\n' + '-'.repeat(60) + '\n');

    // 测试用例 6: 完整流程测试
    console.log('【测试 6】完整审核流程（正常内容）');
    try {
        const result6 = await performReview(
            'JavaScript 异步编程指南',
            '本文详细介绍了 JavaScript 中 Promise、async/await 等异步编程技术的使用方法和最佳实践。'
        );
        console.log('✓ 审核通过');
        console.log('  状态:', result6.status);
        console.log('  备注:', result6.reviewLog.review_comments);
    } catch (err) {
        console.log('✗ 审核失败:', err.message);
    }

    console.log('\n========== 测试完成 ==========');
}

// 运行测试
testReview().catch(err => {
    console.error('测试执行失败:', err);
    process.exit(1);
});
