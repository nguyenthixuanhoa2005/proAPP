const express = require('express');
require('dotenv').config();
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
const AppError = require('./src/errors/AppError');
const asyncHandler = require('./src/errors/asyncHandler');
const errorHandler = require('./src/errors/errorHandler');
const {
    recommendRecipesByIngredientIds,
} = require('./src/services/recipeRecommendService');
const {
    getCloudinaryConfigSummary,
    uploadImageFromPath,
} = require('./src/services/cloudinaryService');
const {
    addIngredient,
} = require('./src/services/adminIngredientService');

const app = express();
const port = Number(process.env.PORT || 3000);
const AI_SERVICE_BASE_URL = String(process.env.AI_SERVICE_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const AI_SERVICE_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS || 30000);

const ACCESS_TOKEN_SECRET = String(process.env.JWT_ACCESS_SECRET || '').trim();
const REFRESH_TOKEN_SECRET = String(process.env.JWT_REFRESH_SECRET || '').trim();
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const INGREDIENT_STATUS_ACTIVE = 'ACTIVE';
const INGREDIENT_STATUS_HIDDEN = 'HIDDEN';
let ingredientSoftDeleteReady = false;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new Error('Thiếu JWT_ACCESS_SECRET hoặc JWT_REFRESH_SECRET trong .env');
}

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

const ensureUserRoleAssigned = async (userId, roleName = 'USER') => {
    const normalizedRole = String(roleName || 'USER').trim().toUpperCase();

    let roleResult = await db.query(
        `SELECT role_id
         FROM role
         WHERE UPPER(role_name) = UPPER($1)
         LIMIT 1`,
        [normalizedRole]
    );

    let roleId = roleResult.rows[0]?.role_id;
    if (!roleId) {
        const insertedRole = await db.query(
            `INSERT INTO role (role_name)
             VALUES ($1)
             ON CONFLICT (role_name) DO UPDATE SET role_name = EXCLUDED.role_name
             RETURNING role_id`,
            [normalizedRole]
        );
        roleId = insertedRole.rows[0]?.role_id;
    }

    if (!roleId) {
        throw new Error('Khong tao duoc role mac dinh cho user');
    }

    await db.query(
        `INSERT INTO user_role (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleId]
    );
};

const getBearerToken = (req) => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.slice('Bearer '.length).trim() || null;
};

const authenticateAccessToken = async (req, res, next) => {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({
                status: 'error',
                message: 'Thiếu access token',
            });
        }

        let payload;
        try {
            payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
        } catch (error) {
            return res.status(401).json({
                status: 'error',
                message: 'Access token không hợp lệ hoặc đã hết hạn',
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
                message: 'Phiên đăng nhập không còn hợp lệ',
            });
        }

        req.authUser = user;
        next();
    } catch (error) {
        console.error('❌ Lỗi authenticateAccessToken:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi xác thực phiên',
        });
    }
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

const ensureIngredientSoftDeleteReady = async () => {
    if (ingredientSoftDeleteReady) {
        return;
    }

    await db.query(
        `ALTER TABLE ingredient
         ADD COLUMN IF NOT EXISTS status VARCHAR(20)
         CHECK (status IN ('ACTIVE', 'HIDDEN'))
         DEFAULT 'ACTIVE'`
    );

    await db.query(
        `UPDATE ingredient
         SET status = $1
         WHERE status IS NULL`,
        [INGREDIENT_STATUS_ACTIVE]
    );

    ingredientSoftDeleteReady = true;
};

const requireBodyField = (value, message) => {
    if (!value) {
        throw new AppError(message, 400);
    }
};

const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const expandAiKeywords = (keywords) => {
    const expanded = new Set();

    (keywords || []).forEach((keyword) => {
        const raw = String(keyword || '').trim();
        if (!raw) {
            return;
        }

        expanded.add(raw);
        const normalized = normalizeText(raw);

        // Nếu AI trả tên cụ thể không trùng DB, thêm từ khóa theo họ để tăng tỉ lệ match.
        if (normalized.includes('ca')) {
            expanded.add('Cá');
        }
        if (normalized.includes('thit bo') || normalized.includes('bo nac')) {
            expanded.add('Thịt bò');
        }
        if (normalized.includes('thit ga')) {
            expanded.add('Thịt gà');
        }
    });

    return [...expanded];
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
        const aiServiceUrl = type === 'voice'
            ? `${AI_SERVICE_BASE_URL}/detect/voice`
            : `${AI_SERVICE_BASE_URL}/detect/image`;

        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path));

        const aiResponse = await axios.post(aiServiceUrl, formData, {
            headers: { ...formData.getHeaders() },
            timeout: AI_SERVICE_TIMEOUT_MS,
        });

        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        const aiKeywords = aiResponse.data.detected_ingredients || [];
        const keywordsForLookup = expandAiKeywords(aiKeywords);

        // 2. Tra cứu DB
        if (keywordsForLookup.length === 0) {
            return res.json({
                status: 'success',
                ai_text: aiResponse.data.raw_text || '',
                detected_ingredients: [],
                ingredients: [],
            });
        }

        await ensureIngredientSoftDeleteReady();

        const promises = keywordsForLookup.map(keyword => {
            return db.query(
                `SELECT *
                 FROM ingredient
                 WHERE name ILIKE $1
                   AND status = $2
                 LIMIT 3`,
                [`%${keyword}%`, INGREDIENT_STATUS_ACTIVE]
            );
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
            detected_ingredients: aiKeywords,
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

        console.log("🔍 Tìm món cho ID:", ingredient_ids);
        const rows = await recommendRecipesByIngredientIds(db, ingredient_ids);

        res.json({
            status: 'success',
            total_found: rows.length,
            recipes: rows
        });

    } catch (error) {
        if (error.statusCode === 400) {
            return res.status(400).json({ error: error.message });
        }
        console.error("❌ Lỗi API Gợi ý:", error.message);
        res.status(500).json({ error: 'Lỗi truy vấn món ăn' });
    }
});

// --- API 3: INTERNAL - GET ALL INGREDIENTS FOR AI SERVICE ---
app.get('/api/internal/all-ingredients', async (req, res) => {
    try {
        console.log("🔄 Yêu cầu lấy danh sách nguyên liệu từ AI Service...");
        await ensureIngredientSoftDeleteReady();
        const result = await db.query(
            `SELECT name
             FROM ingredient
             WHERE status = $1`,
            [INGREDIENT_STATUS_ACTIVE]
        );
        const ingredientNames = result.rows.map(row => row.name);
        res.json(ingredientNames);
        console.log(`✅ Đã gửi ${ingredientNames.length} nguyên liệu cho AI Service.`);
    } catch (error) {
        console.error("❌ Lỗi API all-ingredients:", error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách nguyên liệu' });
    }
});

// --- API 4: PUBLIC - INGREDIENT CATALOG FOR MOBILE ---
app.get('/api/ingredients', async (req, res) => {
    try {
        await ensureIngredientSoftDeleteReady();
        const result = await db.query(
            `SELECT ingredient_id, name, type, image_url, is_common, keywords
             FROM ingredient
             WHERE status = $1
             ORDER BY is_common DESC, ingredient_id ASC`,
            [INGREDIENT_STATUS_ACTIVE]
        );

        res.json({
            status: 'success',
            ingredients: result.rows,
        });
    } catch (error) {
        console.error("❌ Lỗi API ingredients:", error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách nguyên liệu' });
    }
});

// --- API 5: PUBLIC - TRENDING RECIPES FOR HOME ---
app.get('/api/recipes/trending', async (req, res) => {
    try {
        const parsedLimit = Number(req.query.limit || 20);
        const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100 ? parsedLimit : 20;

        const result = await db.query(
            `SELECT
                r.recipe_id,
                r.title,
                r.description,
                r.image_url,
                r.cooking_time,
                r.difficulty,
                COALESCE(u.full_name, 'NutriChef') AS author_name,
                COALESCE(ROUND(AVG(rt.score)::numeric, 1), 0) AS avg_rating,
                COUNT(DISTINCT rt.rating_id) AS rating_count,
                COUNT(DISTINCT fr.user_id) AS like_count
             FROM recipe r
             LEFT JOIN app_user u ON u.user_id = r.author_id
             LEFT JOIN rating rt ON rt.recipe_id = r.recipe_id
             LEFT JOIN favorite_recipe fr ON fr.recipe_id = r.recipe_id
             GROUP BY r.recipe_id, u.full_name
             ORDER BY avg_rating DESC, like_count DESC, r.recipe_id DESC
             LIMIT $1`,
            [limit]
        );

        res.json({
            status: 'success',
            recipes: result.rows,
        });
    } catch (error) {
        console.error('❌ Lỗi API recipes/trending:', error.message);
        res.status(500).json({ error: 'Lỗi truy vấn danh sách công thức' });
    }
});

app.get('/api/recipes/:id', async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        const result = await db.query(
            `SELECT
                r.recipe_id,
                r.title,
                r.description,
                r.ingredients_json,
                r.steps_json,
                r.dish_type,
                r.image_url,
                r.total_calories,
                r.cooking_time,
                r.difficulty,
                r.created_at,
                COALESCE(u.full_name, 'NutriChef') AS author_name,
                COALESCE(ROUND(AVG(rt.score)::numeric, 1), 0) AS avg_rating,
                COUNT(DISTINCT rt.rating_id) AS rating_count,
                COUNT(DISTINCT fr.user_id) AS like_count
             FROM recipe r
             LEFT JOIN app_user u ON u.user_id = r.author_id
             LEFT JOIN rating rt ON rt.recipe_id = r.recipe_id
             LEFT JOIN favorite_recipe fr ON fr.recipe_id = r.recipe_id
             WHERE r.recipe_id = $1
             GROUP BY r.recipe_id, u.full_name
             LIMIT 1`,
            [recipeId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Không tìm thấy công thức' });
        }

        return res.json({
            status: 'success',
            recipe: result.rows[0],
        });
    } catch (error) {
        console.error('❌ Lỗi API recipe detail:', error.message);
        return res.status(500).json({ error: 'Lỗi truy vấn chi tiết công thức' });
    }
});

app.get('/api/recipes/:id/favorite-status', authenticateAccessToken, async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        const result = await db.query(
            `SELECT 1
             FROM favorite_recipe
             WHERE user_id = $1
               AND recipe_id = $2
             LIMIT 1`,
            [req.authUser.user_id, recipeId]
        );

        return res.json({
            status: 'success',
            isFavorite: result.rows.length > 0,
        });
    } catch (error) {
        console.error('❌ Lỗi API favorite-status:', error.message);
        return res.status(500).json({ error: 'Lỗi kiểm tra trạng thái yêu thích' });
    }
});

app.post('/api/recipes/:id/favorite', authenticateAccessToken, async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        const recipeResult = await db.query(
            `SELECT recipe_id
             FROM recipe
             WHERE recipe_id = $1
             LIMIT 1`,
            [recipeId]
        );
        if (!recipeResult.rows.length) {
            return res.status(404).json({ error: 'Không tìm thấy công thức' });
        }

        await db.query(
            `INSERT INTO favorite_recipe (user_id, recipe_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, recipe_id) DO NOTHING`,
            [req.authUser.user_id, recipeId]
        );

        const likeCountResult = await db.query(
            `SELECT COUNT(*)::int AS like_count
             FROM favorite_recipe
             WHERE recipe_id = $1`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            isFavorite: true,
            likeCount: likeCountResult.rows[0]?.like_count || 0,
        });
    } catch (error) {
        console.error('❌ Lỗi API add favorite:', error.message);
        return res.status(500).json({ error: 'Lỗi thêm yêu thích công thức' });
    }
});

app.delete('/api/recipes/:id/favorite', authenticateAccessToken, async (req, res) => {
    try {
        const recipeId = Number(req.params.id);
        if (!Number.isInteger(recipeId) || recipeId <= 0) {
            return res.status(400).json({ error: 'ID công thức không hợp lệ' });
        }

        await db.query(
            `DELETE FROM favorite_recipe
             WHERE user_id = $1
               AND recipe_id = $2`,
            [req.authUser.user_id, recipeId]
        );

        const likeCountResult = await db.query(
            `SELECT COUNT(*)::int AS like_count
             FROM favorite_recipe
             WHERE recipe_id = $1`,
            [recipeId]
        );

        return res.json({
            status: 'success',
            isFavorite: false,
            likeCount: likeCountResult.rows[0]?.like_count || 0,
        });
    } catch (error) {
        console.error('❌ Lỗi API remove favorite:', error.message);
        return res.status(500).json({ error: 'Lỗi bỏ yêu thích công thức' });
    }
});

app.get('/api/internal/cloudinary-config', asyncHandler(async (req, res) => {
    const config = getCloudinaryConfigSummary();
    res.json({
        status: 'success',
        cloudinary: config,
    });
}));

// --- API AUTH: EMAIL/PASSWORD ---
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};

        requireBodyField(email, 'Email và mật khẩu là bắt buộc');
        requireBodyField(password, 'Email và mật khẩu là bắt buộc');

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
        if (error instanceof AppError) {
            return res.status(error.statusCode || 400).json({
                status: 'error',
                message: error.message,
                ...(error.details ? { details: error.details } : {}),
            });
        }

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

        if (payload.tokenType !== 'refresh' || !payload.sub) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token không hợp lệ',
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

        if (Number(tokenRow.user_id) !== Number(payload.sub)) {
            return res.status(401).json({
                status: 'error',
                message: 'Refresh token không khớp người dùng',
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
            const emailVerified = String(payload.email_verified).toLowerCase() === 'true';
            if (!payload.email || !emailVerified) {
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

        let socialProfile;
        try {
            socialProfile = await verifyGoogleIdToken(idToken);
        } catch (error) {
            return res.status(401).json({
                status: 'error',
                message: 'Google token không hợp lệ hoặc đã hết hạn',
            });
        }

        const normalizedEmail = String(socialProfile.email).trim().toLowerCase();
        const provider = 'google';
        let user;

        await db.query('BEGIN');

        try {
            const userResult = await db.query(
                `SELECT user_id, email, password_hash, full_name, avatar_url, status, deleted_at
                 FROM app_user
                 WHERE LOWER(email) = LOWER($1)
                 LIMIT 1`,
                [normalizedEmail]
            );

            user = userResult.rows[0];

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

            await ensureUserRoleAssigned(user.user_id, 'USER');
            await db.query('COMMIT');
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
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

app.get('/api/auth/me', authenticateAccessToken, async (req, res) => {
    try {
        const roles = await getUserRoles(req.authUser.user_id);
        return res.json({
            status: 'success',
            user: sanitizeUser(req.authUser, roles),
        });
    } catch (error) {
        console.error('❌ Lỗi lấy thông tin phiên:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Lỗi server khi lấy thông tin tài khoản',
        });
    }
});

// --- ADMIN INGREDIENTS API ---
app.post('/api/admin/upload/ingredient-image', authenticateAccessToken, upload.single('image'), asyncHandler(async (req, res) => {
    if (!req.file) {
        console.warn('❌ Upload ảnh: Không nhận được file');
        throw new AppError('Không có file được tải lên', 400);
    }

    try {
        console.log(`📁 Upload ảnh từ: ${req.file.path}`);
        const result = await uploadImageFromPath({
            filePath: req.file.path,
            scope: 'ingredients',
            entityId: 'img',
            suffix: Date.now(),
        });
        console.log(`✅ Upload ảnh thành công: ${result.imageUrl}`);
        res.json({ status: 'success', imageUrl: result.imageUrl, publicId: result.publicId });
    } catch (error) {
        console.error('❌ Lỗi upload ảnh:', error.message);
        throw new AppError(`Lỗi upload ảnh: ${error.message}`, 500);
    } finally {
        try { 
            if (req.file?.path) fs.unlinkSync(req.file.path); 
        } catch (_) {}
    }
}));

app.get('/api/admin/ingredients', authenticateAccessToken, asyncHandler(async (req, res) => {
    await ensureIngredientSoftDeleteReady();
    const result = await db.query(
        `SELECT ingredient_id, name, type, image_url, is_common, keywords, status
         FROM ingredient
         WHERE status = $1
         ORDER BY ingredient_id ASC`
        , [INGREDIENT_STATUS_ACTIVE]
    );
    console.log(`✅ Lấy danh sách nguyên liệu: ${result.rows.length} items`);
    res.json({ status: 'success', ingredients: result.rows });
}));

app.post('/api/admin/ingredients', authenticateAccessToken, asyncHandler(async (req, res) => {
    await ensureIngredientSoftDeleteReady();
    try {
        console.log('📥 POST /api/admin/ingredients - Received body:', JSON.stringify(req.body));
        const ingredient = await addIngredient(db, req.body || {});
        console.log(`✅ Thêm nguyên liệu mới: ID ${ingredient.ingredient_id} - ${ingredient.name}`);
        res.status(201).json({ status: 'success', ingredient });
    } catch (error) {
        console.error('❌ Lỗi thêm nguyên liệu:', error.message, error);
        throw error;
    }
}));

app.put('/api/admin/ingredients/:id', authenticateAccessToken, asyncHandler(async (req, res) => {
    await ensureIngredientSoftDeleteReady();
    const id = Number(req.params.id);
    console.log(`📥 PUT /api/admin/ingredients/${id} - ID:`, id, ', Body:', JSON.stringify(req.body));
    
    if (!Number.isInteger(id) || id <= 0) {
        console.warn(`❌ Sửa nguyên liệu: ID không hợp lệ - ${id}`);
        throw new AppError('ID nguyen lieu khong hop le', 400);
    }

    const { name, type, image_url, is_common, keywords } = req.body || {};
    console.log(`   Fields - name: "${name}", type: "${type}", is_common: ${is_common}, keywords: "${keywords}"`);
    
    if (!name || !type) {
        console.warn(`❌ Sửa nguyên liệu ${id}: Thiếu name hoặc type`);
        throw new AppError('Ten va loai nguyen lieu la bat buoc', 400);
    }

    const VALID_TYPES = ['MEAT', 'VEGETABLE', 'SPICE', 'FRUIT', 'STARCH', 'OTHER'];
    if (!VALID_TYPES.includes(type)) {
        console.warn(`❌ Sửa nguyên liệu ${id}: Type không hợp lệ - ${type}`);
        throw new AppError('Loai nguyen lieu khong hop le', 400);
    }

    const result = await db.query(
        `UPDATE ingredient
         SET name = $1, type = $2, image_url = $3, is_common = $4, keywords = $5
         WHERE ingredient_id = $6
           AND status = $7
         RETURNING ingredient_id, name, type, image_url, is_common, keywords, status`,
        [String(name).trim(), type, image_url || null, Boolean(is_common), keywords ? String(keywords).trim() : null, id, INGREDIENT_STATUS_ACTIVE]
    );
    
    if (!result.rows.length) {
        console.warn(`❌ Sửa nguyên liệu: Không tìm thấy ID ${id} với status ACTIVE`);
        // Kiểm tra xem ingredient có tồn tại không (dù status khác)
        const checkResult = await db.query(
            `SELECT ingredient_id, status FROM ingredient WHERE ingredient_id = $1`,
            [id]
        );
        if (!checkResult.rows.length) {
            console.warn(`   → Ingredient ${id} không tồn tại trong DB`);
        } else {
            console.warn(`   → Ingredient ${id} tồn tại nhưng status = ${checkResult.rows[0].status}`);
        }
        throw new AppError('Nguyen lieu khong ton tai', 404);
    }
    
    console.log(`✅ Sửa nguyên liệu ${id} thành công`);
    res.json({ status: 'success', ingredient: result.rows[0] });
}));

app.delete('/api/admin/ingredients/:id', authenticateAccessToken, asyncHandler(async (req, res) => {
    await ensureIngredientSoftDeleteReady();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('ID nguyen lieu khong hop le', 400);

    const result = await db.query(
        `UPDATE ingredient
         SET status = $1
         WHERE ingredient_id = $2
           AND status = $3
         RETURNING ingredient_id, status`,
        [INGREDIENT_STATUS_HIDDEN, id, INGREDIENT_STATUS_ACTIVE]
    );

    if (!result.rows.length) throw new AppError('Nguyen lieu khong ton tai', 404);
    res.json({
        status: 'success',
        ingredientId: result.rows[0].ingredient_id,
        ingredientStatus: result.rows[0].status,
    });
}));

ensureIngredientSoftDeleteReady().catch((error) => {
    console.error('❌ Lỗi khởi tạo status xóa mềm cho ingredient:', error.message);
});

app.use(errorHandler);

const server = app.listen(port, () => {
    console.log(`🚀 Server Node.js đang chạy tại http://localhost:${port}`);
});

server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
        console.error(`❌ Cổng ${port} đã được sử dụng. Hãy tắt tiến trình cũ rồi chạy lại server.`);
        process.exit(1);
    }

    console.error('❌ Lỗi server:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('SIGINT', () => {
    console.log('🛑 Đang tắt server...');
    server.close(() => {
        console.log('✅ Server đã tắt.');
        process.exit(0);
    });
});