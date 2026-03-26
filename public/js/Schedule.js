/* ═══════════════════════════════════════
   PAGE: SCHEDULE / WORK CALENDAR (SRS 2.3.2)
═══════════════════════════════════════ */
let SCH_YEAR, SCH_MONTH, SCH_DATA = {};

async function pageSchedule(){
  const c=document.getElementById('page-content');
  const role=APP.user?.role;
  const canManage=['admin','manager'].includes(role);
  const now=new Date();
  SCH_YEAR  = SCH_YEAR  || now.getFullYear();
  SCH_MONTH = SCH_MONTH || now.getMonth()+1;

  c.innerHTML=`
  <div class="flex jb ic mb2" style="flex-wrap:wrap;gap:.75rem">
    <div>
      <div style="font-size:1.1rem;font-weight:700">📅 ตารางงานช่างและการลา</div>
      <div class="text-muted text-xs">SRS 2.3.2 • ตารางงานประจำวัน, วันหยุด/ลา, เวรฉุกเฉิน</div>
    </div>
    <div class="flex ic gap2">
      <button class="btn btn-ghost btn-sm" onclick="schNav(-1)">◀</button>
      <span id="sch-title" style="font-weight:700;min-width:110px;text-align:center"></span>
      <button class="btn btn-ghost btn-sm" onclick="schNav(1)">▶</button>
      ${canManage?`<button class="btn btn-primary btn-sm" onclick="openSchModal()">➕ มอบหมายงาน</button>`:''}
      ${role==='technician'?`<button class="btn btn-ghost btn-sm" onclick="openLeaveModal()">📝 ขอลา</button>`:''}
    </div>
  </div>

  <div class="tab-bar mb2" id="sch-tabs">
    <button class="tab-btn on" onclick="switchSchTab(this,'cal')">📅 ปฏิทินเวร</button>
    <button class="tab-btn" onclick="switchSchTab(this,'leaves')">📝 คำขอลา</button>
    ${canManage?`<button class="tab-btn" onclick="switchSchTab(this,'oncall')">🚨 เวรฉุกเฉิน</button>`:''}
  </div>

  <div id="sch-cal"><div class="card"><div class="card-b">${loadingState()}</div></div></div>
  <div id="sch-leaves" style="display:none"><div class="card"><div class="card-b">${loadingState()}</div></div></div>
  ${canManage?`<div id="sch-oncall" style="display:none"><div class="card"><div class="card-b">${loadingState()}</div></div></div>`:''}
  `;

  await loadSchData();
}

async function loadSchData(){
  const role=APP.user?.role;
  const canManage=['admin','manager'].includes(role);
  const titleEl=document.getElementById('sch-title');
  if(titleEl) titleEl.textContent = `${SCH_MONTH < 10? '0':''}${SCH_MONTH}/${SCH_YEAR}`;
  try {
    const data = await apiFetch(`/schedule?year=${SCH_YEAR}&month=${SCH_MONTH}`);
    SCH_DATA = data;
    renderSchCalendar(data, canManage);
    renderLeavesList(data.leaves || [], canManage, role);
    if(canManage) renderOncallTab(data.oncall || [], data.technicians || []);
  } catch(e){
    ['cal','leaves','oncall'].forEach(t=>{
      const el=document.getElementById('sch-'+t);
      if(el) el.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`;
    });
  }
}

function schNav(dir){
  SCH_MONTH += dir;
  if(SCH_MONTH > 12){ SCH_MONTH=1; SCH_YEAR++; }
  if(SCH_MONTH < 1){ SCH_MONTH=12; SCH_YEAR--; }
  loadSchData();
}

function switchSchTab(btn, tab){
  document.querySelectorAll('#sch-tabs .tab-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  ['cal','leaves','oncall'].forEach(t=>{
    const el=document.getElementById('sch-'+t);
    if(el) el.style.display=t===tab?'':'none';
  });
}

/* ─────── Calendar Grid ─────── */
function renderSchCalendar(data, canManage){
  const calEl=document.getElementById('sch-cal');
  if(!calEl) return;

  const { schedules=[], leaves=[], oncall=[], technicians=[] } = data;

  // Build lookup maps: "YYYY-MM-DD" → entries
  const schByDate={}, leaveByDate={}, oncallByDate={};
  schedules.forEach(s=>{
    const k=isoToDateKey(s.date);
    schByDate[k]=schByDate[k]||[]; schByDate[k].push(s);
  });
  leaves.filter(l=>l.status!=='ไม่อนุมัติ').forEach(l=>{
    iterDays(l.start_date, l.end_date, k=>{ leaveByDate[k]=leaveByDate[k]||[]; leaveByDate[k].push(l); });
  });
  oncall.forEach(o=>{
    const k=isoToDateKey(o.date);
    oncallByDate[k]=oncallByDate[k]||[]; oncallByDate[k].push(o);
  });

  // Build calendar grid
  const firstDay = new Date(SCH_YEAR, SCH_MONTH-1, 1);
  const lastDay  = new Date(SCH_YEAR, SCH_MONTH, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  const thNames = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  let cells = '';
  // Empty leading cells
  for(let i=0;i<startDow;i++) cells+=`<div class="cal-cell cal-empty"></div>`;
  // Day cells
  for(let d=1;d<=daysInMonth;d++){
    const k=`${SCH_YEAR}-${String(SCH_MONTH).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=k===todayKey;
    const dow=new Date(SCH_YEAR,SCH_MONTH-1,d).getDay();
    const isWeekend=dow===0||dow===6;
    const schEntries=schByDate[k]||[];
    const leaveEntries=leaveByDate[k]||[];
    const oncallEntries=oncallByDate[k]||[];

    const badges=[
      ...schEntries.map(s=>`<div class="cal-badge cb-blue" title="${s.tech_name}: ${s.shift}">${s.tech_name?.split(' ')[0]||'–'} ${s.shift==='เช้า'?'☀️':s.shift==='บ่าย'?'🌤️':'🌙'}</div>`),
      ...leaveEntries.map(l=>`<div class="cal-badge cb-amber" title="${l.tech_name}: ${l.type}">${l.tech_name?.split(' ')[0]||'–'} 🏖️</div>`),
      ...oncallEntries.map(o=>`<div class="cal-badge cb-red" title="เวรฉุกเฉิน: ${o.tech_name}">🚨 ${o.tech_name?.split(' ')[0]||'–'}</div>`)
    ].slice(0,3).join('')+(schEntries.length+leaveEntries.length+oncallEntries.length>3?`<div class="cal-badge cb-gray">+${schEntries.length+leaveEntries.length+oncallEntries.length-3}</div>`:'');

    cells+=`<div class="cal-cell ${isToday?'cal-today':''} ${isWeekend?'cal-weekend':''}" onclick="showDayDetail('${k}')">
      <div class="cal-day">${d}</div>
      <div class="cal-badges">${badges}</div>
    </div>`;
  }

  calEl.innerHTML=`
  <!-- Legend -->
  <div class="flex ic gap2 mb2" style="flex-wrap:wrap">
    <span class="cal-badge cb-blue" style="font-size:.7rem">☀️ กะเช้า / 🌤️ บ่าย / 🌙 ดึก</span>
    <span class="cal-badge cb-amber" style="font-size:.7rem">🏖️ วันลา</span>
    <span class="cal-badge cb-red" style="font-size:.7rem">🚨 เวรฉุกเฉิน</span>
  </div>
  <div class="card" style="overflow:hidden">
    <div class="cal-hd">${thNames.map(t=>`<div class="cal-th">${t}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
  </div>`;
}

/* ─────── Day Detail Popup ─────── */
function showDayDetail(dateKey){
  const { schedules=[], leaves=[], oncall=[] } = SCH_DATA||{};
  const role=APP.user?.role;
  const canManage=['admin','manager'].includes(role);
  const myId=String(APP.user.id);

  const daySchEntries = schedules.filter(s=>isoToDateKey(s.date)===dateKey);
  const dayLeaveEntries = leaves.filter(l=>{
    const s=isoToDateKey(l.start_date), e=isoToDateKey(l.end_date);
    return dateKey>=s && dateKey<=e && l.status!=='ไม่อนุมัติ';
  });
  const dayOncall = oncall.filter(o=>isoToDateKey(o.date)===dateKey);

  const d = new Date(dateKey);
  const label = d.toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  openModal(`<div class="modal"><div class="mh"><div class="mt">📅 ${label}</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    ${daySchEntries.length?`
    <div style="font-weight:700;font-size:.82rem;margin-bottom:.5rem">⚙️ ตารางงาน</div>
    ${daySchEntries.map(s=>`
      <div class="flex jb ic mb1">
        <div><span class="badge b-blue">${s.shift}</span> <strong>${s.tech_name}</strong>${s.note?` — ${s.note}`:''}</div>
        ${canManage?`<button class="btn btn-danger btn-sm" onclick="deleteSchEntry('${s.id}','${dateKey}')">✕</button>`:''}
      </div>`).join('')}`:''}
    ${dayOncall.length?`
    <div style="font-weight:700;font-size:.82rem;margin:.75rem 0 .5rem">🚨 เวรฉุกเฉิน</div>
    ${dayOncall.map(o=>`
      <div class="flex jb ic mb1">
        <span class="badge b-red">🚨 ${o.tech_name}</span>
        ${canManage?`<button class="btn btn-danger btn-sm" onclick="deleteOncall('${o.id}','${dateKey}')">✕</button>`:''}
      </div>`).join('')}`:''}
    ${dayLeaveEntries.length?`
    <div style="font-weight:700;font-size:.82rem;margin:.75rem 0 .5rem">🏖️ วันลา</div>
    ${dayLeaveEntries.map(l=>`<div class="flex jb ic mb1">
      <span><strong>${l.tech_name}</strong> — ${l.type} <span class="badge ${l.status==='อนุมัติ'?'b-green':'b-amber'}">${l.status}</span></span>
    </div>`).join('')}`:''}
    ${!daySchEntries.length&&!dayOncall.length&&!dayLeaveEntries.length?`<div class="empty"><div class="ei">📅</div><div class="text-muted">ไม่มีตารางงานในวันนี้</div></div>`:''}
  </div>
  <div class="mf" style="flex-wrap:wrap;gap:.5rem">
    <button class="btn btn-ghost" onclick="closeModal()">ปิด</button>
    ${canManage?`<button class="btn btn-primary btn-sm" onclick="closeModal();openSchModal('${dateKey}')">➕ มอบหมายงาน</button><button class="btn btn-ghost btn-sm" onclick="closeModal();openOncallModal('${dateKey}')">🚨 กำหนดเวร</button>`:''}
    ${role==='technician'?`<button class="btn btn-ghost btn-sm" onclick="closeModal();openLeaveModal('${dateKey}')">📝 ขอลา</button>`:''}
  </div></div>`);
}

/* ─────── Assign Schedule Modal ─────── */
function openSchModal(prefillDate=''){
  const techs = SCH_DATA?.technicians||[];
  openModal(`<div class="modal"><div class="mh"><div class="mt">➕ มอบหมายตารางงาน</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="frow">
      <div class="fg"><label class="fl">ช่าง <span class="req">*</span></label>
        <select class="fc" id="sch-tech">
          <option value="">-- เลือกช่าง --</option>
          ${techs.map(t=>`<option value="${t.id}" data-name="${t.name}">${t.name}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label class="fl">วันที่ <span class="req">*</span></label><input class="fc" type="date" id="sch-date" value="${prefillDate}"></div>
    </div>
    <div class="frow">
      <div class="fg"><label class="fl">กะงาน</label>
        <select class="fc" id="sch-shift">
          <option value="เช้า">☀️ กะเช้า (08:00-16:00)</option>
          <option value="บ่าย">🌤️ กะบ่าย (16:00-00:00)</option>
          <option value="ดึก">🌙 กะดึก (00:00-08:00)</option>
          <option value="พิเศษ">⚡ พิเศษ</option>
        </select>
      </div>
      <div class="fg"><label class="fl">ประเภท</label>
        <select class="fc" id="sch-type">
          <option value="ปกติ">ปกติ</option>
          <option value="OT">OT</option>
          <option value="วันหยุด">วันหยุด</option>
        </select>
      </div>
    </div>
    <div class="fg"><label class="fl">หมายเหตุ</label><input class="fc" id="sch-note" placeholder="หมายเหตุ (ไม่บังคับ)"></div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="submitSchEntry()">✅ บันทึก</button></div></div>`);
}

async function submitSchEntry(){
  const techSel = document.getElementById('sch-tech');
  const tech_id = techSel?.value;
  const tech_name = techSel?.options[techSel.selectedIndex]?.dataset.name;
  const date = document.getElementById('sch-date')?.value;
  const shift = document.getElementById('sch-shift')?.value;
  const type  = document.getElementById('sch-type')?.value;
  const note  = document.getElementById('sch-note')?.value;
  if(!tech_id||!date){ toast('กรุณาเลือกช่างและวันที่','warn'); return; }
  try {
    const r=await apiFetch('/schedule',{method:'POST',body:JSON.stringify({tech_id,tech_name,date,shift,type,note})});
    toast(r.message); closeModal(); loadSchData();
  } catch(e){ toast(e.message,'err'); }
}

async function deleteSchEntry(id, dateKey){
  if(!confirm('ลบตารางงานนี้?')) return;
  try { const r=await apiFetch(`/schedule/${id}`,{method:'DELETE'}); toast(r.message); closeModal(); loadSchData(); } catch(e){ toast(e.message,'err'); }
}

/* ─────── On-Call Modal ─────── */
function openOncallModal(prefillDate=''){
  const techs = SCH_DATA?.technicians||[];
  openModal(`<div class="modal"><div class="mh"><div class="mt">🚨 กำหนดเวรฉุกเฉิน</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="frow">
      <div class="fg"><label class="fl">ช่างรับเวร <span class="req">*</span></label>
        <select class="fc" id="oc-tech">
          <option value="">-- เลือกช่าง --</option>
          ${techs.map(t=>`<option value="${t.id}" data-name="${t.name}">${t.name}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label class="fl">วันที่ <span class="req">*</span></label><input class="fc" type="date" id="oc-date" value="${prefillDate}"></div>
    </div>
    <div class="fg"><label class="fl">หมายเหตุ</label><input class="fc" id="oc-note" placeholder="เช่น เวรประจำสัปดาห์, หมุนเวียน"></div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="submitOncall()">✅ กำหนดเวร</button></div></div>`);
}

async function submitOncall(){
  const techSel=document.getElementById('oc-tech');
  const tech_id=techSel?.value;
  const tech_name=techSel?.options[techSel.selectedIndex]?.dataset.name;
  const date=document.getElementById('oc-date')?.value;
  const note=document.getElementById('oc-note')?.value;
  if(!tech_id||!date){ toast('กรุณาเลือกช่างและวันที่','warn'); return; }
  try {
    const r=await apiFetch('/schedule/oncall',{method:'POST',body:JSON.stringify({tech_id,tech_name,date,note})});
    toast(r.message); closeModal(); loadSchData();
  } catch(e){ toast(e.message,'err'); }
}

async function deleteOncall(id){
  if(!confirm('ลบเวรฉุกเฉินนี้?')) return;
  try { const r=await apiFetch(`/schedule/oncall/${id}`,{method:'DELETE'}); toast(r.message); closeModal(); loadSchData(); } catch(e){ toast(e.message,'err'); }
}

/* ─────── Leave Modal ─────── */
function openLeaveModal(prefillDate=''){
  openModal(`<div class="modal"><div class="mh"><div class="mt">📝 ยื่นคำขอลา</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="frow">
      <div class="fg"><label class="fl">วันที่เริ่มลา <span class="req">*</span></label><input class="fc" type="date" id="lv-start" value="${prefillDate}"></div>
      <div class="fg"><label class="fl">วันที่สิ้นสุด</label><input class="fc" type="date" id="lv-end" value="${prefillDate}"></div>
    </div>
    <div class="fg"><label class="fl">ประเภทการลา</label>
      <select class="fc" id="lv-type">
        <option value="ลาป่วย">🤒 ลาป่วย</option>
        <option value="ลากิจ">📋 ลากิจ</option>
        <option value="ลาพักร้อน">🏖️ ลาพักร้อน</option>
        <option value="หยุดชดเชย">🔄 หยุดชดเชย</option>
      </select>
    </div>
    <div class="fg"><label class="fl">เหตุผล</label><textarea class="fc" id="lv-reason" rows="2" placeholder="ระบุเหตุผลการลา..."></textarea></div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="submitLeave()">✅ ยื่นคำขอ</button></div></div>`);
}

async function submitLeave(){
  const start_date=document.getElementById('lv-start')?.value;
  const end_date=document.getElementById('lv-end')?.value||start_date;
  const type=document.getElementById('lv-type')?.value;
  const reason=document.getElementById('lv-reason')?.value;
  if(!start_date){ toast('กรุณาระบุวันที่','warn'); return; }
  try {
    const r=await apiFetch('/schedule/leaves',{method:'POST',body:JSON.stringify({start_date,end_date,type,reason})});
    toast(r.message); closeModal(); loadSchData();
  } catch(e){ toast(e.message,'err'); }
}

/* ─────── Leave List Tab ─────── */
function renderLeavesList(leaves, canManage){
  const el=document.getElementById('sch-leaves');
  if(!el) return;
  const statusColor={'รออนุมัติ':'b-amber','อนุมัติ':'b-green','ไม่อนุมัติ':'b-red'};
  el.innerHTML=`
  <div class="card">
    <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
      <div class="card-t">📝 คำขอลาทั้งหมด</div>
      ${APP.user?.role==='technician'?`<button class="btn btn-primary btn-sm" onclick="openLeaveModal()">➕ ขอลาใหม่</button>`:''}
    </div>
    <div class="tw"><table>
      <thead><tr><th>ชื่อช่าง</th><th>ประเภท</th><th>วันเริ่มลา</th><th>วันสิ้นสุด</th><th>เหตุผล</th><th>สถานะ</th>${canManage?'<th>จัดการ</th>':''}</tr></thead>
      <tbody>
      ${leaves.length ? leaves.map(l=>`<tr>
        <td><strong>${l.tech_name||'–'}</strong></td>
        <td>${l.type||'–'}</td>
        <td class="text-xs">${fmtDate(l.start_date)}</td>
        <td class="text-xs">${fmtDate(l.end_date)}</td>
        <td class="text-xs">${l.reason||'–'}</td>
        <td><span class="badge ${statusColor[l.status]||'b-gray'}">${l.status}</span></td>
        ${canManage&&l.status==='รออนุมัติ'?`<td style="white-space:nowrap">
          <button class="btn btn-success btn-sm" onclick="approveLeave('${l.id}','อนุมัติ')">✅ อนุมัติ</button>
          <button class="btn btn-danger btn-sm" onclick="approveLeave('${l.id}','ไม่อนุมัติ')">✕ ปฏิเสธ</button>
        </td>`:canManage?`<td>–</td>`:''}
      </tr>`).join('') : `<tr><td colspan="${canManage?7:6}">${emptyState('📝','ไม่มีคำขอลา')}</td></tr>`}
      </tbody>
    </table></div>
  </div>`;
}

async function approveLeave(id, status){
  if(!confirm(`${status==='อนุมัติ'?'อนุมัติ':'ปฏิเสธ'}คำขอลานี้?`)) return;
  try { const r=await apiFetch(`/schedule/leaves/${id}`,{method:'PATCH',body:JSON.stringify({status})}); toast(r.message); loadSchData(); } catch(e){ toast(e.message,'err'); }
}

/* ─────── On-Call Tab ─────── */
function renderOncallTab(oncall, techs){
  const el=document.getElementById('sch-oncall');
  if(!el) return;
  el.innerHTML=`
  <div class="g2 mb2">
    <div class="card">
      <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
        <div class="card-t">🚨 เวรฉุกเฉินประจำเดือน</div>
        <button class="btn btn-primary btn-sm" onclick="openOncallModal()">➕ กำหนดเวร</button>
      </div>
      <div class="card-b" style="padding:0">
        ${oncall.length ? oncall.map(o=>`
          <div class="flex jb ic" style="padding:.625rem 1.25rem;border-bottom:1px solid var(--wire)">
            <div>
              <div style="font-weight:700;font-size:.82rem">${fmtDate(o.date)}</div>
              <div class="text-muted text-xs">${o.tech_name}</div>
              ${o.note?`<div class="text-xs text-muted">${o.note}</div>`:''}
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteOncall('${o.id}')">✕</button>
          </div>`).join('') : `<div style="padding:1.5rem">${emptyState('🚨','ยังไม่มีเวรฉุกเฉิน')}</div>`}
      </div>
    </div>

    <!-- Rotation Suggestion -->
    <div class="card">
      <div class="card-h"><div class="card-t">🔄 ข้อมูลช่าง</div></div>
      <div class="card-b" style="display:flex;flex-direction:column;gap:.5rem">
        ${techs.map(t=>{
          const myOncall = oncall.filter(o=>o.tech_id===t.id).length;
          return`<div class="flex jb ic">
            <div>
              <div style="font-size:.82rem;font-weight:600">${t.name}</div>
              <div class="text-xs text-muted">${t.email||'–'}</div>
            </div>
            <span class="badge ${myOncall>=3?'b-red':myOncall>=1?'b-amber':'b-gray'}">${myOncall} เวร</span>
          </div>`;
        }).join('')||emptyState('👷','ไม่มีช่าง')}
      </div>
    </div>
  </div>`;
}

/* ─────── Helpers ─────── */
function isoToDateKey(iso){
  if(!iso) return '';
  const d = iso.includes('T') ? new Date(iso) : new Date(iso+'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function iterDays(startIso, endIso, cb){
  const s=new Date(startIso?.includes('T')?startIso:startIso+'T00:00:00');
  const e=new Date(endIso?.includes('T')?endIso:endIso+'T23:59:59');
  const cur=new Date(s);
  while(cur<=e){ cb(isoToDateKey(cur.toISOString())); cur.setDate(cur.getDate()+1); }
}
