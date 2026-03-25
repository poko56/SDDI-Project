const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');
const path = require('path');
// Removed getDb import

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const isFirebase = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.GCLOUD_PROJECT || process.env.FUNCTION_TARGET || process.env.K_SERVICE;
const uploadDir = isFirebase ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

const { seedData } = require('./db/database');

let isDbInitialized = false;

// Middleware to ensure DB is seeded
app.use(async (req, res, next) => {
  if (!isDbInitialized) {
    try {
      await seedData();
      isDbInitialized = true;
      console.log('✅ Firestore seeding checked/completed');
    } catch (e) {
      console.error('❌ Firestore seeding error', e);
      // Even if seed fails, let it pass so it doesn't break everything
      isDbInitialized = true; 
    }
  }
  next();
});

// Load routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/requests', require('./routes/Requests'));

const otherRoutes = require('./routes/Other');
app.use('/api/materials', otherRoutes.materialRouter);
app.use('/api/users', otherRoutes.userRouter);
app.use('/api/locations', otherRoutes.locationRouter);
app.use('/api/evaluations', otherRoutes.evalRouter);
app.use('/api/dashboard', otherRoutes.dashRouter);
app.use('/api/notifications', otherRoutes.notifRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

exports.api = onRequest({ cors: true, invoker: 'public' }, app);
