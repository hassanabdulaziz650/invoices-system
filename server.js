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
        sales_rep TEXT,
        invoice_number TEXT,
        invoice_date TEXT,
        customer_name TEXT,
        delivery_status TEXT,
        driver_name TEXT,
        branch TEXT,
        notes TEXT
    )`);
});

const HTML_PAGE = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>نظام الفواتير - النسخة المحدثة</title>
    <link href="https://googleapis.com" rel="stylesheet">
    <style>
        :root { --primary: #4f46e5; --bg: #f8fafc; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Tajawal', sans-serif; }
        body { background: var(--bg); padding: 20px; }
        .container { max-width: 1400px; margin: auto; }
        .header { background: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .toolbar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .search-box { flex: 1; min-width: 300px; padding: 10px; border-radius: 8px; border: 1px solid #ddd; }
        .main-grid { display: grid; grid-template-columns: 300px 1fr; gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        input, select, textarea { width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 6px; }
        .btn { padding: 10px 15px; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold; }
        .btn-add { background: var(--primary); width: 100%; }
        .btn-excel { background: #22c55e; }
        .btn-import { background: #3b82f6; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th { background: #f1f5f9; padding: 12px; text-align: right; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
        .status-pill { padding: 3px 8px; border-radius: 10px; font-size: 0.7rem; }
        .معلقة { background: #fef3c7; color: #92400e; }
        .تم { background: #dcfce7; color: #166534; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>📝 إدارة فواتير التوصيل</h1></div>
        <div class="toolbar">
            <input type="text" class="search-box" id="search" placeholder="بحث شامل..." onkeyup="search()">
            <button onclick="exportExcel()" class="btn btn-excel">تصدير Excel</button>
            <button onclick="document.getElementById('importEx').click()" class="btn btn-import">استيراد Excel</button>
            <input type="file" id="importEx" style="display:none" onchange="importExcel(event)">
        </div>
        <div class="main-grid">
            <div class="card">
                <form id="invForm">
                    <label>المندوب</label><input type="text" id="sales_rep">
                    <label>رقم الفاتورة</label><input type="text" id="num" required>
                    <label>تاريخ الفاتورة</label><input type="date" id="date" required>
                    <label>العميل</label><input type="text" id="name" required>
                    <label>الحالة</label><select id="status"><option>معلقة</option><option>تم التوصيل</option></select>
                    <label>السائق</label><input type="text" id="driver">
                    <label>الفرع</label><input type="text" id="branch">
                    <label>ملاحظات</label><textarea id="notes"></textarea>
                    <button type="submit" class="btn btn-add">حفظ الفاتورة</button>
                </form>
            </div>
            <div class="card" style="overflow-x:auto">
                <table id="mainTable">
                    <thead>
                        <tr>
                            <th>المندوب</th><th>رقم الفاتورة</th><th>تاريخ الفاتورة</th><th>العميل</th>
                            <th>الحالة</th><th>السائق</th><th>الفرع</th><th>ملاحظات</th><th></th>
                        </tr>
                    </thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
        </div>
    </div>
    <script src="https://cloudflare.com"></script>
    <script>
        async function load() {
            const r = await fetch('/api/invoices');
            const d = await r.json();
            document.getElementById('tableBody').innerHTML = d.map(i => \`
                <tr>
                    <td>\${i.sales_rep || '-'}</td>
                    <td>\${i.invoice_number}</td>
                    <td>\${i.invoice_date}</td>
                    <td>\${i.customer_name}</td>
                    <td><span class="status-pill \${i.delivery_status}">\${i.delivery_status}</span></td>
                    <td>\${i.driver_name || '-'}</td>
                    <td>\${i.branch || '-'}</td>
                    <td>\${i.notes || '-'}</td>
                    <td><button onclick="del(\${i.id})" style="color:red; border:none; background:none; cursor:pointer">✖</button></td>
                </tr>\`).join('');
        }

        document.getElementById('invForm').onsubmit = async (e) => {
            e.preventDefault();
            const data = {
                sales_rep: document.getElementById('sales_rep').value,
                invoice_number: document.getElementById('num').value,
                invoice_date: document.getElementById('date').value,
                customer_name: document.getElementById('name').value,
                delivery_status: document.getElementById('status').value,
                driver_name: document.getElementById('driver').value,
                branch: document.getElementById('branch').value,
                notes: document.getElementById('notes').value
            };
            await fetch('/api/invoices', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            e.target.reset(); load();
        };

        function importExcel(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet);
                
                if (rows.length === 0) return alert('الملف فارغ!');

                for (let row of rows) {
                    await fetch('/api/invoices', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            sales_rep: row['المندوب'] || '',
                            invoice_number: row['رقم الفاتورة'] || '',
                            invoice_date: row['تاريخ الفاتورة'] || '',
                            customer_name: row['العميل'] || '',
                            delivery_status: row['الحالة'] || 'معلقة',
                            driver_name: row['السائق'] || '',
                            branch: row['الفرع'] || '',
                            notes: row['ملاحظات'] || ''
                        })
                    });
                }
                load(); alert('تم استيراد ' + rows.length + ' فواتير بنجاح');
            };
            reader.readAsArrayBuffer(file);
        }

        function search() {
            let v = document.getElementById('search').value.toLowerCase();
            document.querySelectorAll('#tableBody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(v) ? '' : 'none');
        }
        function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById('mainTable')), 'Report.xlsx'); }
        async function del(id) { if(confirm('حذف؟')) { await fetch(\`/api/invoices/\${id}\`, {method:'DELETE'}); load(); } }
        load();
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(HTML_PAGE));
app.get('/api/invoices', (req, res) => { db.all("SELECT * FROM invoices ORDER BY id DESC", (err, rows) => res.json(rows || [])); });
app.post('/api/invoices', (req, res) => {
    const { sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes } = req.body;
    db.run("INSERT INTO invoices (sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes) VALUES (?,?,?,?,?,?,?,?)", 
    [sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes], () => res.json({ok: true}));
});
app.delete('/api/invoices/:id', (req, res) => { db.run("DELETE FROM invoices WHERE id = ?", req.params.id, () => res.json({ok: true})); });
app.listen(PORT, () => console.log('Ready'));
