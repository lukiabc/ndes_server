var express = require('express');
var router = express.Router();

const { Op } = require('sequelize');
const { User } = require('../utils/db');
const { sign } = require('jsonwebtoken');
const jwtAuth = require('../utils/jwt');
const captchaStore = require('../utils/captchaStore');
const { comparePassword, hashPassword } = require('../utils/bcrypt');
const { sendEmail } = require('../utils/email');

// 获取 role_id 不为 1 的用户列表，支持按 username 或 email 模糊搜索
router.get('/list', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
        100,
        Math.max(1, parseInt(req.query.pageSize) || 10)
    );
    const keyword = req.query.keyword?.trim() || '';

    const limit = pageSize;
    const offset = (page - 1) * limit;

    try {
        // 基础条件 排除管理员 role_id != 1
        const where = {
            role_id: { [Op.ne]: 1 },
        };

        // 如有关键词 添加模糊匹配条件 username 或 email
        if (keyword) {
            where[Op.or] = [
                { username: { [Op.like]: `%${keyword}%` } },
                { email: { [Op.like]: `%${keyword}%` } },
            ];
        }

        // 使用 findAndCountAll 获取总数和当前页数据
        const { count, rows } = await User.findAndCountAll({
            where,
            attributes: [
                'user_id',
                'username',
                'avatar_url',
                'email',
                'role_id',
                'status',
                'is_disabled',
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']],
        });

        if (rows.length === 0 && page > 1) {
            return res.status(404).json({ error: '没有更多数据' });
        }

        res.json({
            message: '获取成功',
            keyword: keyword || null,
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
                status: user.status,
                is_disabled: user.is_disabled,
            })),
        });
    } catch (error) {
        console.error('获取用户列表失败：', error);
        res.status(500).json({
            error: '服务器错误',
            detail:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
        });
    }
});

// 获取用户详情
router.get('/details/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log(userId, '获取用户详情');
    try {
        // 根据主键查找用户
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
router.put('/update/:userId', async (req, res) => {
    const { userId } = req.params;
    const { username, email, avatar_url } = req.body;
    const updated_at = new Date();

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户未找到' });
        }

        await user.update({
            username,
            email,
            avatar_url,
            updated_at,
        });

        // 重新查询以返回最新数据
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

    // 获取验证码
    const storedCaptcha = captchaStore.get(captchaId);
    if (!storedCaptcha) {
        return res.status(400).json({ error: '验证码已过期，请刷新' });
    }

    // 忽略大小写比对验证码
    if (storedCaptcha.toLowerCase() !== captcha.toLowerCase()) {
        return res.status(400).json({ error: '验证码错误' });
    }

    try {
        // 查找用户名对应的用户
        const user = await User.findOne({ where: { username } });

        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 检查审核状态
        if (user.status !== 'approved') {
            return res
                .status(403)
                .json({ error: '账户尚未通过审核，请联系管理员' });
        }

        // 检查是否被禁用
        if (user.is_disabled) {
            return res
                .status(403)
                .json({ error: '账号已被禁用，请联系管理员' });
        }

        // 比对密码 使用 bcrypt 中的 comparePassword 方法
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        // 生成 JWT token 有效期 7 天
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

        captchaStore.delete(captchaId); // 清除已使用的验证码 防止重放攻击
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

        //  默认头像
        const defaultAvatar = 'http://localhost:3000/uploads/kk.jpg';

        // 创建新用户
        const newUser = await User.create({
            username,
            password: await hashPassword(password), // 密码加密存储
            email,
            avatar_url: defaultAvatar,
            role_id: 2,
            status: 'pending', // 待审核
            created_at: new Date(),
            updated_at: new Date(),
        });

        // 发送“待审核”邮件通知
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
    if (req.auth && req.auth.role !== 1) {
        return res.status(403).json({ error: '需要管理员权限' });
    }

    try {
        // 查询所有待审核用户（不包括管理员）
        const pendingUsers = await User.findAll({
            where: {
                status: 'pending',
                role_id: { [Op.ne]: 1 },
            },
            attributes: [
                'user_id',
                'username',
                'avatar_url',
                'email',
                'role_id',
                'status',
                'is_disabled',
            ],
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
        // 查询用户
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

        // 更新审核状态
        await user.update({ status: action, updated_at: new Date() });

        // 根据审核结果发送邮件
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

// 禁用或启用用户账号（仅管理员）
router.post('/disable/:userId', jwtAuth, async (req, res) => {
    if (req.auth?.role !== 1) {
        return res.status(403).json({ error: '需要管理员权限' });
    }

    const { userId } = req.params;
    const { disable } = req.body; // true 表示禁用 false 表示启用

    if (typeof disable !== 'boolean') {
        return res.status(400).json({ error: 'disable 必须是布尔值' });
    }

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        if (user.role_id === 1) {
            return res.status(400).json({ error: '不能操作管理员账号' });
        }

        // 如果状态未改变，直接返回
        if (user.is_disabled === disable) {
            return res.json({ message: '状态未改变' });
        }

        // 更新禁用状态
        await user.update({ is_disabled: disable, updated_at: new Date() });

        // 发送邮件：根据 disable 状态决定内容
        if (user.email) {
            let subject, html;

            if (disable) {
                // 禁用账号
                subject = '【账号异常】您的账号已被禁用';
                html = `
                    <h3>您好，${user.username}！</h3>
                    <p>很抱歉地通知您，您的账号因违反平台规则或存在异常行为，已被管理员<strong>临时禁用</strong>。</p>
                    <p>如您认为这是误操作，请联系管理员申诉。</p>
                    <hr>
                    <p><i>此为系统自动邮件，请勿回复。</i></p>
                `;
            } else {
                // 解禁账号
                subject = '【账号恢复】您的账号已恢复正常';
                html = `
                    <h3>您好，${user.username}！</h3>
                    <p>好消息！您的账号现已<strong>解除禁用</strong>，可以正常登录和使用平台服务。</p>
                    <p>感谢您的理解与支持！</p>
                    <hr>
                    <p><i>此为系统自动邮件，请勿回复。</i></p>
                `;
            }

            sendEmail(user.email, subject, html).catch(console.error);
        }

        const actionText = disable ? '禁用' : '启用';
        res.json({ message: `用户账号已成功${actionText}` });
    } catch (error) {
        console.error('操作账号禁用状态失败:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

router.get('/', function (req, res, next) {
    res.render('users', { title: '用户管理' });
});

module.exports = router;
