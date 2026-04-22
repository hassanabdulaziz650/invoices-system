const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 10000; // Render يفضل المنفذ 10000

// التأكد من قراءة الملفات من المجلد الحالي بشكل صحيح
app.use(express.static(path.join(__dirname)));

// إرسال index.html لأي طلب يجي للسيرفر
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
