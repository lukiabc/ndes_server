var express = require('express');
var router = express.Router();

const { Sequelize, Op } = require('sequelize');
const { User } = require('../utils/db');
const { sign } = require('jsonwebtoken');
const upload = require('../utils/upload');
const jwtAuth = require('../utils/jwt');

// 获取role_id不为1的用户列表
router.get('/list', async (req, res) => {
    try {
        const users = await User.findAll({
            where: {
                role_id: {
                    [Sequelize.Op.not]: 1,
                },
            },
            attributes: [
                'user_id',
                'username',
                'avatar_url',
                'email',
                'role_id',
            ], // 指定需要返回的字段
        });

        if (users.length === 0) {
            return res.status(404).json({ error: '没有找到符合条件的用户' });
        }

        res.json({
            message: '获取成功',
            users: users.map((user) => ({
                user_id: user.user_id,
                username: user.username,
                avatar_url: user.avatar_url,
                email: user.email,
                role_id: user.role_id,
            })),
        });
    } catch (error) {
        console.error('获取用户列表失败：', error);
        res.status(500).json({ error: '服务器错误', details: error.message });
    }
});

// 获取用户详情
router.get('/details/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(userId, '获取用户详情');
    try {
        // 查询用户详情
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'username', 'avatar_url', 'email'],
        });

        if (!user) {
            return res.status(404).json({ error: '用户未找到' });
        }

        res.json({
            user_id: user.user_id,
            username: user.username,
            avatar_url: user.avatar_url,
            email: user.email,
        });

        console.log(user, '用户详情');
    } catch (error) {
        console.error('获取用户详情失败：', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 更新用户信息
router.put('/update/:userId', upload('avatar'), async (req, res) => {
    const { userId } = req.params;
    const { username, email } = req.body;
    const updated_at = new Date();

    let avatar_url = null;

    // 检查是否有上传文件
    if (req.file) {
        console.log(req.file.filename, 'req.file');
        avatar_url = `http://localhost:3000/uploads/${req.file.filename}`;
    }

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户未找到' });
        }

        // 只有当有新文件时才更新 avatar_url，否则保留原值
        await user.update({
            username,
            email,
            avatar_url: avatar_url || user.avatar_url, // 保留旧头像
            updated_at,
        });

        const updatedUser = await User.findByPk(userId);
        res.json({
            message: '用户信息更新成功',
            data: updatedUser.toJSON(),
        });
    } catch (error) {
        console.error('更新用户信息失败：', error);
        res.status(500).json({ error: '更新失败' });
    }
});

// 用户登录
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(req.body, '111');
    console.log(username, password, '登录');
    try {
        const user = await User.findOne({
            where: { username },
        });
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        if (password !== user.password) {
            return res.status(401).json({ error: '密码错误' });
        }
        const token = sign(
            { id: user.user_id, role: user.role_id },
            'suibian',
            { expiresIn: '1h' }
        );

        const userInfo = {
            code: 1,
            msg: '登录成功',
            result: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role_id: user.role_id,
                avatar_url: user.avatar_url,
                token: token,
            },
        };
        res.json({ userInfo });
    } catch (error) {
        console.error('登录失败：', error);
        res.status(500).json({ error: '登录失败' });
    }
});

router.get('/', function (req, res, next) {
    res.render('users', { title: '用户管理' });
});

module.exports = router;
