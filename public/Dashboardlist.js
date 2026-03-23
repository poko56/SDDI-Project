// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
async function renderDashboard() {
  const c = document.getElementById('page-content');
  try {
    const d = await api('GET', '/dashboard');
    const { total, by_category, by_urgency, monthly, top_buildings, tech_perf, avg_sla, satisfaction } = d;

    const maxCat = Math.max(...by_category.map(x => x.count), 1);
    const maxMon = Math.max(...monthly.map(x => x.count), 1);

    c.innerHTML = `
    <!-- STAT CARDS -->
    <div class="stats-row">
      ${[
        ['📋', total.total, 'ทั้งหมด', 'var(--blue)', 'badge-blue'],
        ['⏳', total.pending, 'รอดำเนินการ', 'var(--yellow)', 'badge-yellow'],
        ['⚙️', total.in_progress, 'กำลังดำเนินการ', 'var(--blue)', 'badge-blue'],
        ['🔍', total.review, 'รอตรวจสอบ', 'var(--purple)', 'badge-purple'],
        ['✅', total.done, 'เสร็จสมบูรณ์', 'var(--green)', 'badge-green'],
        ['🚨', total.overdue, 'เกิน SLA', 'var(--red)', 'badge-red'],
        ['⚡', total.emergency, 'ฉุกเฉิน', 'var(--orange)', 'badge-orange'],
      ].map(([icon, val, label, color]) => `
        <div class="stat">
          <div class="stat-top">
            <div class="stat-icon-wrap" style="background:${color}22"><span style="font-size:1.1rem">${icon}</span></div>
          </div>
          <div class="stat-val" style="color:${color}">${val}</div>
          <div class="stat-label">${label}</div>
          <div class="stat-accent" style="background:${color}"></div>
        </div>`).join('')}
    </div>

    <!-- ROW 2 -->
    <div class="grid-2" style="margin-bottom:1.25rem">
      <!-- Monthly trend -->
      <div class="card">
        <div class="card-header"><div class="card-title">📈 แนวโน้มรายเดือน</div></div>
        <div class="card-body">
          ${monthly.length ? `
            <div style="display:flex;align-items:flex-end;gap:6px;height:140px;padding-top:1rem">
              ${monthly.map(m => `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                  <span style="font-size:.65rem;color:var(--blue);font-weight:600">${m.count}</span>
                  <div style="width:100%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,var(--blue),#1e40af);height:${Math.max(6,Math.round(m.count/maxMon*120))}px;opacity:.85"></div>
                  <span style="font-size:.6rem;color:var(--text3)">${m.month?.slice(5)||''}</span>
                </div>`).join('')}
            </div>` : emptyState('📈', 'ยังไม่มีข้อมูล')}
        </div>
      </div>

      <!-- Category -->
      <div class="card">
        <div class="card-header"><div class="card-title">🏷️ ประเภทงานซ่อม</div></div>
        <div class="card-body">
          <div class="bar-chart">
            ${by_category.map(c => `
              <div class="bar-row">
                <div class="bar-label">${categoryIcon(c.category)} ${c.category}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.round(c.count/maxCat*100)}%;background:var(--blue)"></div></div>
                <div class="bar-val">${c.count}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- ROW 3 -->
    <div class="grid-2" style="margin-bottom:1.25rem">
      <!-- Top buildings -->
      <div class="card">
        <div class="card-header"><div class="card-title">📍 พื้นที่แจ้งซ่อมบ่อย</div><div class="text-muted text-xs">Top 5</div></div>
        <div class="card-body">
          ${top_buildings.length ? top_buildings.map((b, i) => `
            <div class="flex items-center gap-2" style="padding:.5rem 0;border-bottom:1px solid var(--border)">
              <div style="width:22px;height:22px;background:var(--bg3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:var(--text2)">${i+1}</div>
              <div style="flex:1;font-size:.82rem">${b.name}</div>
              <span class="badge badge-blue">${b.count} ครั้ง</span>
            </div>`).join('') : emptyState('📍','ยังไม่มีข้อมูล')}
        </div>
      </div>

      <!-- KPIs -->
      <div class="card">
        <div class="card-header"><div class="card-title">🎯 KPI สรุป</div></div>
        <div class="card-body">
          <div style="display:grid;gap:1rem">
            ${[
              ['⭐', 'คะแนนความพึงพอใจเฉลี่ย', satisfaction.avg ? `${Number(satisfaction.avg).toFixed(2)} / 5.0` : '–', satisfaction.avg >= 4 ? 'var(--green)' : 'var(--yellow)'],
              ['⏱️', 'เวลาเฉลี่ยในการปิดงาน', avg_sla.avg_hours ? `${avg_sla.avg_hours} ชั่วโมง` : '–', 'var(--blue)'],
              ['📝', 'จำนวนผลประเมิน', `${satisfaction.count} รายการ`, 'var(--purple)'],
              ['✅', 'อัตราสำเร็จ', total.total ? `${Math.round(total.done/total.total*100)}%` : '0%', 'var(--green)'],
            ].map(([icon, label, val, color]) => `
              <div class="flex items-center justify-between" style="padding:.5rem .75rem;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border)">
                <div class="flex items-center gap-2"><span>${icon}</span><span style="font-size:.82rem;color:var(--text2)">${label}</span></div>
                <span style="font-weight:700;font-size:.9rem;color:${color};font-family:var(--mono)">${val}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- TECH PERFORMANCE -->
    <div class="card">
      <div class="card-header"><div class="card-title">👷 ประสิทธิภาพช่างซ่อม</div></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>ชื่อช่าง</th><th>งานทั้งหมด</th><th>เสร็จแล้ว</th><th>เฉลี่ย (วัน)</th><th>คะแนน</th><th>อัตราสำเร็จ</th></tr></thead>
          <tbody>
            ${tech_perf.length ? tech_perf.map(t => {
              const rate = t.total ? Math.round(t.done / t.total * 100) : 0;
              return `<tr>
                <td><strong>${t.name}</strong></td>
                <td class="mono">${t.total}</td>
                <td><span class="badge badge-green">${t.done}</span></td>
                <td class="mono">${t.avg_days ?? '–'}</td>
                <td>${t.avg_score ? `<span style="color:var(--yellow)">⭐ ${Number(t.avg_score).toFixed(1)}</span>` : '–'}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="progress" style="flex:1"><div class="progress-bar" style="width:${rate}%;background:${rate>=80?'var(--green)':rate>=50?'var(--yellow)':'var(--red)'}"></div></div>
                    <span class="text-xs mono">${rate}%</span>
                  </div>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="6">${emptyState('👷','ยังไม่มีข้อมูลช่าง')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  } catch (e) {
    c.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════
// REQUESTS LIST
// ═══════════════════════════════════════
let _reqFilters = {};

async function renderRequestsList(filters = {}) {
  _reqFilters = filters;
  const c = document.getElementById('page-content');
  const role = APP.user?.role;
  const canCreate = ['user','manager','admin'].includes(role);
  const canAssign = ['manager','admin'].includes(role);

  try {
    const [data, stats] = await Promise.all([
      api('GET', `/requests?${new URLSearchParams(filters)}`),
      api('GET', '/requests/stats')
    ]);
    const { items, total } = data;

    c.innerHTML = `
    <!-- STATS ROW -->
    <div class="stats-row" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
      ${[
        ['⏳','รอดำเนินการ', stats.pending,'var(--yellow)'],
        ['⚙️','กำลังดำเนินการ', stats.in_progress,'var(--blue)'],
        ['🔍','รอตรวจสอบ', stats.review,'var(--purple)'],
        ['✅','เสร็จสมบูรณ์', stats.done,'var(--green)'],
        ['🚨','เกิน SLA', stats.overdue,'var(--red)'],
      ].map(([icon,label,val,color]) => `
        <div class="stat" style="cursor:pointer" onclick="applyFilter('status','${label}')">
          <div class="stat-top"><div class="stat-icon-wrap" style="background:${color}22">${icon}</div></div>
          <div class="stat-val" style="color:${color}">${val}</div>
          <div class="stat-label">${label}</div>
          <div class="stat-accent" style="background:${color}"></div>
        </div>`).join('')}
    </div>

    <!-- FILTER + TABLE -->
    <div class="card">
      <div class="filter-bar">
        <div class="form-group filter-search">
          <label class="form-label">ค้นหา</label>
          <div class="input-group">
            <input class="form-control" id="f-search" placeholder="Tracking ID, รายละเอียด, ชื่อผู้แจ้ง..." value="${filters.search||''}">
            <button class="btn btn-primary" onclick="applyFilters()">🔍</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">สถานะ</label>
          <select class="form-control" id="f-status" onchange="applyFilters()">
            <option value="">ทั้งหมด</option>
            ${['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์','ต้องส่งซ่อมภายนอก'].map(s => `<option ${filters.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">ประเภท</label>
          <select class="form-control" id="f-cat" onchange="applyFilters()">
            <option value="">ทั้งหมด</option>
            ${['ไฟฟ้า','ประปา','โครงสร้าง','อุปกรณ์อิเล็กทรอนิกส์','เครื่องปรับอากาศ'].map(s => `<option ${filters.category===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">ความเร่งด่วน</label>
          <select class="form-control" id="f-urgency" onchange="applyFilters()">
            <option value="">ทั้งหมด</option>
            ${['ฉุกเฉิน','เร่งด่วน','ปกติ','ไม่เร่งด่วน'].map(s => `<option ${filters.urgency===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">เรียงตาม</label>
          <select class="form-control" id="f-sort" onchange="applyFilters()">
            <option value="urgency">ความเร่งด่วน</option>
            <option value="newest">ล่าสุด</option>
            <option value="oldest">เก่าสุด</option>
          </select>
        </div>
        <div class="form-group" style="align-self:flex-end">
          <button class="btn btn-ghost btn-sm" onclick="resetFilters()">↺ รีเซ็ต</button>
          ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="navigate('request-new')" style="margin-left:.25rem">➕ แจ้งซ่อมใหม่</button>` : ''}
        </div>
      </div>

      <div style="padding:.75rem 1.25rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span class="text-muted text-sm">พบ <strong style="color:var(--text)">${total}</strong> รายการ</span>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Tracking ID</th><th>ประเภท</th><th>รายละเอียด</th>
            <th>สถานที่</th><th>ความเร่งด่วน</th><th>สถานะ</th>
            ${canAssign?'<th>ช่าง</th>':''}
            <th>วันที่แจ้ง</th><th></th>
          </tr></thead>
          <tbody>
            ${items.length ? items.map(r => {
              const overdue = r.sla_deadline && new Date(r.sla_deadline) < new Date() && r.status !== 'เสร็จสมบูรณ์';
              return `<tr${overdue?' style="background:rgba(239,68,68,0.04)"':''}>
                <td><span class="tid">${r.tracking_id}</span>${overdue?'<br><span class="badge badge-red" style="margin-top:2px;font-size:.62rem">⏰ เกิน SLA</span>':''}</td>
                <td><span style="font-size:1rem">${categoryIcon(r.category)}</span> <span class="text-sm">${r.category}</span></td>
                <td><div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem">${r.description}</div><div class="text-xs" style="color:var(--text3)">${r.requester_name||''}</div></td>
                <td class="text-sm">${r.building_name?`${r.building_name} ${r.floor} ${r.room}`:(r.location_detail||'–')}</td>
                <td>${urgencyBadge(r.urgency)}</td>
                <td>${statusBadge(r.status)}</td>
                ${canAssign?`<td class="text-sm">${r.tech_name||`<span class="text-muted">–</span>`}</td>`:''}
                <td><div class="text-xs">${fmtDate(r.created_at, true)}</div></td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="navigate('request-detail',{id:${r.id}})">ดู →</button>
                  ${canAssign&&r.status==='รอดำเนินการ'?`<button class="btn btn-primary btn-sm" onclick="openAssignModal(${r.id},'${r.tracking_id}')" style="margin-top:2px">มอบหมาย</button>`:''}
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="9">${emptyState('📭','ไม่มีรายการแจ้งซ่อมที่ตรงกับเงื่อนไข')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
  } catch (e) {
    c.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  }
}

function applyFilters() {
  const filters = {};
  const search = document.getElementById('f-search')?.value;
  const status = document.getElementById('f-status')?.value;
  const category = document.getElementById('f-cat')?.value;
  const urgency = document.getElementById('f-urgency')?.value;
  const sort = document.getElementById('f-sort')?.value;
  if (search) filters.search = search;
  if (status) filters.status = status;
  if (category) filters.category = category;
  if (urgency) filters.urgency = urgency;
  if (sort) filters.sort = sort;
  renderRequestsList(filters);
}

function applyFilter(key, val) {
  renderRequestsList({ [key]: val });
}

function resetFilters() { renderRequestsList({}); }

// ASSIGN MODAL
async function openAssignModal(requestId, trackingId) {
  const techs = await api('GET', '/users/technicians');
  openModal(`
    <div class="modal">
      <div class="modal-header"><div class="modal-title">👷 มอบหมายช่างซ่อม</div><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="alert alert-info">📋 งาน: <strong>${trackingId}</strong></div>
        <div class="form-group">
          <label class="form-label">เลือกช่าง <span class="req">*</span></label>
          <select class="form-control" id="assign-tech-sel">
            <option value="">-- เลือกช่างซ่อม --</option>
            ${techs.map(t => `<option value="${t.id}">${t.name} | งานปัจจุบัน: ${t.active_jobs} | คะแนน: ${t.avg_score||'–'}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;gap:.5rem">
          ${techs.map(t => `
            <div class="flex items-center justify-between" style="padding:.6rem .875rem;background:var(--bg3);border-radius:var(--r-sm);border:1px solid var(--border);font-size:.8rem">
              <div><strong>${t.name}</strong> <span class="text-muted">${t.department||''}</span></div>
              <div class="flex items-center gap-2">
                <span class="badge badge-blue">งาน ${t.active_jobs}</span>
                ${t.avg_score?`<span class="badge badge-yellow">⭐ ${Number(t.avg_score).toFixed(1)}</span>`:''}
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button>
        <button class="btn btn-primary" onclick="doAssign(${requestId})">✅ ยืนยันมอบหมาย</button>
      </div>
    </div>`);
}

async function doAssign(id) {
  const tech_id = document.getElementById('assign-tech-sel').value;
  if (!tech_id) { toast('กรุณาเลือกช่าง', 'warning'); return; }
  try {
    const r = await api('PATCH', `/requests/${id}/assign`, { tech_id: parseInt(tech_id) });
    toast(r.message);
    closeModal();
    renderRequestsList(_reqFilters);
  } catch (e) { toast(e.message, 'error'); }
}