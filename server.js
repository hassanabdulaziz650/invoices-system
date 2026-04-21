const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// إنشاء مجلد البيانات إذا لم يكن موجوداً
if (!fs.existsSync('data')) fs.mkdirSync('data');

const db = new sqlite3.Database('data/invoices.db');

// تهيئة قاعدة البيانات
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
    <title>نظام الفواتير الاحترافي</title>
    <style>
        :root { --primary: #667eea; --secondary: #764ba2; --success: #4CAF50; --danger: #f44336; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7f6; padding: 20px; }
        .container { max-width: 1300px; margin: 0 auto; }
        
        .header-box { background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        
        .toolbar { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .toolbar input { flex: 1; min-width: 250px; padding: 12px; border: 1px solid #ddd; border-radius: 5px; }
        
        .btn { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; transition: 0.3s; color: white; display: flex; align-items: center; gap: 8px; }
        .btn-add { background: var(--success); }
        .btn-excel { background: #1D6F42; }
        .btn-pdf { background: #E74C3C; }
        .btn-import { background: #3498db; }

        .main-content { display: grid; grid-template-columns: 350px 1fr; gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        
        form label { display: block; margin: 10px 0 5px; font-weight: bold; color: #555; }
        form input, form select { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 5px; }

        table { width: 100%; border-collapse: collapse; background: white; }
        th, td { padding: 15px; text-align: right; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; color: var(--primary); }
        tr:hover { background: #f9f9f9; }

        .status-badge { padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; }
        .معلقة { background: #fff3e0; color: #ef6c00; }
        .تم { background: #e8f5e9; color: #2e7d32; }
        
        @media (max-width: 900px) { .main-content { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-box">
            <h1>📦 نظام إدارة فواتير التوصيل</h1>
            <p>إدارة، بحث، وتصدير البيانات بكل سهولة</p>
        </div>

        <div class="toolbar">
            <input type="text" id="searchInput" placeholder="بحث باسم العميل أو رقم الفاتورة..." onkeyup="searchTable()">
            <button onclick="exportToExcel()" class="btn btn-excel">📥 تصدير Excel</button>
            <button onclick="exportToPDF()" class="btn btn-pdf">📄 تصدير PDF</button>
            <input type="file" id="fileInput" style="display:none" onchange="importFromExcel(event)">
            <button onclick="document.getElementById('fileInput').click()" class="btn btn-import">📤 استيراد Excel</button>
        </div>

        <div class="main-content">
            <div class="card">
                <h3>📝 إضافة فاتورة</h3>
                <form id="invoiceForm">
                    <label>رقم الفاتورة</label>
                    <input type="text" id="invoice_number" required>
                    <label>اسم العميل</label>
                    <input type="text" id="customer_name" required>
                    <label>التاريخ</label>
                    <input type="date" id="invoice_date" required>
                    <label>الحالة</label>
                    <select id="delivery_status">
                        <option value="معلقة">معلقة</option>
                        <option value="تم التوصيل">تم التوصيل</option>
                        <option value="ملغية">ملغية</option>
                    </select>
                    <button type="submit" class="btn btn-add" style="width:100%; margin-top:10px;">حفظ الفاتورة</button>
                </form>
            </div>

            <div class="card">
                <table id="invoicesTable">
                    <thead>
                        <tr>
                            <th>رقم الفاتورة</th>
                            <th>العميل</th>
                            <th>التاريخ</th>
                            <th>الحالة</th>
                            <th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="tableBody">
                        <!-- البيانات ستظهر هنا -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- المكتبات الخارجية -->
    <script src="https://cloudflare.com"></script>
    <script src="https://cloudflare.com"></script>
    <script src="https://cloudflare.com"></script>

    <script>
        // تحميل البيانات عند فتح الصفحة
        async function loadInvoices() {
            const res = await fetch('/api/invoices');
            const data = await res.json();
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = data.map(inv => \`
                <tr>
                    <td>\${inv.invoice_number}</td>
                    <td>\${inv.customer_name}</td>
                    <td>\${inv.invoice_date}</td>
                    <td><span class="status-badge \${inv.delivery_status}">\${inv.delivery_status}</span></td>
                    <td><button onclick="deleteInvoice(\${inv.id})" style="color:red; border:none; background:none; cursor:pointer;">حذف</button></td>
                </tr>
            \`).join('');
        }

        // إضافة فاتورة
        document.getElementById('invoiceForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = {
                invoice_number: document.getElementById('invoice_number').value,
                customer_name: document.getElementById('customer_name').value,
                invoice_date: document.getElementById('invoice_date').value,
                delivery_status: document.getElementById('delivery_status').value
            };

            await fetch('/api/invoices', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(formData)
            });
            
            e.target.reset();
            loadInvoices();
        };

        // البحث
        function searchTable() {
            let val = document.getElementById('searchInput').value.toLowerCase();
            let rows = document.querySelectorAll('#tableBody tr');
            rows.forEach(row => {
                row.style.display = row.innerText.toLowerCase().includes(val) ? '' : 'none';
            });
        }

        // تصدير Excel
        function exportToExcel() {
            let table = document.getElementById('invoicesTable');
            let wb = XLSX.utils.table_to_book(table);
            XLSX.writeFile(wb, 'Fatoora_Export.xlsx');
        }

        // تصدير PDF
        function exportToPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text("قائمة الفواتير", 10, 10);
            doc.autoTable({ html: '#invoicesTable', margin: { top: 20 } });
            doc.save('Invoices.pdf');
        }

        // استيراد من Excel
        function importFromExcel(event) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = function(e) {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                alert('تم استخراج ' + jsonData.length + ' سجل من الملف. يمكنك الآن ربطها بقاعدة البيانات.');
                console.log(jsonData);
            };
            reader.readAsArrayBuffer(file);
        }

        async function deleteInvoice(id) {
            if(confirm('هل أنت متأكد؟')) {
                await fetch(\`/api/invoices/\${id}\`, { method: 'DELETE' });
                loadInvoices();
            }
        }

        loadInvoices();
    </script>
</body>
</html>\`;

// ═══════════════════ API ROUTES ═══════════════════

app.get('/', (req, res) => res.send(HTML_PAGE));

app.get('/api/invoices', (req, res) => {
    db.all("SELECT * FROM invoices ORDER BY id DESC", [], (err, rows) => {
        res.json(rows);
    });
});

app.post('/api/invoices', (req, res) => {
    const { invoice_number, invoice_date, customer_name, delivery_status } = req.body;
    db.run(\`INSERT INTO invoices (invoice_number, invoice_date, customer_name, delivery_status) VALUES (?, ?, ?, ?)\`,
    [invoice_number, invoice_date, customer_name, delivery_status], () => {
        res.json({ success: true });
    });
});

app.delete('/api/invoices/:id', (req, res) => {
    db.run(\`DELETE FROM invoices WHERE id = ?\`, req.params.id, () => {
        res.json({ success: true });
    });
});

app.listen(PORT, () => console.log(\`Server is running on port \${PORT}\`));
