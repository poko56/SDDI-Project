const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, Timestamp } = require('../db/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });

    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).where('is_active', '==', 1).limit(1).get();

    if (snapshot.empty) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ' });

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

    await userDoc.ref.update({ last_login: Timestamp.now() });

    const token = jwt.sign({ id: userDoc.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userDoc.id, name: user.name, role: user.role, email: user.email, is_active: user.is_active } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, student_id, department } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็น' });

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });

    // Password validation (min 6 chars)
    if (password.length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' });

    const usersRef = db.collection('users');
    const emailSnap = await usersRef.where('email', '==', email).limit(1).get();
    if (!emailSnap.empty) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });

    if (student_id) {
      const sidSnap = await usersRef.where('student_id', '==', student_id).limit(1).get();
      if (!sidSnap.empty) return res.status(409).json({ error: 'รหัสประจำตัวนี้ถูกใช้งานแล้ว' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const newUserRef = usersRef.doc(); // Auto ID
    
    await newUserRef.set({
      id: newUserRef.id,
      name,
      email,
      password: hash,
      student_id: student_id || null,
      department: department || null,
      role: 'user',
      is_active: 1,
      created_at: Timestamp.now()
    });
    
    res.status(201).json({ message: 'ลงทะเบียนสำเร็จ สามารถเข้าสู่ระบบได้เลย' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(String(req.user.id)).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
    
    const u = userDoc.data();
    res.json({
      id: userDoc.id,
      name: u.name,
      email: u.email,
      role: u.role,
      student_id: u.student_id,
      department: u.department,
      phone: u.phone,
      avatar: u.avatar,
      is_active: u.is_active
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH: Update Profile Info
router.patch('/profile', authenticate, async (req, res) => {
  try {
    const { name, student_id, department, phone } = req.body;
    const allowed = { name, student_id, department, phone };
    const updates = {};
    Object.keys(allowed).forEach(k => { if(allowed[k] !== undefined) updates[k] = allowed[k]; });
    
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องการอัปเดต' });

    const ref = db.collection('users').doc(String(req.user.id));
    await ref.update(updates);

    await db.collection('audit_logs').add({
      user_id: String(req.user.id), action: 'UPDATE_PROFILE', target_table: 'users', target_id: req.user.id,
      detail: `แก้ไขข้อมูลโปรไฟล์: ${Object.keys(updates).join(', ')}`, created_at: Timestamp.now()
    });

    res.json({ message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH: Change Password
router.patch('/profile/password', authenticate, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่' });
    if (new_password.length < 6) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });

    const ref = db.collection('users').doc(String(req.user.id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });

    const user = doc.data();
    const isValid = bcrypt.compareSync(old_password, user.password);
    if (!isValid) return res.status(401).json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' });

    const hash = bcrypt.hashSync(new_password, 10);
    await ref.update({ password: hash });

    await db.collection('audit_logs').add({
      user_id: String(req.user.id), action: 'CHANGE_PASSWORD', target_table: 'users', target_id: req.user.id,
      detail: 'เปลี่ยนรหัสผ่านสำเร็จ', created_at: Timestamp.now()
    });

    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
