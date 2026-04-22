const express = require('express');
const path = require('path');
const app = express();

// المنفذ الديناميكي لـ Render
const PORT = process.env.PORT || 3000;

// تشغيل الملفات الثابتة من المجلد الرئيسي
app.use(express.static(__dirname));

// توجيه أي طلب لملف index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
