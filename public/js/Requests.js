/* ═══════════════════════════════════════
   PAGE: REQUESTS LIST
═══════════════════════════════════════ */
let _flt={};
async function pageRequestsList(flt={}){
  _flt=flt;
  const c=document.getElementById('page-content');
  const role=APP.user.role;
  const canCreate=['user','manager','admin'].includes(role);
  const canAssign=['manager','admin'].includes(role);

  c.innerHTML = loadingState();

  try {
    let q = new URLSearchParams(flt).toString();
    const data = await apiFetch(`/requests?${q}`);
    const reqs = data.items;
    const statsData = await apiFetch('/requests/stats');

    c.innerHTML=`
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
      ${[['⏳',statsData.pending,'รอดำเนินการ','c-amber','รอดำเนินการ'],['⚙️',statsData.in_progress,'กำลังดำเนินการ','c-blue','กำลังดำเนินการ'],['✅',statsData.done,'เสร็จสมบูรณ์','c-green','เสร็จสมบูรณ์']].map(([ico,val,lbl,cls,sf])=>`
      <div class="scard ${cls}" style="cursor:pointer" onclick="pageRequestsList({status:'${sf}'})">
        <div class="scard-row"><div class="scard-ico">${ico}</div></div>
        <div class="scard-val">${val||0}</div><div class="scard-lbl">${lbl}</div>
        <div class="scard-bar"></div>
      </div>`).join('')}
    </div>

    <div class="card">
      <div style="padding:.875rem 1.25rem;border-bottom:1px solid var(--wire);display:flex;flex-wrap:wrap;gap:.625rem;align-items:flex-end">
        <div class="fg" style="flex:2 1 200px;margin:0">
          <label class="fl">ค้นหา</label>
          <div class="igrp"><input class="fc" id="f-s" placeholder="Tracking ID / รายละเอียด..." value="${flt.search||''}"><button class="btn btn-primary" onclick="applyF()">🔍</button></div>
        </div>
        <div class="fg" style="flex:1 1 130px;margin:0"><label class="fl">สถานะ</label><select class="fc" id="f-st" onchange="applyF()"><option value="">ทั้งหมด</option>${['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์','ต้องส่งซ่อมภายนอก'].map(s=>`<option${flt.status===s?' selected':''}>${s}</option>`).join('')}</select></div>
        <div class="fg" style="flex:1 1 120px;margin:0"><label class="fl">ประเภท</label><select class="fc" id="f-ct" onchange="applyF()"><option value="">ทั้งหมด</option>${['ไฟฟ้า','ประปา','โครงสร้าง','อุปกรณ์อิเล็กทรอนิกส์','เครื่องปรับอากาศ'].map(s=>`<option${flt.category===s?' selected':''}>${s}</option>`).join('')}</select></div>
        <div class="fg" style="flex:1 1 120px;margin:0"><label class="fl">ความเร่งด่วน</label><select class="fc" id="f-ur" onchange="applyF()"><option value="">ทั้งหมด</option>${['ฉุกเฉิน','เร่งด่วน','ปกติ','ไม่เร่งด่วน'].map(s=>`<option${flt.urgency===s?' selected':''}>${s}</option>`).join('')}</select></div>
        <div style="align-self:flex-end;display:flex;gap:.375rem">
          <button class="btn btn-ghost btn-sm" onclick="pageRequestsList({})">↺</button>
          ${canCreate?`<button class="btn btn-primary btn-sm" onclick="switchPage('request-new')">➕ แจ้งซ่อม</button>`:''}
        </div>
      </div>
      <div style="padding:.6rem 1.25rem;border-bottom:1px solid var(--wire)"><span class="text-muted">พบ <strong style="color:var(--chalk)">${data.total}</strong> รายการ</span></div>
      <div class="tw"><table>
        <thead><tr><th>Tracking ID</th><th>ประเภท</th><th>รายละเอียด</th><th>สถานที่</th><th>ความเร่งด่วน</th><th>สถานะ</th>${canAssign?'<th>ช่าง</th>':''}<th>วันที่แจ้ง</th><th></th></tr></thead>
        <tbody>
          ${reqs.length?reqs.map(r=>{
            const overdue = r.sla_deadline && new Date(r.sla_deadline)<new Date() && r.status!=='เสร็จสมบูรณ์';
            return`<tr${overdue?' style="background:rgba(255,71,87,0.04)"':''}>
              <td><span class="tid">${r.tracking_id}</span>${overdue?'<br><span class="badge b-red" style="font-size:.6rem;margin-top:2px">⏰ เกิน SLA</span>':''}</td>
              <td><span style="font-size:.95rem">${catIcon(r.category)}</span> <span class="text-sm">${r.category}</span></td>
              <td><div style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.description}</div><div class="text-xs" style="color:var(--chalk3)">${r.requester_name||'–'}</div></td>
              <td class="text-sm">${r.location||'–'}</td>
              <td>${uBadge(r.urgency)}</td>
              <td>${sBadge(r.status)}</td>
              ${canAssign?`<td class="text-sm">${r.tech_name||'<span class="text-muted">–</span>'}</td>`:''}
              <td><div class="text-xs">${fmtDate(r.created_at,true)}</div></td>
              <td style="white-space:nowrap">
                <button class="btn btn-ghost btn-sm" onclick="switchPage('request-detail',{id:'${r.id}'})">ดู →</button>
                ${canAssign&&r.status==='รอดำเนินการ'?`<button class="btn btn-primary btn-sm" style="margin-top:2px;display:block" onclick="openAssignModal('${r.id}','${r.tracking_id}')">มอบหมาย</button>`:''}
              </td>
            </tr>`;
          }).join(''):`<tr><td colspan="${canAssign?9:8}">${emptyState('📭','ไม่มีรายการที่ตรงกับเงื่อนไข')}</td></tr>`}
        </tbody>
      </table></div>
    </div>`;
  } catch(e){ c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}

function applyF(){
  const f={};
  const s=document.getElementById('f-s')?.value;const st=document.getElementById('f-st')?.value;const ct=document.getElementById('f-ct')?.value;const ur=document.getElementById('f-ur')?.value;
  if(s)f.search=s;if(st)f.status=st;if(ct)f.category=ct;if(ur)f.urgency=ur;
  pageRequestsList(f);
}

async function openAssignModal(reqId,tid){
  try {
    const techs = await apiFetch('/users?role=technician');
    openModal(`<div class="modal"><div class="mh"><div class="mt">👷 มอบหมายช่างซ่อม</div><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb2">
      <div class="alert al-info">📋 งาน: <strong>${tid}</strong></div>
      <div class="fg"><label class="fl">เลือกช่าง <span class="req">*</span></label><select class="fc" id="a-tech"><option value="">-- เลือกช่าง --</option>${techs.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
      <div style="display:grid;gap:.5rem">${techs.map(t=>`<div style="padding:.6rem .875rem;background:var(--ink3);border-radius:var(--r);border:1px solid var(--wire);display:flex;justify-content:space-between;align-items:center;font-size:.8rem"><div><strong>${t.name}</strong> <span class="text-muted">${t.department||''}</span></div></div>`).join('')}</div>
    </div>
    <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="doAssign('${reqId}')">✅ ยืนยัน</button></div></div>`);
  } catch(e){ toast('โหลดช่างไม่สำเร็จ ' + e.message, 'err'); }
}

async function doAssign(reqId){
  const techId=document.getElementById('a-tech').value;
  if(!techId){toast('กรุณาเลือกช่าง','warn');return;}
  try {
    const res = await apiFetch(`/requests/${reqId}/assign`, { method:'PATCH', body:JSON.stringify({ tech_id: techId }) });
    toast(res.message);
    closeModal();
    pageRequestsList(_flt);
  } catch(e){ toast(e.message, 'err'); }
}

/* ═══════════════════════════════════════
   PAGE: NEW REQUEST
═══════════════════════════════════════ */
let _locData={};
function pageNewRequest(){
  const c=document.getElementById('page-content');
  const buildings=['อาคาร A','อาคาร B','อาคาร C','อาคาร D'];
  const locMap={'อาคาร A':{floor:['ชั้น 1','ชั้น 2','ชั้น 3'],rooms:{'ชั้น 1':['ห้อง 101','ห้อง 102','ห้อง 103'],'ชั้น 2':['ห้อง 201','ห้อง 202'],'ชั้น 3':['ห้อง 301']}},'อาคาร B':{floor:['ชั้น 1','ชั้น 2'],rooms:{'ชั้น 1':['ห้องปฏิบัติการ 1','ห้องปฏิบัติการ 2'],'ชั้น 2':['ห้องประชุม','ห้องอาจารย์']}},'อาคาร C':{floor:['ชั้น 1','ชั้น 2'],rooms:{'ชั้น 1':['สำนักงาน','ห้องน้ำ ชั้น 1'],'ชั้น 2':['ห้องผู้อำนวยการ']}},'อาคาร D':{floor:['ชั้น 1','ชั้น 2','ชั้น 3'],rooms:{'ชั้น 1':['ห้องพัก 101','ห้องพัก 102'],'ชั้น 2':['ห้องพัก 201','ห้องพัก 202'],'ชั้น 3':['ห้องพัก 301']}}};
  _locData=locMap;

  c.innerHTML=`
  <div style="max-width:720px;margin:0 auto">
    <div class="card">
      <div class="card-h"><div class="card-t">➕ แบบฟอร์มแจ้งซ่อม</div><button class="btn btn-ghost btn-sm" onclick="switchPage('requests-list')">← กลับ</button></div>
      <div class="card-b">
        <div id="req-alert"></div>

        <div style="margin-bottom:1.5rem">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--chalk3);margin-bottom:.75rem">1. ประเภทปัญหา</div>
          <div class="cat-grid">
            ${[['ไฟฟ้า','⚡'],['ประปา','💧'],['โครงสร้าง','🏗️'],['อุปกรณ์อิเล็กทรอนิกส์','💻'],['เครื่องปรับอากาศ','❄️']].map(([cat,ico])=>`
            <div class="catcard" id="c-${cat}" onclick="selCat('${cat}',this)">
              <div class="cc-i">${ico}</div><div class="cc-t">${cat}</div>
            </div>`).join('')}
          </div>
          <input type="hidden" id="req-cat">
        </div>

        <div style="margin-bottom:1.5rem">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--chalk3);margin-bottom:.75rem">2. สถานที่เกิดเหตุ</div>
          <div class="frow3">
            <div class="fg"><label class="fl">อาคาร</label><select class="fc" id="req-bld" onchange="upFloor()"><option value="">-- เลือก --</option>${buildings.map(b=>`<option>${b}</option>`).join('')}</select></div>
            <div class="fg"><label class="fl">ชั้น</label><select class="fc" id="req-fl" onchange="upRoom()" disabled><option value="">-- เลือก --</option></select></div>
            <div class="fg"><label class="fl">ห้อง</label><select class="fc" id="req-rm" disabled><option value="">-- เลือก --</option></select></div>
          </div>
        </div>

        <div style="margin-bottom:1.5rem">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--chalk3);margin-bottom:.75rem">3. รายละเอียดปัญหา</div>
          <div class="fg"><textarea class="fc" id="req-desc" rows="4" placeholder="อธิบายรายละเอียดปัญหา..."></textarea></div>
        </div>

        <div style="margin-bottom:1.5rem">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--chalk3);margin-bottom:.75rem">4. ระดับความเร่งด่วน</div>
          <div class="u-grid">
            ${[['ฉุกเฉิน','u-red','🚨','ต้องดำเนินการทันที — อันตราย/กระทบรุนแรง'],['เร่งด่วน','u-amber','⚡','ภายใน 24 ชั่วโมง — กระทบการใช้งาน'],['ปกติ','u-green','📋','ภายใน 3 วันทำการ'],['ไม่เร่งด่วน','u-gray','📌','ภายใน 7 วันทำการ — ปรับปรุงทั่วไป']].map(([u,cls,ico,d])=>`
            <div class="ucard ${cls}" id="u-${u}" onclick="selUrg('${u}',this)">
              <div class="uc-t">${ico} ${u}</div><div class="uc-d">${d}</div>
            </div>`).join('')}
          </div>
          <input type="hidden" id="req-urg">
        </div>

        <div style="margin-bottom:1.5rem">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--chalk3);margin-bottom:.75rem">5. แนบรูปภาพ (ถ้ามี)</div>
          <div class="flex ic gap2" style="background:var(--ink3);padding:1rem;border-radius:var(--r);border:1px dashed var(--wire)">
            <label for="req-photo" class="btn btn-ghost" style="margin:0">📷 เลือกรูปภาพ</label>
            <input type="file" id="req-photo" style="display:none" onchange="previewImg(this, 'req-photo-preview')">
            <div id="req-photo-preview" class="text-xs text-muted">ไม่ได้เลือกไฟล์</div>
          </div>
        </div>

        <div style="display:flex;gap:.5rem;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="switchPage('requests-list')">ยกเลิก</button>
          <button class="btn btn-primary btn-lg" onclick="submitReq()" id="btn-submit-req">📨 ส่งคำขอแจ้งซ่อม</button>
        </div>
      </div>
    </div>
  </div>`;
}

function selCat(v,el){document.querySelectorAll('.catcard').forEach(e=>e.classList.remove('sel'));el.classList.add('sel');document.getElementById('req-cat').value=v;}
function selUrg(v,el){document.querySelectorAll('.ucard').forEach(e=>e.classList.remove('sel'));el.classList.add('sel');document.getElementById('req-urg').value=v;}
function upFloor(){
  const bld=document.getElementById('req-bld').value;
  const d=_locData[bld];
  const fs=document.getElementById('req-fl');
  fs.innerHTML='<option value="">-- เลือก --</option>'+(d?d.floor.map(f=>`<option>${f}</option>`).join(''):'');
  fs.disabled=!d;document.getElementById('req-rm').innerHTML='<option value="">-- เลือก --</option>';document.getElementById('req-rm').disabled=true;
}
function upRoom(){
  const bld=document.getElementById('req-bld').value;const fl=document.getElementById('req-fl').value;
  const rooms=_locData[bld]?.rooms[fl]||[];
  const rs=document.getElementById('req-rm');
  rs.innerHTML='<option value="">-- เลือก --</option>'+rooms.map(r=>`<option>${r}</option>`).join('');
  rs.disabled=!rooms.length;
}
async function submitReq(){
  const cat=document.getElementById('req-cat').value;
  const desc=document.getElementById('req-desc').value.trim();
  const urg=document.getElementById('req-urg').value;
  const bld=document.getElementById('req-bld').value;
  const fl=document.getElementById('req-fl').value;
  const rm=document.getElementById('req-rm').value;
  const alertEl=document.getElementById('req-alert');
  if(!cat){alertEl.innerHTML=`<div class="alert al-warn">⚠️ กรุณาเลือกประเภทปัญหา</div>`;return;}
  if(!desc){alertEl.innerHTML=`<div class="alert al-warn">⚠️ กรุณากรอกรายละเอียด</div>`;return;}
  if(!urg){alertEl.innerHTML=`<div class="alert al-warn">⚠️ กรุณาเลือกความเร่งด่วน</div>`;return;}
  
  const locationStr = bld && fl && rm ? `${bld} ${fl} ${rm}` : bld || 'ไม่ระบุ';

  document.getElementById('btn-submit-req').disabled = true;
  document.getElementById('btn-submit-req').innerHTML = 'กำลังบันทึก...';
  
  try {
    let photoUrl = null;
    const photoInput = document.getElementById('req-photo');
    if (photoInput && photoInput.files[0]) {
      const uploadRes = await uploadMedia(photoInput.files[0]);
      photoUrl = uploadRes.url;
    }

    const res = await apiFetch('/requests', {
      method: 'POST',
      body: JSON.stringify({ 
        category: cat, description: desc, urgency: urg, 
        location_detail: locationStr,
        image_urls: photoUrl ? [photoUrl] : [] 
      })
    });
    document.getElementById('page-content').innerHTML=`
      <div style="max-width:480px;margin:4rem auto;text-align:center">
        <div style="font-size:5rem;margin-bottom:1.5rem;animation:float 2s ease infinite">✅</div>
        <h2 style="color:var(--green);margin-bottom:.75rem;font-size:1.5rem">แจ้งซ่อมสำเร็จ!</h2>
        <p class="text-muted mb2">บันทึกหมายเลขติดตามงานของคุณ</p>
        <div class="track-box mb2">
          <div class="text-xs" style="color:var(--chalk3);margin-bottom:.5rem">หมายเลขติดตามงาน</div>
          <div class="track-id">${res.tracking_id}</div>
          <div class="text-xs" style="color:var(--chalk3);margin-top:.5rem">ใช้สำหรับติดตามสถานะ</div>
        </div>
        <div class="flex ic gap2" style="justify-content:center">
          <button class="btn btn-ghost" onclick="switchPage('track')">🔍 ติดตามงาน</button>
          <button class="btn btn-primary" onclick="switchPage('requests-list')">📋 ดูรายการ</button>
        </div>
      </div>`;
  } catch(e) {
    alertEl.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`;
    document.getElementById('btn-submit-req').disabled = false;
    document.getElementById('btn-submit-req').innerHTML = '📨 ส่งคำขอแจ้งซ่อม';
  }
}

/* ═══════════════════════════════════════
   PAGE: REQUEST DETAIL
═══════════════════════════════════════ */
async function pageRequestDetail(id){
  const c=document.getElementById('page-content');
  c.innerHTML = loadingState();
  try {
    const r = await apiFetch(`/requests/${id}`);
    const role=APP.user.role;
    const uid=APP.user.id;
    const eval_= r.evaluation;
    const overdue=r.sla_deadline&&new Date(r.sla_deadline)<new Date()&&r.status!=='เสร็จสมบูรณ์';
    const statusOrder=['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์'];
    const si=statusOrder.indexOf(r.status);
    const canTech=role==='technician'&&r.assigned_tech_id===uid;
    const canManager=['manager','admin'].includes(role);
    const canAssign=canManager&&!r.assigned_tech_id;
    const canEval=role==='user'&&r.requester_id===uid&&r.status==='เสร็จสมบูรณ์'&&!eval_;

    c.innerHTML=`
    <div style="max-width:820px;margin:0 auto">
      <div class="flex ic jb mb2" style="flex-wrap:wrap;gap:.5rem">
        <button class="btn btn-ghost btn-sm" onclick="switchPage('requests-list')">← กลับ</button>
        <div class="flex gap1 ic" style="flex-wrap:wrap">
          ${canAssign?`<button class="btn btn-spark btn-sm" onclick="doAutoAssign('${r.id}')" id="btn-auto-assign">🤖 Auto-Assign</button>`:''}
          ${canAssign?`<button class="btn btn-primary btn-sm" onclick="openAssignModal('${r.id}','${r.tracking_id}')">👷 มอบหมายช่าง</button>`:''}
          ${canTech&&r.status!=='เสร็จสมบูรณ์'?`<button class="btn btn-amber btn-sm" onclick="openStatusModal('${r.id}')">🔄 อัปเดตสถานะ</button>`:''}
          ${canEval?`<button class="btn btn-primary btn-sm" style="background:var(--amber);color:#000;border-color:var(--amber)" onclick="openEvalModal('${r.id}')">⭐ ประเมินงาน</button>`:''}
        </div>
      </div>

      <div class="card mb">
        <div class="card-h">
          <div><div class="flex ic gap1"><span class="tid">${r.tracking_id}</span>${overdue?'<span class="badge b-red">⏰ เกิน SLA</span>':''}</div><div class="text-muted text-xs" style="margin-top:3px">${catIcon(r.category)} ${r.category} · แจ้งเมื่อ ${fmtDate(r.created_at)}</div></div>
          <div class="flex gap1">${uBadge(r.urgency)} ${sBadge(r.status)}</div>
        </div>
        <div class="card-b">
          <div class="g2">
            <div><div class="text-xs" style="color:var(--chalk3);margin-bottom:3px">ผู้แจ้งซ่อม</div><div style="font-weight:700">${r.requester_name||'–'}</div></div>
            <div><div class="text-xs" style="color:var(--chalk3);margin-bottom:3px">สถานที่</div><div style="font-weight:700">${r.location||'–'}</div></div>
            <div><div class="text-xs" style="color:var(--chalk3);margin-bottom:3px">ช่างที่รับผิดชอบ</div><div style="font-weight:700">${r.tech_name?r.tech_name:'– ยังไม่ได้มอบหมาย –'}</div></div>
            <div><div class="text-xs" style="color:var(--chalk3);margin-bottom:3px">กำหนด SLA</div><div style="font-weight:700;color:${overdue?'var(--red)':'inherit'}">${fmtDate(r.sla_deadline)}</div></div>
          </div>
          <div class="text-xs" style="color:var(--chalk3);margin-bottom:5px">รายละเอียดปัญหา</div>
          <p style="line-height:1.8;font-size:.85rem">${r.description}</p>
          ${r.repair_detail?`<div class="alert al-info mt2">🔧 <strong>รายละเอียดการซ่อม:</strong> ${r.repair_detail}</div>`:''}

          <!-- Media Section -->
          ${(r.image_urls?.length || r.before_images?.length || r.after_images?.length) ? `
          <div class="divider"></div>
          <div class="text-xs" style="color:var(--chalk3);margin-bottom:10px">📷 รูปภาพหลักฐาน (Evidence)</div>
          <div class="flex gap2" style="flex-wrap:wrap">
            ${(r.image_urls||[]).map(url => `
              <div class="img-thumb" onclick="openImgModal('${url}')">
                <img src="${url}">
                <div class="img-lbl">รูปแจ้งซ่อม</div>
              </div>`).join('')}
            ${(r.before_images||[]).map(url => `
              <div class="img-thumb" onclick="openImgModal('${url}')">
                <img src="${url}">
                <div class="img-lbl" style="background:var(--amber);color:#000">ก่อนซ่อม</div>
              </div>`).join('')}
            ${(r.after_images||[]).map(url => `
              <div class="img-thumb" onclick="openImgModal('${url}')">
                <img src="${url}">
                <div class="img-lbl" style="background:var(--green)">หลังซ่อม</div>
              </div>`).join('')}
          </div>` : ''}
        </div>
      </div>

      <div class="card mb">
        <div class="card-h"><div class="card-t">⏱️ ความคืบหน้า</div></div>
        <div class="card-b">
          <div class="tl">
            ${statusOrder.map((s,i)=>`
              <div class="tl-step">
                <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                  <div class="tl-dot ${i<si?'done':i===si?'curr':''}">${i<si?'✓':i+1}</div>
                  <div class="tl-lbl ${i<si?'done':i===si?'curr':''}">${s}</div>
                </div>
              </div>
              ${i<statusOrder.length-1?`<div class="tl-line ${i<si?'done':''}"></div>`:''}`).join('')}
          </div>
          <div class="g2 mt2" style="font-size:.75rem;color:var(--chalk2)">
            <div>📅 มอบหมาย: <strong style="color:var(--chalk)">${fmtDate(r.assigned_at)}</strong></div>
            <div>✅ เสร็จ: <strong style="color:var(--chalk)">${fmtDate(r.completed_at)}</strong></div>
          </div>
        </div>
      </div>

      <div class="card mb">
        <div class="card-h"><div class="card-t">📦 วัสดุที่ใช้ในการซ่อม</div>${(canTech || canManager)?`<button class="btn btn-primary btn-xs" onclick="openWithdrawModal('${r.id}')">เบิกวัสดุ</button>`:''}</div>
        <div class="card-b" id="material-list-container">
          ${(r.materials_used && r.materials_used.length) ? `
            <div class="tw"><table>
              <thead><tr><th>วัสดุ</th><th class="tr">จำนวน</th><th class="tr">วันที่เบิก</th><th></th></tr></thead>
              <tbody>
                ${r.materials_used.map(m=>`<tr>
                  <td>${m.material_name}</td>
                  <td class="tr">${m.quantity_used} ${m.unit}</td>
                  <td class="tr text-xs text-muted">${fmtDate(m.withdrawn_at,true)}</td>
                  <td class="tr">${(canTech || canManager)?`<button class="btn btn-ghost btn-xs text-red" onclick="deleteWithdraw('${r.id}','${m.id}')">🗑️</button>`:''}</td>
                </tr>`).join('')}
              </tbody>
            </table></div>
          ` : `<div style="padding:1rem;color:var(--chalk3);font-size:.875rem" class="tc">ยังไม่มีการเบิกวัสดุ</div>`}
        </div>
      </div>

      ${eval_?`
      <div class="card">
        <div class="card-h"><div class="card-t">⭐ ผลการประเมิน</div><span class="badge b-amber">เฉลี่ย ${Number(eval_.avg_score).toFixed(2)}</span></div>
        <div class="card-b">
          <div class="g3">
            ${[['คุณภาพงาน',eval_.quality_score],['ความรวดเร็ว',eval_.speed_score],['การบริการ',eval_.service_score]].map(([l,s])=>`
            <div style="text-align:center;padding:1rem;background:var(--ink3);border-radius:var(--r2);border:1px solid var(--wire)">
              <div style="font-size:1.5rem;margin-bottom:.25rem">${'★'.repeat(s)}${'☆'.repeat(5-s)}</div>
              <div style="font-weight:700;color:var(--amber);font-family:var(--mono)">${s}/5</div>
              <div class="text-xs" style="color:var(--chalk2)">${l}</div>
            </div>`).join('')}
          </div>
          ${eval_.comment?`<div class="alert al-info mt2">💬 "${eval_.comment}"</div>`:''}
        </div>
      </div>`:''}
    </div>`;
  } catch(e) { c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}

function openStatusModal(reqId){
  openModal(`<div class="modal"><div class="mh"><div class="mt">🔄 อัปเดตสถานะ</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="fg"><label class="fl">สถานะใหม่</label>
      <select class="fc" id="ns"><option>กำลังดำเนินการ</option><option>รอตรวจสอบ</option><option>เสร็จสมบูรณ์</option><option>ต้องส่งซ่อมภายนอก</option></select>
    </div>
    <div class="fg"><label class="fl">รายละเอียดการดำเนินการ</label><textarea class="fc" id="rd" rows="4" placeholder="อธิบายสิ่งที่ทำ..."></textarea></div>
    
    <div class="g2">
      <div class="fg">
        <label class="fl">📸 รูปก่อนซ่อม</label>
        <div class="flex ic gap1" style="background:var(--ink3);padding:.5rem;border-radius:var(--r);border:1px dashed var(--wire)">
          <label for="img-before" class="btn btn-ghost btn-xs">📁 เลือก</label>
          <input type="file" id="img-before" style="display:none" onchange="previewImg(this, 'pre-before')">
          <div id="pre-before" class="text-xs"></div>
        </div>
      </div>
      <div class="fg">
        <label class="fl">📸 รูปหลังซ่อม</label>
        <div class="flex ic gap1" style="background:var(--ink3);padding:.5rem;border-radius:var(--r);border:1px dashed var(--wire)">
          <label for="img-after" class="btn btn-ghost btn-xs">📁 เลือก</label>
          <input type="file" id="img-after" style="display:none" onchange="previewImg(this, 'pre-after')">
          <div id="pre-after" class="text-xs"></div>
        </div>
      </div>
    </div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" id="btn-up-stat" onclick="doUpdateStatus('${reqId}')">✅ บันทึก</button></div></div>`);
}

async function doUpdateStatus(reqId){
  const status=document.getElementById('ns').value;const rd=document.getElementById('rd').value;
  const btn = document.getElementById('btn-up-stat');
  
  btn.disabled = true; btn.innerHTML = 'กำลังบันทึก...';
  
  try {
    let beforeUrl = null, afterUrl = null;
    const fBefore = document.getElementById('img-before').files[0];
    const fAfter = document.getElementById('img-after').files[0];
    
    if (fBefore) { const res = await uploadMedia(fBefore); beforeUrl = res.url; }
    if (fAfter) { const res = await uploadMedia(fAfter); afterUrl = res.url; }

    const body = { status, repair_detail:rd };
    if (beforeUrl) body.before_images = [beforeUrl];
    if (afterUrl) body.after_images = [afterUrl];

    const res = await apiFetch(`/requests/${reqId}/status`, { method:'PATCH', body:JSON.stringify(body) });
    toast(res.message);
    closeModal();
    pageRequestDetail(reqId);
  } catch(e){ 
    toast(e.message, 'err'); 
    btn.disabled = false; btn.innerHTML = '✅ บันทึก';
  }
}

function openEvalModal(reqId){
  openModal(`<div class="modal"><div class="mh"><div class="mt">⭐ ประเมินความพึงพอใจ</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <p class="text-muted mb2">กรุณาให้คะแนน 1–5 ดาวในแต่ละหัวข้อ</p>
    ${[['quality','คุณภาพงาน'],['speed','ความรวดเร็ว'],['service','การบริการ']].map(([k,l])=>`
    <div class="sg"><div class="sg-l">${l}</div>
    <div class="stars" id="st-${k}">${[1,2,3,4,5].map(n=>`<span class="star" data-v="${n}" onclick="setStar('${k}',${n})">★</span>`).join('')}</div>
    <input type="hidden" id="sc-${k}" value="0"></div>`).join('')}
    <div class="fg"><label class="fl">ความคิดเห็น</label><textarea class="fc" id="ec" rows="3" placeholder="บอกเราเพิ่มเติม..."></textarea></div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="doEval('${reqId}')">⭐ ส่ง</button></div></div>`);
}
function setStar(k,v){document.getElementById(`sc-${k}`).value=v;document.querySelectorAll(`#st-${k} .star`).forEach(s=>s.classList.toggle('on',parseInt(s.dataset.v)<=v));}
async function doEval(reqId){
  const q=parseInt(document.getElementById('sc-quality').value);const sp=parseInt(document.getElementById('sc-speed').value);const sv=parseInt(document.getElementById('sc-service').value);const cm=document.getElementById('ec').value;
  if(!q||!sp||!sv){toast('กรุณาให้คะแนนทุกหัวข้อ','warn');return;}
  try {
    const res = await apiFetch('/evaluations', { method:'POST', body:JSON.stringify({ request_id:reqId, quality_score:q, speed_score:sp, service_score:sv, comment:cm }) });
    toast(res.message);
    closeModal();
    pageRequestDetail(reqId);
  } catch(e){ toast(e.message, 'err'); }
}

/* ═══════════════════════════════════════
   PAGE: TRACK
═══════════════════════════════════════ */
function pageTrack(){
  document.getElementById('page-content').innerHTML=`
  <div style="max-width:600px;margin:0 auto">
    <div class="card">
      <div class="card-h"><div class="card-t">🔍 ติดตามสถานะงานซ่อม</div></div>
      <div class="card-b">
        <div class="fg"><label class="fl">หมายเลขติดตามงาน (Tracking ID)</label>
          <div class="igrp"><input class="fc" id="ti" placeholder="TRK-2568-xxxx" style="font-family:var(--mono);letter-spacing:.05em" onkeydown="if(event.key==='Enter')doTrack()"><button class="btn btn-primary" onclick="doTrack()">🔍 ค้นหา</button></div>
        </div>
        <div id="track-result"></div>
      </div>
    </div>
  </div>`;
}

async function doTrack(){
  const id=document.getElementById('ti').value.trim().toUpperCase();
  const el=document.getElementById('track-result');
  if(!id){el.innerHTML=`<div class="alert al-warn">⚠️ กรุณากรอก Tracking ID</div>`;return;}
  
  el.innerHTML = loadingState();

  try {
    const r = await apiFetch(`/requests/track/${id}`);
    const statusOrder=['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์'];
    const si=statusOrder.indexOf(r.status);
    el.innerHTML=`
      <div class="divider"></div>
      <div class="track-box mb2">
        <div class="text-xs" style="color:var(--chalk3);margin-bottom:.5rem">Tracking ID</div>
        <div class="track-id">${r.tracking_id}</div>
        <div class="flex gap2" style="justify-content:center;margin-top:.75rem">${uBadge(r.urgency)} ${sBadge(r.status)}</div>
      </div>
      <div class="g2 mb2" style="font-size:.8rem">
        ${[['📂','ประเภท',`${catIcon(r.category)} ${r.category}`],['📍','สถานที่',r.location||'–'],['👷','ช่างซ่อม',r.tech_name||'ยังไม่ได้มอบหมาย'],['📅','กำหนด SLA',fmtDate(r.sla_deadline)]].map(([ico,l,v])=>`
        <div style="padding:.625rem .875rem;background:var(--ink3);border-radius:var(--r);border:1px solid var(--wire)">
          <div class="text-xs" style="color:var(--chalk3);margin-bottom:3px">${ico} ${l}</div>
          <div style="font-weight:600">${v}</div>
        </div>`).join('')}
      </div>
      <p class="text-muted mb2" style="line-height:1.7">${r.description}</p>
      <div class="tl">
        ${statusOrder.map((s,i)=>`
          <div class="tl-step">
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <div class="tl-dot ${i<si?'done':i===si?'curr':''}">${i<si?'✓':i+1}</div>
              <div class="tl-lbl ${i<si?'done':i===si?'curr':''}">${s}</div>
            </div>
          </div>
          ${i<statusOrder.length-1?`<div class="tl-line ${i<si?'done':''}"></div>`:''}`).join('')}
      </div>
      ${r.repair_detail?`<div class="alert al-info mt2">🔧 ${r.repair_detail}</div>`:''}`;
  } catch(e) {
    el.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`;
  }
}

/* ═══════════════════════════════════════
   MATERIAL WITHDRAWAL HELPERS
═══════════════════════════════════════ */
async function openWithdrawModal(reqId) {
  try {
    const data = await apiFetch('/materials');
    const mats = data.items.filter(m => m.quantity > 0);
    openModal(`<div class="modal"><div class="mh"><div class="mt">📦 เบิกวัสดุอุปกรณ์</div><button class="mx" onclick="closeModal()">✕</button></div>
    <div class="mb2">
      <div class="fg"><label class="fl">วัสดุในคลัง <span class="req">*</span></label>
        <select class="fc" id="w-mat" onchange="upWUnit()">
          <option value="">-- เลือกวัสดุ --</option>
          ${mats.map(m=>`<option value="${m.id}" data-unit="${m.unit}" data-qty="${m.quantity}">${m.name} [คงเหลือ: ${m.quantity} ${m.unit}]</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label class="fl">จำนวนที่ใช้ <span class="req">*</span></label>
        <div class="igrp"><input type="number" class="fc" id="w-qty" step="0.1" min="0.1"><span class="btn btn-ghost" style="pointer-events:none" id="w-unit-lbl">-</span></div>
      </div>
    </div>
    <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="doWithdraw('${reqId}')">✅ ยืนยันการเบิก</button></div></div>`);
  } catch(e){ toast('โหลดรายการวัสดุไม่สำเร็จ ' + e.message, 'err'); }
}

function upWUnit() {
  const sel = document.getElementById('w-mat');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('w-unit-lbl').innerText = opt.dataset.unit || '-';
}

async function doWithdraw(reqId) {
  const mid = document.getElementById('w-mat').value;
  const qty = document.getElementById('w-qty').value;
  if(!mid || !qty) { toast('กรุณากรอกข้อมูลให้ครบ', 'warn'); return; }
  try {
    const res = await apiFetch(`/requests/${reqId}/materials`, { method:'POST', body:JSON.stringify({ material_id: mid, quantity_used: qty }) });
    toast(res.message);
    closeModal();
    pageRequestDetail(reqId);
  } catch(e){ toast(e.message, 'err'); }
}

async function deleteWithdraw(reqId, mid) {
  if(!confirm('ยืนยันระบบการยกเลิกการเบิกวัสดุ? (จะคืนสต็อกเข้าคลัง)')) return;
  try {
    const res = await apiFetch(`/requests/${reqId}/materials/${mid}`, { method:'DELETE' });
    toast(res.message);
    pageRequestDetail(reqId);
  } catch(e){ toast(e.message, 'err'); }
}

async function doAutoAssign(reqId) {
  const btn = document.getElementById('btn-auto-assign');
  btn.disabled = true;
  btn.innerHTML = '🤖 ประมวลผล...';
  try {
    const res = await apiFetch(`/requests/${reqId}/auto-assign`, { method:'POST' });
    toast(res.message);
    pageRequestDetail(reqId);
  } catch(e){ 
    toast(e.message, 'err');
    btn.disabled = false;
    btn.innerHTML = '🤖 Auto-Assign';
  }
}
