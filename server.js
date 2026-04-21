const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit: '50mb'}));

// إعداد قاعدة البيانات
if (!fs.existsSync('data')) fs.mkdirSync('data');
const db = new sqlite3.Database('data/invoices.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sales_rep TEXT, invoice_number TEXT, invoice_date TEXT, 
        customer_name TEXT, delivery_status TEXT, 
        driver_name TEXT, branch TEXT, notes TEXT
    )`);
});

const HTML_PAGE = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نظام إدارة الفواتير والأرشفة</title>
    <link rel="stylesheet" href="https://cloudflare.com">
    <script src="https://cloudflare.com"></script>
    <script src="https://cloudflare.com"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
        :root { --primary: #2c3e50; --secondary: #3498db; --success: #27ae60; --danger: #e74c3c; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; }

        .sidebar { width: 280px; background: var(--primary); color: white; height: 100vh; position: fixed; right: 0; padding: 20px; }
        .logo { text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; }
        .nav-item { padding: 15px; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 15px; border-radius: 10px; margin-bottom: 5px; }
        .nav-item:hover, .nav-item.active { background: rgba(255,255,255,0.1); color: var(--secondary); }

        .main-content { flex: 1; margin-right: 280px; padding: 30px; width: calc(100% - 280px); }
        .section { display: none; animation: fadeIn 0.4s ease; }
        .section.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .header-top { background: white; padding: 20px; border-radius: 15px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .dashboard-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; padding: 25px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); text-align: center; }
        
        .form-card { background: white; padding: 30px; border-radius: 15px; max-width: 800px; margin: auto; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        .grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .form-group { margin-bottom: 15px; text-align: right; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: var(--primary); }
        input, select, textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; }

        .table-container { background: white; border-radius: 15px; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 1000px; }
        th { background: #f1f5f9; padding: 15px; text-align: right; }
        td { padding: 15px; border-bottom: 1px solid #eee; }
        
        .btn { padding: 12px 25px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; color: white; display: inline-flex; align-items: center; gap: 8px; }
        .btn-success { background: var(--success); }
        .btn-primary { background: var(--secondary); }
        .btn-pdf { background: #e74c3c; }
        .status-badge { padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        .معلقة { background: #fff3e0; color: #e67e22; }
        .تم { background: #e8f5e9; color: #27ae60; }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="logo"><i class="fas fa-file-invoice fa-2x"></i><h3>نظام الفواتير</h3></div>
        <div class="nav-item active" onclick="showSection('home')"><i class="fas fa-home"></i> الرئيسية</div>
        <div class="nav-item" onclick="showSection('add')"><i class="fas fa-plus-circle"></i> إضافة فاتورة</div>
        <div class="nav-item" onclick="showSection('archive')"><i class="fas fa-archive"></i> الأرشيف</div>
    </div>

    <div class="main-content">
        <!-- قسم الرئيسية -->
        <div id="home" class="section active">
            <div class="header-top"><h2>لوحة التحكم</h2><div id="clock"></div></div>
            <div class="dashboard-cards">
                <div class="card">إجمالي الفواتير<div id="totalCount" style="font-size:2rem; font-weight:bold;">0</div></div>
                <div class="card">معلقة<div id="pendingCount" style="color:#e67e22; font-size:2rem; font-weight:bold;">0</div></div>
                <div class="card">تم التوصيل<div id="deliveredCount" style="color:#27ae60; font-size:2rem; font-weight:bold;">0</div></div>
            </div>
            <div style="background:white; padding:20px; border-radius:15px; text-align:center;">
                <h3>استيراد البيانات</h3><br>
                <button class="btn btn-success" onclick="document.getElementById('xlIn').click()"><i class="fas fa-file-excel"></i> استيراد Excel</button>
                <button class="btn btn-pdf" onclick="document.getElementById('pdfIn').click()"><i class="fas fa-file-pdf"></i> استيراد PDF</button>
                <input type="file" id="xlIn" style="display:none" onchange="importExcel(event)">
                <input type="file" id="pdfIn" style="display:none" accept=".pdf" onchange="importPDF(event)">
            </div>
        </div>

        <!-- قسم إضافة فاتورة -->
        <div id="add" class="section">
            <div class="header-top"><h2>إضافة فاتورة جديدة</h2></div>
            <div class="form-card">
                <form id="addForm">
                    <div class="grid-form">
                        <div class="form-group"><label>المندوب</label><input type="text" id="sales_rep"></div>
                        <div class="form-group"><label>رقم الفاتورة</label><input type="text" id="inv_num" required></div>
                        <div class="form-group"><label>تاريخ الفاتورة</label><input type="date" id="inv_date" required></div>
                        <div class="form-group"><label>العميل</label><input type="text" id="cust_name" required></div>
                        <div class="form-group"><label>الحالة</label><select id="inv_status"><option>معلقة</option><option>تم التوصيل</option></select></div>
                        <div class="form-group"><label>السائق</label><input type="text" id="driver"></div>
                        <div class="form-group"><label>الفرع</label><input type="text" id="branch"></div>
                    </div>
                    <div class="form-group"><label>ملاحظات</label><textarea id="notes" rows="3"></textarea></div>
                    <button type="submit" class="btn btn-primary" style="width:100%"><i class="fas fa-save"></i> حفظ الفاتورة</button>
                </form>
            </div>
        </div>

        <!-- قسم الأرشيف -->
        <div id="archive" class="section">
            <div class="header-top"><h2>أرشيف الفواتير</h2><button class="btn btn-primary" onclick="exportExcel()">تصدير Excel</button></div>
            <div class="table-container">
                <table>
                    <thead><tr><th>المندوب</th><th>الرقم</th><th>التاريخ</th><th>العميل</th><th>الحالة</th><th>السائق</th><th>الفرع</th><th>ملاحظات</th><th></th></tr></thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cloudflare.com';

        function showSection(id) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById(id).classList.add('active');
            event.currentTarget.classList.add('active');
        }

        async function loadData() {
            const res = await fetch('/api/invoices');
            const data = await res.json();
            document.getElementById('totalCount').innerText = data.length;
            document.getElementById('pendingCount').innerText = data.filter(i => i.delivery_status === 'معلقة').length;
            document.getElementById('deliveredCount').innerText = data.filter(i => i.delivery_status === 'تم التوصيل').length;
            document.getElementById('tableBody').innerHTML = data.map(i => \`
                <tr><td>\${i.sales_rep}</td><td><b>\${i.invoice_number}</b></td><td>\${i.invoice_date}</td><td>\${i.customer_name}</td>
                <td><span class="status-badge \${i.delivery_status}">\${i.delivery_status}</span></td><td>\${i.driver_name}</td>
                <td>\${i.branch}</td><td>\${i.notes}</td><td><button onclick="deleteInv(\${i.id})" style="color:red;border:none;background:none;cursor:pointer"><i class="fas fa-trash"></i></button></td></tr>\`).join('');
        }

        document.getElementById('addForm').onsubmit = async (e) => {
            e.preventDefault();
            const inv = {
                sales_rep: document.getElementById('sales_rep').value, invoice_number: document.getElementById('inv_num').value,
                invoice_date: document.getElementById('inv_date').value, customer_name: document.getElementById('cust_name').value,
                delivery_status: document.getElementById('inv_status').value, driver_name: document.getElementById('driver').value,
                branch: document.getElementById('branch').value, notes: document.getElementById('notes').value
            };
            await fetch('/api/invoices', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(inv) });
            alert('تمت الإضافة!'); e.target.reset(); loadData(); showSection('archive');
        };

        async function importPDF(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async function() {
                const pdf = await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;
                let text = "";
                for(let i=1; i<=pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(it => it.str).join(' ');
                }
                alert('تم استخراج النص من PDF، يمكنك مراجعة البيانات في وحدة التحكم.');
                console.log("PDF Text:", text);
            };
            reader.readAsArrayBuffer(file);
        }

        function importExcel(e) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const wb = XLSX.read(evt.target.result, {type:'binary'});
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames], {header:1});
                const invoices = rows.slice(1).map(r => ({
                    sales_rep: r[0], invoice_number: r[1], invoice_date: r[2], customer_name: r[3],
                    delivery_status: r[4]||'معلقة', driver_name: r[5], branch: r[6], notes: r[7]
                })).filter(x => x.invoice_number);
                await fetch('/api/invoices/bulk', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({invoices}) });
                loadData(); alert('تم الاستيراد!');
            };
            reader.readAsBinaryString(e.target.files[0]);
        }

        async function deleteInv(id) { if(confirm('حذف؟')) { await fetch('/api/invoices/'+id, {method:'DELETE'}); loadData(); } }
        function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById('invTable')), 'تقرير.xlsx'); }
        loadData();
        setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleString('ar-SA'); }, 1000);
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(HTML_PAGE));
app.get('/api/invoices', (req, res) => db.all("SELECT * FROM invoices ORDER BY id DESC", (err, rows) => res.json(rows || [])));
app.post('/api/invoices', (req, res) => {
    const { sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes } = req.body;
    db.run("INSERT INTO invoices (sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes) VALUES (?,?,?,?,?,?,?,?)", 
    [sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes], () => res.json({ok: true}));
});
app.post('/api/invoices/bulk', (req, res) => {
    const { invoices } = req.body;
    const stmt = db.prepare("INSERT INTO invoices (sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes) VALUES (?,?,?,?,?,?,?,?)");
    invoices.forEach(i => stmt.run(i.sales_rep, i.invoice_number, i.invoice_date, i.customer_name, i.delivery_status, i.driver_name, i.branch, i.notes));
    stmt.finalize(); res.json({ok: true});
});
app.delete('/api/invoices/:id', (req, res) => db.run("DELETE FROM invoices WHERE id = ?", req.params.id, () => res.json({ok: true})));
app.listen(PORT, () => console.log('Ready...'));
