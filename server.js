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
    <title>نظام إدارة الفواتير</title>
    <link href="https://googleapis.com" rel="stylesheet">
    <style>
        :root { --primary: #4f46e5; --bg: #f8fafc; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Tajawal', sans-serif; }
        body { background: var(--bg); padding: 20px; }
        .container { max-width: 1450px; margin: auto; }
        
        /* الإحصائيات */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 15px; border-radius: 12px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-top: 4px solid var(--primary); }
        .stat-card h4 { color: #64748b; font-size: 0.9rem; margin-bottom: 5px; }
        .stat-card p { font-size: 1.6rem; font-weight: bold; color: #1e293b; }

        .toolbar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .search-box { flex: 1; min-width: 300px; padding: 12px; border-radius: 10px; border: 1px solid #ddd; outline: none; }
        .search-box:focus { border-color: var(--primary); }

        .main-grid { display: grid; grid-template-columns: 320px 1fr; gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        
        label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 0.85rem; color: #475569; }
        input, select, textarea { width: 100%; padding: 10px; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; outline: none; }
        
        .btn { padding: 10px 20px; border: none; border-radius: 10px; cursor: pointer; color: white; font-weight: bold; transition: 0.3s; }
        .btn-add { background: var(--primary); width: 100%; margin-top: 10px; }
        .btn-excel { background: #16a34a; }
        .btn-import { background: #2563eb; }

        /* الجدول من اليسار لليمين */
        .table-wrapper { overflow-x: auto; direction: ltr; } 
        table { width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left; }
        th { background: #f8fafc; padding: 15px; border-bottom: 2px solid #e2e8f0; color: #64748b; white-space: nowrap; }
        td { padding: 15px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        
        .status-pill { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; }
        .معلقة { background: #fef3c7; color: #92400e; }
        .تم { background: #dcfce7; color: #166534; }
        
        @media (max-width: 1100px) { .main-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <!-- قسم الإحصائيات -->
        <div class="stats-grid">
            <div class="stat-card"><h4>إجمالي الفواتير</h4><p id="totalCount">0</p></div>
            <div class="stat-card"><h4>فواتير معلقة</h4><p id="pendingCount" style="color:#b45309">0</p></div>
            <div class="stat-card"><h4>تم التوصيل</h4><p id="deliveredCount" style="color:#15803d">0</p></div>
        </div>

        <!-- أدوات التحكم -->
        <div class="toolbar">
            <input type="text" class="search-box" id="search" placeholder="بحث سريع في كل البيانات..." onkeyup="search()">
            <button onclick="exportExcel()" class="btn btn-excel">تصدير إكسل</button>
            <button onclick="document.getElementById('importEx').click()" class="btn btn-import">استيراد إكسل</button>
            <input type="file" id="importEx" style="display:none" onchange="importExcel(event)">
        </div>

        <div class="main-grid">
            <!-- نموذج الإدخال -->
            <div class="card">
                <h3 style="margin-bottom:15px">إضافة فاتورة</h3>
                <form id="invForm">
                    <label>المندوب</label><input type="text" id="sales_rep">
                    <label>رقم الفاتورة</label><input type="text" id="num" required>
                    <label>تاريخ الفاتورة</label><input type="date" id="date" required>
                    <label>العميل</label><input type="text" id="name" required>
                    <label>الحالة</label>
                    <select id="status">
                        <option value="معلقة">معلقة</option>
                        <option value="تم التوصيل">تم التوصيل</option>
                    </select>
                    <label>السائق</label><input type="text" id="driver">
                    <label>الفرع</label><input type="text" id="branch">
                    <label>ملاحظات</label><textarea id="notes" rows="3"></textarea>
                    <button type="submit" class="btn btn-add">حفظ البيانات</button>
                </form>
            </div>

            <!-- الجدول -->
            <div class="card table-wrapper">
                <table id="mainTable">
                    <thead>
                        <tr>
                            <th>المندوب</th>
                            <th>رقم الفاتورة</th>
                            <th>تاريخ الفاتورة</th>
                            <th>العميل</th>
                            <th>الحالة</th>
                            <th>السائق</th>
                            <th>الفرع</th>
                            <th>ملاحظات</th>
                            <th>إجراء</th>
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
            
            // تحديث الأرقام في الأعلى
            document.getElementById('totalCount').innerText = d.length;
            document.getElementById('pendingCount').innerText = d.filter(i => i.delivery_status === 'معلقة').length;
            document.getElementById('deliveredCount').innerText = d.filter(i => i.delivery_status === 'تم التوصيل').length;

            document.getElementById('tableBody').innerHTML = d.map(i => \`
                <tr>
                    <td>\${i.sales_rep || '-'}</td>
                    <td><b>\${i.invoice_number}</b></td>
                    <td>\${i.invoice_date}</td>
                    <td>\${i.customer_name}</td>
                    <td><span class="status-pill \${i.delivery_status}">\${i.delivery_status}</span></td>
                    <td>\${i.driver_name || '-'}</td>
                    <td>\${i.branch || '-'}</td>
                    <td style="color:#64748b; font-size:0.8rem">\${i.notes || '-'}</td>
                    <td><button onclick="del(\${i.id})" style="color:#ef4444; border:none; background:none; cursor:pointer; font-weight:bold">حذف</button></td>
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
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const workbook = XLSX.read(evt.target.result, {type: 'array'});
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames]);
                for (let row of rows) {
                    await fetch('/api/invoices', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            sales_rep: row['المندوب'],
                            invoice_number: row['رقم الفاتورة'],
                            invoice_date: row['تاريخ الفاتورة'],
                            customer_name: row['العميل'],
                            delivery_status: row['الحالة'] || 'معلقة',
                            driver_name: row['السائق'],
                            branch: row['الفرع'],
                            notes: row['ملاحظات']
                        })
                    });
                }
                load(); alert('تم استيراد البيانات بنجاح!');
            };
            reader.readAsArrayBuffer(e.target.files);
        }

        function search() {
            let v = document.getElementById('search').value.toLowerCase();
            document.querySelectorAll('#tableBody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(v) ? '' : 'none');
        }
        function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById('mainTable')), 'تقرير_الفواتير.xlsx'); }
        async function del(id) { if(confirm('هل تريد حذف هذه الفاتورة؟')) { await fetch(\`/api/invoices/\${id}\`, {method:'DELETE'}); load(); } }
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
app.listen(PORT, () => console.log('Server is running...'));
