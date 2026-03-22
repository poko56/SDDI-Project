const express = require('express');
const { query, run } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

/* ====== MATERIALS ====== */
const materialRouter = express.Router();

materialRouter.get('/', authenticate, (req, res) => {
  const { category, low_stock, search } = req.query;
  let sql = 'SELECT * FROM materials WHERE 1=1'; const p = [];
  if (category) { sql += ' AND category=?'; p.push(category); }
  if (low_stock==='1') sql += ' AND quantity <= reorder_point';
  if (search) { sql += ' AND (name LIKE ? OR code LIKE ?)'; p.push(`%${search}%`,`%${search}%`); }
  sql += ' ORDER BY category, name';
  const items = query(sql, p);
  const low_count = query('SELECT COUNT(*) as c FROM materials WHERE quantity<=reorder_point AND reorder_point>0')[0].c;
  const total_value = query('SELECT COALESCE(SUM(quantity*unit_price),0) as v FROM materials')[0].v;
  const categories = query("SELECT DISTINCT category FROM materials ORDER BY category");
  res.json({ items, low_count, total_value, categories: categories.map(c=>c.category) });
});

materialRouter.get('/:id', authenticate, (req, res) => {
  const m = query('SELECT * FROM materials WHERE id=?', [req.params.id]);
  if (!m.length) return res.status(404).json({ error: 'ไม่พบวัสดุ' });
  const txn = query(`SELECT st.*,u.name as by_name FROM stock_transactions st LEFT JOIN users u ON st.created_by=u.id WHERE st.material_id=? ORDER BY st.created_at DESC LIMIT 30`, [req.params.id]);
  const usage = query(`SELECT mu.*,r.tracking_id,u.name as tech_name FROM material_usage mu JOIN repair_requests r ON mu.request_id=r.id JOIN users u ON mu.used_by=u.id WHERE mu.material_id=? ORDER BY mu.used_at DESC LIMIT 20`, [req.params.id]);
  res.json({ ...m[0], transactions: txn, recent_usage: usage });
});

materialRouter.post('/', authenticate, authorize('admin','manager'), (req, res) => {
  const { code, name, category, brand, quantity, unit, unit_price, reorder_point, expiry_date, location_note } = req.body;
  if (!code||!name||!category) return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็น' });
  if (query('SELECT id FROM materials WHERE code=?', [code]).length) return res.status(409).json({ error: 'รหัสวัสดุซ้ำ' });
  const r = run('INSERT INTO materials (code,name,category,brand,quantity,unit,unit_price,reorder_point,expiry_date,location_note) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [code,name,category,brand||null,quantity||0,unit||'ชิ้น',unit_price||0,reorder_point||5,expiry_date||null,location_note||null]);
  if (quantity>0) run('INSERT INTO stock_transactions (material_id,type,quantity,note,created_by) VALUES (?,?,?,?,?)',
    [r.lastInsertRowid,'in',quantity,'ยอดยกมา',req.user.id]);
  res.status(201).json({ message:'เพิ่มวัสดุสำเร็จ', id:r.lastInsertRowid });
});

materialRouter.put('/:id', authenticate, authorize('admin','manager'), (req, res) => {
  const { name, category, brand, unit, unit_price, reorder_point, expiry_date, location_note } = req.body;
  run('UPDATE materials SET name=?,category=?,brand=?,unit=?,unit_price=?,reorder_point=?,expiry_date=?,location_note=? WHERE id=?',
    [name,category,brand||null,unit,unit_price,reorder_point,expiry_date||null,location_note||null,req.params.id]);
  res.json({ message:'แก้ไขสำเร็จ' });
});

materialRouter.post('/:id/stock-in', authenticate, authorize('admin','manager','technician'), (req, res) => {
  const { quantity, note } = req.body;
  if (!quantity||quantity<=0) return res.status(400).json({ error: 'จำนวนไม่ถูกต้อง' });
  run('UPDATE materials SET quantity=quantity+? WHERE id=?', [quantity, req.params.id]);
  run('INSERT INTO stock_transactions (material_id,type,quantity,note,created_by) VALUES (?,?,?,?,?)',
    [req.params.id,'in',quantity,note||null,req.user.id]);
  res.json({ message:'รับวัสดุเข้าคลังสำเร็จ' });
});

materialRouter.post('/use', authenticate, authorize('technician','admin','manager'), (req, res) => {
  const { request_id, material_id, quantity_used, note } = req.body;
  if (!request_id||!material_id||!quantity_used) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  const m = query('SELECT quantity,reorder_point,name FROM materials WHERE id=?', [material_id]);
  if (!m.length) return res.status(404).json({ error: 'ไม่พบวัสดุ' });
  if (m[0].quantity < quantity_used) return res.status(400).json({ error: `วัสดุ ${m[0].name} คงเหลือไม่เพียงพอ (คงเหลือ ${m[0].quantity})` });
  run('UPDATE materials SET quantity=quantity-? WHERE id=?', [quantity_used, material_id]);
  run('INSERT INTO material_usage (request_id,material_id,quantity_used,used_by,note) VALUES (?,?,?,?,?)',
    [request_id, material_id, quantity_used, req.user.id, note||null]);
  run('INSERT INTO stock_transactions (material_id,type,quantity,note,ref_request_id,created_by) VALUES (?,?,?,?,?,?)',
    [material_id,'out',quantity_used,`เบิกใช้งาน #${request_id}`,request_id,req.user.id]);
  const updated = query('SELECT quantity,reorder_point FROM materials WHERE id=?', [material_id])[0];
  res.json({ message:'บันทึกสำเร็จ', low_stock: updated.quantity<=updated.reorder_point });
});

materialRouter.get('/report/summary', authenticate, authorize('manager','admin'), (req, res) => {
  const by_category = query(`SELECT category, COUNT(*) as count, SUM(quantity*unit_price) as value FROM materials GROUP BY category ORDER BY value DESC`);
  const top_used = query(`SELECT m.name,m.code,SUM(mu.quantity_used) as total_used,SUM(mu.quantity_used*m.unit_price) as cost
    FROM material_usage mu JOIN materials m ON mu.material_id=m.id GROUP BY m.id ORDER BY total_used DESC LIMIT 10`);
  const monthly = query(`SELECT strftime('%Y-%m',mu.used_at) as month,SUM(mu.quantity_used*m.unit_price) as cost
    FROM material_usage mu JOIN materials m ON mu.material_id=m.id GROUP BY month ORDER BY month DESC LIMIT 12`);
  res.json({ by_category, top_used, monthly: monthly.reverse() });
});

/* ====== USERS ====== */
const userRouter = express.Router();

userRouter.get('/', authenticate, authorize('admin','manager'), (req, res) => {
  const { role } = req.query;
  let sql = 'SELECT id,student_id,name,email,role,department,phone,is_active,last_login,created_at FROM users WHERE 1=1';
  const p = [];
  if (role) { sql += ' AND role=?'; p.push(role); }
  sql += ' ORDER BY role,name';
  res.json(query(sql, p));
});

userRouter.get('/technicians', authenticate, (req, res) => {
  const techs = query(`SELECT u.id,u.name,u.email,u.department,u.phone,
    COUNT(CASE WHEN r.status IN ('กำลังดำเนินการ','รอตรวจสอบ') THEN 1 END) as active_jobs,
    COUNT(CASE WHEN r.status='เสร็จสมบูรณ์' THEN 1 END) as done_jobs,
    ROUND(AVG(e.avg_score),2) as avg_score
    FROM users u
    LEFT JOIN repair_requests r ON u.id=r.assigned_tech_id
    LEFT JOIN evaluations e ON r.id=e.request_id
    WHERE u.role='technician' AND u.is_active=1
    GROUP BY u.id ORDER BY active_jobs ASC, done_jobs DESC`);
  res.json(techs);
});

userRouter.patch('/:id/toggle', authenticate, authorize('admin'), (req, res) => {
  run('UPDATE users SET is_active=CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=?', [req.params.id]);
  res.json({ message:'อัปเดตสถานะสำเร็จ' });
});

userRouter.patch('/:id/role', authenticate, authorize('admin'), (req, res) => {
  const { role } = req.body;
  const valid = ['user','technician','manager','admin'];
  if (!valid.includes(role)) return res.status(400).json({ error:'บทบาทไม่ถูกต้อง' });
  run('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
  res.json({ message:'เปลี่ยนบทบาทสำเร็จ' });
});

/* ====== LOCATIONS ====== */
const locationRouter = express.Router();

locationRouter.get('/', authenticate, (req, res) => {
  const buildings = query('SELECT * FROM buildings ORDER BY name');
  const locs = query('SELECT l.*,b.name as building_name FROM locations l JOIN buildings b ON l.building_id=b.id ORDER BY b.name,l.floor,l.room');
  const grouped = {};
  buildings.forEach(b => { grouped[b.id] = { ...b, locations: [] }; });
  locs.forEach(l => { if (grouped[l.building_id]) grouped[l.building_id].locations.push(l); });
  res.json({ buildings, locations: locs, grouped: Object.values(grouped) });
});

locationRouter.post('/building', authenticate, authorize('admin'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error:'กรุณาระบุชื่ออาคาร' });
  const r = run('INSERT INTO buildings (name,description) VALUES (?,?)', [name, description||null]);
  res.status(201).json({ message:'เพิ่มอาคารสำเร็จ', id:r.lastInsertRowid });
});

locationRouter.post('/', authenticate, authorize('admin'), (req, res) => {
  const { building_id, floor, room } = req.body;
  if (!building_id||!floor||!room) return res.status(400).json({ error:'ข้อมูลไม่ครบ' });
  const r = run('INSERT INTO locations (building_id,floor,room) VALUES (?,?,?)', [building_id, floor, room]);
  res.status(201).json({ message:'เพิ่มสถานที่สำเร็จ', id:r.lastInsertRowid });
});

/* ====== EVALUATIONS ====== */
const evalRouter = express.Router();

evalRouter.post('/', authenticate, (req, res) => {
  const { request_id, quality_score, speed_score, service_score, comment } = req.body;
  if (!request_id||!quality_score||!speed_score||!service_score) return res.status(400).json({ error:'กรุณาให้คะแนนให้ครบ' });
  const r = query("SELECT * FROM repair_requests WHERE id=? AND requester_id=? AND status='เสร็จสมบูรณ์'", [request_id, req.user.id]);
  if (!r.length) return res.status(403).json({ error:'ไม่สามารถประเมินงานนี้ได้' });
  if (query('SELECT id FROM evaluations WHERE request_id=?', [request_id]).length) return res.status(409).json({ error:'ประเมินงานนี้ไปแล้ว' });
  const avg = ((+quality_score + +speed_score + +service_score) / 3).toFixed(2);
  run('INSERT INTO evaluations (request_id,evaluator_id,quality_score,speed_score,service_score,avg_score,comment) VALUES (?,?,?,?,?,?,?)',
    [request_id, req.user.id, quality_score, speed_score, service_score, avg, comment||null]);
  res.status(201).json({ message:'บันทึกผลประเมินสำเร็จ ขอบคุณสำหรับ Feedback ของคุณ' });
});

/* ====== DASHBOARD ====== */
const dashRouter = express.Router();

dashRouter.get('/', authenticate, authorize('manager','admin'), (req, res) => {
  const total = query(`SELECT
    COUNT(*) as total, COUNT(CASE WHEN status='รอดำเนินการ' THEN 1 END) as pending,
    COUNT(CASE WHEN status='กำลังดำเนินการ' THEN 1 END) as in_progress,
    COUNT(CASE WHEN status='รอตรวจสอบ' THEN 1 END) as review,
    COUNT(CASE WHEN status='เสร็จสมบูรณ์' THEN 1 END) as done,
    COUNT(CASE WHEN sla_deadline < datetime('now') AND status NOT IN ('เสร็จสมบูรณ์') THEN 1 END) as overdue,
    COUNT(CASE WHEN urgency='ฉุกเฉิน' AND status!='เสร็จสมบูรณ์' THEN 1 END) as emergency
    FROM repair_requests`)[0];
  const by_category = query("SELECT category,COUNT(*) as count FROM repair_requests GROUP BY category ORDER BY count DESC");
  const by_urgency = query("SELECT urgency,COUNT(*) as count FROM repair_requests GROUP BY urgency");
  const by_status = query("SELECT status,COUNT(*) as count FROM repair_requests GROUP BY status");
  const monthly = query(`SELECT strftime('%Y-%m',created_at) as month,COUNT(*) as count FROM repair_requests GROUP BY month ORDER BY month DESC LIMIT 12`);
  const top_buildings = query(`SELECT b.name,COUNT(r.id) as count FROM repair_requests r JOIN locations l ON r.location_id=l.id JOIN buildings b ON l.building_id=b.id GROUP BY b.id ORDER BY count DESC LIMIT 5`);
  const tech_perf = query(`SELECT u.name,u.id,
    COUNT(r.id) as total, COUNT(CASE WHEN r.status='เสร็จสมบูรณ์' THEN 1 END) as done,
    ROUND(AVG(CASE WHEN r.completed_at IS NOT NULL THEN julianday(r.completed_at)-julianday(r.created_at) END),1) as avg_days,
    ROUND(AVG(e.avg_score),2) as avg_score
    FROM users u LEFT JOIN repair_requests r ON u.id=r.assigned_tech_id LEFT JOIN evaluations e ON r.id=e.request_id
    WHERE u.role='technician' GROUP BY u.id ORDER BY done DESC`);
  const avg_sla = query(`SELECT ROUND(AVG(julianday(completed_at)-julianday(created_at))*24,1) as avg_hours FROM repair_requests WHERE status='เสร็จสมบูรณ์' AND completed_at IS NOT NULL`)[0];
  const sat = query(`SELECT ROUND(AVG(avg_score),2) as avg, COUNT(*) as count FROM evaluations`)[0];
  res.json({ total, by_category, by_urgency, by_status, monthly: monthly.reverse(), top_buildings, tech_perf, avg_sla, satisfaction: sat });
});

/* ====== NOTIFICATIONS ====== */
const notifRouter = express.Router();

notifRouter.get('/', authenticate, (req, res) => {
  const items = query('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  const unread = items.filter(n=>!n.is_read).length;
  res.json({ items, unread });
});

notifRouter.patch('/read-all', authenticate, (req, res) => {
  run('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
  res.json({ message:'อ่านทั้งหมดแล้ว' });
});

notifRouter.patch('/:id/read', authenticate, (req, res) => {
  run('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ message:'ok' });
});

module.exports = { materialRouter, userRouter, locationRouter, evalRouter, dashRouter, notifRouter };