// test-github.js
require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

(async () => {
    try {
        const { data } = await octokit.users.getAuthenticated();
        console.log('✅ Token 有效！用户:', data.login);
    } catch (err) {
        console.error('❌ 错误:', err.message);
    }
})();
