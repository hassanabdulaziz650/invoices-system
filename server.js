const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// الاتصال بقاعدة البيانات باستخدام المتغيرات من ريندر
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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

// إضافة فاتورة جديدة للقاعدة
app.post('/api/invoices', async (req, res) => {
    const { name, date, amount } = req.body;
    try {
        await pool.query(
            'INSERT INTO invoices (customer_name, invoice_date, amount) VALUES ($1, $2, $3)',
            [name, date, amount]
        );
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
