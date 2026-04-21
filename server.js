
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

// ═══════════════════ HTML PAGE ═══════════════════

const HTML_PAGE = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نظام إدارة الفواتير</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; color: white; margin-bottom: 30px; padding: 20px; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; border-radius: 15px; padding: 25px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .stat-card .icon { font-size: 2.5rem; margin-bottom: 10px; }
        .stat-card .number { font-size: 2rem; font-weight: bold; color: #333; }
        .stat-card .label { color: #666; font-size: 0.9rem; }
        .main-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
        .form-section, .table-section { background: white; border-radius: 15px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        h2 { color: #667eea; margin-bottom: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #555; font-weight: bold; }
        input, select { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-family: Arial; }
        .btn { width: 100%; padding: 12px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-bottom: 10px; font-size: 1rem; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: right; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; color: #667eea; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 نظام إدارة الفواتير</h1>
            <p>تتبع وإدارة فواتير التوصيل بكل سهولة</p>
        </div>
        <div class="main-grid">
            <div class="form-section">
                <h2>📝 إضافة فاتورة جديدة</h2>
                <p>تم إصلاح الكود وإغلاق جميع الأوسمة بنجاح.</p>
            </div>
        </div>
    </div>
</body>
</html>`;

// ═══════════════════ ROUTES ═══════════════════

app.get('/', (req, res) => {
    res.send(HTML_PAGE);
});

// إضافة فاتورة
app.post('/api/invoices', (req, res) => {
    const { invoice_number, invoice_date, customer_name, sales_rep, delivery_status, driver_name, branch, notes, items } = req.body;
    const sql = `INSERT INTO invoices (invoice_number, invoice_date, customer_name, sales_rep, delivery_status, driver_name, branch, notes, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [invoice_number, invoice_date, customer_name, sales_rep, delivery_status, driver_name, branch, notes, items], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// جلب جميع الفواتير
app.get('/api/invoices', (req, res) => {
    db.all("SELECT * FROM invoices ORDER BY created_at DESC", [], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});