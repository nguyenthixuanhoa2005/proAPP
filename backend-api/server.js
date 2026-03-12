const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./src/config/db');   //kết nối db qua file riêng

const app = express();
const port = 3000;

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

app.use(express.json());
app.use(cors());

const toMs = (expiresIn) => {
    const value = String(expiresIn).trim();
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) {
        return 30 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const factors = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };

    return amount * factors[unit];
};

const refreshTokenExpiresMs = toMs(REFRESH_TOKEN_EXPIRES_IN);

const sanitizeUser = (row, roles = []) => ({
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    status: row.status,
    roles,
    primaryRole: roles[0] || 'USER',
});

const getUserRoles = async (userId) => {
    const roleResult = await db.query(
        `SELECT r.role_name
         FROM user_role ur
         JOIN role r ON ur.role_id = r.role_id
         WHERE ur.user_id = $1
         ORDER BY r.role_name`,
        [userId]
    );

    return roleResult.rows.map((r) => String(r.role_name || '').toUpperCase()).filter(Boolean);
};

const buildTokenPayload = (user) => ({
    sub: user.user_id,
    email: user.email,
    fullName: user.full_name,
});

const issueAccessToken = (user) => jwt.sign(buildTokenPayload(user), ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
});

const issueRefreshToken = (user) => jwt.sign(
    {
        sub: user.user_id,
        tokenType: 'refresh',
    },
    REFRESH_TOKEN_SECRET,
    {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    }
);

const saveRefreshToken = async (userId, refreshToken, req) => {
    const expiredAt = new Date(Date.now() + refreshTokenExpiresMs);
    const deviceInfo = String(req.headers['user-agent'] || 'unknown').slice(0, 100);
    const ipAddress = String(req.ip || req.connection?.remoteAddress || 'unknown').slice(0, 50);

    await db.query(
        `INSERT INTO refresh_token (user_id, token, expired_at, device_info, ip_address, is_revoked)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [userId, refreshToken, expiredAt, deviceInfo, ipAddress]
    );
};

const issueTokenPair = async (user, req) => {
    const accessToken = issueAccessToken(user);
    const refreshToken = issueRefreshToken(user);
    await saveRefreshToken(user.user_id, refreshToken, req);

    return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    };
};

const verifyPassword = async (plainPassword, storedPasswordHash) => {
    if (!storedPasswordHash) {
        return false;
    }

    // Hỗ trợ dữ liệu cũ đang lưu plain-text trong file seed.
    if (storedPasswordHash.startsWith('$2a$') || storedPasswordHash.startsWith('$2b$')) {
        return bcrypt.compare(plainPassword, storedPasswordHash);
    }

    return plainPassword === storedPasswordHash;
};

// --- CẤU HÌNH UPLOAD ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// --- API 1: AI DETECT ---
app.post('/api/ai/detect-ingredients', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const type = req.query.type || 'image';

        if (!file) return res.status(400).json({ error: 'Vui lòng upload file' });

        // 1. Gọi sang Python Service
        // Trong server.js
        const aiServiceUrl = type === 'voice' 
            ? 'http://localhost:5000/detect/voice' // <-- Đổi thành 5000
            : 'http://localhost:5000/detect/image'; // cổng bên python AI

        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path));

        const aiResponse = await axios.post(aiServiceUrl, formData, {
            headers: { ...formData.getHeaders() }
        });

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        const aiKeywords = aiResponse.data.detected_ingredients || [];

        // 2. Tra cứu DB
        if (aiKeywords.length === 0) {
            return res.json({ status: 'success', ingredients: [] });
        }

        const promises = aiKeywords.map(keyword => {
            return db.query(`SELECT * FROM ingredient WHERE name ILIKE $1 LIMIT 3`, [`%${keyword}%`]);
        });

        const results = await Promise.all(promises);
        let foundIngredients = [];
        results.forEach(result => foundIngredients = foundIngredients.concat(result.rows));

        const uniqueIngredients = foundIngredients.filter((value, index, self) =>
            index === self.findIndex((t) => t.ingredient_id === value.ingredient_id)
        );

        res.json({
            status: 'success',
            ai_text: aiResponse.data.raw_text,
            ingredients: uniqueIngredients 
        });

    } catch (error) {
        console.error("❌ Lỗi API AI:", error.message);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Lỗi server' });
    }
});

// --- API 2: RECIPE RECOMMEND (MỚI THÊM) ---
app.post('/api/recipes/recommend', async (req, res) => {
    try {
        const { ingredient_ids } = req.body;

        if (!ingredient_ids || !Array.isArray(ingredient_ids) || ingredient_ids.length === 0) {
            return res.status(400).json({ error: 'Danh sách nguyên liệu không hợp lệ' });
        }

        console.log("🔍 Tìm món cho ID:", ingredient_ids);

        const recipeQuery = `
            SELECT 
                r.recipe_id, 
                r.title, 
                r.image_url, 
                r.cooking_time,
                r.difficulty,
                COUNT(ri.ingredient_id) as match_count
            FROM recipe r
            JOIN recipe_ingredient ri ON r.recipe_id = ri.recipe_id
            WHERE ri.ingredient_id = ANY($1::int[]) 
            GROUP BY r.recipe_id, r.title, r.image_url, r.cooking_time, r.difficulty
            ORDER BY match_count DESC
            LIMIT 10
        `;

        const result = await db.query(recipeQuery, [ingredient_ids]);

        res.json({
            status: 'success',
            total_found: result.rows.length,
            recipes: result.rows
        });

    } catch (error) {
        console.error("❌ Lỗi API Gợi ý:", error.message);
        res.status(500).json({ error: 'Lỗi truy vấn món ăn' });
    }
});

// --- API 3: INTERNAL - GET ALL INGREDIENTS FOR AI SERVICE ---
app.get('/api/internal/all-ingredients', async (req, res) => {
    try {
        console.log("🔄 Yêu cầu lấy danh sách nguyên liệu từ AI Service...");
        const result = await db.query('SELECT name FROM ingredient');
        const ingredientNames = result.rows.map(row => row.name);
        res.json(ingredientNames);
        console.log(`✅ Đã gửi ${ingredientNames.length} nguyên liệu cho AI Service.`);
    } catch (error) {
        console.error("❌ Lỗi API all-ingredients:", error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách nguyên liệu' });
    }
});

// --- API AUTH: EMAIL/PASSWORD ---
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Email và mật khẩu là bắt buộc',
            });
        }

        const userResult = await db.query(
            `SELECT user_id, email, password_hash, full_name, avatar_url, status, deleted_at
             FROM app_user
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [email]
        );

        const user = userResult.rows[0];
        if (!user || user.deleted_at || user.status !== 'ACTIVE') {
            return res.status(401).json({
                status: 'error',
                message: 'Tài khoản không tồn tại hoặc đã bị khóa',
            });
        }

        const passwordValid = await verifyPassword(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Sai email hoặc mật khẩu',
            });
        }

        const tokens = await issueTokenPair(user, req);

        const roles = await getUserRoles(user.user_id);
        return res.json({
            status: 'success',
            user: sanitizeUser(user, roles),
            ...tokens,
        });
    } catch (error) {
        console.error('❌ Lỗi login:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi đăng nhập',
        });
    }
});

app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        if (!refreshToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Thiếu refresh token',
            });
        }

        let payload;
        try {
            payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        } catch (error) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token không hợp lệ hoặc đã hết hạn',
            });
        }

        const tokenResult = await db.query(
            `SELECT token_id, user_id, is_revoked, expired_at
             FROM refresh_token
             WHERE token = $1
             LIMIT 1`,
            [refreshToken]
        );

        const tokenRow = tokenResult.rows[0];
        if (!tokenRow || tokenRow.is_revoked || new Date(tokenRow.expired_at) <= new Date()) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token đã bị thu hồi hoặc hết hạn',
            });
        }

        const userResult = await db.query(
            `SELECT user_id, email, password_hash, full_name, avatar_url, status, deleted_at
             FROM app_user
             WHERE user_id = $1
             LIMIT 1`,
            [payload.sub]
        );

        const user = userResult.rows[0];
        if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
            return res.status(401).json({
                status: 'error',
                message: 'Tài khoản không hợp lệ',
            });
        }

        await db.query('UPDATE refresh_token SET is_revoked = true WHERE token_id = $1', [tokenRow.token_id]);

        const tokens = await issueTokenPair(user, req);
        const roles = await getUserRoles(user.user_id);
        return res.json({
            status: 'success',
            user: sanitizeUser(user, roles),
            ...tokens,
        });
    } catch (error) {
        console.error('❌ Lỗi refresh token:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi refresh token',
        });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        if (refreshToken) {
            await db.query('UPDATE refresh_token SET is_revoked = true WHERE token = $1', [refreshToken]);
        }

        return res.json({
            status: 'success',
            message: 'Đăng xuất thành công',
        });
    } catch (error) {
        console.error('❌ Lỗi logout:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi đăng xuất',
        });
    }
});

const socialAuthHandler = async (req, res) => {
    try {
        const { idToken } = req.body || {};

        const verifyGoogleIdToken = async (token) => {
            const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
                params: { id_token: token },
                timeout: 8000,
            });

            const payload = response.data || {};
            if (!payload.email || payload.email_verified !== 'true') {
                throw new Error('Google token hợp lệ nhưng email chưa xác thực');
            }

            return {
                email: payload.email,
                fullName: payload.name || null,
                avatarUrl: payload.picture || null,
            };
        };

        if (!idToken) {
            return res.status(400).json({
                status: 'error',
                message: 'Thiếu idToken từ Google',
            });
        }
        const socialProfile = await verifyGoogleIdToken(idToken);

        const normalizedEmail = String(socialProfile.email).trim().toLowerCase();
        let userResult = await db.query(
            `SELECT user_id, email, password_hash, full_name, avatar_url, status, deleted_at
             FROM app_user
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [normalizedEmail]
        );

        let user = userResult.rows[0];
        const provider = 'google';

        if (!user) {
            const generatedHash = await bcrypt.hash(`SOCIAL_${provider}_${crypto.randomUUID()}`, 10);
            const inserted = await db.query(
                `INSERT INTO app_user (email, password_hash, full_name, avatar_url, status)
                 VALUES ($1, $2, $3, $4, 'ACTIVE')
                 RETURNING user_id, email, password_hash, full_name, avatar_url, status, deleted_at`,
                [
                    normalizedEmail,
                    generatedHash,
                    socialProfile.fullName || null,
                    socialProfile.avatarUrl || null,
                ]
            );
            user = inserted.rows[0];
        } else {
            await db.query(
                `UPDATE app_user
                 SET full_name = COALESCE($2, full_name),
                     avatar_url = COALESCE($3, avatar_url)
                 WHERE user_id = $1`,
                [user.user_id, socialProfile.fullName, socialProfile.avatarUrl]
            );

            const refreshed = await db.query(
                `SELECT user_id, email, password_hash, full_name, avatar_url, status, deleted_at
                 FROM app_user
                 WHERE user_id = $1
                 LIMIT 1`,
                [user.user_id]
            );
            user = refreshed.rows[0];
        }

        if (user.status !== 'ACTIVE' || user.deleted_at) {
            return res.status(401).json({
                status: 'error',
                message: 'Tài khoản đã bị khóa',
            });
        }

        const tokens = await issueTokenPair(user, req);
        const roles = await getUserRoles(user.user_id);
        return res.json({
            status: 'success',
            provider,
            user: sanitizeUser(user, roles),
            ...tokens,
        });
    } catch (error) {
        console.error('❌ Lỗi social login google:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi đăng nhập google',
        });
    }
};

// API social login (payload nhận từ mobile sau khi xác thực ở SDK client)
app.post('/api/auth/social/google', socialAuthHandler);

app.listen(port, () => {
    console.log(`🚀 Server Node.js đang chạy tại http://localhost:${port}`);
});