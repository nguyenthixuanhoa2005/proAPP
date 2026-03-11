const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'mydb',
  password: process.env.DB_PASSWORD || '123',
  port: process.env.DB_PORT || 5440,
});

// Hàm tiện ích để log khi kết nối thành công/thất bại
pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(), // Dùng cho Transaction
};