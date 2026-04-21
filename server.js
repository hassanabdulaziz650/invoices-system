const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// تجهيز قاعدة البيانات
if (!fs.existsSync('data')) fs.mkdirSync('data');
const db = new sqlite3.Database('data/invoices.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE,
        customer_name TEXT,
        invoice_date TEXT,
        delivery_status TEXT
    )`);
});

// الواجهة الأمامية (HTML)
const HTML_PAGE = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>نظام الفواتير</title>
    <style>
        body { font-family: sans-serif; padding: 20px; background: #f0f2f5; }
        .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); max-width: 800px; margin: auto; }
        input, select, button { width: 100%; padding: 10px; margin: 10px 0; border-radius: 5px; border: 1px solid #ddd; }
        button { background: #007bff; color: white; cursor: pointer; border: none; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
        .toolbar { display: flex; gap: 10px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="card">
        <h2>📊 إدارة الفواتير</h2>
        <div class="toolbar">
            <input type="text" id="search" placeholder="بحث باسم العميل..." onkeyup="search()">
            <button onclick="exportExcel()" style="background:#28a745">Excel</button>
        </div>
        <form id="f">
            <input type="text" id="num" placeholder="رقم الفاتورة" required>
            <input type="text" id="name" placeholder="اسم العميل" required>
            <input type="date" id="date" required>
            <select id="status"><option>معلقة</option><option>تم التوصيل</option></select>
            <button type="submit">إضافة فاتورة</button>
        </form>
        <table id="t">
            <thead><tr><th>الرقم</th><th>العميل</th><th>التاريخ</th><th>الحالة</th></tr></thead>
            <tbody id="b"></tbody>
        </table>
    </div>

    <script src="https://cloudflare.com"></script>
    <script>
        async function load() {
            const r = await fetch('/api/invoices');
            const d = await r.json();
            document.getElementById('b').innerHTML = d.map(i => \`<tr><td>\${i.invoice_number}</td><td>\${i.customer_name}</td><td>\${i.invoice_date}</td><td>\${i.delivery_status}</td></tr>\`).join('');
        }
        document.getElementById('f').onsubmit = async (e) => {
            e.preventDefault();
            await fetch('/api/invoices', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    invoice_number: document.getElementById('num').value,
                    customer_name: document.getElementById('name').value,
                    invoice_date: document.getElementById('date').value,
                    delivery_status: document.getElementById('status').value
                })
            });
            e.target.reset();
            load();
        };
        function search() {
            let v = document.getElementById('search').value.toLowerCase();
            document.querySelectorAll('#b tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(v) ? '' : 'none');
        }
        function exportExcel() {
            XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById('t')), 'Invoices.xlsx');
        }
        load();
    </script>
</body>
</html>`;

// المسارات (API)
app.get('/', (req, res) => res.send(HTML_PAGE));

app.get('/api/invoices', (req, res) => {
    db.all("SELECT * FROM invoices", (err, rows) => res.json(rows || []));
});

app.post('/api/invoices', (req, res) => {
    const { invoice_number, customer_name, invoice_date, delivery_status } = req.body;
    db.run("INSERT INTO invoices (invoice_number, customer_name, invoice_date, delivery_status) VALUES (?,?,?,?)", 
    [invoice_number, customer_name, invoice_date, delivery_status], () => res.json({ok: true}));
});

app.listen(PORT, () => console.log('Server running...'));
