const express = require('express');
const { Pool } = require('pg'); // مكتبة الاتصال بـ PostgreSQL
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// الربط بقاعدة البيانات باستخدام الرابط من Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // مطلوب للاتصال بـ Render
});

// جلب الفواتير من القاعدة
app.get('/api/invoices', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM invoices ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// حفظ فاتورة جديدة
app.post('/api/invoices', async (req, res) => {
    const { name, date, amount } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO invoices (customer_name, invoice_date, amount) VALUES ($1, $2, $3) RETURNING *',
            [name, date, amount]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
