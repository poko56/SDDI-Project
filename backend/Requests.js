const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, run } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, f, cb) => ['.jpg','.jpeg','.png'].includes(path.extname(f.originalname).toLowerCase()) ? cb(null,true) : cb(new Error('รองรับเฉพาะ JPG/PNG'))
});

function genTracking() {
  const year = new Date().getFullYear() + 543;
  return `TRK-${year}-${String(Math.floor(Math.random()*9000)+1000)}`;
}

function slaDeadline(urgency) {
  const map = { 'ฉุกเฉิน':0, 'เร่งด่วน':1, 'ปกติ':3, 'ไม่เร่งด่วน':7 };
  const d = new Date();
  d.setDate(d.getDate() + (map[urgency] ?? 3));
  return d.toISOString();
}

const BASE_SQL = `
  SELECT r.*,
    u.name as requester_name, u.student_id as requester_sid, u.department as requester_dept, u.email as requester_email, u.phone as requester_phone,
    t.name as tech_name, t.phone as tech_phone, t.department as tech_dept,
    b.name as building_name, l.floor, l.room
  FROM repair_requests r
  LEFT JOIN users u ON r.requester_id=u.id
  LEFT JOIN users t ON r.assigned_tech_id=t.id
  LEFT JOIN locations l ON r.location_id=l.id
  LEFT JOIN buildings b ON l.building_id=b.id
`;

// GET /api/requests
router.get('/', authenticate, (req, res) => {
  const { role, id } = req.user;
  const { status, category, urgency, search, page=1, limit=20, sort='urgency' } = req.query;
  let where = 'WHERE 1=1'; const params = [];

  if (role === 'user') { where += ' AND r.requester_id=?'; params.push(id); }
  if (role === 'technician') { where += ' AND r.assigned_tech_id=?'; params.push(id); }
  if (status) { where += ' AND r.status=?'; params.push(status); }
  if (category) { where += ' AND r.category=?'; params.push(category); }
  if (urgency) { where += ' AND r.urgency=?'; params.push(urgency); }
  if (search) { where += ' AND (r.tracking_id LIKE ? OR r.description LIKE ? OR u.name LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }

  const orderMap = {
    urgency: "CASE r.urgency WHEN 'ฉุกเฉิน' THEN 1 WHEN 'เร่งด่วน' THEN 2 WHEN 'ปกติ' THEN 3 ELSE 4 END, r.created_at DESC",
    newest: 'r.created_at DESC', oldest: 'r.created_at ASC'
  };
  const order = orderMap[sort] || orderMap.urgency;
  const all = query(`${BASE_SQL} ${where} ORDER BY ${order}`, params);
  const offset = (parseInt(page)-1) * parseInt(limit);
  res.json({ total: all.length, page:parseInt(page), limit:parseInt(limit), items: all.slice(offset, offset+parseInt(limit)) });
});

// GET /api/requests/stats - summary counts
router.get('/stats', authenticate, (req, res) => {
  const { role, id } = req.user;
  let extra = role==='user' ? `AND requester_id=${id}` : role==='technician' ? `AND assigned_tech_id=${id}` : '';
  const r = query(`SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN status='รอดำเนินการ' THEN 1 END) as pending,
    COUNT(CASE WHEN status='กำลังดำเนินการ' THEN 1 END) as in_progress,
    COUNT(CASE WHEN status='รอตรวจสอบ' THEN 1 END) as review,
    COUNT(CASE WHEN status='เสร็จสมบูรณ์' THEN 1 END) as done,
    COUNT(CASE WHEN status='ต้องส่งซ่อมภายนอก' THEN 1 END) as external,
    COUNT(CASE WHEN urgency='ฉุกเฉิน' AND status NOT IN ('เสร็จสมบูรณ์') THEN 1 END) as emergency,
    COUNT(CASE WHEN sla_deadline < datetime('now') AND status NOT IN ('เสร็จสมบูรณ์') THEN 1 END) as overdue
    FROM repair_requests WHERE 1=1 ${extra}`)[0];
  res.json(r);
});

// GET /api/requests/track/:tid - public tracking
router.get('/track/:tid', (req, res) => {
  const rows = query(`SELECT r.tracking_id,r.category,r.description,r.urgency,r.status,
    r.created_at,r.assigned_at,r.started_at,r.completed_at,r.sla_deadline,r.repair_detail,
    b.name as building_name, l.floor, l.room, t.name as tech_name
    FROM repair_requests r
    LEFT JOIN locations l ON r.location_id=l.id LEFT JOIN buildings b ON l.building_id=b.id
    LEFT JOIN users t ON r.assigned_tech_id=t.id
    WHERE r.tracking_id=?`, [req.params.tid]);
  if (!rows.length) return res.status(404).json({ error: 'ไม่พบหมายเลขติดตามนี้' });
  res.json(rows[0]);
});

// GET /api/requests/:id
router.get('/:id', authenticate, (req, res) => {
  const rows = query(`${BASE_SQL} WHERE r.id=? OR r.tracking_id=?`, [req.params.id, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
  const r = rows[0];
  r.materials_used = query(`SELECT mu.*,m.name as mat_name,m.code,m.unit,u.name as used_by_name
    FROM material_usage mu JOIN materials m ON mu.material_id=m.id JOIN users u ON mu.used_by=u.id
    WHERE mu.request_id=?`, [r.id]);
  r.evaluation = query('SELECT * FROM evaluations WHERE request_id=?', [r.id])[0] || null;
  res.json(r);
});

// POST /api/requests - create
router.post('/', authenticate, upload.single('image'), (req, res) => {
  const { category, location_id, location_detail, description, urgency } = req.body;
  if (!category||!description||!urgency) return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็น' });
  const tid = genTracking();
  const sla = slaDeadline(urgency);
  const img = req.file ? `/uploads/${req.file.filename}` : null;
  const r = run(`INSERT INTO repair_requests (tracking_id,requester_id,category,location_id,location_detail,description,urgency,image_path,sla_deadline)
    VALUES (?,?,?,?,?,?,?,?,?)`,
    [tid, req.user.id, category, location_id||null, location_detail||null, description, urgency, img, sla]);
  // notify managers
  const managers = query("SELECT id FROM users WHERE role IN ('manager','admin') AND is_active=1");
  managers.forEach(m => run('INSERT INTO notifications (user_id,title,message,type,ref_request_id) VALUES (?,?,?,?,?)',
    [m.id, 'มีการแจ้งซ่อมใหม่', `${req.user.name} แจ้งซ่อม ${category} (${urgency})`, 'info', r.lastInsertRowid]));
  run('INSERT INTO audit_logs (user_id,action,target_table,target_id,detail) VALUES (?,?,?,?,?)',
    [req.user.id,'CREATE_REQUEST','repair_requests',r.lastInsertRowid,`สร้างใบแจ้งซ่อม ${tid}`]);
  res.status(201).json({ message:'แจ้งซ่อมสำเร็จ', tracking_id:tid, id:r.lastInsertRowid });
});

// PATCH /api/requests/:id/assign
router.patch('/:id/assign', authenticate, authorize('manager','admin'), (req, res) => {
  const { tech_id } = req.body;
  if (!tech_id) return res.status(400).json({ error: 'กรุณาเลือกช่าง' });
  const tech = query("SELECT id,name FROM users WHERE id=? AND role='technician' AND is_active=1", [tech_id]);
  if (!tech.length) return res.status(404).json({ error: 'ไม่พบข้อมูลช่าง' });
  const req_row = query('SELECT requester_id,tracking_id FROM repair_requests WHERE id=?', [req.params.id]);
  if (!req_row.length) return res.status(404).json({ error: 'ไม่พบงาน' });
  run("UPDATE repair_requests SET assigned_tech_id=?,assigned_at=CURRENT_TIMESTAMP,status='กำลังดำเนินการ' WHERE id=?", [tech_id, req.params.id]);
  // notify tech
  run('INSERT INTO notifications (user_id,title,message,type,ref_request_id) VALUES (?,?,?,?,?)',
    [tech_id, 'งานใหม่ถูกมอบหมายให้คุณ', `มอบหมายงาน ${req_row[0].tracking_id} ให้คุณแล้ว`, 'info', req.params.id]);
  // notify requester
  run('INSERT INTO notifications (user_id,title,message,type,ref_request_id) VALUES (?,?,?,?,?)',
    [req_row[0].requester_id, 'งานของคุณถูกมอบหมายช่างแล้ว', `ช่าง ${tech[0].name} จะดูแลงาน ${req_row[0].tracking_id}`, 'success', req.params.id]);
  res.json({ message:`มอบหมายให้ ${tech[0].name} สำเร็จ` });
});

// PATCH /api/requests/:id/status
router.patch('/:id/status', authenticate, (req, res) => {
  const { status, repair_detail } = req.body;
  const valid = ['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์','ต้องส่งซ่อมภายนอก'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
  const row = query('SELECT * FROM repair_requests WHERE id=?', [req.params.id]);
  if (!row.length) return res.status(404).json({ error: 'ไม่พบงาน' });
  const { role, id:uid } = req.user;
  if (role==='technician' && row[0].assigned_tech_id !== uid) return res.status(403).json({ error:'ไม่ใช่งานของคุณ' });
  let extra = ''; const params = [status];
  if (status==='กำลังดำเนินการ' && !row[0].started_at) extra += ',started_at=CURRENT_TIMESTAMP';
  if (status==='เสร็จสมบูรณ์') extra += ',completed_at=CURRENT_TIMESTAMP';
  if (repair_detail) { extra += ',repair_detail=?'; params.push(repair_detail); }
  params.push(req.params.id);
  run(`UPDATE repair_requests SET status=?${extra} WHERE id=?`, params);
  if (status==='เสร็จสมบูรณ์') {
    run('INSERT INTO notifications (user_id,title,message,type,ref_request_id) VALUES (?,?,?,?,?)',
      [row[0].requester_id,'งานซ่อมเสร็จแล้ว',`งาน ${row[0].tracking_id} เสร็จสมบูรณ์แล้ว กรุณาประเมินผล`,'success',req.params.id]);
  }
  res.json({ message:'อัปเดตสถานะสำเร็จ' });
});

// POST /api/requests/:id/after-image
router.post('/:id/after-image', authenticate, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'กรุณาอัพโหลดรูปภาพ' });
  run('UPDATE repair_requests SET after_image_path=? WHERE id=?', [`/uploads/${req.file.filename}`, req.params.id]);
  res.json({ message:'อัพโหลดรูปหลังซ่อมสำเร็จ' });
});

module.exports = router;