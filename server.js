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
        .btn-success { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: right; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; color: #667eea; font-weight: bold; }
        .status-badge { padding: 5px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; }
        .status-delivered { background: #e8f5e9; color: #2e7d32; }
        .status-pending { background: #fff3e0; color: #ef6c00; }
        .status-cancelled { background: #ffebee; color: #c62828; }
        .status-returned { background: #f3e5f5; color: #6a1b9a; }
        .actions { display: flex; gap: 5px; }
        .btn-small { padding: 5px 10px; border: none; border-radius: 5px; cursor: pointer; font-size: 0.8rem; }
        .btn-delete { background: #f44336; color: white; }
        .btn-status { background: #FF9800; color: white; }
        .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 15px 25px; border-radius: 10px; display: none; z-index: 2000; font-weight: bold; }
        .toast.show { display: block; }
        .toast.success { background: #4CAF50; }
        .toast.error { background: #f44336; }
        .empty-state { text-align: center; padding: 40px; color: #999; }
        @media (max-width: 768px) { .main-grid { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: repeat(2, 1fr); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 نظام إدارة الفواتير</h1>
            <p>تتبع وإدارة فواتير التوصيل بكل سهولة</p>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="icon">📋</div>
                <div class="number" id="stat-total">0</div>
                <div class="label">إجمالي الفواتير</div>
            </div>
            <div class="stat-card">
                <div class="icon">✅</div>
                <div class="number" id="stat-delivered">0</div>
                <div class="label">تم التوصيل</div>
            </div>
            <div class="stat-card">
                <div class="icon">⏳</div>
                <div class="number" id="stat-pending">0</div>
                <div class="label">معلقة</div>
            </div>
            <div class="stat-card">
                <div class="icon">❌</div>
                <div class="number" id="stat-cancelled">0</div>
                <div class="label">ملغية</div>
            </div>
            <div class="stat-card">
                <div class="icon">🔄</div>
                <div class="number" id="stat-returned">0</div>
                <div class="label">مرتجع</div>
            </div>
        </div>
        <div class="main-grid">
            <div class="form-section">
                <h2>📝 إضافة فاتورة جديد