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
    <title>نظام الفواتير - إصلاح الاستيراد</title>
    <link href="https://googleapis.com" rel="stylesheet">
    <style>
        :root { --primary: #4f46e5; --bg: #f8fafc; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Tajawal', sans-serif; }
        body { background: var(--bg); padding: 20px; }
        .container { max-width: 1450px; margin: auto; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 15px; border-radius: 12px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border-top: 4px solid var(--primary); }
        .stat-card h4 { color: #64748b; font-size: 0.9rem; }
        .stat-card p { font-size: 1.6rem; font-weight: bold; color: #1e293b; }
        .toolbar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .search-box { flex: 1; min-width: 300px; padding: 12px; border-radius: 10px; border: 1px solid #ddd; }
        .main-grid { display: grid; grid-template-columns: 320px 1fr; gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        input, select, textarea { width: 100%; padding: 10px; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
        .btn { padding: 10px 20px; border: none; border-radius: 10px; cursor: pointer; color: white; font-weight: bold; }
        .btn-add { background: var(--primary); width: 100%; }
        .btn-excel { background: #16a34a; }
        .btn-import { background: #2563eb; }
        .table-wrapper { overflow-x: auto; direction: ltr; } 
        table { width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left; }
        th { background: #f8fafc; padding: 15px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
        td { padding: 15px; border-bottom: 1px solid #f1f5f9; }
        .status-pill { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; }
        .معلقة { background: #fef3c7; color: #92400e; }
        .تم { background: #dcfce7; color: #166534; }
    </style>
</head>
<body>
    <div class="container">
        <div class="stats-grid">
            <div class="stat-card"><h4>إجمالي الفواتير</h4><p id="totalCount">0</p></div>
            <div class="stat-card"><h4>معلقة</h4><p id="pendingCount">0</p></div>
            <div class="stat-card"><h4>تم التوصيل</h4><p id="deliveredCount">0</p></div>
        </div>

        <div class="toolbar">
            <input type="text" class="search-box" id="search" placeholder="بحث..." onkeyup="search()">
            <button onclick="exportExcel()" class="btn btn-excel">تصدير إكسل</button>
            <button onclick="document.getElementById('importEx').click()" class="btn btn-import">استيراد إكسل (مضمون)</button>
            <input type="file" id="importEx" style="display:none" onchange="importExcel(event)">
        </div>

        <div class="main-grid">
            <div class="card">
                <h3>إضافة فاتورة</h3>
                <form id="invForm" style="margin-top:10px">
                    <input type="text" id="sales_rep" placeholder="المندوب">
                    <input type="text" id="num" placeholder="رقم الفاتورة" required>
                    <input type="date" id="date" required>
                    <input type="text" id="name" placeholder="العميل" required>
                    <select id="status"><option>معلقة</option><option>تم التوصيل</option></select>
                    <input type="text" id="driver" placeholder="السائق">
                    <input type="text" id="branch" placeholder="الفرع">
                    <textarea id="notes" placeholder="ملاحظات"></textarea>
                    <button type="submit" class="btn btn-add">حفظ</button>
                </form>
            </div>
            <div class="card table-wrapper">
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
            document.getElementById('totalCount').innerText = d.length;
            document.getElementById('pendingCount').innerText = d.filter(i => i.delivery_status === 'معلقة').length;
            document.getElementById('deliveredCount').innerText = d.filter(i => i.delivery_status === 'تم التوصيل').length;
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
                    <td><button onclick="del(\${i.id})" style="color:red; border:none; background:none; cursor:pointer">حذف</button></td>
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
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                // تحويل البيانات لمصفوفة بسيطة (Array of Arrays) لتجنب مشاكل مسميات الأعمدة
                const rows = XLSX.utils.sheet_to_json(sheet, {header: 1}); 

                // نبدأ من 1 لتخطي سطر العناوين
                for (let i = 1; i < rows.length; i++) {
                    const r = rows[i];
                    if (!r[1]) continue; // إذا كان رقم الفاتورة فارغاً تخطى السطر

                    await fetch('/api/invoices', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            sales_rep: r[0] || '',
                            invoice_number: r[1] || '',
                            invoice_date: r[2] || '',
                            customer_name: r[3] || '',
                            delivery_status: r[4] || 'معلقة',
                            driver_name: r[5] || '',
                            branch: r[6] || '',
                            notes: r[7] || ''
                        })
                    });
                }
                load(); alert('تم استيراد ' + (rows.length - 1) + ' سجل بنجاح!');
            };
            reader.readAsArrayBuffer(e.target.files[0]);
        }

        function search() {
            let v = document.getElementById('search').value.toLowerCase();
            document.querySelectorAll('#tableBody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(v) ? '' : 'none');
        }
        function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById('mainTable')), 'تقرير.xlsx'); }
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
app.listen(PORT, () => console.log('Fixed Server Ready'));
