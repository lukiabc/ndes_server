// 中国时间获取器

/**
 * 返回一个 Sequelize 字段的 getter 函数，用于将数据库 DATETIME（视为东八区时间）
 * 转换为 "YYYY-MM-DD HH:mm:ss" 格式的字符串
 * @param {string} fieldName - 数据库字段名，如 'publish_date'
 * @returns {Function} Sequelize getter 函数
 */
function chinaDateTimeGetter(fieldName) {
    return function () {
        const raw = this.getDataValue(fieldName);
        if (!raw) return null;

        const pad = (n) => n.toString().padStart(2, '0');
        const year = raw.getFullYear();
        const month = pad(raw.getMonth() + 1);
        const day = pad(raw.getDate());
        const hours = pad(raw.getHours());
        const minutes = pad(raw.getMinutes());
        const seconds = pad(raw.getSeconds());

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
}

module.exports = chinaDateTimeGetter;
