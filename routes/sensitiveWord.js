const express = require('express');
const router = express.Router();
const { Sequelize, Op } = require('sequelize');
const { Article, Category, SensitiveWord } = require('../utils/db');
const { filter, addWord, removeWord } = require('../utils/sensitive');

// 模糊查询敏感词
router.get('/search', async (req, res) => {
    const q = req.query.q?.trim();
    if (!q) return res.status(400).json({ error: '查询关键词不能为空' });

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    try {
        const { count, rows } = await SensitiveWord.findAndCountAll({
            where: {
                word: {
                    [Sequelize.Op.like]: `%${q}%`, // 模糊匹配
                },
            },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset,
        });

        res.json({
            total: count,
            page,
            pageSize,
            keyword: q,
            list: rows,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '查询失败' });
    }
});

//  添加敏感词
router.post('/create', async (req, res) => {
    const { word, type = 'keyword' } = req.body;
    if (!word) return res.status(400).json({ error: 'word 不能为空' });
    if (!['keyword', 'regex'].includes(type)) {
        return res.status(400).json({ error: 'type 必须是 keyword 或 regex' });
    }

    try {
        await addWord(word, type);
        res.json({ message: '敏感词已添加', word, type });
    } catch (e) {
        if (e.message === '敏感词已存在') {
            return res.status(409).json({ error: '敏感词已存在' });
        }
        if (e.message.includes('正则表达式无效')) {
            return res.status(400).json({ error: e.message });
        }
        console.error(e);
        res.status(500).json({ error: '添加失败' });
    }
});

//  删除敏感词
router.delete('/delete/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);

    // 验证 id 是否有效
    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: '无效的ID' });
    }

    try {
        const sensitiveWord = await SensitiveWord.findByPk(id);
        if (!sensitiveWord) {
            return res.status(404).json({ error: '敏感词不存在' });
        }

        const word = sensitiveWord.word;

        // 执行删除
        const rows = await SensitiveWord.destroy({
            where: { id },
        });

        if (rows === 0) {
            return res.status(404).json({ error: '敏感词不存在' });
        }

        // 内存中同步删除
        removeWord(word);

        res.status(200).json({ message: '敏感词已删除', id, word });
    } catch (error) {
        console.error('删除敏感词时发生错误:', error);
        res.status(500).json({ error: '删除失败' });
    }
});
//  获取所有敏感词
router.get('/list', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    try {
        const { count, rows } = await SensitiveWord.findAndCountAll({
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset,
        });
        res.json({ total: count, page, pageSize, list: rows });
    } catch (e) {
        res.status(500).json({ error: '查询失败' });
    }
});

//  编辑敏感词
router.put('/update/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { word, type = 'keyword' } = req.body;
    if (!word) return res.status(400).json({ error: 'word 不能为空' });
    if (!['keyword', 'regex'].includes(type)) {
        return res.status(400).json({ error: 'type 无效' });
    }

    try {
        const record = await SensitiveWord.findByPk(id);
        if (!record) return res.status(404).json({ error: '敏感词不存在' });

        // 验证正则语法
        if (type === 'regex') {
            try {
                new RegExp(word, 'gi');
            } catch (e) {
                return res
                    .status(400)
                    .json({ error: `正则表达式无效: ${e.message}` });
            }
        }

        // 更新数据库
        await SensitiveWord.update({ word, type }, { where: { id } });

        //  重新加载缓存
        try {
            await loadWords(); // 重新加载全部词
        } catch (cacheError) {
            console.error('缓存加载失败:', cacheError);
        }

        res.json({ message: '更新成功' });
    } catch (error) {
        console.error('更新敏感词失败:', error);
        res.status(500).json({ error: '更新失败' });
    }
});

module.exports = router;
