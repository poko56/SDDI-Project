// ═══════════════════════════════════════
// MATERIALS
// ═══════════════════════════════════════
async function renderMaterials() {
  const c = document.getElementById('page-content');
  const role = APP.user?.role;
  const canManage = ['admin','manager'].includes(role);
  try {
    const { items, low_count, total_value, categories } = await api('GET', '/materials');

    c.innerHTML = `
    <!-- Stats -->
    <div class="stats-row" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:1.25rem">
      <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--blue-dim)">📦</div></div><div class="stat-val" style="color:var(--blue)">${items.length}</div><div class="stat-label">รายการทั้งหมด</div><div class="stat-accent" style="background:var(--blue)"></div></div>
      <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--red-dim)">⚠️</div></div><div class="stat-val" style="color:var(--red)">${low_count}</div><div class="stat-label">ใกล้หมด / หมด</div><div class="stat-accent" style="background:var(--red)"></div></div>
      <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--green-dim)">💰</div></div><div class="stat-val" style="color:var(--green);font-size:1.4rem">฿${Number(total_value).toLocaleString()}</div><div class="stat-label">มูลค่าคลังรวม</div><div class="stat-accent" style="background:var(--green)"></div></div>
    </div>

    <div class="card">
      <!-- Filters -->
      <div class="filter-bar">
        <div class="form-group filter-search">
          <label class="form-label">ค้นหา</label>
          <div class="input-group">
            <input class="form-control" id="mat-search" placeholder="ชื่อหรือรหัสวัสดุ..." onkeydown="if(event.key==='Enter')filterMats()">
            <button class="btn btn-primary" onclick="filterMats()">🔍</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">หมวดหมู่</label>
          <select class="form-control" id="mat-cat" onchange="filterMats()">
            <option value="">ทั้งหมด</option>
            ${categories.map(cat=>`<option>${cat}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">แสดง</label>
          <select class="form-control" id="mat-ls" onchange="filterMats()">
            <option value="">ทั้งหมด</option>
            <option value="1">เฉพาะใกล้หมด</option>
          </select>
        </div>
        <div class="form-group" style="align-self:flex-end">
          ${canManage?`<button class="btn btn-primary btn-sm" onclick="openAddMatModal()">➕ เพิ่มวัสดุ</button>`:''}
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table class="table" id="mat-table">
          <thead><tr><th>รหัส</th><th>ชื่อวัสดุ</th><th>หมวดหมู่</th><th>ยี่ห้อ</th><th>คงเหลือ</th><th>จุดสั่งซื้อ</th><th>ราคา/หน่วย</th><th>มูลค่า</th><th>สถานะ</th>${canManage?'<th></th>':''}</tr></thead>
          <tbody>
            ${renderMatRows(items, canManage)}
          </tbody>
        </table>
      </div>
    </div>`;

    window._matItems = items;
  } catch (e) {
    c.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  }
}

function renderMatRows(items, canManage) {
  if (!items.length) return `<tr><td colspan="10">${emptyState('📦','ไม่มีรายการวัสดุ')}</td></tr>`;
  return items.map(m => {
    const isLow = m.quantity <= m.reorder_point && m.reorder_point > 0;
    const isEmpty = m.quantity === 0;
    return `<tr style="${isEmpty?'background:rgba(239,68,68,0.04)':isLow?'background:rgba(245,158,11,0.04)':''}">
      <td><span class="tid">${m.code}</span></td>
      <td><strong>${m.name}</strong>${m.location_note?`<br><span class="text-xs text-muted">📍 ${m.location_note}</span>`:''}</td>
      <td><span class="badge badge-gray">${m.category}</span></td>
      <td class="text-muted text-sm">${m.brand||'–'}</td>
      <td><strong style="color:${isEmpty?'var(--red)':isLow?'var(--yellow)':'var(--text)'}">${m.quantity}</strong> <span class="text-muted text-xs">${m.unit}</span></td>
      <td class="text-muted mono">${m.reorder_point}</td>
      <td class="mono text-sm">฿${Number(m.unit_price).toLocaleString()}</td>
      <td class="mono text-sm">฿${Number(m.quantity * m.unit_price).toLocaleString()}</td>
      <td>${isEmpty?'<span class="badge badge-red">❌ หมด</span>':isLow?'<span class="badge badge-yellow">⚠️ ใกล้หมด</span>':'<span class="badge badge-green">✅ ปกติ</span>'}</td>
      ${canManage?`<td class="flex gap-1"><button class="btn btn-success btn-sm" onclick="openStockInModal(${m.id},'${m.name}')">+รับเข้า</button></td>`:''}
    </tr>`;
  }).join('');
}

async function filterMats() {
  const search = document.getElementById('mat-search')?.value||'';
  const cat = document.getElementById('mat-cat')?.value||'';
  const ls = document.getElementById('mat-ls')?.value||'';
  const params = new URLSearchParams();
  if (search) params.set('search',search);
  if (cat) params.set('category',cat);
  if (ls) params.set('low_stock',ls);
  const { items } = await api('GET', `/materials?${params}`);
  const canManage = ['admin','manager'].includes(APP.user?.role);
  document.querySelector('#mat-table tbody').innerHTML = renderMatRows(items, canManage);
}

function openStockInModal(id, name) {
  openModal(`
    <div class="modal">
      <div class="modal-header"><div class="modal-title">📥 รับวัสดุเข้าคลัง</div><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="alert alert-info">📦 วัสดุ: <strong>${name}</strong></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">จำนวนที่รับเข้า <span class="req">*</span></label><input class="form-control" type="number" id="si-qty" min="1" value="1"></div>
          <div class="form-group"><label class="form-label">หมายเหตุ</label><input class="form-control" id="si-note" placeholder="เช่น รับจาก ABC Co."></div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-success" onclick="doStockIn(${id})">✅ บันทึก</button></div>
    </div>`);
}

async function doStockIn(id) {
  const qty = parseInt(document.getElementById('si-qty').value);
  const note = document.getElementById('si-note').value;
  if (!qty||qty<=0){toast('จำนวนไม่ถูกต้อง','warning');return;}
  try { await api('POST',`/materials/${id}/stock-in`,{quantity:qty,note}); toast('บันทึกสำเร็จ'); closeModal(); renderMaterials(); }
  catch(e){toast(e.message,'error');}
}

function openAddMatModal() {
  openModal(`
    <div class="modal modal-lg">
      <div class="modal-header"><div class="modal-title">➕ เพิ่มวัสดุใหม่</div><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group"><label class="form-label">รหัสวัสดุ <span class="req">*</span></label><input class="form-control" id="nm-code" placeholder="MAT016"></div>
          <div class="form-group"><label class="form-label">ชื่อวัสดุ <span class="req">*</span></label><input class="form-control" id="nm-name" placeholder="ชื่อวัสดุ"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">หมวดหมู่ <span class="req">*</span></label><input class="form-control" id="nm-cat" placeholder="ไฟฟ้า / ประปา / ฯลฯ"></div>
          <div class="form-group"><label class="form-label">ยี่ห้อ</label><input class="form-control" id="nm-brand" placeholder="ยี่ห้อ (ถ้ามี)"></div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label class="form-label">จำนวนเริ่มต้น</label><input class="form-control" id="nm-qty" type="number" value="0" min="0"></div>
          <div class="form-group"><label class="form-label">หน่วย</label><input class="form-control" id="nm-unit" value="ชิ้น"></div>
          <div class="form-group"><label class="form-label">ราคา/หน่วย (฿)</label><input class="form-control" id="nm-price" type="number" value="0" min="0"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Reorder Point</label><input class="form-control" id="nm-reorder" type="number" value="5" min="0"></div>
          <div class="form-group"><label class="form-label">ที่เก็บ</label><input class="form-control" id="nm-loc" placeholder="ห้องเก็บของ ตู้ A3"></div>
        </div>
      </div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="doAddMat()">✅ บันทึก</button></div>
    </div>`);
}

async function doAddMat() {
  const code=document.getElementById('nm-code').value.trim();
  const name=document.getElementById('nm-name').value.trim();
  const category=document.getElementById('nm-cat').value.trim();
  if(!code||!name||!category){toast('กรุณากรอกข้อมูลที่จำเป็น','warning');return;}
  try {
    await api('POST','/materials',{code,name,category,brand:document.getElementById('nm-brand').value,quantity:+document.getElementById('nm-qty').value,unit:document.getElementById('nm-unit').value,unit_price:+document.getElementById('nm-price').value,reorder_point:+document.getElementById('nm-reorder').value,location_note:document.getElementById('nm-loc').value});
    toast('เพิ่มวัสดุสำเร็จ'); closeModal(); renderMaterials();
  } catch(e){toast(e.message,'error');}
}

// ═══════════════════════════════════════
// MATERIALS REPORT
// ═══════════════════════════════════════
async function renderMaterialsReport() {
  const c = document.getElementById('page-content');
  try {
    const d = await api('GET', '/materials/report/summary');
    const { by_category, top_used, monthly } = d;
    const maxMon = Math.max(...monthly.map(m=>m.cost),1);
    c.innerHTML = `
    <div class="grid-2 mb-2">
      <div class="card">
        <div class="card-header"><div class="card-title">📊 มูลค่าวัสดุตามหมวดหมู่</div></div>
        <div class="card-body">
          ${by_category.map(c=>`
            <div class="flex justify-between items-center" style="padding:.5rem 0;border-bottom:1px solid var(--border)">
              <span class="text-sm">${c.category}</span>
              <div class="flex gap-2"><span class="badge badge-blue">${c.count} รายการ</span><span class="mono text-sm">฿${Number(c.value).toLocaleString()}</span></div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">🏆 วัสดุที่ใช้มากสุด</div></div>
        <div class="card-body">
          ${top_used.map((m,i)=>`
            <div class="flex justify-between items-center" style="padding:.5rem 0;border-bottom:1px solid var(--border)">
              <div><div style="font-size:.75rem;color:var(--text2)">${i+1}. <span class="mono" style="color:var(--blue)">${m.code}</span></div><div class="text-sm">${m.name}</div></div>
              <div class="text-right"><div class="mono text-sm">฿${Number(m.cost).toLocaleString()}</div><div class="text-xs text-muted">${m.total_used} หน่วย</div></div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">📈 ค่าใช้จ่ายวัสดุรายเดือน</div></div>
      <div class="card-body">
        ${monthly.length?`
        <div style="display:flex;align-items:flex-end;gap:8px;height:160px;padding-top:1rem">
          ${monthly.map(m=>`
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <span style="font-size:.62rem;color:var(--green);font-weight:600">฿${Number(m.cost).toLocaleString()}</span>
              <div style="width:100%;border-radius:4px 4px 0 0;background:var(--green);height:${Math.max(6,Math.round(m.cost/maxMon*140))}px;opacity:.8"></div>
              <span style="font-size:.6rem;color:var(--text3)">${m.month?.slice(5)||''}</span>
            </div>`).join('')}
        </div>` : emptyState('📈','ยังไม่มีข้อมูลการเบิกใช้')}
      </div>
    </div>`;
  } catch(e){c.innerHTML=`<div class="alert alert-danger">❌ ${e.message}</div>`;}
}

// ═══════════════════════════════════════
// USERS
// ═══════════════════════════════════════
async function renderUsers() {
  const c = document.getElementById('page-content');
  const isAdmin = APP.user?.role === 'admin';
  try {
    const users = await api('GET', '/users');
    const byRole = { admin:0, manager:0, technician:0, user:0 };
    users.forEach(u => byRole[u.role] = (byRole[u.role]||0) + 1);

    c.innerHTML = `
    <div class="stats-row" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:1.25rem">
      <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--blue-dim)">👥</div></div><div class="stat-val" style="color:var(--blue)">${users.length}</div><div class="stat-label">ผู้ใช้ทั้งหมด</div><div class="stat-accent" style="background:var(--blue)"></div></div>
      <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--red-dim)">🛡️</div></div><div class="stat-val" style="color:var(--red)">${byRole.admin}</div><div class="stat-label">Admin</div><div class="stat-accent" style="background:var(--red)"></div></div>
      <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--purple-dim)">📋</div></div><div class="stat-val" style="color:var(--purple)">${byRole.manager}</div><div class="stat-label">Manager</div><div class="stat-accent" style="background:var(--purple)"></div></div>
      <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--cyan-dim)">🔧</div></div><div class="stat-val" style="color:var(--cyan)">${byRole.technician}</div><div class="stat-label">ช่างซ่อม</div><div class="stat-accent" style="background:var(--cyan)"></div></div>
      <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--border)">👤</div></div><div class="stat-val">${byRole.user}</div><div class="stat-label">ผู้ใช้งาน</div><div class="stat-accent" style="background:var(--border)"></div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">👥 รายชื่อผู้ใช้งานทั้งหมด</div></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>อีเมล</th><th>บทบาท</th><th>แผนก</th><th>เข้าสู่ระบบล่าสุด</th><th>สถานะ</th>${isAdmin?'<th></th>':''}</tr></thead>
        <tbody>${users.map(u=>`<tr style="${!u.is_active?'opacity:.5':''}">
          <td><span class="tid">${u.student_id||'–'}</span></td>
          <td><strong>${u.name}</strong></td>
          <td class="text-sm text-muted">${u.email}</td>
          <td>${roleBadge(u.role)}</td>
          <td class="text-sm">${u.department||'–'}</td>
          <td class="text-xs text-muted">${timeAgo(u.last_login)||'ยังไม่เคยเข้า'}</td>
          <td>${u.is_active?'<span class="badge badge-green">✅ ใช้งาน</span>':'<span class="badge badge-red">❌ ระงับ</span>'}</td>
          ${isAdmin?`<td>
            <button class="btn btn-ghost btn-sm" onclick="toggleUser(${u.id})">${u.is_active?'ระงับ':'เปิดใช้'}</button>
            <select class="form-control" style="display:inline-block;width:auto;padding:.2rem .5rem;font-size:.72rem;margin-left:.25rem" onchange="changeRole(${u.id},this.value)">
              ${['user','technician','manager','admin'].map(r=>`<option${u.role===r?' selected':''}>${r}</option>`).join('')}
            </select>
          </td>`:''}
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  } catch(e){c.innerHTML=`<div class="alert alert-danger">❌ ${e.message}</div>`;}
}

async function toggleUser(id) {
  if(!confirm('ยืนยันเปลี่ยนสถานะผู้ใช้?'))return;
  try{await api('PATCH',`/users/${id}/toggle`);toast('อัปเดตสำเร็จ');renderUsers();}catch(e){toast(e.message,'error');}
}

async function changeRole(id, role) {
  try{await api('PATCH',`/users/${id}/role`,{role});toast('เปลี่ยนบทบาทสำเร็จ');}catch(e){toast(e.message,'error');}
}

// ═══════════════════════════════════════
// TRACK
// ═══════════════════════════════════════
function renderTrack() {
  document.getElementById('page-content').innerHTML = `
    <div style="max-width:600px;margin:0 auto">
      <div class="card">
        <div class="card-header"><div class="card-title">🔍 ติดตามสถานะงานซ่อม</div></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">หมายเลขติดตามงาน (Tracking ID)</label>
            <div class="input-group">
              <input class="form-control" id="track-input" placeholder="TRK-2568-xxxx" style="font-family:var(--mono);letter-spacing:.05em" onkeydown="if(event.key==='Enter')doTrack()">
              <button class="btn btn-primary" onclick="doTrack()">🔍 ค้นหา</button>
            </div>
          </div>
          <div id="track-result"></div>
        </div>
      </div>
    </div>`;
}

async function doTrack() {
  const id = document.getElementById('track-input').value.trim().toUpperCase();
  const el = document.getElementById('track-result');
  if (!id) { el.innerHTML=`<div class="alert alert-warning">⚠️ กรุณากรอก Tracking ID</div>`; return; }
  el.innerHTML = loading('กำลังค้นหา...');
  try {
    const r = await api('GET', `/requests/track/${id}`);
    const statusOrder = ['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์'];
    const si = statusOrder.indexOf(r.status);
    el.innerHTML = `
      <div class="divider"></div>
      <div class="track-box mb-2">
        <div class="text-xs text-muted mb-1">Tracking ID</div>
        <div class="track-id">${r.tracking_id}</div>
        <div class="flex gap-2" style="justify-content:center;margin-top:.75rem">${urgencyBadge(r.urgency)} ${statusBadge(r.status)}</div>
      </div>
      <div class="grid-2 mb-2" style="font-size:.82rem">
        <div style="padding:.625rem;background:var(--bg3);border-radius:var(--r-sm);border:1px solid var(--border)"><div class="text-xs text-muted mb-1">ประเภท</div><strong>${categoryIcon(r.category)} ${r.category}</strong></div>
        <div style="padding:.625rem;background:var(--bg3);border-radius:var(--r-sm);border:1px solid var(--border)"><div class="text-xs text-muted mb-1">สถานที่</div><strong>${r.building_name?`${r.building_name} ${r.floor} ${r.room}`:'–'}</strong></div>
        <div style="padding:.625rem;background:var(--bg3);border-radius:var(--r-sm);border:1px solid var(--border)"><div class="text-xs text-muted mb-1">ช่างซ่อม</div><strong>${r.tech_name||'ยังไม่ได้มอบหมาย'}</strong></div>
        <div style="padding:.625rem;background:var(--bg3);border-radius:var(--r-sm);border:1px solid var(--border)"><div class="text-xs text-muted mb-1">กำหนด SLA</div><strong>${fmtDate(r.sla_deadline)}</strong></div>
      </div>
      <p class="text-muted mb-2" style="font-size:.82rem;line-height:1.6">${r.description}</p>
      <div class="timeline">
        ${statusOrder.map((s,i)=>`
          <div class="tl-step">
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <div class="tl-dot ${i<si?'done':i===si?'current':''}">${i<si?'✓':i+1}</div>
              <div class="tl-label ${i<si?'done':i===si?'current':''}" style="font-size:.62rem;text-align:center;max-width:65px">${s}</div>
            </div>
          </div>
          ${i<statusOrder.length-1?`<div class="tl-line ${i<si?'done':''}"></div>`:''}`).join('')}
      </div>
      ${r.repair_detail?`<div class="alert alert-info mt-2">🔧 ${r.repair_detail}</div>`:''}`;
  } catch(e) {
    el.innerHTML = `<div class="alert alert-danger">❌ ไม่พบหมายเลข Tracking ID นี้ในระบบ</div>`;
  }
}

// ═══════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════
async function renderProfile() {
  const c = document.getElementById('page-content');
  try {
    const u = await api('GET', '/auth/me');
    const myRequests = await api('GET', '/requests/stats');

    c.innerHTML = `
    <div style="max-width:680px;margin:0 auto">
      <!-- Profile card -->
      <div class="card mb-2">
        <div class="card-header"><div class="card-title">👤 ข้อมูลส่วนตัว</div></div>
        <div class="card-body">
          <div class="flex gap-2 mb-2">
            <div style="width:64px;height:64px;border-radius:14px;background:linear-gradient(135deg,var(--blue),var(--purple));display:flex;align-items:center;justify-content:center;font-size:1.75rem;font-weight:700;color:#fff;flex-shrink:0">${u.name?.[0]||'?'}</div>
            <div>
              <div style="font-size:1.1rem;font-weight:700">${u.name}</div>
              <div>${roleBadge(u.role)}</div>
              <div class="text-muted text-xs mt-1">สมาชิกตั้งแต่ ${fmtDate(u.created_at, true)}</div>
            </div>
          </div>
          <div class="grid-2" style="font-size:.82rem;gap:.75rem">
            ${[['📧','อีเมล',u.email],['🎓','รหัสนักศึกษา',u.student_id||'–'],['🏫','แผนก/สาขา',u.department||'–'],['📞','โทรศัพท์',u.phone||'–']].map(([icon,label,val])=>`
              <div style="padding:.625rem;background:var(--bg3);border-radius:var(--r-sm);border:1px solid var(--border)">
                <div class="text-xs text-muted mb-1">${icon} ${label}</div>
                <div style="font-weight:500">${val}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- My stats -->
      <div class="stats-row mb-2">
        <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--blue-dim)">📋</div></div><div class="stat-val" style="color:var(--blue)">${myRequests.total}</div><div class="stat-label">งานทั้งหมด</div><div class="stat-accent" style="background:var(--blue)"></div></div>
        <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--yellow-dim)">⏳</div></div><div class="stat-val" style="color:var(--yellow)">${myRequests.pending}</div><div class="stat-label">รอดำเนินการ</div><div class="stat-accent" style="background:var(--yellow)"></div></div>
        <div class="stat"><div class="stat-top"><div class="stat-icon-wrap" style="background:var(--green-dim)">✅</div></div><div class="stat-val" style="color:var(--green)">${myRequests.done}</div><div class="stat-label">เสร็จสมบูรณ์</div><div class="stat-accent" style="background:var(--green)"></div></div>
      </div>

      <!-- Edit profile -->
      <div class="card mb-2">
        <div class="card-header"><div class="card-title">✏️ แก้ไขข้อมูล</div></div>
        <div class="card-body">
          <div id="profile-alert"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">ชื่อ-นามสกุล</label><input class="form-control" id="p-name" value="${u.name}"></div>
            <div class="form-group"><label class="form-label">แผนก/สาขา</label><input class="form-control" id="p-dept" value="${u.department||''}"></div>
          </div>
          <div class="form-group"><label class="form-label">โทรศัพท์</label><input class="form-control" id="p-phone" value="${u.phone||''}"></div>
          <button class="btn btn-primary" onclick="saveProfile()">💾 บันทึกข้อมูล</button>
        </div>
      </div>

      <!-- Change password -->
      <div class="card">
        <div class="card-header"><div class="card-title">🔒 เปลี่ยนรหัสผ่าน</div></div>
        <div class="card-body">
          <div id="pw-alert"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">รหัสผ่านเดิม</label><input class="form-control" id="pw-old" type="password"></div>
            <div class="form-group"><label class="form-label">รหัสผ่านใหม่ (≥6 ตัว)</label><input class="form-control" id="pw-new" type="password"></div>
          </div>
          <button class="btn btn-warning" onclick="changePassword()">🔒 เปลี่ยนรหัสผ่าน</button>
        </div>
      </div>
    </div>`;
  } catch(e){c.innerHTML=`<div class="alert alert-danger">❌ ${e.message}</div>`;}
}

async function saveProfile() {
  const el = document.getElementById('profile-alert');
  try {
    await api('PATCH','/auth/profile',{name:document.getElementById('p-name').value,department:document.getElementById('p-dept').value,phone:document.getElementById('p-phone').value});
    el.innerHTML=`<div class="alert alert-success">✅ บันทึกสำเร็จ</div>`;
    toast('อัปเดตโปรไฟล์สำเร็จ');
  } catch(e){el.innerHTML=`<div class="alert alert-danger">❌ ${e.message}</div>`;}
}

async function changePassword() {
  const el = document.getElementById('pw-alert');
  try {
    await api('PATCH','/auth/password',{old_password:document.getElementById('pw-old').value,new_password:document.getElementById('pw-new').value});
    el.innerHTML=`<div class="alert alert-success">✅ เปลี่ยนรหัสผ่านสำเร็จ</div>`;
    document.getElementById('pw-old').value='';
    document.getElementById('pw-new').value='';
  } catch(e){el.innerHTML=`<div class="alert alert-danger">❌ ${e.message}</div>`;}
}