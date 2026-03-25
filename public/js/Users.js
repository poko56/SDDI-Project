/* ═══════════════════════════════════════
   PAGE: USERS & PROFILE
═══════════════════════════════════════ */
async function pageUsers(){
  const c=document.getElementById('page-content');
  c.innerHTML = loadingState();
  try {
    const users = await apiFetch('/users');
    let st={admin:0,manager:0,technician:0,user:0};
    users.forEach(u=>st[u.role]=(st[u.role]||0)+1);

    c.innerHTML=`
    <div class="stats-grid mb2">
      ${Object.entries(st).map(([r,v])=>`
      <div class="scard"><div class="scard-lbl" style="margin-bottom:.5rem">${roleBadge(r)}</div><div class="scard-val">${v}</div></div>
      `).join('')}
    </div>
    <div class="card">
      <div class="tw"><table>
        <thead><tr><th>ผู้ใช้</th><th>อีเมล</th><th>บทบาท</th><th>รหัส นศ./แผนก</th><th>วันที่สมัคร</th><th>จัดการ</th></tr></thead>
        <tbody>
          ${users.map(u=>`<tr>
            <td>
              <div class="flex ic gap2">
                <div style="width:32px;height:32px;background:var(--spark2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff">${u.name[0]}</div>
                <strong>${u.name}</strong>
              </div>
            </td>
            <td class="text-sm">${u.email}</td>
            <td>${roleBadge(u.role)}</td>
            <td class="text-sm" style="color:var(--chalk2)">
              <div>${u.student_id||'-'}</div>
              <div>${u.department||'-'}</div>
            </td>
            <td class="text-xs" style="color:var(--chalk3)">${fmtDate(u.created_at,true)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick='openRoleModal(${JSON.stringify(u).replace(/'/g,"&#39;")})'>✎ เปลี่ยนสิทธิ์</button></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  } catch(e) { c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}

function openRoleModal(u){
  openModal(`<div class="modal"><div class="mh"><div class="mt">👤 จัดการสิทธิ์การใช้งาน</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="alert al-info mb2">ชื่อ: <strong>${u.name}</strong><br>อีเมล: ${u.email}</div>
    <div class="fg"><label class="fl">ระบุสิทธิ์ใหม่</label>
      <select class="fc" id="ur-s">
        <option value="user" ${u.role==='user'?'selected':''}>👤 ผู้ใช้ทั่วไป (General User)</option>
        <option value="technician" ${u.role==='technician'?'selected':''}>🔧 ช่างซ่อม (Technician)</option>
        <option value="manager" ${u.role==='manager'?'selected':''}>📋 หัวหน้าช่าง (Manager)</option>
        <option value="admin" ${u.role==='admin'?'selected':''}>🛡️ ผู้ดูแลระบบ (Admin)</option>
      </select>
    </div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="doChangeRole('${u.id}')">✅ บันทึก</button></div></div>`);
}

async function doChangeRole(id){
  const nr=document.getElementById('ur-s').value;
  try {
    const res = await apiFetch(`/users/${id}/role`, { method:'PATCH', body:JSON.stringify({ role: nr }) });
    toast(res.message);
    closeModal();
    pageUsers();
  } catch(e) { toast(e.message, 'err'); }
}

function pageProfile(){
  const c=document.getElementById('page-content');
  const u=APP.user;
  
  c.innerHTML=`
  <div style="max-width:600px;margin:0 auto">
    <div class="card mb">
      <div class="card-b" style="text-align:center;padding:3rem 1rem">
        <div style="width:80px;height:80px;background:linear-gradient(135deg,var(--spark2),var(--violet));border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;font-weight:700;color:#fff;margin:0 auto 1rem;box-shadow:0 10px 20px rgba(0,0,0,0.3)">${u.name[0]}</div>
        <h2 style="margin-bottom:.5rem">${u.name}</h2>
        <div style="margin-bottom:1.5rem">${roleBadge(u.role)}</div>
        <div class="g2" style="text-align:left;background:var(--ink2);padding:1.5rem;border-radius:var(--r2)">
          <div><div class="text-xs" style="color:var(--chalk3);margin-bottom:4px">อีเมล</div><div style="font-weight:600">${u.email}</div></div>
          <div><div class="text-xs" style="color:var(--chalk3);margin-bottom:4px">รหัสนักศึกษา / รหัสพนักงาน</div><div style="font-weight:600">${u.student_id||'-'}</div></div>
          <div><div class="text-xs" style="color:var(--chalk3);margin-bottom:4px">สาขา / แผนก</div><div style="font-weight:600">${u.department||'-'}</div></div>
          <div><div class="text-xs" style="color:var(--chalk3);margin-bottom:4px">วันที่สมัคร</div><div style="font-weight:600">${fmtDate(u.created_at,true)}</div></div>
        </div>
      </div>
    </div>
    <div style="text-align:center">
      <button class="btn btn-ghost" style="color:var(--red);border-color:rgba(255,71,87,0.3)" onclick="logout()">ออกจากระบบ</button>
    </div>
  </div>`;
}
