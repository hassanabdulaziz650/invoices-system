const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.get('/api/invoices', async (req, res) => {
    const r = await pool.query('SELECT * FROM invoices ORDER BY id DESC');
    res.json(r.rows);
});

app.post('/api/invoices', async (req, res) => {
    const { name, date, amount, status } = req.body;
    await pool.query('INSERT INTO invoices (customer_name, invoice_date, amount, status) VALUES ($1, $2, $3, $4)', [name, date, amount, status || 'تم التوصيل']);
    res.sendStatus(200);
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
