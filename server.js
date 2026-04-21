const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// تجهيز قاعدة البيانات بالأعمدة الجديدة
if (!fs.existsSync('data')) fs.mkdirSync('data');
const db = new sqlite3.Database('data/invoices.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_rep TEXT,
        invoice_number TEXT UNIQUE,
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نظام إدارة الفواتير الاحترافي</title>
    <link href="https://googleapis.com" rel="stylesheet">
    <style>
        :root { --primary: #4f46e5; --secondary: #6366f1; --success: #22c55e; --danger: #ef4444; --bg: #f8fafc; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Tajawal', sans-serif; }
        body { background: var(--bg); color: #1e293b; padding: 20px; }
        .container { max-width: 1200px; margin: auto; }
        
        /* Header & Stats */
        .header { background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); margin-bottom: 30px; text-align: center; }
        .header h1 { color: var(--primary); font-size: 2rem; margin-bottom: 10px; }

        /* Toolbar */
        .toolbar { display: grid; grid-template-columns: 1fr auto; gap: 15px; margin-bottom: 20px; align-items: center; }
        .search-box { width: 100%; padding: 12px 20px; border-radius: 12px; border: 1px solid #e2e8f0; outline: none; transition: 0.3s; }
        .search-box:focus { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); }
        .action-btns { display: flex; gap: 10px; }

        /* Main Layout */
        .main-grid { display: grid; grid-template-columns: 350px 1fr; gap: 25px; }
        .card { background: white; padding: 25px; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
        
        /* Form Styling */
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 6px; font-weight: bold; font-size: 0.9rem; color: #64748b; }
        input, select, textarea { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; outline: none; }
        .btn { padding: 10px 20px; border: none; border-radius: 10px; cursor: pointer; font-weight: bold; transition: 0.2s; color: white; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
        .btn-primary { background: var(--primary); width: 100%; justify-content: center; }
        .btn-excel { background: #16a34a; }
        .btn-pdf { background: #dc2626; }
        .btn-import { background: #2563eb; }

        /* Table Styling */
        .table-container { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 800px; }
        th { background: #f1f5f9; padding: 15px; text-align: right; color: #475569; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
        td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
        tr:hover { background: #f8fafc; }
        .status { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        .معلقة { background: #fef3c7; color: #92400e; }
        .تم { background: #dcfce7; color: #166534; }

        @media (max-width: 900px) { .main-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 نظام إدارة الفواتير المتطور</h1>
            <p>تحكم كامل في فواتير المندوبين والسائقين</p>
        </div>

        <div class="toolbar">
            <input type="text" class="search-box" id="search" placeholder="بحث باسم العميل، رقم الفاتورة، أو المندوب..." onkeyup="search()">
            <div class="action-btns">
                <button onclick="exportExcel()" class="btn btn-excel">Excel</button>
                <button onclick="exportPDF()" class="btn btn-pdf">PDF</button>
                <button onclick="document.getElementById('import').click()" class="btn btn-import">استيراد</button>
                <input type="file" id="import" style="display:none" onchange="importExcel(event)">
            </div>
        </div>

        <div class="main-grid">
            <div class="card">
                <h3 style="margin-bottom:20px">📦 بيانات الفاتورة</h3>
                <form id="invForm">
                    <div class="form-group"><label>المندوب</label><input type="text" id="sales_rep"></div>
                    <div class="form-group"><label>رقم الفاتورة</label><input type="text" id="num" required></div>
                    <div class="form-group"><label>تاريخ الفاتورة</label><input type="date" id="date" required></div>
                    <div class="form-group"><label>اسم العميل</label><input type="text" id="name" required></div>
                    <div class="form-group"><label>حالة التوصيل</label>
                        <select id="status"><option>معلقة</option><option>تم التوصيل</option><option>ملغية</option></select>
                    </div>
                    <div class="form-group"><label>اسم السائق</label><input type="text" id="driver"></div>
                    <div class="form-group"><label>الفرع</label><input type="text" id="branch"></div>
                    <div class="form-group"><label>ملاحظات</label><textarea id="notes" rows="2"></textarea></div>
                    <button type="submit" class="btn btn-primary">حفظ البيانات</button>
                </form>
            </div>

            <div class="card table-container">
                <table id="mainTable">
                    <thead>
                        <tr>
                            <th>المندوب</th><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th>
                            <th>الحالة</th><th>السائق</th><th>الفرع</th><th>ملاحظات</th><th></th>
                        </tr>
                    </thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script src="https://cloudflare.com"></script>
    <script src="https://cloudflare.com"></script>
    <script src="https://cloudflare.com"></script>

    <script>
        async function load() {
            const r = await fetch('/api/invoices');
            const d = await r.json();
            document.getElementById('tableBody').innerHTML = d.map(i => \`
                <tr>
                    <td>\${i.sales_rep || '-'}</td>
                    <td><b>\${i.invoice_number}</b></td>
                    <td>\${i.invoice_date}</td>
                    <td>\${i.customer_name}</td>
                    <td><span class="status \${i.delivery_status}">\${i.delivery_status}</span></td>
                    <td>\${i.driver_name || '-'}</td>
                    <td>\${i.branch || '-'}</td>
                    <td style="font-size:0.7rem; color:#64748b">\${i.notes || '-'}</td>
                    <td><button onclick="del(\${i.id})" style="color:var(--danger); border:none; background:none; cursor:pointer">✖</button></td>
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
            await fetch('/api/invoices', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            e.target.reset();
            load();
        };

        function search() {
            let v = document.getElementById('search').value.toLowerCase();
            document.querySelectorAll('#tableBody tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(v) ? '' : 'none');
        }

        function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById('mainTable')), 'Fatoora_System.xlsx'); }

        function exportPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'pt');
            doc.autoTable({ html: '#mainTable', styles: { font: 'Tajawal' } });
            doc.save('Report.pdf');
        }

        function importExcel(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, {type:'binary'});
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                data.forEach(async (row) => {
                    await fetch('/api/invoices', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            sales_rep: row['المندوب'],
                            invoice_number: row['رقم الفاتورة'],
                            invoice_date: row['التاريخ'],
                            customer_name: row['العميل'],
                            delivery_status: row['الحالة'],
                            driver_name: row['السائق'],
                            branch: row['الفرع'],
                            notes: row['ملاحظات']
                        })
                    });
                });
                setTimeout(load, 1000);
                alert('تم الاستيراد بنجاح!');
            };
            reader.readAsBinaryString(file);
        }

        async function del(id) { if(confirm('حذف؟')) { await fetch(\`/api/invoices/\${id}\`, {method:'DELETE'}); load(); } }
        load();
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(HTML_PAGE));

app.get('/api/invoices', (req, res) => {
    db.all("SELECT * FROM invoices ORDER BY id DESC", (err, rows) => res.json(rows || []));
});

app.post('/api/invoices', (req, res) => {
    const { sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes } = req.body;
    db.run("INSERT INTO invoices (sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes) VALUES (?,?,?,?,?,?,?,?)", 
    [sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes], () => res.json({ok: true}));
});

app.delete('/api/invoices/:id', (req, res) => {
    db.run("DELETE FROM invoices WHERE id = ?", req.params.id, () => res.json({ok: true}));
});

app.listen(PORT, () => console.log('Smarter Server Running...'));
