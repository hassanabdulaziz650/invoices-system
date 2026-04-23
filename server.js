const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// تحديث قاعدة البيانات تلقائياً
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                customer_name TEXT,
                invoice_date DATE DEFAULT CURRENT_DATE,
                amount NUMERIC DEFAULT 0,
                status TEXT DEFAULT 'تم التوصيل'
            );
        `);
        // إضافة عمود الحالة إذا لم يكن موجوداً
        await pool.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'تم التوصيل';");
        console.log("✅ قاعدة البيانات جاهزة");
    } catch (err) { console.error("❌ خطأ في القاعدة:", err); }
}
initDB();

app.get('/api/invoices', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM invoices ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/invoices', async (req, res) => {
    try {
        const { name, date, amount, status } = req.body;
        // تنظيف البيانات قبل الإدخال
        const cleanName = name ? name.toString() : 'غير معروف';
        const cleanAmount = isNaN(parseFloat(amount)) ? 0 : parseFloat(amount);
        const cleanDate = date || new Date();

        await pool.query(
            'INSERT INTO invoices (customer_name, invoice_date, amount, status) VALUES ($1, $2, $3, $4)',
            [cleanName, cleanDate, cleanAmount, status || 'تم التوصيل']
        );
        res.sendStatus(200);
    } catch (err) { res.status(500).send(err.message); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 السيرفر يعمل على منفذ ${PORT}`));
