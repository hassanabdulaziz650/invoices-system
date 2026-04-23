const express = require('express');
const { Pool } = require('pg');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// دالة تلقائية لإنشاء الجدول وتحديث الأعمدة
async function setupDatabase() {
    try {
        // إنشاء الجدول إذا لم يكن موجوداً
        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                customer_name TEXT,
                invoice_date DATE,
                amount NUMERIC,
                status TEXT DEFAULT 'تم التوصيل'
            );
        `);
        // إضافة عمود الحالة إذا كان الجدول قديماً ولا يحتوي عليه
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='status') THEN
                    ALTER TABLE invoices ADD COLUMN status TEXT DEFAULT 'تم التوصيل';
                END IF;
            END $$;
        `);
        console.log("Database updated successfully");
    } catch (err) {
        console.error("Database setup error:", err);
    }
}
setupDatabase();

app.get('/api/invoices', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM invoices ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json(err); }
});

app.post('/api/invoices', async (req, res) => {
    const { name, date, amount, status } = req.body;
    try {
        await pool.query(
            'INSERT INTO invoices (customer_name, invoice_date, amount, status) VALUES ($1, $2, $3, $4)',
            [name, date || new Date(), amount, status || 'تم التوصيل']
        );
        res.sendStatus(200);
    } catch (err) { res.status(500).json(err); }
});

app.listen(process.env.PORT || 10000, '0.0.0.0');
