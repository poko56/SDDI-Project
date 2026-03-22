const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

getDb().then(() => {
  console.log('✅ Database initialized');

  const authRoutes = require('./routes/auth');
  const requestRoutes = require('./routes/requests');
  const { materialRouter, userRouter, locationRouter, evalRouter, dashRouter, notifRouter } = require('./routes/other');

  app.use('/api/auth', authRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/materials', materialRouter);
  app.use('/api/users', userRouter);
  app.use('/api/locations', locationRouter);
  app.use('/api/evaluations', evalRouter);
  app.use('/api/dashboard', dashRouter);
  app.use('/api/notifications', notifRouter);

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  });

  // SPA fallback
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log('─────────────────────────────────────');
    console.log('📋 บัญชีทดสอบ:');
    console.log('   admin@school.ac.th      / admin1234   (Admin)');
    console.log('   supachok@school.ac.th   / manager1234 (Manager)');
    console.log('   wasurat@school.ac.th    / tech1234    (ช่างไฟฟ้า)');
    console.log('   wattanapong@school.ac.th/ tech1234    (ช่างประปา)');
    console.log('   warataya@school.ac.th   / user1234    (ผู้ใช้งาน)');
    console.log('─────────────────────────────────────');
  });
}).catch(e => { console.error('❌', e.message); process.exit(1); });