const express = require('express');
const cors = require('cors');
const path = require('path');

// *** จุดสำคัญ: ถ้าคุณเอา database.js ไว้ในโฟลเดอร์ db ให้ใช้ './db/database' ***
// *** แต่ถ้าเอาไว้ข้างนอกคู่กับ server.js ให้ใช้ './database' ***
const db = require('./db/database'); // ต้องมี db/ นำหน้าเสมอ!

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// เรียกใช้ getDb ผ่านตัวแปร db
db.getDb().then(() => {
  console.log('✅ Database initialized');

  try {
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/requests', require('./routes/requests'));
    app.use('/api/materials', require('./routes/materials'));
    const otherRoutes = require('./routes/other');
    app.use('/api/users', otherRoutes.userRouter);
    app.use('/api/locations', otherRoutes.locationRouter);
    app.use('/api/evaluations', otherRoutes.evalRouter);
    app.use('/api/dashboard', otherRoutes.dashRouter);
  } catch (e) {
    console.warn('⚠️ บาง Route อาจจะยังไม่มีไฟล์รองรับ:', e.message);
  }

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Database error:', err);
  process.exit(1);
});