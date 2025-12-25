var express = require('express');
var router = express.Router();

const { Sequelize, Op } = require('sequelize');
const { User } = require('../utils/db');
const { sign } = require('jsonwebtoken');
const upload = require('../utils/upload');
const jwtAuth = require('../utils/jwt');
const captchaStore = require('../utils/captchaStore');
const { comparePassword, hashPassword } = require('../utils/bcrypt');
const { sendEmail } = require('../utils/email');

// 获取role_id不为1的用户列表
router.get('/list', async (req, res) => {
    // 从查询参数获取分页参数，默认第1页，每页10条
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    // 安全限制：防止 pageSize 过大
    const limit = Math.min(pageSize, 100); // 最多100条/页
    const offset = (page - 1) * limit;

    try {
        const { count, rows } = await User.findAndCountAll({
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
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']], // 按创建时间倒序
        });

        if (rows.length === 0 && page > 1) {
            return res.status(404).json({ error: '没有更多数据' });
        }

        res.json({
            message: '获取成功',
            pagination: {
                total: count,
                page,
                pageSize: limit,
                totalPages: Math.ceil(count / limit),
            },
            users: rows.map((user) => ({
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
    const { username, password, captcha, captchaId } = req.body;

    // 校验验证码
    if (!captcha || !captchaId) {
        return res.status(400).json({ error: '验证码或ID缺失' });
    }

    const storedCaptcha = captchaStore.get(captchaId);
    if (!storedCaptcha) {
        return res.status(400).json({ error: '验证码已过期，请刷新' });
    }

    if (storedCaptcha.toLowerCase() !== captcha.toLowerCase()) {
        return res.status(400).json({ error: '验证码错误' });
    }

    try {
        const user = await User.findOne({ where: { username } });

        // 统一错误提示，防止信息泄露
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 检查审核状态
        if (user.status !== 'approved') {
            return res
                .status(403)
                .json({ error: '账户尚未通过审核，请联系管理员' });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const token = sign(
            { id: user.user_id, role: user.role_id },
            'suibian',
            { expiresIn: '7d' }
        );

        const userInfo = {
            code: 1,
            msg: '登录成功',
            result: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                role_id: user.role_id,
                avatar_url: user.avatar_url || '',
                token,
            },
        };

        captchaStore.delete(captchaId); // 清除验证码
        return res.json({ userInfo });
    } catch (error) {
        console.error('登录失败：', error);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

// 注册
router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    try {
        // 检查用户名或邮箱是否已存在
        const existing = await User.findOne({
            where: {
                [Op.or]: [{ username }, { email }],
            },
        });
        if (existing) {
            return res.status(409).json({ error: '用户名或邮箱已被注册' });
        }

        // 创建新用户（默认 role_id=2，status=pending）
        const newUser = await User.create({
            username,
            password: await hashPassword(password),
            email,
            role_id: 2,
            status: 'pending', // 待审核
            created_at: new Date(),
            updated_at: new Date(),
        });

        // 发送“待审核”邮件（可选）
        if (email) {
            sendEmail(
                email,
                '【注册成功】请等待管理员审核',
                `
        <h3>您好，${username}！</h3>
        <p>您的注册申请已提交，当前状态为：<strong>待审核</strong>。</p>
        <p>管理员将在 1-3 个工作日内完成审核，请耐心等待。</p>
        <hr>
        <p><i>此为系统自动邮件，请勿回复。</i></p>
      `
            ).catch(console.error);
        }

        res.status(201).json({ message: '注册成功，请等待管理员审核' });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 获取待审核用户
router.get('/pending', jwtAuth, async (req, res) => {
    // 手动检查是否为管理员（因为 jwtAuth 不校验角色）
    if (req.auth && req.auth.role !== 1) {
        return res.status(403).json({ error: '需要管理员权限' });
    }

    try {
        const pendingUsers = await User.findAll({
            where: {
                status: 'pending',
                role_id: { [Op.ne]: 1 },
            },
            attributes: ['user_id', 'username', 'email', 'created_at'],
        });
        res.json({ users: pendingUsers });
    } catch (error) {
        console.error('获取待审核用户失败:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 审核用户
router.post('/review/:userId', jwtAuth, async (req, res) => {
    if (req.auth && req.auth.role !== 1) {
        return res.status(403).json({ error: '需要管理员权限' });
    }

    const { userId } = req.params;
    const { action } = req.body;

    if (!['approved', 'rejected'].includes(action)) {
        return res
            .status(400)
            .json({ error: 'action 必须是 approved 或 rejected' });
    }

    try {
        const user = await User.findByPk(userId);
        if (!user || !user.email) {
            return res.status(404).json({ error: '用户不存在或未绑定邮箱' });
        }
        if (user.role_id === 1) {
            return res.status(400).json({ error: '不能审核管理员账号' });
        }
        if (user.status !== 'pending') {
            return res.status(400).json({ error: '该用户无需审核' });
        }

        await user.update({ status: action, updated_at: new Date() });

        // 发送邮件
        let subject, html;
        if (action === 'approved') {
            subject = '【审核通过】您的账户已激活！';
            html = `<h3>您好，${user.username}！</h3>
              <p>🎉 恭喜！您的账户已通过管理员审核，现在可以登录系统了。</p>
              <p><a href="http://localhost:3000/login">立即登录</a></p>`;
        } else {
            subject = '【审核未通过】';
            html = `<h3>您好，${user.username}！</h3>
              <p>很抱歉，您的账户未能通过审核。</p>
              <p>如有疑问，请联系管理员。</p>`;
        }

        sendEmail(user.email, subject, html).catch(console.error);

        res.json({
            message: `用户已${action === 'approved' ? '批准' : '拒绝'}`,
        });
    } catch (error) {
        console.error('审核失败:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.get('/', function (req, res, next) {
    res.render('users', { title: '用户管理' });
});

module.exports = router;
