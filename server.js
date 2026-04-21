const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({limit: '50mb'}));

// إعداد قاعدة البيانات الدائمة
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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
        :root { --primary: #2c3e50; --secondary: #3498db; --success: #27ae60; --danger: #e74c3c; --light: #f8fafc; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; }

        /* Sidebar */
        .sidebar { width: 280px; background: var(--primary); color: white; height: 100vh; position: fixed; right: 0; padding: 20px; }
        .logo { text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; }
        .logo i { font-size: 2.5rem; color: var(--secondary); }
        .nav-item { padding: 15px; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 15px; border-radius: 10px; margin-bottom: 5px; }
        .nav-item:hover, .nav-item.active { background: rgba(255,255,255,0.1); color: var(--secondary); }

        /* Main Content */
        .main-content { flex: 1; margin-right: 280px; padding: 30px; width: calc(100% - 280px); }
        .header-top { background: white; padding: 20px; border-radius: 15px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
        
        /* Dashboard Cards */
        .dashboard-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; padding: 25px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); text-align: center; }
        .card-value { font-size: 2rem; font-weight: bold; color: var(--primary); margin-top: 10px; }

        /* Table Section */
        .table-container { background: white; border-radius: 15px; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 1000px; }
        th { background: #f1f5f9; padding: 15px; text-align: right; font-weight: bold; color: var(--primary); }
        td { padding: 15px; border-bottom: 1px solid #eee; font-size: 0.9rem; }
        .status-badge { padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        .معلقة { background: #fff3e0; color: #e67e22; }
        .تم { background: #e8f5e9; color: #27ae60; }
        
        .import-section { background: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; text-align: center; }
        .btn { padding: 12px 25px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; color: white; transition: 0.3s; }
        .btn-success { background: var(--success); }
        .btn-primary { background: var(--secondary); }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="logo">
            <i class="fas fa-file-invoice"></i>
            <div style="font-size: 1.2rem; margin-top:10px;">إدارة الفواتير</div>
        </div>
        <div class="nav-item active"><i class="fas fa-home"></i> الرئيسية</div>
        <div class="nav-item"><i class="fas fa-plus-circle"></i> إضافة فاتورة</div>
        <div class="nav-item"><i class="fas fa-archive"></i> الأرشيف</div>
    </div>

    <div class="main-content">
        <div class="header-top">
            <h2>لوحة التحكم</h2>
            <div id="date-time"></div>
        </div>

        <div class="dashboard-cards">
            <div class="card"><div>إجمالي الفواتير</div><div class="card-value" id="totalCount">0</div></div>
            <div class="card"><div>معلقة</div><div class="card-value" id="pendingCount" style="color: #e67e22;">0</div></div>
            <div class="card"><div>تم التوصيل</div><div class="card-value" id="deliveredCount" style="color: #27ae60;">0</div></div>
        </div>

        <div class="import-section">
            <h3 style="margin-bottom: 15px;">استيراد بيانات من إكسل</h3>
            <input type="file" id="excelInput" style="display: none;" onchange="importExcel(event)">
            <button class="btn btn-success" onclick="document.getElementById('excelInput').click()">
                <i class="fas fa-upload"></i> اختر ملف الإكسل
            </button>
            <button class="btn btn-primary" style="margin-right: 10px;" onclick="exportExcel()">
                <i class="fas fa-download"></i> تصدير البيانات
            </button>
        </div>

        <div class="table-container">
            <table id="invTable">
                <thead>
                    <tr>
                        <th>المندوب</th><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th>
                        <th>الحالة</th><th>السائق</th><th>الفرع</th><th>ملاحظات</th><th>إجراء</th>
                    </tr>
                </thead>
                <tbody id="tableBody"></tbody>
            </table>
        </div>
    </div>

    <script>
        async function loadData() {
            const res = await fetch('/api/invoices');
            const data = await res.json();
            
            document.getElementById('totalCount').innerText = data.length;
            document.getElementById('pendingCount').innerText = data.filter(i => i.delivery_status === 'معلقة').length;
            document.getElementById('deliveredCount').innerText = data.filter(i => i.delivery_status === 'تم التوصيل').length;

            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = data.map(inv => \`
                <tr>
                    <td>\${inv.sales_rep || '-'}</td>
                    <td><b>\${inv.invoice_number}</b></td>
                    <td>\${inv.invoice_date}</td>
                    <td>\${inv.customer_name}</td>
                    <td><span class="status-badge \${inv.delivery_status}">\${inv.delivery_status}</span></td>
                    <td>\${inv.driver_name || '-'}</td>
                    <td>\${inv.branch || '-'}</td>
                    <td style="font-size: 0.75rem;">\${inv.notes || '-'}</td>
                    <td><button onclick="deleteInv(\${inv.id})" style="color:var(--danger); border:none; background:none; cursor:pointer"><i class="fas fa-trash"></i></button></td>
                </tr>
            \`).join('');
        }

        function importExcel(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const workbook = XLSX.read(evt.target.result, { type: 'binary' });
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
                
                const invoices = rows.slice(1).map(r => ({
                    sales_rep: r[0]||'', invoice_number: r[1]||'', invoice_date: r[2]||'',
                    customer_name: r[3]||'', delivery_status: r[4]||'معلقة',
                    driver_name: r[5]||'', branch: r[6]||'', notes: r[7]||''
                })).filter(x => x.invoice_number !== '');

                await fetch('/api/invoices/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoices })
                });
                loadData();
                alert('تم الاستيراد بنجاح! ✅');
            };
            reader.readAsBinaryString(file);
        }

        function exportExcel() { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById('invTable')), 'تقرير.xlsx'); }
        async function deleteInv(id) { if(confirm('حذف الفاتورة؟')) { await fetch(\`/api/invoices/\${id}\`, { method: 'DELETE' }); loadData(); } }
        setInterval(() => { document.getElementById('date-time').innerText = new Date().toLocaleString('ar-SA'); }, 1000);
        loadData();
    </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(HTML_PAGE));
app.get('/api/invoices', (req, res) => db.all("SELECT * FROM invoices ORDER BY id DESC", (err, rows) => res.json(rows || [])));
app.post('/api/invoices/bulk', (req, res) => {
    const { invoices } = req.body;
    const stmt = db.prepare("INSERT INTO invoices (sales_rep, invoice_number, invoice_date, customer_name, delivery_status, driver_name, branch, notes) VALUES (?,?,?,?,?,?,?,?)");
    invoices.forEach(inv => stmt.run(inv.sales_rep, inv.invoice_number, inv.invoice_date, inv.customer_name, inv.delivery_status, inv.driver_name, inv.branch, inv.notes));
    stmt.finalize();
    res.json({ ok: true });
});
app.delete('/api/invoices/:id', (req, res) => db.run("DELETE FROM invoices WHERE id = ?", req.params.id, () => res.json({ ok: true })));
app.listen(PORT, () => console.log('Ready...'));
