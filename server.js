const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit: '50mb'}));

// 1. إعداد قاعدة البيانات
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

// 2. الواجهة الاحترافية (Sidebar + Sections)
const HTML_PAGE = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>نظام إدارة الفواتير والأرشفة</title>
    <link rel="stylesheet" href="https://cloudflare.com">
    <script src="https://cloudflare.com"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
        :root { --primary: #2c3e50; --secondary: #3498db; --success: #27ae60; --danger: #e74c3c; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; }
        
        .sidebar { width: 280px; background: var(--primary); color: white; height: 100vh; position: fixed; right: 0; padding: 20px; }
        .nav-item { padding: 15px; cursor: pointer; display: flex; align-items: center; gap: 15px; border-radius: 10px; margin-bottom: 5px; transition: 0.3s; }
        .nav-item:hover, .nav-item.active { background: rgba(255,255,255,0.1); color: var(--secondary); }
        
        .main-content { flex: 1; margin-right: 280px; padding: 30px; width: calc(100% - 280px); }
        .section { display: none; animation: fadeIn 0.3s ease; }
        .section.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .card { background: white; padding: 25px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .dashboard-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
        
        .grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        input, select, textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; }
        .btn { padding: 12px 25px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; color: white; display: inline-flex; align-items: center; gap: 8px; }
        
        table { width: 100%; border-collapse: collapse; background: white; direction: ltr; text-align: left; }
        th, td { padding: 12px; border-bottom: 1px solid #eee; }
        th { background: #f1f5f9; color: var(--primary); }
        .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        .معلقة { background: #fff3e0; color: #e67e22; }
        .تم { background: #e8f5e9; color: #27ae60; }
    </style>
</head>
<body>
    <div class="sidebar">
        <div style="text-align:center; margin-bottom:30px;"><i class="fas fa-file-invoice fa-3x"></i><h3 style="margin-top:10px">نظام الأرشفة</h3></div>
        <div class="nav-item active" onclick="showSection('home')"><i class="fas fa-home"></i> الرئيسية</div>
        <div class="nav-item" onclick="showSection('add')"><i class="fas fa-plus-circle"></i> إضافة فاتورة</div>
        <div class="nav-item" onclick="showSection('archive')"><i class="fas fa-archive"></i> الأرشيف</div>
    </div>

    <div class="main-content">
        <!-- الرئيسية -->
        <div id="home" class="section active">
            <div class="dashboard-cards">
                <div class="card">إجمالي الفواتير<div id="totalCount" style="font-size:2rem; font-weight:bold;">0</div></div>
                <div class="card">بانتظار التوصيل<div id="pendingCount" style="color:#e67e22; font-size:2rem; font-weight:bold;">0</div></div>
                <div class="card">تم التوصيل<div id="deliveredCount" style="color:#27ae60; font-size:2rem; font-weight:bold;">0</div></div>
            </div>
            <div class="card" style="text-align:center">
                <h3>استيراد البيانات من إكسل</h3><br>
                <button class="btn" style="background:var(--success)" onclick="document.getElementById('xl').click()"><i class="fas fa-upload"></i> اختر ملف الإكسل</button>
                <input type="file" id="xl" style="display:none" onchange="importExcel(event)">
            </div>
        </div>

        <!-- إضافة فاتورة -->
        <div id="add" class="section">
            <div class="card">
                <h3>تعبئة بيانات الفاتورة</h3><br>
                <form id="addForm">
                    <div class="grid-form">
                        <input type="text" id="sales_rep" placeholder="المندوب">
                        <input type="text" id="inv_num" placeholder="رقم الفاتورة" required>
                        <input type="date" id="inv_date" required>
                        <input type="text" id="cust_name" placeholder="اسم العميل" required>
                        <select id="inv_status"><option>معلقة</option><option>تم التوصيل</option></select>
                        <input type="text" id="driver" placeholder="السائق">
                        <input type="text" id="branch" placeholder="الفرع">
                    </div>
                    <textarea id="notes" placeholder="ملاحظات إضافية" rows="3"></textarea>
                    <button type="submit" class="btn" style="background:var(--secondary); width:100%"><i class="fas fa-save"></i> حفظ في القاعدة</button>
                </form>
            </div>
        </div>

        <!-- الأرشيف -->
        <div id="archive" class="section">
            <div class="card" style="overflow-x:auto">
                <table id="invTable">
                    <thead><tr><th>المندوب</th><th>الرقم</th><th>التاريخ</th><th>العميل</th><th>الحالة</th><th>السائق</th><th>الفرع</th><th>ملاحظات</th><th></th></tr></thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
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
                <tr><td>\${i.sales_rep || '-'}</td><td><b>\${i.invoice_number}</b></td><td>\${i.invoice_date}</td><td>\${i.customer_name}</td>
                <td><span class="status-badge \${i.delivery_status}">\${i.delivery_status}</span></td><td>\${i.driver_name || '-'}</td>
                <td>\${i.branch || '-'}</td><td>\${i.notes || '-'}</td>
                <td><button onclick="delInv(\${i.id})" style="color:red;border:none;background:none;cursor:pointer"><i class="fas fa-trash"></i></button></td></tr>\`).join('');
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
            alert('تم الحفظ بنجاح!'); e.target.reset(); loadData(); showSection('archive');
        };

        function importExcel(e) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const workbook = XLSX.read(evt.target.result, {type: 'array'});
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames], {header: 1});
                
                const cleanData = rows.slice(1).filter(r => r.length > 0);
                for(let r of cleanData) {
                    await fetch('/api/invoices', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            sales_rep: r[0]||'', invoice_number: r[1]||'', invoice_date: r[2]||'', customer_name: r[3]||'',
                            delivery_status: r[4]||'معلقة', driver_name: r[5]||'', branch: r[6]||'', notes: r[7]||''
                        })
                    });
                }
                loadData(); alert('تم استيراد ' + cleanData.length + ' فواتير!');
            };
            reader.readAsArrayBuffer(e.target.files);
        }

        async function delInv(id) { if(confirm('حذف؟')) { await fetch('/api/invoices/'+id, {method:'DELETE'}); loadData(); } }
        loadData();
    </script>
</body>
</html>`;

// 3. مسارات السيرفر (API)
app.get('/', (req, res) => res.send(HTML_PAGE));
app.get('/api/invoices', (req, res) => db.all("SELECT * FROM invoices ORDER BY id DESC", (err, rows) => res.json(rows || [])));
app.post('/api/invoices', (req, res) => {
    const { sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes } = req.body;
    db.run("INSERT INTO invoices (sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes) VALUES (?,?,?,?,?,?,?,?)", 
    [sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes], () => res.json({ok: true}));
});
app.delete('/api/invoices/:id', (req, res) => db.run("DELETE FROM invoices WHERE id = ?", req.params.id, () => res.json({ok: true})));

app.listen(PORT, () => console.log('Server is running...'));
