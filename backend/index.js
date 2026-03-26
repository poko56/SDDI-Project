const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// ── CORS: whitelist production + local dev ──────────────────────────────────
const allowedOrigins = [
  'https://sddi-2025.web.app',
  'https://sddi-2025.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS Not Allowed'));
  },
  credentials: true
}));

// Route for media upload (must stay above global body parsers to avoid stream consumption issues)
app.use('/api/media', require('./routes/Media'));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Rate Limiters ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                    // 10 attempts per window per IP
  message: { error: 'พยายาม login มากเกินไป กรุณารอ 15 นาที แล้วลองใหม่' },
  standardHeaders: true,
  legacyHeaders: false,
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,
  message: { error: 'สมัครสมาชิกมากเกินไป กรุณารอ 1 ชั่วโมง' },
  standardHeaders: true,
  legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 200,
  message: { error: 'Request มากเกินไป กรุณารอสักครู่' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general limiter to all API routes
app.use('/api', apiLimiter);

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
    } catch (e) {
      console.error('❌ Firestore seeding error', e);
      isDbInitialized = true;
    }
  }
  next();
});

// Load routes (apply specific limiters to auth)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/requests', require('./routes/Requests'));

const otherRoutes = require('./routes/Other');
app.use('/api/materials', otherRoutes.materialRouter);
app.use('/api/users', otherRoutes.userRouter);
app.use('/api/locations', otherRoutes.locationRouter);
app.use('/api/evaluations', otherRoutes.evalRouter);
app.use('/api/dashboard', otherRoutes.dashRouter);
app.use('/api/notifications', otherRoutes.notifRouter);
app.use('/api/reports', otherRoutes.reportRouter);
app.use('/api/purchase-orders', otherRoutes.poRouter);
app.use('/api/schedule', otherRoutes.scheduleRouter);
app.use('/api/notification-settings', otherRoutes.notifSettingsRouter);
app.use('/api/audit-logs', otherRoutes.auditLogRouter);


// ── Global error handler (no stack trace in production) ─────────────────────
app.use((err, req, res, next) => {
  const isProd = !process.env.FUNCTIONS_EMULATOR;
  console.error('[ERROR]', err.message);
  if (err.message === 'CORS Not Allowed') {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.status(err.status || 500).json({
    error: isProd ? (err.message || 'Internal Server Error') : err.message,
    ...(isProd ? {} : { stack: err.stack })
  });
});

exports.api = onRequest({ cors: false, invoker: 'public' }, app);

