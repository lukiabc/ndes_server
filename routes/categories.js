const express = require('express');
const router = express.Router();
const { Sequelize, DataTypes } = require('sequelize');
const { Op } = Sequelize;
const { Category } = require('../utils/db');

// 模糊查询分类
router.get('/search', async (req, res) => {
    const { category_name, page = 1, pageSize = 10 } = req.query; // 获取分页参数，默认值为第1页，每页10条

    if (
        !category_name ||
        typeof category_name !== 'string' ||
        category_name.trim() === ''
    ) {
        return res.status(400).json({ error: '缺少搜索关键词' });
    }

    const trimmedKeyword = category_name.trim();
    const offset = (parseInt(page) - 1) * parseInt(pageSize); // 计算偏移量
    const limit = parseInt(pageSize);

    try {
        // 查询符合条件的分类总数
        const total = await Category.count({
            where: {
                category_name: {
                    [Op.like]: `%${trimmedKeyword}%`,
                },
            },
        });

        // 查询当前页的数据
        const categories = await Category.findAll({
            where: {
                category_name: {
                    [Op.like]: `%${trimmedKeyword}%`,
                },
            },
            order: [['sort_order', 'ASC']],
            offset: offset,
            limit: limit,
        });

        // 返回结构化响应
        res.json({
            code: 200,
            data: categories,
            pagination: {
                page: parseInt(page),
                pageSize: limit,
                total: total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('搜索分类失败:', error);
        res.status(500).json({
            error: '搜索分类失败',
            detail: error.message,
        });
    }
});

// 获取分类列表
router.get('/list', async (req, res) => {
    try {
        const categories = await Category.findAll();
        res.json(categories);
    } catch {
        res.status(500).json({ error: '获取分类列表失败' });
    }
});

// 创建分类
router.post('/create', async (req, res) => {
    const { category_name, parent_id } = req.body;
    try {
        const category = await Category.create({
            category_name,
            parent_id: parent_id || null, // 默认父分类ID为null
        });
        res.status(200).json({ message: '分类创建成功', category });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '分类创建失败' });
    }
});

// 编辑分类
router.put('/update/:category_id', async (req, res) => {
    const { category_name, parent_id, sort_order } = req.body;
    const category_id = parseInt(req.params.category_id);
    try {
        const [updatedRows] = await Category.update(
            {
                category_name,
                sort_order,
                parent_id: parent_id || null,
            },
            { where: { category_id } }
        );

        if (updatedRows === 0) {
            return res.status(404).json({ error: '分类未找到' });
        }

        res.status(200).json({ message: '分类更新成功' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '分类更新失败' });
    }
});

// 删除分类
router.delete('/delete/:category_id', async (req, res) => {
    const category_id = parseInt(req.params.category_id);
    try {
        const deletedRows = await Category.destroy({ where: { category_id } });

        if (deletedRows === 0) {
            return res.status(404).json({ error: '分类未找到' });
        }

        res.status(200).json({ message: '分类删除成功' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '分类删除失败' });
    }
});

// 删除分类及其所有子分类
router.delete('/deleteAll/:category_id', async (req, res) => {
    const category_id = parseInt(req.params.category_id);
    try {
        // 递归删除所有子分类
        const deleteCategoryAndChildren = async (id) => {
            const children = await Category.findAll({
                where: { parent_id: id },
            });
            for (const child of children) {
                await deleteCategoryAndChildren(child.category_id);
            }
            await Category.destroy({ where: { category_id: id } });
        };

        await deleteCategoryAndChildren(category_id);

        res.status(200).json({ message: '分类及其所有子分类删除成功' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '分类删除失败' });
    }
});

router.get('/', function (req, res, next) {
    res.render('categories', { title: '分类管理' });
});

module.exports = router;
