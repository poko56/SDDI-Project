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
    if (!code || !name) return res.status(400).json({ error: 'กรุณาระบุรหัสและชื่อวัสดุ' });
    
    // Feature 1: Type Validation
    const qty = Number(quantity);
    const price = Number(unit_price);
    const reorder = Number(reorder_point);
    if (isNaN(qty) || qty < 0) return res.status(400).json({ error: 'จำนวนต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0' });
    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'ราคาต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0' });

    const snap = await db.collection('materials').where('code','==',code).get();
    if(!snap.empty) return res.status(409).json({error:'รหัสวัสดุซ้ำ'});
    const ref = db.collection('materials').doc();
    await ref.set({ 
      id:ref.id, code, name, category, brand:brand||null, 
      quantity:qty, unit:unit||'ชิ้น', unit_price:price, 
      reorder_point:isNaN(reorder)?5:reorder, created_at:Timestamp.now() 
    });
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

userRouter.patch('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user','technician','manager','admin'];
    if(!validRoles.includes(role)) return res.status(400).json({error:'บทบาทไม่ถูกต้อง'});
    const ref = db.collection('users').doc(req.params.id);
    const doc = await ref.get();
    if(!doc.exists) return res.status(404).json({error:'ไม่พบผู้ใช้งาน'});
    // Prevent demoting yourself
    if(req.params.id === String(req.user.id) && role !== 'admin') {
      return res.status(400).json({error:'ไม่สามารถเปลี่ยนบทบาทของตัวเองได้'});
    }
    await ref.update({ role });
    res.json({ message:`เปลี่ยนบทบาทเป็น ${role} สำเร็จ` });
  } catch(e){ res.status(500).json({error:e.message}); }
});

userRouter.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (id === String(req.user.id)) return res.status(400).json({ error: 'ไม่สามารถลบตัวเองได้' });

    const ref = db.collection('users').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });

    const userData = doc.data();
    await ref.delete();

    // Log action
    await db.collection('audit_logs').add({
      user_id: String(req.user.id), action: 'DELETE_USER', target_table: 'users', target_id: id,
      detail: `ลบผู้ใช้งาน: ${userData.name || userData.email} (${id})`, created_at: Timestamp.now()
    });

    res.json({ message: 'ลบผู้ใช้งานสำเร็จ' });
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// Admin / Manager
dashRouter.get('/', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    const [rSnap, uSnap, evalSnap] = await Promise.all([
      db.collection('repair_requests').get(),
      db.collection('users').get(),
      db.collection('evaluations').get()
    ]);
    const reqs = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const evals = evalSnap.docs.map(d => d.data());
    const techMap = {};
    uSnap.docs.forEach(d => { const u=d.data(); if(u.role==='technician') techMap[d.id]=u.name||u.email; });
    const total = {
      total: reqs.length,
      pending: reqs.filter(r=>r.status==='รอดำเนินการ').length,
      in_progress: reqs.filter(r=>r.status==='กำลังดำเนินการ').length,
      review: reqs.filter(r=>r.status==='รอตรวจสอบ').length,
      done: reqs.filter(r=>r.status==='เสร็จสมบูรณ์').length,
      emergency: reqs.filter(r=>r.urgency==='ฉุกเฉิน'&&r.status!=='เสร็จสมบูรณ์').length,
      overdue: reqs.filter(r=>r.sla_deadline&&r.sla_deadline.toMillis()<Date.now()&&r.status!=='เสร็จสมบูรณ์').length
    };
    const catMap = {};
    reqs.forEach(r => { catMap[r.category]=(catMap[r.category]||0)+1; });
    const by_category = Object.entries(catMap).map(([category,count])=>({category,count})).sort((a,b)=>b.count-a.count);
    const monthMap = {};
    reqs.forEach(r => {
      const ts = r.created_at?.toDate ? r.created_at.toDate() : new Date(r.created_at);
      if(!ts||isNaN(ts)) return;
      const key = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}`;
      monthMap[key] = (monthMap[key]||0)+1;
    });
    const monthly = Object.entries(monthMap).sort(([a],[b])=>a.localeCompare(b)).slice(-7).map(([month,count])=>({month,count}));
    const techPerf = {};
    reqs.forEach(r => {
      const tid = r.assigned_to||r.assigned_tech_id; if(!tid) return;
      techPerf[tid]=techPerf[tid]||{name:techMap[tid]||tid,total:0,done:0};
      techPerf[tid].total++; if(r.status==='เสร็จสมบูรณ์') techPerf[tid].done++;
    });
    const evalByTech = {};
    evals.forEach(e => {
      const req = reqs.find(r=>r.id===e.request_id); const tid = req?.assigned_to||req?.assigned_tech_id; if(!tid) return;
      evalByTech[tid]=evalByTech[tid]||{sum:0,cnt:0}; evalByTech[tid].sum+=Number(e.avg_score||0); evalByTech[tid].cnt++;
    });
    const tech_perf = Object.entries(techPerf).map(([tid,t])=>({
      ...t, avg_score: evalByTech[tid]?+(evalByTech[tid].sum/evalByTech[tid].cnt).toFixed(1):0
    })).sort((a,b)=>b.total-a.total);
    const satisfaction = { avg: evals.length?+(evals.reduce((s,e)=>s+Number(e.avg_score||0),0)/evals.length).toFixed(1):0, count: evals.length };

    // Proactive Alerts
    const now = Date.now();
    const riskThreshold = now + (4 * 60 * 60 * 1000); // 4 hours
    const at_risk_sla_items = reqs.filter(r => r.status !== 'เสร็จสมบูรณ์' && r.sla_deadline && r.sla_deadline.toMillis() > now && r.sla_deadline.toMillis() <= riskThreshold);
    
    const mSnap = await db.collection('materials').get();
    const low_stock_items = mSnap.docs.map(d => ({id:d.id, ...d.data()})).filter(m => m.quantity <= (m.reorder_point||5));

    res.json({ total, by_category, monthly, tech_perf, satisfaction, at_risk_sla_items, low_stock_items });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Technician Dashboard (SRS 2.7.3)
dashRouter.get('/tech', authenticate, async (req, res) => {
  try {
    const uid = String(req.user.id);
    const [rSnap, matSnap, evalSnap] = await Promise.all([
      db.collection('repair_requests').get(),
      db.collection('materials').get(),
      db.collection('evaluations').get()
    ]);
    const allReqs = rSnap.docs.map(d=>({id:d.id,...d.data()}));
    const myReqs = allReqs.filter(r=>(r.assigned_to===uid||r.assigned_tech_id===uid));
    const today = new Date(); today.setHours(0,0,0,0);
    const todayReqs = allReqs.filter(r=>{
      if(r.status==='เสร็จสมบูรณ์') return false;
      const ts = r.created_at?.toDate?r.created_at.toDate():new Date(r.created_at); return ts>=today;
    });
    const myEvals = evalSnap.docs.map(d=>d.data()).filter(e=>myReqs.find(r=>r.id===e.request_id));
    const avgScore = myEvals.length?+(myEvals.reduce((s,e)=>s+Number(e.avg_score||0),0)/myEvals.length).toFixed(1):0;
    const mats = matSnap.docs.map(d=>({id:d.id,...d.data()}));
    const convert = r=>{
      if(r.created_at?.toDate) r.created_at=r.created_at.toDate().toISOString();
      if(r.sla_deadline?.toDate) r.sla_deadline=r.sla_deadline.toDate().toISOString(); return r;
    };
    myReqs.forEach(convert); todayReqs.forEach(convert);
    // Proactive Alerts for Tech
    const now = Date.now();
    const riskThreshold = now + (4 * 60 * 60 * 1000); // 4 hours
    const at_risk_sla_items = myReqs.filter(r => r.status !== 'เสร็จสมบูรณ์' && r.sla_deadline && r.sla_deadline.toMillis() > now && r.sla_deadline.toMillis() <= riskThreshold);

    res.json({
      stats: { today: todayReqs.length, in_progress: myReqs.filter(r=>r.status==='กำลังดำเนินการ').length,
        done: myReqs.filter(r=>r.status==='เสร็จสมบูรณ์').length, total: myReqs.length, avg_score: avgScore, eval_count: myEvals.length },
      at_risk_sla_items,
      today_tasks: todayReqs.slice(0,8),
      in_progress_tasks: myReqs.filter(r=>r.status==='กำลังดำเนินการ').slice(0,5),
      review_tasks: myReqs.filter(r=>r.status==='รอตรวจสอบ').slice(0,5),
      completed_history: myReqs.filter(r=>r.status==='เสร็จสมบูรณ์').slice(0,5),
      low_materials: mats.filter(m=>(m.quantity||0)<=(m.reorder_point||5)).slice(0,5)
    });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// User Dashboard (SRS 2.7.4)
dashRouter.get('/user', authenticate, async (req, res) => {
  try {
    const uid = String(req.user.id);
    const [rSnap, evalSnap] = await Promise.all([
      db.collection('repair_requests').where('requester_id','==',uid).get(),
      db.collection('evaluations').where('evaluator_id','==',uid).get()
    ]);
    const myReqs = rSnap.docs.map(d=>{
      const r={id:d.id,...d.data()};
      if(r.created_at?.toDate) r.created_at=r.created_at.toDate().toISOString();
      if(r.sla_deadline?.toDate) r.sla_deadline=r.sla_deadline.toDate().toISOString();
      if(r.updated_at?.toDate) r.updated_at=r.updated_at.toDate().toISOString();
      return r;
    }).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const myEvals = evalSnap.docs.map(d=>d.data());
    const doneReqs = myReqs.filter(r=>r.status==='เสร็จสมบูรณ์');
    const avgWait = doneReqs.length ? doneReqs.reduce((s,r)=>{
      return s+(r.updated_at&&r.created_at?(new Date(r.updated_at)-new Date(r.created_at))/3600000:0);
    },0)/doneReqs.length : 0;
    res.json({
      stats: { total: myReqs.length, pending: myReqs.filter(r=>r.status==='รอดำเนินการ').length,
        in_progress: myReqs.filter(r=>['กำลังดำเนินการ','รอตรวจสอบ'].includes(r.status)).length,
        done: doneReqs.length, avg_wait_hours: +avgWait.toFixed(1), already_evaluated: myEvals.length },
      active: myReqs.filter(r=>r.status!=='เสร็จสมบูรณ์'),
      history: doneReqs.slice(0,10)
    });
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

/* ====== LOCATIONS (stub) ====== */
const locationRouter = express.Router();
locationRouter.get('/', (req,res) => res.json({buildings:[], locations:[], grouped:[]}));

/* ====== REPORTS (SRS 2.8) ====== */
const reportRouter = express.Router();

// Full request list for export
reportRouter.get('/requests', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    const [rSnap, uSnap] = await Promise.all([
      db.collection('repair_requests').orderBy('created_at','desc').get(),
      db.collection('users').get()
    ]);
    const userMap = {};
    uSnap.docs.forEach(d => { userMap[d.id] = d.data().name || d.data().email; });
    const rows = rSnap.docs.map(d => {
      const r = d.data();
      if(r.created_at?.toDate) r.created_at = r.created_at.toDate().toISOString();
      if(r.updated_at?.toDate) r.updated_at = r.updated_at.toDate().toISOString();
      if(r.sla_deadline?.toDate) r.sla_deadline = r.sla_deadline.toDate().toISOString();
      if(r.completed_at?.toDate) r.completed_at = r.completed_at.toDate().toISOString();
      return { ...r, id: d.id,
        requester_name: userMap[r.requester_id] || r.requester_name || '–',
        assigned_to_name: r.assigned_to ? (userMap[r.assigned_to] || '–') : '–',
      };
    });
    res.json({ rows, total: rows.length });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Aggregated stats for the reports dashboard
reportRouter.get('/summary', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    const [rSnap, uSnap, matSnap, evalSnap] = await Promise.all([
      db.collection('repair_requests').get(),
      db.collection('users').get(),
      db.collection('materials').get(),
      db.collection('evaluations').get()
    ]);

    const reqs  = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const mats  = matSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const evals = evalSnap.docs.map(d => d.data());
    const techMap = {};
    uSnap.docs.forEach(d => {
      const u = d.data();
      if(u.role === 'technician') techMap[d.id] = u.name || u.email;
    });

    // ── 1. Repair stats by category ──
    const catMap = {};
    reqs.forEach(r => {
      const c = r.category || 'ไม่ระบุ';
      catMap[c] = catMap[c] || { count:0, done:0, cost:0 };
      catMap[c].count++;
      if(r.status === 'เสร็จสมบูรณ์') catMap[c].done++;
      catMap[c].cost += Number(r.repair_cost || 0);
    });
    const by_category = Object.entries(catMap)
      .map(([category, v]) => ({ category, ...v, success_rate: v.count ? Math.round(v.done/v.count*100) : 0 }))
      .sort((a,b) => b.count - a.count);

    // ── 2. Avg resolution time (hours) for completed tickets ──
    let totalHours = 0, resolvedCount = 0;
    reqs.forEach(r => {
      if(r.status === 'เสร็จสมบูรณ์' && r.created_at && r.updated_at) {
        const start = r.created_at.toMillis ? r.created_at.toMillis() : new Date(r.created_at).getTime();
        const end   = r.updated_at.toMillis ? r.updated_at.toMillis() : new Date(r.updated_at).getTime();
        const hrs   = (end - start) / 3600000;
        if(hrs >= 0 && hrs < 8760) { totalHours += hrs; resolvedCount++; }
      }
    });
    const avg_resolution_hours = resolvedCount ? +(totalHours / resolvedCount).toFixed(1) : 0;

    // ── 3. Total cost ──
    const total_cost = reqs.reduce((s,r) => s + Number(r.repair_cost||0), 0);

    // ── 4. Success rate ──
    const done_count = reqs.filter(r => r.status === 'เสร็จสมบูรณ์').length;
    const success_rate = reqs.length ? Math.round(done_count/reqs.length*100) : 0;

    // ── 5. Monthly trend (last 7 months) ──
    const monthMap = {};
    reqs.forEach(r => {
      const ts = r.created_at?.toDate ? r.created_at.toDate() : new Date(r.created_at);
      if(isNaN(ts)) return;
      const key = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}`;
      monthMap[key] = monthMap[key] || { total:0, done:0, cost:0 };
      monthMap[key].total++;
      if(r.status === 'เสร็จสมบูรณ์') monthMap[key].done++;
      monthMap[key].cost += Number(r.repair_cost||0);
    });
    const monthly = Object.entries(monthMap)
      .sort(([a],[b]) => a.localeCompare(b))
      .slice(-7)
      .map(([month, v]) => ({ month, ...v }));

    // ── 6. Hotspot locations ──
    const locMap = {};
    reqs.forEach(r => {
      const loc = r.location || 'ไม่ระบุสถานที่';
      locMap[loc] = (locMap[loc]||0) + 1;
    });
    const hotspots = Object.entries(locMap)
      .map(([location, count]) => ({ location, count }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 10);

    // ── 7. Tech performance ──
    const techPerf = {};
    reqs.forEach(r => {
      const tid = r.assigned_to || r.assigned_tech_id;
      if(!tid) return;
      techPerf[tid] = techPerf[tid] || { name: techMap[tid]||tid, total:0, done:0, in_progress:0, cost:0 };
      techPerf[tid].total++;
      if(r.status === 'เสร็จสมบูรณ์') techPerf[tid].done++;
      if(r.status === 'กำลังดำเนินการ') techPerf[tid].in_progress++;
      techPerf[tid].cost += Number(r.repair_cost||0);
    });
    const evalByTech = {};
    evals.forEach(e => {
      // match eval to request to get tech
      const req = reqs.find(r => r.id === e.request_id);
      const tid = req?.assigned_to || req?.assigned_tech_id;
      if(!tid) return;
      evalByTech[tid] = evalByTech[tid] || { sum:0, cnt:0 };
      evalByTech[tid].sum += Number(e.avg_score||0);
      evalByTech[tid].cnt++;
    });
    const tech_performance = Object.entries(techPerf).map(([tid, t]) => ({
      ...t,
      avg_score: evalByTech[tid] ? +(evalByTech[tid].sum/evalByTech[tid].cnt).toFixed(1) : 0,
      success_rate: t.total ? Math.round(t.done/t.total*100) : 0
    })).sort((a,b) => b.total - a.total);

    // ── 8. Satisfaction breakdown ──
    const satisfaction = {
      avg: evals.length ? +(evals.reduce((s,e)=>s+Number(e.avg_score||0),0)/evals.length).toFixed(1) : 0,
      quality: evals.length ? +(evals.reduce((s,e)=>s+Number(e.quality_score||0),0)/evals.length).toFixed(1) : 0,
      speed:   evals.length ? +(evals.reduce((s,e)=>s+Number(e.speed_score||0),0)/evals.length).toFixed(1) : 0,
      service: evals.length ? +(evals.reduce((s,e)=>s+Number(e.service_score||0),0)/evals.length).toFixed(1) : 0,
      count: evals.length
    };

    // ── 9. Material stats ──
    const total_material_value = mats.reduce((s,m)=>s+(m.quantity||0)*(m.unit_price||0),0);
    const low_stock = mats.filter(m=>(m.quantity||0)<=(m.reorder_point||5));
    // Most used: sort by (reorder_point - quantity) as a proxy for usage
    const mat_most_used = [...mats]
      .sort((a,b) => ((a.quantity||0)-(a.reorder_point||5)) - ((b.quantity||0)-(b.reorder_point||5)))
      .slice(0,5)
      .map(m => ({ name:m.name, code:m.code, quantity:m.quantity||0, reorder_point:m.reorder_point||5, unit:m.unit||'ชิ้น' }));

    // Degraded (very low, < 10% of reorder_point OR quantity=0)
    const mat_degraded = mats
      .filter(m => (m.quantity||0) === 0 || (m.reorder_point > 0 && (m.quantity||0) < m.reorder_point * 0.5))
      .map(m => ({ name:m.name, code:m.code, quantity:m.quantity||0, reorder_point:m.reorder_point||5, unit:m.unit||'ชิ้น', unit_price:m.unit_price||0 }));

    res.json({
      totals: {
        total: reqs.length, done: done_count, pending: reqs.filter(r=>r.status==='รอดำเนินการ').length,
        in_progress: reqs.filter(r=>r.status==='กำลังดำเนินการ').length, success_rate, total_cost,
        avg_resolution_hours
      },
      by_category, monthly, hotspots, tech_performance, satisfaction,
      materials: { total_value: total_material_value, items: mats.length, low_stock: low_stock.length, low_stock_items: low_stock, mat_most_used, mat_degraded }
    });
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* ====== PURCHASE ORDERS (SRS 2.6.2-2.6.3) ====== */
const poRouter = express.Router();

function genPOCode() {
  const d = new Date();
  return `PO-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`;
}

// List all POs
poRouter.get('/', authenticate, authorize('admin','manager','technician'), async (req, res) => {
  try {
    const snap = await db.collection('purchase_orders').orderBy('created_at','desc').get();
    const items = snap.docs.map(d => {
      const po = { id: d.id, ...d.data() };
      if(po.created_at?.toDate) po.created_at = po.created_at.toDate().toISOString();
      if(po.received_at?.toDate) po.received_at = po.received_at.toDate().toISOString();
      if(po.expected_date?.toDate) po.expected_date = po.expected_date.toDate().toISOString();
      return po;
    });
    res.json({ items, total: items.length });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Create PO
poRouter.post('/', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const { supplier, items, expected_date, note } = req.body;
    if(!supplier || !items?.length) return res.status(400).json({error:'กรุณากรอกข้อมูล Supplier และรายการวัสดุ'});
    const total_amount = items.reduce((s, i) => s + (Number(i.unit_price||0) * Number(i.quantity||0)), 0);
    const ref = db.collection('purchase_orders').doc();
    const po = {
      id: ref.id,
      code: genPOCode(),
      supplier,
      items,
      total_amount,
      status: 'รออนุมัติ',
      note: note || '',
      created_by: String(req.user.id),
      expected_date: expected_date ? Timestamp.fromDate(new Date(expected_date)) : null,
      created_at: Timestamp.now(),
      received_at: null
    };
    await ref.set(po);
    res.status(201).json({ message:'สร้างใบจัดซื้อสำเร็จ', id: ref.id, code: po.code });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Approve PO
poRouter.patch('/:id/approve', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const ref = db.collection('purchase_orders').doc(req.params.id);
    const doc = await ref.get();
    if(!doc.exists) return res.status(404).json({error:'ไม่พบใบจัดซื้อ'});
    if(doc.data().status !== 'รออนุมัติ') return res.status(400).json({error:'ไม่สามารถอนุมัติได้'});
    await ref.update({ status: 'อนุมัติแล้ว', approved_by: String(req.user.id), approved_at: Timestamp.now() });
    res.json({ message:'อนุมัติใบจัดซื้อสำเร็จ' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Receive goods from supplier (updates stock + logs transaction)
poRouter.patch('/:id/receive', authenticate, authorize('admin','manager','technician'), async (req, res) => {
  try {
    const { received_items, note } = req.body;
    const ref = db.collection('purchase_orders').doc(req.params.id);
    const doc = await ref.get();
    if(!doc.exists) return res.status(404).json({error:'ไม่พบใบจัดซื้อ'});
    const po = doc.data();
    if(po.status === 'รับของแล้ว') return res.status(400).json({error:'รับของแล้ว'});

    const batch = db.batch();
    // Update each material's stock and record expiry if provided
    for(const ri of (received_items || po.items)) {
      if(!ri.material_id) continue;
      const matRef = db.collection('materials').doc(ri.material_id);
      const matDoc = await matRef.get();
      if(!matDoc.exists) continue;
      const updates = { quantity: matDoc.data().quantity + Number(ri.quantity||0) };
      if(ri.expiry_date) updates.expiry_date = Timestamp.fromDate(new Date(ri.expiry_date));
      batch.update(matRef, updates);
      // Log the stock transaction
      const logRef = db.collection('stock_transactions').doc();
      batch.set(logRef, {
        id: logRef.id, material_id: ri.material_id, po_id: ref.id, po_code: po.code,
        type: 'in', quantity: Number(ri.quantity||0), unit_price: ri.unit_price || 0,
        note: note || `รับของจาก PO ${po.code}`,
        created_by: String(req.user.id), created_at: Timestamp.now()
      });
    }
    batch.update(ref, { status: 'รับของแล้ว', received_at: Timestamp.now(), received_by: String(req.user.id), receive_note: note || '' });
    await batch.commit();
    res.json({ message:'บันทึกการรับของสำเร็จ' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Cancel PO
poRouter.patch('/:id/cancel', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const ref = db.collection('purchase_orders').doc(req.params.id);
    const doc = await ref.get();
    if(!doc.exists) return res.status(404).json({error:'ไม่พบใบจัดซื้อ'});
    if(doc.data().status === 'รับของแล้ว') return res.status(400).json({error:'ไม่สามารถยกเลิกใบที่รับของแล้ว'});
    await ref.update({ status: 'ยกเลิก', cancelled_by: String(req.user.id), cancelled_at: Timestamp.now() });
    res.json({ message:'ยกเลิกใบจัดซื้อแล้ว' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Get materials with expiry alerts
poRouter.get('/expiry-alerts', authenticate, authorize('admin','manager','technician'), async (req, res) => {
  try {
    const snap = await db.collection('materials').get();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 3600 * 1000;
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => {
      if(!m.expiry_date) return false;
      const exp = m.expiry_date?.toMillis ? m.expiry_date.toMillis() : new Date(m.expiry_date).getTime();
      return exp - now < thirtyDays; // within 30 days or already expired
    }).map(m => {
      const exp = m.expiry_date?.toDate ? m.expiry_date.toDate().toISOString() : m.expiry_date;
      const expMs = m.expiry_date?.toMillis ? m.expiry_date.toMillis() : new Date(m.expiry_date).getTime();
      return { ...m, expiry_date: exp, expired: expMs < now, days_left: Math.ceil((expMs - now) / 86400000) };
    });
    res.json({ items, total: items.length });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// Stock transaction history
poRouter.get('/transactions', authenticate, authorize('admin','manager','technician'), async (req, res) => {
  try {
    const snap = await db.collection('stock_transactions').orderBy('created_at','desc').limit(100).get();
    const items = snap.docs.map(d => {
      const t = { id: d.id, ...d.data() };
      if(t.created_at?.toDate) t.created_at = t.created_at.toDate().toISOString();
      return t;
    });
    res.json({ items });
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* ====== SCHEDULE / WORK CALENDAR (SRS 2.3.2) ====== */
const scheduleRouter = express.Router();

// GET schedules for a month: ?year=2026&month=3
scheduleRouter.get('/', authenticate, async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const start = Timestamp.fromDate(new Date(year, month-1, 1));
    const end   = Timestamp.fromDate(new Date(year, month, 1));
    const [schSnap, leaveSnap, oncallSnap, uSnap] = await Promise.all([
      db.collection('schedules').where('date','>=',start).where('date','<',end).get(),
      db.collection('leaves').where('start_date','>=',start).where('start_date','<',end).get(),
      db.collection('oncall').where('date','>=',start).where('date','<',end).get(),
      db.collection('users').where('role','==','technician').get()
    ]);
    const toISO = d => d?.toDate ? d.toDate().toISOString() : d;
    const schedules = schSnap.docs.map(d => { const s={id:d.id,...d.data()}; s.date=toISO(s.date); return s; });
    const leaves    = leaveSnap.docs.map(d => { const l={id:d.id,...d.data()}; l.start_date=toISO(l.start_date); l.end_date=toISO(l.end_date); return l; });
    const oncall    = oncallSnap.docs.map(d => { const o={id:d.id,...d.data()}; o.date=toISO(o.date); return o; });
    const technicians = uSnap.docs.map(d => ({ id:d.id, name:d.data().name||d.data().email, email:d.data().email }));
    res.json({ schedules, leaves, oncall, technicians });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// POST: assign work schedule to technician
scheduleRouter.post('/', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const { tech_id, tech_name, date, shift, type, note } = req.body;
    if(!tech_id || !date) return res.status(400).json({error:'กรุณาระบุช่างและวันที่'});
    const ref = db.collection('schedules').doc();
    await ref.set({
      id: ref.id, tech_id, tech_name: tech_name||tech_id,
      date: Timestamp.fromDate(new Date(date)),
      shift: shift||'เช้า', type: type||'ปกติ', note: note||'',
      created_by: String(req.user.id), created_at: Timestamp.now()
    });
    res.status(201).json({ message:'บันทึกตารางงานสำเร็จ', id: ref.id });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// DELETE schedule entry
scheduleRouter.delete('/:id', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    await db.collection('schedules').doc(req.params.id).delete();
    res.json({ message:'ลบตารางงานสำเร็จ' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// LEAVES ──────────────────────────────────────────────────
// GET: list leaves for current user or all (manager/admin)
scheduleRouter.get('/leaves', authenticate, async (req, res) => {
  try {
    let snap;
    const isManager = ['admin','manager'].includes(req.user.role);
    if(isManager) snap = await db.collection('leaves').orderBy('created_at','desc').get();
    else snap = await db.collection('leaves').where('tech_id','==',String(req.user.id)).get();
    const toISO = d => d?.toDate ? d.toDate().toISOString() : d;
    const items = snap.docs.map(d => { const l={id:d.id,...d.data()}; l.start_date=toISO(l.start_date); l.end_date=toISO(l.end_date); l.created_at=toISO(l.created_at); return l; });
    res.json({ items });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// POST: request leave
scheduleRouter.post('/leaves', authenticate, async (req, res) => {
  try {
    const { start_date, end_date, type, reason } = req.body;
    if(!start_date) return res.status(400).json({error:'กรุณาระบุวันที่'});
    const ref = db.collection('leaves').doc();
    await ref.set({
      id: ref.id, tech_id: String(req.user.id), tech_name: req.user.name||req.user.email,
      start_date: Timestamp.fromDate(new Date(start_date)),
      end_date: Timestamp.fromDate(new Date(end_date||start_date)),
      type: type||'ลาป่วย', reason: reason||'', status: 'รออนุมัติ',
      created_at: Timestamp.now()
    });
    res.status(201).json({ message:'ยื่นคำขอลาสำเร็จ', id: ref.id });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// PATCH: approve/reject leave
scheduleRouter.patch('/leaves/:id', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const { status, note } = req.body;
    if(!['อนุมัติ','ไม่อนุมัติ'].includes(status)) return res.status(400).json({error:'สถานะไม่ถูกต้อง'});
    await db.collection('leaves').doc(req.params.id).update({
      status, note: note||'', approved_by: String(req.user.id), approved_at: Timestamp.now()
    });
    res.json({ message:'อัปเดตคำขอลาสำเร็จ' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// ON-CALL ──────────────────────────────────────────────────
// POST: assign on-call duty for a date
scheduleRouter.post('/oncall', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const { tech_id, tech_name, date, note } = req.body;
    if(!tech_id || !date) return res.status(400).json({error:'กรุณาระบุช่างและวันที่'});
    const ref = db.collection('oncall').doc();
    await ref.set({
      id: ref.id, tech_id, tech_name: tech_name||tech_id,
      date: Timestamp.fromDate(new Date(date)), note: note||'',
      created_by: String(req.user.id), created_at: Timestamp.now()
    });
    res.status(201).json({ message:'บันทึกเวรฉุกเฉินสำเร็จ', id: ref.id });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// DELETE on-call
scheduleRouter.delete('/oncall/:id', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    await db.collection('oncall').doc(req.params.id).delete();
    res.json({ message:'ลบเวรฉุกเฉินสำเร็จ' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* ====== NOTIFICATION SETTINGS (SRS 2.1.2) ====== */
const notifSettingsRouter = express.Router();
const NS = require('../services/NotificationService');

// GET current config (mask sensitive fields)
notifSettingsRouter.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('notifications').get();
    const cfg = doc.exists ? doc.data() : {};
    // Mask passwords
    if(cfg.smtp_pass) cfg.smtp_pass = '••••••••';
    if(cfg.twilio_token) cfg.twilio_token = '••••••••';
    res.json(cfg);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// POST: save settings
notifSettingsRouter.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const allowed = ['enabled','email_enabled','sms_enabled','resend_api_key','resend_from','smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from_name','twilio_sid','twilio_token','twilio_from', 'auto_assign_enabled'];
    const updates = {};
    allowed.forEach(k => { if(req.body[k] !== undefined) updates[k] = req.body[k]; });
    // Don't overwrite passwords with masked values
    if(updates.smtp_pass === '••••••••') delete updates.smtp_pass;
    if(updates.twilio_token === '••••••••') delete updates.twilio_token;
    await db.collection('settings').doc('notifications').set(updates, {merge:true});
    NS.invalidateCfg();
    res.json({ message:'บันทึกการตั้งค่าสำเร็จ' });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// POST: test email
notifSettingsRouter.post('/test-email', authenticate, authorize('admin'), async (req, res) => {
  try {
    const cfg = await NS.getCfg();
    const result = await NS.sendEmail(cfg, { to: req.user.email, subject:'[SDDI] ทดสอบการส่ง Email', html:`<p>ทดสอบส่งอีเมลจากระบบแจ้งซ่อม SDDI-2025 สำเร็จ ✅</p><p>เวลา: ${new Date().toLocaleString('th-TH')}</p>` });
    if(result.ok) res.json({ message:`ส่ง Email ทดสอบไปที่ ${req.user.email} สำเร็จ` });
    else res.status(400).json({ error: result.reason });
  } catch(e){ res.status(500).json({error:e.message}); }
});

// POST: test SMS
notifSettingsRouter.post('/test-sms', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { phone } = req.body;
    if(!phone) return res.status(400).json({error:'กรุณากรอกเบอร์โทรศัพท์'});
    const cfg = await NS.getCfg();
    const result = await NS.sendSMS(cfg, { to: phone, body:`[SDDI] ทดสอบ SMS จากระบบแจ้งซ่อม เวลา ${new Date().toLocaleString('th-TH')}` });
    if(result.ok) res.json({ message:'ส่ง SMS ทดสอบสำเร็จ' });
    else res.status(400).json({ error: result.reason });
  } catch(e){ res.status(500).json({error:e.message}); }
});

/* ====== AUDIT LOGS (Feature 4) ====== */
const auditLogRouter = express.Router();

auditLogRouter.get('/', authenticate, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { action, user_id, limit = 50 } = req.query;
    let query = db.collection('audit_logs').orderBy('created_at', 'desc');

    if (action) query = query.where('action', '==', action);
    if (user_id) query = query.where('user_id', '==', user_id);

    const [aSnap, uSnap] = await Promise.all([
      query.limit(Number(limit)).get(),
      db.collection('users').get()
    ]);

    const userMap = {};
    uSnap.docs.forEach(d => { const u=d.data(); userMap[d.id] = u.name || u.email; });

    const items = aSnap.docs.map(doc => {
      const data = doc.data();
      if (data.created_at instanceof Timestamp) data.created_at = data.created_at.toDate().toISOString();
      return { id: doc.id, ...data, user_name: userMap[data.user_id] || data.user_id };
    });

    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ====== SYSTEM MANAGEMENT ====== */
const systemRouter = express.Router();

systemRouter.post('/reset', authenticate, authorize('admin'), async (req, res) => {
  try {
    const collections = ['repair_requests', 'materials', 'evaluations', 'audit_logs', 'notifications', 'leaves', 'oncall', 'purchase_orders'];
    
    // Batch delete (caution: Firestore limits batch size to 500)
    for (const coll of collections) {
      const snap = await db.collection(coll).get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    // Re-log the reset action itself
    await db.collection('audit_logs').add({
      user_id: String(req.user.id), action: 'SYSTEM_RESET', target_table: 'multiple', target_id: 'all',
      detail: 'ล้างข้อมูลระบบทั้งหมด (Factory Reset) สำเร็จ', created_at: Timestamp.now()
    });

    res.json({ message: 'ล้างข้อมูลระบบทั้งหมดสำเร็จ' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = { 
  materialRouter, 
  userRouter, 
  evalRouter, 
  dashRouter, 
  notifRouter, 
  locationRouter,
  scheduleRouter,
  notifSettingsRouter,
  auditLogRouter,
  systemRouter,
  reportRouter,
  poRouter
};
