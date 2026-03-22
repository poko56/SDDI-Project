const jwt = require('jsonwebtoken');
const { run } = require('../db/database');
const JWT_SECRET = process.env.JWT_SECRET || 'maint_sys_secret_2568';

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงส่วนนี้' });
    next();
  };
}

function auditLog(action, table, targetId, detail) {
  return (req, res, next) => {
    const orig = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400) {
        try {
          run('INSERT INTO audit_logs (user_id,action,target_table,target_id,detail,ip_address) VALUES (?,?,?,?,?,?)',
            [req.user?.id || null, action, table, targetId || body?.id || null, detail, req.ip]);
        } catch {}
      }
      return orig(body);
    };
    next();
  };
}

module.exports = { authenticate, authorize, auditLog, JWT_SECRET };