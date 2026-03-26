const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, Timestamp } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const NS = require('../services/NotificationService');

const isFirebase = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.GCLOUD_PROJECT || process.env.FUNCTION_TARGET || process.env.K_SERVICE;
const uploadDir = isFirebase ? path.join('/tmp', 'uploads') : path.join(__dirname, '../../uploads');
try {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {
  console.warn('Could not create upload directory:', e.message);
}

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
  return Timestamp.fromDate(d);
}

// Helper to populate relations manually
async function populateRequest(reqData) {
  let requester_name = null, tech_name = null, building_name = null, floor = null, room = null;
  
  if (reqData.requester_id) {
    const uDoc = await db.collection('users').doc(String(reqData.requester_id)).get();
    if (uDoc.exists) requester_name = uDoc.data().name;
  }
  if (reqData.assigned_tech_id) {
    const tDoc = await db.collection('users').doc(String(reqData.assigned_tech_id)).get();
    if (tDoc.exists) tech_name = tDoc.data().name;
  }
  // Locations not fully relational in NoSQL usually, assuming location details saved in string
  // If location_id is used, we'd fetch it. The original code does `location: bld&&fl&&rm...` in frontend
  // but let's just return what exists
  return { ...reqData, requester_name, tech_name };
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { role, id } = req.user;
    const { status, category, urgency, search, page=1, limit=20, sort='urgency' } = req.query;
    
    let queryRef = db.collection('repair_requests');

    if (role === 'user') queryRef = queryRef.where('requester_id', '==', String(id));
    if (role === 'technician') queryRef = queryRef.where('assigned_tech_id', '==', String(id));
    if (status) queryRef = queryRef.where('status', '==', status);
    if (category) queryRef = queryRef.where('category', '==', category);
    if (urgency) queryRef = queryRef.where('urgency', '==', urgency);
    
    // Sort might require composite indexes, but we can sort in memory for purely search
    let snapshot = await queryRef.get();
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client side search approximation
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(r => (r.tracking_id && r.tracking_id.toLowerCase().includes(s)) || (r.description && r.description.toLowerCase().includes(s)));
    }

    const urgOrd = { 'ฉุกเฉิน':1, 'เร่งด่วน':2, 'ปกติ':3, 'ไม่เร่งด่วน':4 };
    if (sort === 'urgency') {
      items.sort((a, b) => (urgOrd[a.urgency]||5) - (urgOrd[b.urgency]||5));
    } else if (sort === 'newest') {
      items.sort((a,b) => (b.created_at?.toMillis()||0) - (a.created_at?.toMillis()||0));
    } else {
      items.sort((a,b) => (a.created_at?.toMillis()||0) - (b.created_at?.toMillis()||0));
    }

    const populated = await Promise.all(items.map(populateRequest));

    const offset = (parseInt(page)-1) * parseInt(limit);
    const paginated = populated.slice(offset, offset+parseInt(limit));

    // Convert timestamps to ISO strings
    paginated.forEach(p => {
      Object.keys(p).forEach(k => { if (p[k] instanceof Timestamp) p[k] = p[k].toDate().toISOString(); });
    });

    res.json({ total: items.length, page:parseInt(page), limit:parseInt(limit), items: paginated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const { role, id } = req.user;
    let queryRef = db.collection('repair_requests');
    if (role === 'user') queryRef = queryRef.where('requester_id', '==', String(id));
    if (role === 'technician') queryRef = queryRef.where('assigned_tech_id', '==', String(id));
    
    const snap = await queryRef.get();
    const reqs = snap.docs.map(d => d.data());
    
    const total = reqs.length;
    const pending = reqs.filter(r => r.status === 'รอดำเนินการ').length;
    const in_progress = reqs.filter(r => r.status === 'กำลังดำเนินการ').length;
    const review = reqs.filter(r => r.status === 'รอตรวจสอบ').length;
    const done = reqs.filter(r => r.status === 'เสร็จสมบูรณ์').length;
    const external = reqs.filter(r => r.status === 'ต้องส่งซ่อมภายนอก').length;
    const emergency = reqs.filter(r => r.urgency === 'ฉุกเฉิน' && r.status !== 'เสร็จสมบูรณ์').length;
    const overdue = reqs.filter(r => r.sla_deadline && r.sla_deadline.toMillis() < Date.now() && r.status !== 'เสร็จสมบูรณ์').length;

    res.json({ total, pending, in_progress, review, done, external, emergency, overdue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/track/:tid', async (req, res) => {
  try {
    const snap = await db.collection('repair_requests').where('tracking_id', '==', req.params.tid).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'ไม่พบหมายเลขติดตามนี้' });
    const data = snap.docs[0].data();
    const populated = await populateRequest(data);
    Object.keys(populated).forEach(k => { if (populated[k] instanceof Timestamp) populated[k] = populated[k].toDate().toISOString(); });
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    let docRef = db.collection('repair_requests').doc(req.params.id);
    let docSnap = await docRef.get();
    if (!docSnap.exists) {
      // maybe by tracking id
      const snap = await db.collection('repair_requests').where('tracking_id', '==', req.params.id).limit(1).get();
      if (snap.empty) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
      docSnap = snap.docs[0];
    }
    const r = await populateRequest(docSnap.data());
    r.id = docSnap.id;
    
    // fetch materials
    // simplified: skip materials joins for now or implement manually
    const muSnap = await db.collection('material_usage').where('request_id', '==', req.params.id).get();
    r.materials_used = muSnap.docs.map(d => d.data()); // Missing m.name, etc. but sufficient for basic API

    const evSnap = await db.collection('evaluations').where('request_id', '==', req.params.id).limit(1).get();
    r.evaluation = evSnap.empty ? null : evSnap.docs[0].data();
    
    Object.keys(r).forEach(k => { if (r[k] instanceof Timestamp) r[k] = r[k].toDate().toISOString(); });
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Conditional upload: skip multer when Content-Type is JSON (Firebase Functions truncates multipart)
function conditionalUpload(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/json') || !ct.includes('multipart')) return next();
  upload.single('image')(req, res, next);
}

router.post('/', authenticate, conditionalUpload, async (req, res) => {
  try {
    const { category, location_id, location_detail, description, urgency } = req.body;
    
    // Feature 1: Type & Value Validation
    const validCats = ['ไฟฟ้า','ประปา','โครงสร้าง','อุปกรณ์อิเล็กทรอนิกส์','เครื่องปรับอากาศ','อื่นๆ'];
    const validUrgencies = ['ฉุกเฉิน','เร่งด่วน','ปกติ','ไม่เร่งด่วน'];
    
    if (!category || !description || !urgency) return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็น' });
    if (!validCats.includes(category)) return res.status(400).json({ error: 'หมวดหมู่ไม่ถูกต้อง' });
    if (!validUrgencies.includes(urgency)) return res.status(400).json({ error: 'ระดับความเร่งด่วนไม่ถูกต้อง' });
    if (description.length < 5) return res.status(400).json({ error: 'กรุณาอธิบายรายละเอียดการแจ้งซ่อมอย่างน้อย 5 ตัวอักษร' });

    const newRef = db.collection('repair_requests').doc();
    const tid = genTracking();
    const reqData = {
      id: newRef.id,
      tracking_id: tid,
      requester_id: String(req.user.id),
      category,
      location_id: location_id || null,
      location: location_detail || null,
      description,
      urgency,
      status: 'รอดำเนินการ',
      image_path: req.file ? `/uploads/${req.file.filename}` : null,
      image_urls: req.body.image_urls || [],
      sla_deadline: slaDeadline(urgency),
      created_at: Timestamp.now(),
      assigned_tech_id: null,
      assigned_at: null,
      completed_at: null,
      started_at: null,
      repair_detail: null,
      before_images: [],
      after_images: []
    };
    
    await newRef.set(reqData);
    
    // In-app notifications
    const mSnap = await db.collection('users').where('role', 'in', ['manager', 'admin']).where('is_active', '==', 1).get();
    const batch = db.batch();
    mSnap.docs.forEach(doc => {
      batch.set(db.collection('notifications').doc(), {
        user_id: doc.id,
        title: 'มีการแจ้งซ่อมใหม่',
        message: `${req.user.name||'ผู้ใช้'} แจ้งซ่อม ${category} (${urgency})`,
        type: 'info',
        ref_request_id: newRef.id,
        is_read: 0,
        created_at: Timestamp.now()
      });
    });
    batch.set(db.collection('audit_logs').doc(), {
      user_id: String(req.user.id), action: 'CREATE_REQUEST', target_table: 'repair_requests', target_id: newRef.id, detail: `สร้างใบแจ้งซ่อม ${tid}`, created_at: Timestamp.now()
    });
    await batch.commit();

    // 🔔 Real Email/SMS notifications (async, non-blocking)
    NS.notifyNewRequest(reqData, req.user).catch(()=>{});

    // ── Check if Auto-Assign is enabled ─────────────────────────────────────
    const settingsDoc = await db.collection('settings').doc('notifications').get();
    const isAutoAssign = settingsDoc.exists && settingsDoc.data().auto_assign_enabled;

    if (isAutoAssign) {
      try {
        // Find best technician
        const techSnap = await db.collection('users').where('role', '==', 'technician').where('is_active', '==', 1).get();
        if(!techSnap.empty) {
          const activeJobsSnap = await db.collection('repair_requests').where('status','in',['รอดำเนินการ','กำลังดำเนินการ']).get();
          const jobCount = {};
          activeJobsSnap.docs.forEach(d => { const tid = d.data().assigned_tech_id; if(tid) jobCount[tid] = (jobCount[tid]||0)+1; });
          
          let chosen = null, min = Infinity;
          techSnap.docs.forEach(d => { const c = jobCount[d.id]||0; if(c < min){ min = c; chosen = { id: d.id, ...d.data() }; } });

          if (chosen) {
            await newRef.update({ assigned_tech_id: chosen.id, assigned_at: Timestamp.now(), status: 'กำลังดำเนินการ' });
            NS.notifyAssigned(reqData, chosen).catch(()=>{});
            
            await db.collection('audit_logs').add({
              user_id: 'SYSTEM', action: 'AUTO_ASSIGN', target_table: 'repair_requests', target_id: newRef.id,
              detail: `Auto-assign งาน ${tid} ให้ ${chosen.name} (งานปัจจุบัน: ${min})`, created_at: Timestamp.now()
            });
          }
        }
      } catch(e) { console.error('Auto-assign failed:', e.message); }
    }

    res.status(201).json({ message:'แจ้งซ่อมสำเร็จ' + (isAutoAssign ? ' และมอบหมายงานอัตโนมัติแล้ว' : ''), tracking_id:tid, id:newRef.id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.patch('/:id/assign', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    const { tech_id } = req.body;
    if (!tech_id) return res.status(400).json({ error: 'กรุณาเลือกช่าง' });
    
    // Check tech
    const tDoc = await db.collection('users').doc(String(tech_id)).get();
    if (!tDoc.exists || tDoc.data().role !== 'technician' || tDoc.data().is_active !== 1) return res.status(404).json({ error: 'ไม่พบข้อมูลช่าง' });

    const reqRef = db.collection('repair_requests').doc(req.params.id);
    const rDoc = await reqRef.get();
    if (!rDoc.exists) return res.status(404).json({ error: 'ไม่พบงาน' });

    await reqRef.update({
      assigned_tech_id: String(tech_id),
      assigned_at: Timestamp.now(),
      status: 'กำลังดำเนินการ'
    });

    const batch = db.batch();
    batch.set(db.collection('notifications').doc(), {
      user_id: String(tech_id), title: 'งานใหม่ถูกมอบหมายให้คุณ', message: `มอบหมายงาน ${rDoc.data().tracking_id} ให้คุณแล้ว`, type: 'info', ref_request_id: rDoc.id, is_read:0, created_at: Timestamp.now()
    });
    batch.set(db.collection('notifications').doc(), {
      user_id: rDoc.data().requester_id, title: 'งานของคุณถูกมอบหมายช่างแล้ว', message: `ช่าง ${tDoc.data().name} จะดูแลงาน ${rDoc.data().tracking_id}`, type: 'success', ref_request_id: rDoc.id, is_read:0, created_at: Timestamp.now()
    });
    await batch.commit();

    // 🔔 Real Email/SMS notifications
    const rData2 = rDoc.data();
    NS.notifyAssigned({ ...rData2, id: rDoc.id }, tDoc.data()).catch(()=>{});

    res.json({ message:`มอบหมายให้ ${tDoc.data().name} สำเร็จ` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, repair_detail } = req.body;
    const valid = ['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์','ต้องส่งซ่อมภายนอก'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    
    const reqRef = db.collection('repair_requests').doc(req.params.id);
    const rDoc = await reqRef.get();
    if (!rDoc.exists) return res.status(404).json({ error: 'ไม่พบงาน' });
    
    const rData = rDoc.data();
    if (req.user.role === 'technician' && rData.assigned_tech_id !== String(req.user.id)) {
      return res.status(403).json({ error: 'ไม่ใช่งานของคุณ' });
    }

    const updates = { status };
    if (status === 'กำลังดำเนินการ' && !rData.started_at) updates.started_at = Timestamp.now();
    if (status === 'เสร็จสมบูรณ์') updates.completed_at = Timestamp.now();
    if (repair_detail) updates.repair_detail = repair_detail;
    if (req.body.before_images) updates.before_images = req.body.before_images;
    if (req.body.after_images) updates.after_images = req.body.after_images;

    await reqRef.update(updates);

    if (status === 'เสร็จสมบูรณ์') {
      await db.collection('notifications').add({
         user_id: rData.requester_id, title: 'งานซ่อมเสร็จแล้ว', message: `งาน ${rData.tracking_id} เสร็จสมบูรณ์แล้ว กรุณาประเมินผล`, type: 'success', ref_request_id: rDoc.id, is_read: 0, created_at: Timestamp.now()
      });
      NS.notifyCompleted({ ...rData, id: rDoc.id }).catch(()=>{});
    }

    res.json({ message: 'อัปเดตสถานะสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════
   MATERIAL WITHDRAWAL PER REPAIR  (Feature 2)
   GET  /requests/:id/materials
   POST /requests/:id/materials
   DELETE /requests/:id/materials/:mid
══════════════════════════════════════════════════ */
router.get('/:id/materials', authenticate, async (req, res) => {
  try {
    const snap = await db.collection('material_usage')
      .where('request_id', '==', req.params.id)
      .orderBy('withdrawn_at', 'desc').get();
    const items = snap.docs.map(d => {
      const data = d.data();
      Object.keys(data).forEach(k => { if (data[k]?.toDate) data[k] = data[k].toDate().toISOString(); });
      return { id: d.id, ...data };
    });
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/materials', authenticate, authorize('technician','manager','admin'), async (req, res) => {
  try {
    const { material_id, quantity_used } = req.body;
    if (!material_id || !quantity_used) return res.status(400).json({ error: 'กรุณาระบุวัสดุและจำนวน' });
    const qty = parseFloat(quantity_used);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'จำนวนต้องมากกว่า 0' });

    // Check request exists
    const reqDoc = await db.collection('repair_requests').doc(req.params.id).get();
    if (!reqDoc.exists) return res.status(404).json({ error: 'ไม่พบงานซ่อม' });

    // Check & deduct material stock
    const matRef = db.collection('materials').doc(material_id);
    const matDoc = await matRef.get();
    if (!matDoc.exists) return res.status(404).json({ error: 'ไม่พบวัสดุ' });
    const mat = matDoc.data();
    if ((mat.quantity || 0) < qty) return res.status(400).json({ error: `สต็อกไม่พอ (เหลือ ${mat.quantity} ${mat.unit})` });

    await matRef.update({ quantity: (mat.quantity || 0) - qty });

    const ref = db.collection('material_usage').doc();
    const record = {
      id: ref.id, request_id: req.params.id,
      material_id, material_name: mat.name, unit: mat.unit || '',
      quantity_used: qty,
      withdrawn_by: String(req.user.id), withdrawn_by_name: req.user.name || req.user.email,
      withdrawn_at: Timestamp.now()
    };
    await ref.set(record);

    await db.collection('audit_logs').add({
      user_id: String(req.user.id), action: 'WITHDRAW_MATERIAL',
      target_table: 'material_usage', target_id: ref.id,
      detail: `เบิก ${mat.name} x${qty} สำหรับงาน ${reqDoc.data().tracking_id}`,
      created_at: Timestamp.now()
    });

    res.status(201).json({ message: `เบิก ${mat.name} x${qty} สำเร็จ`, id: ref.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/materials/:mid', authenticate, authorize('technician','manager','admin'), async (req, res) => {
  try {
    const usageDoc = await db.collection('material_usage').doc(req.params.mid).get();
    if (!usageDoc.exists) return res.status(404).json({ error: 'ไม่พบรายการเบิก' });
    const usage = usageDoc.data();

    // Restore stock
    const matRef = db.collection('materials').doc(usage.material_id);
    const matDoc = await matRef.get();
    if (matDoc.exists) {
      await matRef.update({ quantity: (matDoc.data().quantity || 0) + usage.quantity_used });
    }
    await db.collection('material_usage').doc(req.params.mid).delete();
    res.json({ message: 'ยกเลิกรายการเบิกสำเร็จ (คืนสต็อกแล้ว)' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════
   AUTO-ASSIGN  (Feature 3)
   POST /requests/:id/auto-assign
   Assigns the technician with fewest active jobs
══════════════════════════════════════════════════ */
router.post('/:id/auto-assign', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    const reqRef = db.collection('repair_requests').doc(req.params.id);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(404).json({ error: 'ไม่พบงานซ่อม' });
    if (reqDoc.data().assigned_tech_id) return res.status(400).json({ error: 'งานนี้มีช่างรับผิดชอบแล้ว' });

    // Get all active technicians
    const techSnap = await db.collection('users')
      .where('role', '==', 'technician')
      .where('is_active', '==', 1).get();
    if (techSnap.empty) return res.status(404).json({ error: 'ไม่พบช่างที่ active' });

    // Count active jobs per technician
    const activeSnap = await db.collection('repair_requests')
      .where('status', 'in', ['รอดำเนินการ','กำลังดำเนินการ']).get();
    const jobCount = {};
    activeSnap.docs.forEach(d => {
      const tid = d.data().assigned_tech_id;
      if (tid) jobCount[tid] = (jobCount[tid] || 0) + 1;
    });

    // Pick tech with fewest jobs (round-robin)
    let chosenTech = null, minJobs = Infinity;
    techSnap.docs.forEach(d => {
      const cnt = jobCount[d.id] || 0;
      if (cnt < minJobs) { minJobs = cnt; chosenTech = { id: d.id, ...d.data() }; }
    });

    if (!chosenTech) return res.status(404).json({ error: 'ไม่สามารถหาช่างได้' });

    await reqRef.update({ assigned_tech_id: chosenTech.id, assigned_at: Timestamp.now(), status: 'กำลังดำเนินการ' });

    await db.collection('audit_logs').add({
      user_id: String(req.user.id), action: 'AUTO_ASSIGN',
      target_table: 'repair_requests', target_id: req.params.id,
      detail: `Auto-assign งาน ${reqDoc.data().tracking_id} → ${chosenTech.name} (งานปัจจุบัน: ${minJobs})`,
      created_at: Timestamp.now()
    });

    NS.notifyAssigned(reqDoc.data(), chosenTech).catch(() => {});
    res.json({ message: `มอบหมายงานให้ ${chosenTech.name} อัตโนมัติสำเร็จ (งานปัจจุบัน: ${minJobs})`, tech: { id: chosenTech.id, name: chosenTech.name } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;