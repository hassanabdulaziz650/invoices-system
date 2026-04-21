const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit: '50mb'}));

if (!fs.existsSync('data')) fs.mkdirSync('data');
const db = new sqlite3.Database('data/invoices.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_rep TEXT, invoice_number TEXT, invoice_date TEXT, customer_name TEXT,
        delivery_status TEXT, driver_name TEXT, branch TEXT, notes TEXT
    )`);
});

const HTML_PAGE = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>نظام الفواتير - الحل النهائي</title>
    <link href="https://googleapis.com" rel="stylesheet">
    <style>
        :root { --primary: #4f46e5; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Tajawal', sans-serif; }
        body { background: #f8fafc; padding: 20px; }
        .container { max-width: 1400px; margin: auto; }
        .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 20px; }
        .toolbar { display: flex; gap: 10px; margin-bottom: 20px; }
        input, select { padding: 10px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; width: 100%; }
        .btn { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; direction: ltr; text-align: left; }
        th, td { padding: 12px; border-bottom: 1px solid #eee; }
        th { background: #f1f5f9; }
        .status-pill { padding: 4px 8px; border-radius: 10px; font-size: 0.8rem; font-weight: bold; }
        .معلقة { background: #fef3c7; color: #92400e; }
        .تم { background: #dcfce7; color: #166534; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h2>إحصائيات: <span id="count">0</span> فاتورة</h2>
            <div class="toolbar">
                <button onclick="exportExcel()" class="btn" style="background:#16a34a">تصدير</button>
                <button onclick="document.getElementById('imp').click()" class="btn" style="background:#2563eb">استيراد Excel</button>
                <input type="file" id="imp" style="display:none" onchange="handleImport(event)">
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 300px 1fr; gap:20px;">
            <div class="card">
                <form id="f">
                    <input type="text" id="c1" placeholder="المندوب">
                    <input type="text" id="c2" placeholder="رقم الفاتورة" required>
                    <input type="date" id="c3" required>
                    <input type="text" id="c4" placeholder="العميل" required>
                    <select id="c5"><option>معلقة</option><option>تم التوصيل</option></select>
                    <input type="text" id="c6" placeholder="السائق">
                    <input type="text" id="c7" placeholder="الفرع">
                    <input type="text" id="c8" placeholder="ملاحظات">
                    <button type="submit" class="btn" style="background:var(--primary); width:100%">حفظ</button>
                </form>
            </div>
            <div class="card" style="overflow-x:auto">
                <table id="tbl">
                    <thead>
                        <tr><th>المندوب</th><th>الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الحالة</th><th>السائق</th><th>الفرع</th><th>ملاحظات</th><th></th></tr>
                    </thead>
                    <tbody id="body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script src="https://sheetjs.com"></script>
    <script>
        async function load() {
            const r = await fetch('/api/data');
            const d = await r.json();
            document.getElementById('count').innerText = d.length;
            document.getElementById('body').innerHTML = d.map(i => \`
                <tr>
                    <td>\${i.sales_rep}</td><td>\${i.invoice_number}</td><td>\${i.invoice_date}</td><td>\${i.customer_name}</td>
                    <td><span class="status-pill \${i.delivery_status}">\${i.delivery_status}</span></td>
                    <td>\${i.driver_name}</td><td>\${i.branch}</td><td>\${i.notes}</td>
                    <td><button onclick="del(\${i.id})" style="color:red; background:none; border:none; cursor:pointer">حذف</button></td>
                </tr>\`).join('');
        }

        document.getElementById('f').onsubmit = async (e) => {
            e.preventDefault();
            const obj = {
                sales_rep: document.getElementById('c1').value,
                invoice_number: document.getElementById('c2').value,
                invoice_date: document.getElementById('c3').value,
                customer_name: document.getElementById('c4').value,
                delivery_status: document.getElementById('c5').value,
                driver_name: document.getElementById('c6').value,
                branch: document.getElementById('c7').value,
                notes: document.getElementById('c8').value
            };
            await fetch('/api/data', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
            e.target.reset(); load();
        };

        function handleImport(e) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const wb = XLSX.read(evt.target.result, {type: 'array'});
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames], {header: 1});
                
                // حذف العناوين والبدء في رفع البيانات
                const cleanData = data.slice(1).filter(r => r.length > 0);
                for(let r of cleanData) {
                    await fetch('/api/data', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            sales_rep: r[0]||'', invoice_number: r[1]||'', invoice_date: r[2]||'', customer_name: r[3]||'',
                            delivery_status: r[4]||'معلقة', driver_name: r[5]||'', branch: r[6]||'', notes: r[7]||''
                        })
                    });
                }
                load(); alert('تم الاستيراد بنجاح!');
            };
            reader.readAsArrayBuffer(e.target.files[0]);
        }

        function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById('tbl')), 'تقرير.xlsx'); }
        async function del(id) { if(confirm('حذف؟')) { await fetch('/api/data/'+id, {method:'DELETE'}); load(); } }
        load();
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(HTML_PAGE));
app.get('/api/data', (req, res) => db.all("SELECT * FROM invoices ORDER BY id DESC", (err, rows) => res.json(rows || [])));
app.post('/api/data', (req, res) => {
    const { sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes } = req.body;
    db.run("INSERT INTO invoices (sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes) VALUES (?,?,?,?,?,?,?,?)", 
    [sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes], () => res.json({ok: true}));
});
app.delete('/api/data/:id', (req, res) => db.run("DELETE FROM invoices WHERE id = ?", req.params.id, () => res.json({ok: true})));
app.listen(PORT, () => console.log('Final Build Ready'));
