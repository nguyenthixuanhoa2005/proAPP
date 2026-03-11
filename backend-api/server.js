const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');   //kết nối db qua file riêng

const app = express();
const port = 3000;

app.use(express.json());

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

app.listen(port, () => {
    console.log(`🚀 Server Node.js đang chạy tại http://localhost:${port}`);
});