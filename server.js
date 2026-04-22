const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// مسارات الـ API
app.get('/api/invoices', async (req, res) => {
    const result = await pool.query('SELECT * FROM invoices ORDER BY id DESC');
    res.json(result.rows);
});

app.post('/api/invoices', async (req, res) => {
    const { name, date, amount } = req.body;
    await pool.query('INSERT INTO invoices (customer_name, invoice_date, amount) VALUES ($1, $2, $3)', [name, date, amount]);
    res.sendStatus(200);
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
