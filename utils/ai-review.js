const { filter } = require('./sensitive');

async function performReview(title, content) {
    const safeTitle = typeof title === 'string' ? title : '';
    const safeContent = typeof content === 'string' ? content : '';

    const titleCheck = filter(safeTitle);
    const contentCheck = filter(safeContent);

    const hitWords = [
        ...new Set([...titleCheck.hitWords, ...contentCheck.hitWords]),
    ];

    if (hitWords.length > 0) {
        throw new Error(`内容包含敏感词: ${hitWords.join(',')}`);
    }

    return {
        status: '待审',
        reviewLog: {
            reviewer: 'system',
            review_result: '通过初筛',
            review_comments: '[系统] 敏感词检测通过，进入人工审核队列。',
            review_time: new Date(),
        },
    };
}

module.exports = { performReview };
