// ═══════════════════════════════════════
// NEW REQUEST
// ═══════════════════════════════════════
let _locations = [];

async function renderNewRequest() {
  const c = document.getElementById('page-content');
  try {
    const locData = await api('GET', '/locations');
    _locations = locData.locations;
    const buildings = locData.buildings;

    c.innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <div class="card">
        <div class="card-header">
          <div class="card-title">➕ แบบฟอร์มแจ้งซ่อม</div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('requests-list')">← กลับ</button>
        </div>
        <div class="card-body">
          <div id="req-alert"></div>

          <!-- Step 1: Category -->
          <div style="margin-bottom:1.5rem">
            <div style="font-size:.8rem;font-weight:600;color:var(--text2);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">1. ประเภทปัญหา</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem">
              ${[['ไฟฟ้า','⚡','var(--yellow)'],['ประปา','💧','var(--blue)'],['โครงสร้าง','🏗️','var(--orange)'],['อุปกรณ์อิเล็กทรอนิกส์','💻','var(--purple)'],['เครื่องปรับอากาศ','❄️','var(--cyan)']].map(([cat,icon,color]) => `
                <div class="urgency-card" id="cat-${cat}" onclick="selectCategory('${cat}',this)" style="text-align:center;padding:1rem .75rem">
                  <div style="font-size:1.75rem;margin-bottom:.4rem">${icon}</div>
                  <div style="font-size:.8rem;font-weight:600">${cat}</div>
                </div>`).join('')}
            </div>
            <input type="hidden" id="req-category">
          </div>

          <!-- Step 2: Location -->
          <div style="margin-bottom:1.5rem">
            <div style="font-size:.8rem;font-weight:600;color:var(--text2);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">2. สถานที่เกิดเหตุ</div>
            <div class="form-row-3">
              <div class="form-group">
                <label class="form-label">อาคาร <span class="req">*</span></label>
                <select class="form-control" id="req-building" onchange="updateFloors()">
                  <option value="">-- เลือกอาคาร --</option>
                  ${buildings.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">ชั้น <span class="req">*</span></label>
                <select class="form-control" id="req-floor" onchange="updateRooms()" disabled>
                  <option value="">-- เลือกชั้น --</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">ห้อง <span class="req">*</span></label>
                <select class="form-control" id="req-room" onchange="setLocationId()" disabled>
                  <option value="">-- เลือกห้อง --</option>
                </select>
              </div>
            </div>
            <input type="hidden" id="req-location-id">
          </div>

          <!-- Step 3: Description -->
          <div style="margin-bottom:1.5rem">
            <div style="font-size:.8rem;font-weight:600;color:var(--text2);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">3. รายละเอียดปัญหา</div>
            <div class="form-group">
              <textarea class="form-control" id="req-desc" rows="4" placeholder="อธิบายรายละเอียดปัญหาที่พบ เช่น อาการ ความรุนแรง สิ่งที่ลองทำแล้ว..."></textarea>
            </div>
          </div>

          <!-- Step 4: Urgency -->
          <div style="margin-bottom:1.5rem">
            <div style="font-size:.8rem;font-weight:600;color:var(--text2);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">4. ระดับความเร่งด่วน</div>
            <div class="urgency-grid">
              ${[['ฉุกเฉิน','u-emergency','🚨','ต้องดำเนินการทันที – อันตราย/ส่งผลกระทบรุนแรง'],['เร่งด่วน','u-urgent','⚡','ภายใน 24 ชั่วโมง – กระทบการใช้งาน'],['ปกติ','u-normal','📋','ภายใน 3 วันทำการ – ไม่กระทบรุนแรง'],['ไม่เร่งด่วน','u-low','📌','ภายใน 7 วันทำการ – ปรับปรุงทั่วไป']].map(([u,cls,icon,desc]) => `
                <div class="urgency-card ${cls}" id="u-${u}" onclick="selectUrgency('${u}',this)">
                  <div class="uc-title">${icon} ${u}</div>
                  <div class="uc-desc">${desc}</div>
                </div>`).join('')}
            </div>
            <input type="hidden" id="req-urgency">
          </div>

          <!-- Step 5: Image -->
          <div style="margin-bottom:1.5rem">
            <div style="font-size:.8rem;font-weight:600;color:var(--text2);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">5. รูปภาพประกอบ (ไม่บังคับ)</div>
            <label class="upload-area" for="req-image" id="upload-area">
              <div style="font-size:2rem;margin-bottom:.5rem">📷</div>
              <div>คลิกหรือลากไฟล์มาวางที่นี่</div>
              <div class="text-xs" style="margin-top:.25rem;color:var(--text3)">รองรับ JPG, PNG ขนาดไม่เกิน 10MB</div>
            </label>
            <input type="file" id="req-image" accept=".jpg,.jpeg,.png" class="hidden" onchange="previewImage(this)">
            <img id="img-preview" class="img-preview hidden" style="margin-top:.75rem">
          </div>

          <!-- Submit -->
          <div class="flex gap-2" style="justify-content:flex-end">
            <button class="btn btn-ghost" onclick="navigate('requests-list')">ยกเลิก</button>
            <button class="btn btn-primary btn-lg" onclick="submitRequest()">📨 ส่งคำขอแจ้งซ่อม</button>
          </div>
        </div>
      </div>
    </div>`;
  } catch (e) {
    c.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  }
}

function selectCategory(val, el) {
  document.querySelectorAll('[id^="cat-"]').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('req-category').value = val;
}

function selectUrgency(val, el) {
  document.querySelectorAll('[id^="u-"]').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('req-urgency').value = val;
}

function updateFloors() {
  const bid = document.getElementById('req-building').value;
  const floors = [...new Set(_locations.filter(l => l.building_id == bid).map(l => l.floor))];
  const sel = document.getElementById('req-floor');
  sel.innerHTML = '<option value="">-- เลือกชั้น --</option>' + floors.map(f => `<option>${f}</option>`).join('');
  sel.disabled = false;
  document.getElementById('req-room').innerHTML = '<option value="">-- เลือกห้อง --</option>';
  document.getElementById('req-room').disabled = true;
  document.getElementById('req-location-id').value = '';
}

function updateRooms() {
  const bid = document.getElementById('req-building').value;
  const floor = document.getElementById('req-floor').value;
  const rooms = _locations.filter(l => l.building_id == bid && l.floor === floor);
  const sel = document.getElementById('req-room');
  sel.innerHTML = '<option value="">-- เลือกห้อง --</option>' + rooms.map(r => `<option value="${r.id}">${r.room}</option>`).join('');
  sel.disabled = false;
  document.getElementById('req-location-id').value = '';
}

function setLocationId() {
  document.getElementById('req-location-id').value = document.getElementById('req-room').value;
}

function previewImage(input) {
  const preview = document.getElementById('img-preview');
  if (input.files?.[0]) {
    const reader = new FileReader();
    reader.onload = e => { preview.src = e.target.result; preview.classList.remove('hidden'); };
    reader.readAsDataURL(input.files[0]);
    document.getElementById('upload-area').innerHTML = `<div style="color:var(--green)">✅ ${input.files[0].name}</div>`;
  }
}

async function submitRequest() {
  const category = document.getElementById('req-category').value;
  const description = document.getElementById('req-desc').value.trim();
  const urgency = document.getElementById('req-urgency').value;
  const location_id = document.getElementById('req-location-id').value;
  const imageFile = document.getElementById('req-image').files?.[0];
  const alertEl = document.getElementById('req-alert');

  if (!category) { alertEl.innerHTML = `<div class="alert alert-warning">⚠️ กรุณาเลือกประเภทปัญหา</div>`; return; }
  if (!description) { alertEl.innerHTML = `<div class="alert alert-warning">⚠️ กรุณาระบุรายละเอียดปัญหา</div>`; return; }
  if (!urgency) { alertEl.innerHTML = `<div class="alert alert-warning">⚠️ กรุณาเลือกระดับความเร่งด่วน</div>`; return; }

  try {
    let result;
    if (imageFile) {
      const fd = new FormData();
      fd.append('category', category); fd.append('description', description); fd.append('urgency', urgency);
      if (location_id) fd.append('location_id', location_id);
      fd.append('image', imageFile);
      result = await api('POST', '/requests', fd, true);
    } else {
      result = await api('POST', '/requests', { category, description, urgency, location_id: location_id || null });
    }
    document.getElementById('page-content').innerHTML = `
      <div style="max-width:480px;margin:4rem auto;text-align:center">
        <div style="font-size:5rem;margin-bottom:1.5rem;animation:slideUp .4s ease">✅</div>
        <h2 style="color:var(--green);margin-bottom:.75rem">แจ้งซ่อมสำเร็จ!</h2>
        <p class="text-muted" style="margin-bottom:1.5rem">ระบบได้รับคำขอของคุณแล้ว กรุณาบันทึกหมายเลขติดตามงานด้านล่าง</p>
        <div class="track-box mb-2">
          <div class="text-xs text-muted mb-1">หมายเลขติดตามงาน</div>
          <div class="track-id">${result.tracking_id}</div>
          <div class="text-xs text-muted mt-1">กดคัดลอกหรือบันทึกไว้</div>
        </div>
        <div class="flex gap-2" style="justify-content:center">
          <button class="btn btn-ghost" onclick="navigate('track')">🔍 ติดตามงาน</button>
          <button class="btn btn-primary" onclick="navigate('requests-list')">📋 ดูรายการ</button>
        </div>
      </div>`;
  } catch (e) {
    alertEl.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════
// REQUEST DETAIL
// ═══════════════════════════════════════
async function renderRequestDetail(id) {
  const c = document.getElementById('page-content');
  const role = APP.user?.role;
  const uid = APP.user?.id;
  try {
    const r = await api('GET', `/requests/${id}`);
    const statusOrder = ['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์'];
    const si = statusOrder.indexOf(r.status);
    const isOverdue = r.sla_deadline && new Date(r.sla_deadline) < new Date() && r.status !== 'เสร็จสมบูรณ์';
    const canTech = role === 'technician' && r.assigned_tech_id === uid;
    const canManager = ['manager','admin'].includes(role);
    const canEval = role === 'user' && r.requester_id === uid && r.status === 'เสร็จสมบูรณ์' && !r.evaluation;
    const canAssignBtn = canManager && !r.assigned_tech_id;

    c.innerHTML = `
    <div style="max-width:820px;margin:0 auto">
      <!-- HEADER -->
      <div class="flex items-center justify-between mb-2" style="flex-wrap:wrap;gap:.5rem">
        <button class="btn btn-ghost btn-sm" onclick="navigate('requests-list')">← กลับ</button>
        <div class="flex gap-1" style="flex-wrap:wrap">
          ${canAssignBtn?`<button class="btn btn-primary btn-sm" onclick="openAssignModal(${r.id},'${r.tracking_id}')">👷 มอบหมายช่าง</button>`:''}
          ${canTech&&r.status!=='เสร็จสมบูรณ์'?`<button class="btn btn-warning btn-sm" onclick="openStatusModal(${r.id},'${r.status}')">🔄 อัปเดตสถานะ</button>`:''}
          ${canTech?`<button class="btn btn-success btn-sm" onclick="openMatUsageModal(${r.id})">📦 บันทึกวัสดุ</button>`:''}
          ${canEval?`<button class="btn btn-primary btn-sm" style="background:var(--yellow);color:#000" onclick="openEvalModal(${r.id})">⭐ ประเมินงาน</button>`:''}
        </div>
      </div>

      <!-- INFO CARD -->
      <div class="card mb-2">
        <div class="card-header">
          <div>
            <div class="flex items-center gap-2"><span class="tid">${r.tracking_id}</span>${isOverdue?'<span class="badge badge-red">⏰ เกิน SLA</span>':''}</div>
            <div class="text-muted text-xs mt-1">${categoryIcon(r.category)} ${r.category} | แจ้งเมื่อ ${fmtDate(r.created_at)}</div>
          </div>
          <div class="flex gap-1">${urgencyBadge(r.urgency)} ${statusBadge(r.status)}</div>
        </div>
        <div class="card-body">
          <div class="grid-2">
            <div>
              <div class="text-xs text-muted mb-1">ผู้แจ้งซ่อม</div>
              <div style="font-weight:600">${r.requester_name}</div>
              <div class="text-muted text-sm">${r.requester_sid||''} | ${r.requester_dept||''}</div>
              <div class="text-muted text-xs">${r.requester_email||''}</div>
            </div>
            <div>
              <div class="text-xs text-muted mb-1">สถานที่</div>
              <div style="font-weight:600">${r.building_name?`${r.building_name} ${r.floor} ${r.room}`:r.location_detail||'–'}</div>
            </div>
            <div>
              <div class="text-xs text-muted mb-1">ช่างที่รับผิดชอบ</div>
              <div style="font-weight:600">${r.tech_name||'– ยังไม่ได้มอบหมาย –'}</div>
              ${r.tech_phone?`<div class="text-muted text-xs">📞 ${r.tech_phone}</div>`:''}
            </div>
            <div>
              <div class="text-xs text-muted mb-1">กำหนด SLA</div>
              <div style="font-weight:600;color:${isOverdue?'var(--red)':'inherit'}">${fmtDate(r.sla_deadline)}</div>
            </div>
          </div>
          <div class="divider"></div>
          <div class="text-xs text-muted mb-1">รายละเอียดปัญหา</div>
          <p style="line-height:1.8;font-size:.875rem">${r.description}</p>
          ${r.image_path?`<div class="mt-2"><div class="text-xs text-muted mb-1">รูปภาพก่อนซ่อม</div><img src="${r.image_path}" class="img-preview" style="max-height:280px"></div>`:''}
          ${r.repair_detail?`<div class="mt-2 alert alert-info">🔧 <strong>รายละเอียดการซ่อม:</strong> ${r.repair_detail}</div>`:''}
          ${r.after_image_path?`<div class="mt-2"><div class="text-xs text-muted mb-1">รูปภาพหลังซ่อม</div><img src="${r.after_image_path}" class="img-preview" style="max-height:280px"></div>`:''}
        </div>
      </div>

      <!-- TIMELINE -->
      <div class="card mb-2">
        <div class="card-header"><div class="card-title">⏱️ ความคืบหน้า</div></div>
        <div class="card-body">
          <div class="timeline">
            ${statusOrder.map((s,i) => `
              <div class="tl-step">
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                  <div class="tl-dot ${i<si?'done':i===si?'current':''}">${i<si?'✓':i+1}</div>
                  <div class="tl-label ${i<si?'done':i===si?'current':''}" style="font-size:.65rem;text-align:center;max-width:70px">${s}</div>
                </div>
              </div>
              ${i<statusOrder.length-1?`<div class="tl-line ${i<si?'done':''}"></div>`:''}`).join('')}
          </div>
          <div class="grid-2 mt-2" style="font-size:.78rem;color:var(--text2)">
            <div>📅 มอบหมาย: <strong style="color:var(--text)">${fmtDate(r.assigned_at)}</strong></div>
            <div>🔨 เริ่มซ่อม: <strong style="color:var(--text)">${fmtDate(r.started_at)}</strong></div>
            <div>✅ เสร็จ: <strong style="color:var(--text)">${fmtDate(r.completed_at)}</strong></div>
          </div>
        </div>
      </div>

      <!-- MATERIALS USED -->
      ${r.materials_used?.length?`
      <div class="card mb-2">
        <div class="card-header"><div class="card-title">📦 วัสดุที่ใช้</div></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>รหัส</th><th>วัสดุ</th><th>จำนวน</th><th>หน่วย</th><th>โดย</th><th>เวลา</th></tr></thead>
          <tbody>${r.materials_used.map(m=>`<tr>
            <td class="mono text-sm">${m.code}</td><td>${m.mat_name}</td>
            <td class="mono">${m.quantity_used}</td><td>${m.unit}</td>
            <td class="text-sm">${m.tech_name}</td><td class="text-xs text-muted">${fmtDate(m.used_at,true)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`:''}

      <!-- EVALUATION -->
      ${r.evaluation?`
      <div class="card">
        <div class="card-header"><div class="card-title">⭐ ผลการประเมิน</div><span class="badge badge-green">คะแนนเฉลี่ย ${Number(r.evaluation.avg_score).toFixed(2)}</span></div>
        <div class="card-body">
          <div class="grid-3">
            ${[['คุณภาพงาน',r.evaluation.quality_score],['ความรวดเร็ว',r.evaluation.speed_score],['การบริการ',r.evaluation.service_score]].map(([l,s])=>`
              <div style="text-align:center;padding:1rem;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border)">
                <div style="font-size:1.5rem;margin-bottom:.25rem">${'⭐'.repeat(s)}${'☆'.repeat(5-s)}</div>
                <div class="text-sm" style="color:var(--yellow);font-weight:700;margin-bottom:.25rem">${s}/5</div>
                <div class="text-xs text-muted">${l}</div>
              </div>`).join('')}
          </div>
          ${r.evaluation.comment?`<div class="alert alert-info mt-2">💬 "${r.evaluation.comment}"</div>`:''}
        </div>
      </div>`:''}
    </div>`;
  } catch (e) {
    c.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  }
}

// STATUS MODAL
function openStatusModal(id, current) {
  openModal(`
    <div class="modal">
      <div class="modal-header"><div class="modal-title">🔄 อัปเดตสถานะงาน</div><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">สถานะใหม่</label>
          <select class="form-control" id="new-status">
            ${['กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์','ต้องส่งซ่อมภายนอก'].map(s=>`<option value="${s}"${current===s?' selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">รายละเอียดการดำเนินการ</label>
          <textarea class="form-control" id="repair-detail" rows="4" placeholder="อธิบายสิ่งที่ทำ วัสดุที่ใช้ ปัญหาที่พบ..."></textarea>
        </div>
        <div class="form-group" id="after-img-group">
          <label class="form-label">รูปภาพหลังซ่อม</label>
          <input type="file" class="form-control" id="after-img" accept=".jpg,.jpeg,.png">
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="doUpdateStatus(${id})">✅ บันทึก</button></div>
    </div>`);
}

async function doUpdateStatus(id) {
  const status = document.getElementById('new-status').value;
  const repair_detail = document.getElementById('repair-detail').value;
  const afterImg = document.getElementById('after-img')?.files?.[0];
  try {
    await api('PATCH', `/requests/${id}/status`, { status, repair_detail });
    if (afterImg) {
      const fd = new FormData(); fd.append('image', afterImg);
      await api('POST', `/requests/${id}/after-image`, fd, true);
    }
    toast('อัปเดตสถานะสำเร็จ');
    closeModal();
    renderRequestDetail(id);
  } catch (e) { toast(e.message, 'error'); }
}

// MATERIAL USAGE MODAL
async function openMatUsageModal(requestId) {
  const { items } = await api('GET', '/materials');
  openModal(`
    <div class="modal">
      <div class="modal-header"><div class="modal-title">📦 บันทึกการใช้วัสดุ</div><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">วัสดุ <span class="req">*</span></label>
          <select class="form-control" id="mat-sel">
            <option value="">-- เลือกวัสดุ --</option>
            ${items.map(m=>`<option value="${m.id}">${m.name} (คงเหลือ: ${m.quantity} ${m.unit})</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">จำนวน <span class="req">*</span></label><input class="form-control" type="number" id="mat-qty" value="1" min="1"></div>
          <div class="form-group"><label class="form-label">หมายเหตุ</label><input class="form-control" id="mat-note" placeholder="(ไม่บังคับ)"></div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-success" onclick="doUseMat(${requestId})">✅ บันทึก</button></div>
    </div>`);
}

async function doUseMat(requestId) {
  const material_id = parseInt(document.getElementById('mat-sel').value);
  const quantity_used = parseInt(document.getElementById('mat-qty').value);
  const note = document.getElementById('mat-note').value;
  if (!material_id) { toast('กรุณาเลือกวัสดุ', 'warning'); return; }
  try {
    const r = await api('POST', '/materials/use', { request_id:requestId, material_id, quantity_used, note });
    toast(r.message);
    if (r.low_stock) toast('⚠️ วัสดุใกล้หมด!', 'warning');
    closeModal();
    renderRequestDetail(requestId);
  } catch (e) { toast(e.message, 'error'); }
}

// EVALUATION MODAL
function openEvalModal(requestId) {
  openModal(`
    <div class="modal">
      <div class="modal-header"><div class="modal-title">⭐ ประเมินความพึงพอใจ</div><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <p class="text-muted mb-2">กรุณาประเมินงานซ่อมโดยให้คะแนน 1–5 ดาว</p>
        ${[['quality','คุณภาพงาน'],['speed','ความรวดเร็ว'],['service','การบริการ']].map(([k,l])=>`
          <div class="star-group">
            <div class="star-group-label">${l}</div>
            <div class="stars" id="stars-${k}">
              ${[1,2,3,4,5].map(n=>`<span class="star" data-v="${n}" onclick="setStars('${k}',${n})">★</span>`).join('')}
            </div>
            <input type="hidden" id="score-${k}" value="0">
          </div>`).join('')}
        <div class="form-group mt-1"><label class="form-label">ความคิดเห็นเพิ่มเติม</label><textarea class="form-control" id="eval-comment" rows="3" placeholder="บอกความรู้สึกของคุณ..."></textarea></div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="doEval(${requestId})">⭐ ส่งผลประเมิน</button></div>
    </div>`);
}

function setStars(key, val) {
  document.getElementById(`score-${key}`).value = val;
  document.querySelectorAll(`#stars-${key} .star`).forEach(s => s.classList.toggle('on', parseInt(s.dataset.v) <= val));
}

async function doEval(requestId) {
  const quality_score = parseInt(document.getElementById('score-quality').value);
  const speed_score   = parseInt(document.getElementById('score-speed').value);
  const service_score = parseInt(document.getElementById('score-service').value);
  const comment = document.getElementById('eval-comment').value;
  if (!quality_score||!speed_score||!service_score) { toast('กรุณาให้คะแนนทุกหัวข้อ','warning'); return; }
  try {
    const r = await api('POST', '/evaluations', { request_id:requestId, quality_score, speed_score, service_score, comment });
    toast(r.message);
    closeModal();
    renderRequestDetail(requestId);
  } catch (e) { toast(e.message,'error'); }
}