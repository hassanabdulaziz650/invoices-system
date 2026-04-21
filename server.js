const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

if (!fs.existsSync('public')) fs.mkdirSync('public');
app.use(express.static('public'));

if (!fs.existsSync('data')) fs.mkdirSync('data');

const db = new sqlite3.Database('data/invoices.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        invoice_date TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        sales_rep TEXT,
        delivery_status TEXT DEFAULT 'معلقة',
        driver_name TEXT,
        branch TEXT,
        notes TEXT,
        items TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/invoices', (req, res) => {
    const { status, search } = req.query;
    let sql = 'SELECT * FROM invoices WHERE 1=1';
    let params = [];

    if (status) {
        sql += ' AND delivery_status = ?';
        params.push(status);
    }
    if (search) {
        sql += ' AND (invoice_number LIKE ? OR customer_name LIKE ? OR sales_rep LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY created_at DESC';

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: rows });
    });
});

app.get('/api/stats', (req, res) => {
    db.get(`SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN delivery_status = 'تم التوصيل' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN delivery_status = 'معلقة' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN delivery_status = 'ملغية' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN delivery_status = 'مرتجع' THEN 1 ELSE 0 END) as returned
    FROM invoices`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: row });
    });
});

app.get('/api/invoices/:id', (req, res) => {
    db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: row });
    });
});

app.post('/api/invoices', (req, res) => {
    const { invoice_number, invoice_date, customer_name, sales_rep, 
            delivery_status, driver_name, branch, notes, items } = req.body;

    const sql = `INSERT INTO invoices 
        (invoice_number, invoice_date, customer_name, sales_rep, 
         delivery_status, driver_name, branch, notes, items) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [invoice_number, invoice_date, customer_name, sales_rep,
                 delivery_status || 'معلقة', driver_name, branch, notes, 
                 JSON.stringify(items || [])], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'رقم الفاتورة موجود مسبقاً' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, id: this.lastID, message: 'تم الإضافة بنجاح' });
    });
});

app.put('/api/invoices/:id', (req, res) => {
    const { invoice_number, invoice_date, customer_name, sales_rep, 
            delivery_status, driver_name, branch, notes } = req.body;

    db.run(`UPDATE invoices SET 
        invoice_number = ?, invoice_date = ?, customer_name = ?,
        sales_rep = ?, delivery_status = ?, driver_name = ?,
        branch = ?, notes = ?
        WHERE id = ?`,
        [invoice_number, invoice_date, customer_name, sales_rep,
         delivery_status, driver_name, branch, notes, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'تم التحديث بنجاح' });
        });
});

app.patch('/api/invoices/:id/status', (req, res) => {
    const { delivery_status } = req.body;
    db.run('UPDATE invoices SET delivery_status = ? WHERE id = ?', 
        [delivery_status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'تم تغيير الحالة' });
    });
});

app.delete('/api/invoices/:id', (req, res) => {
    db.run('DELETE FROM invoices WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'تم الحذف بنجاح' });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});