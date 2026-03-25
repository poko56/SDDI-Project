const express = require('express');
const { db, Timestamp } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

/* ====== MATERIALS ====== */
const materialRouter = express.Router();

materialRouter.get('/', authenticate, async (req, res) => {
  try {
    const snap = await db.collection('materials').get();
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (a.category||'').localeCompare(b.category||''));
    const low_count = items.filter(m => m.quantity <= m.reorder_point && m.reorder_point > 0).length;
    const total_value = items.reduce((acc, m) => acc + (m.quantity * (m.unit_price||0)), 0);
    const categories = [...new Set(items.map(m => m.category))];
    res.json({ items, low_count, total_value, categories });
  } catch(e) { res.status(500).json({error:e.message}); }
});

materialRouter.post('/', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const { code, name, category, brand, quantity, unit, unit_price, reorder_point } = req.body;
    const snap = await db.collection('materials').where('code','==',code).get();
    if(!snap.empty) return res.status(409).json({error:'รหัสวัสดุซ้ำ'});
    const ref = db.collection('materials').doc();
    await ref.set({ id:ref.id, code, name, category, brand:brand||null, quantity:Number(quantity)||0, unit:unit||'ชิ้น', unit_price:Number(unit_price)||0, reorder_point:Number(reorder_point)||5, created_at:Timestamp.now() });
    res.status(201).json({ message:'เพิ่มสำเร็จ', id:ref.id });
  } catch(e){ res.status(500).json({error:e.message}); }
});

materialRouter.post('/:id/stock-in', authenticate, authorize('admin','manager','technician'), async (req, res) => {
  try {
    const qty = Number(req.body.quantity);
    if (!qty || qty <= 0) return res.status(400).json({error:'จำนวนไม่ถูกต้อง'});
    const ref = db.collection('materials').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({error:'ไม่พบวัสดุ'});
    await ref.update({ quantity: doc.data().quantity + qty });
    res.json({ message:'รับเข้าคลังสำเร็จ' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* ====== USERS ====== */
const userRouter = express.Router();
userRouter.get('/', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const snap = await db.collection('users').get();
    let users = snap.docs.map(d => { const dt = d.data(); if(dt.password) delete dt.password; return {id: d.id, ...dt}; });
    if(req.query.role) users = users.filter(u=>u.role === req.query.role);
    res.json(users);
  } catch(e){ res.status(500).json({error:e.message}); }
});
userRouter.patch('/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.id);
    const doc = await ref.get();
    if(!doc.exists) return res.status(404).json({error:'ไม่พบผู้ใช้งาน'});
    await ref.update({ is_active: doc.data().is_active ? 0 : 1 });
    res.json({ message:'อัปเดตสถานะสำเร็จ' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* ====== EVALUATIONS ====== */
const evalRouter = express.Router();
evalRouter.post('/', authenticate, async (req, res) => {
  try {
    const { request_id, quality_score, speed_score, service_score, comment } = req.body;
    const avg = ((+quality_score + +speed_score + +service_score) / 3).toFixed(2);
    const ref = db.collection('evaluations').doc();
    await ref.set({ id:ref.id, request_id, evaluator_id:String(req.user.id), quality_score, speed_score, service_score, avg_score:avg, comment, created_at:Timestamp.now() });
    res.status(201).json({ message:'บันทึกผลประเมินสำเร็จ' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* ====== DASHBOARD ====== */
const dashRouter = express.Router();
dashRouter.get('/', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    const snap = await db.collection('repair_requests').get();
    const reqs = snap.docs.map(d=>d.data());
    const total = {
      total: reqs.length,
      pending: reqs.filter(r=>r.status==='รอดำเนินการ').length,
      in_progress: reqs.filter(r=>r.status==='กำลังดำเนินการ').length,
      review: reqs.filter(r=>r.status==='รอตรวจสอบ').length,
      done: reqs.filter(r=>r.status==='เสร็จสมบูรณ์').length,
      emergency: reqs.filter(r=>r.urgency==='ฉุกเฉิน' && r.status!=='เสร็จสมบูรณ์').length,
      overdue: reqs.filter(r=>r.sla_deadline && r.sla_deadline.toMillis()<Date.now() && r.status!=='เสร็จสมบูรณ์').length
    };
    const catMap = {}; reqs.forEach(r => { catMap[r.category] = (catMap[r.category]||0)+1; });
    const by_category = Object.entries(catMap).map(([category, count]) => ({category, count}));
    
    // Very dummy summary
    res.json({ total, by_category, by_status: [], monthly: [], tech_perf: [], avg_sla: {avg_hours:0}, satisfaction: {avg:5.0, count:1} });
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* ====== NOTIFICATIONS ====== */
const notifRouter = express.Router();
notifRouter.get('/', authenticate, async (req, res) => {
  try {
    const snap = await db.collection('notifications').where('user_id', '==', String(req.user.id)).get();
    let items = snap.docs.map(d=>({id: d.id, ...d.data()}));
    items.sort((a,b) => (b.created_at?.toMillis()||0) - (a.created_at?.toMillis()||0));
    items.forEach(i => { if(i.created_at instanceof Timestamp) i.created_at = i.created_at.toDate().toISOString(); });
    const unread = items.filter(n=>!n.is_read).length;
    res.json({ items, unread });
  } catch(e){ res.status(500).json({error:e.message}); }
});
notifRouter.patch('/read-all', authenticate, async (req, res) => {
  try {
    const snap = await db.collection('notifications').where('user_id', '==', String(req.user.id)).where('is_read', '==', 0).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.update(doc.ref, { is_read: 1 }));
    await batch.commit();
    res.json({ message:'อ่านทั้งหมดแล้ว' });
  } catch(e){ res.status(500).json({error:e.message}); }
});
notifRouter.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await db.collection('notifications').doc(req.params.id).update({ is_read: 1 });
    res.json({ message:'ok' });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Since locations is no longer structured relationally in the new frontend update, omit or mock locationRouter
const locationRouter = express.Router();
locationRouter.get('/', (req,res) => res.json({buildings:[], locations:[], grouped:[]}));

module.exports = { materialRouter, userRouter, evalRouter, dashRouter, notifRouter, locationRouter };