const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, run } = require('../db/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });

  const users = query('SELECT * FROM users WHERE email=? AND is_active=1', [email]);
  if (!users.length) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ' });

  const user = users[0];
  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

  run('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, email: user.email, is_active: user.is_active } });
});

router.post('/register', (req, res) => {
  const { name, email, password, student_id, department } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็น' });

  const existing = query('SELECT id FROM users WHERE email=? OR (student_id IS NOT NULL AND student_id=?)', [email, student_id || '']);
  if (existing.length) return res.status(409).json({ error: 'อีเมลหรือรหัสประจำตัวนี้มีในระบบแล้ว' });

  const hash = bcrypt.hashSync(password, 10);
  run('INSERT INTO users (name, email, password, student_id, department, role) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, hash, student_id || null, department || null, 'user']);
  
  res.status(201).json({ message: 'ลงทะเบียนสำเร็จ สามารถเข้าสู่ระบบได้เลย' });
});

router.get('/me', authenticate, (req, res) => {
  const users = query('SELECT id, name, email, role, student_id, department, phone, avatar, is_active FROM users WHERE id=?', [req.user.id]);
  if (!users.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
  res.json(users[0]);
});

module.exports = router;
