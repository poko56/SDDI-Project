/* ═══════════════════════════════════════
   PAGE: PROFILE & SECURITY
   Allows users to update info and change password
═══════════════════════════════════════ */
async function pageProfile() {
  const c = document.getElementById('page-content');
  c.innerHTML = loadingState();

  try {
    const u = await apiFetch('/auth/me');
    APP.user = u; // Refresh local state
    saveApp();

    c.innerHTML = `
      <div style="max-width:800px;margin:0 auto">
        <div class="flex ic jb mb2">
          <div>
            <div style="font-size:1.15rem;font-weight:700">👤 โปรไฟล์ของฉัน</div>
            <div class="text-muted text-xs">จัดการข้อมูลส่วนตัวและความปลอดภัยของบัญชี</div>
          </div>
          <div class="badge ${u.is_active?'b-green':'b-red'}">${u.is_active?'บัญชีปกติ':'ถูกระงับ'}</div>
        </div>

        <div class="g2">
          <!-- Personal Info Card -->
          <div class="card">
            <div class="card-h"><div class="card-t">📝 ข้อมูลส่วนตัว</div></div>
            <div class="card-b">
              <div class="fg"><label class="fl">ชื่อ-นามสกุล</label><input class="fc" id="p-name" value="${u.name||''}"></div>
              <div class="fg"><label class="fl">อีเมล (สมัครสมาชิก)</label><input class="fc" value="${u.email}" disabled style="opacity:.6;cursor:not-allowed"></div>
              <div class="frow">
                <div class="fg"><label class="fl">รหัสนักศึกษา/พนักงาน</label><input class="fc" id="p-sid" value="${u.student_id||''}"></div>
                <div class="fg"><label class="fl">สาขา/แผนก</label><input class="fc" id="p-dept" value="${u.department||''}"></div>
              </div>
              <div class="fg"><label class="fl">เบอร์โทรศัพท์</label><input class="fc" id="p-phone" value="${u.phone||''}" placeholder="08x-xxx-xxxx"></div>
              <button class="btn btn-primary btn-block mt2" onclick="updateProfile()">✅ บันทึกข้อมูล</button>
            </div>
          </div>

          <!-- Security Card -->
          <div class="card">
            <div class="card-h"><div class="card-t">🛡️ ความปลอดภัย</div></div>
            <div class="card-b">
              <p class="text-xs text-muted mb2">รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร</p>
              <div class="fg"><label class="fl">รหัสผ่านเดิม</label><input class="fc" id="p-old-pw" type="password" placeholder="••••••••"></div>
              <div class="fg"><label class="fl">รหัสผ่านใหม่</label><input class="fc" id="p-new-pw" type="password" placeholder="••••••••"></div>
              <div class="fg"><label class="fl">ยืนยันรหัสผ่านใหม่</label><input class="fc" id="p-new-pw2" type="password" placeholder="••••••••"></div>
              <button class="btn btn-amber btn-block mt2" style="background:var(--red);border-color:var(--red)" onclick="changePassword()">🔑 เปลี่ยนรหัสผ่าน</button>
            </div>
          </div>
        </div>

        <!-- Role Badge Info -->
        <div class="alert al-info mt2" style="display:flex;align-items:center;gap:1rem">
          <div style="font-size:1.5rem">🎖️</div>
          <div>
            <div style="font-weight:700">บทบาทปัจจุบัน: ${u.role?.toUpperCase()}</div>
            <div class="text-xs" style="opacity:.8">สิทธิ์การใช้งานของคุณถูกกำหนดโดย Admin หากต้องการเปลี่ยนสิทธิ์กรุณาติดต่อผู้ดูแลระบบ</div>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    c.innerHTML = `<div class="alert al-danger">❌ ${e.message}</div>`;
  }
}

async function updateProfile() {
  const name = document.getElementById('p-name').value.trim();
  const student_id = document.getElementById('p-sid').value.trim();
  const department = document.getElementById('p-dept').value.trim();
  const phone = document.getElementById('p-phone').value.trim();

  if (!name) return toast('กรุณาระบุชื่อ-นามสกุล', 'warn');

  try {
    const res = await apiFetch('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, student_id, department, phone })
    });
    toast(res.message);
    pageProfile(); // Reload
  } catch (e) { toast(e.message, 'err'); }
}

async function changePassword() {
  const old_password = document.getElementById('p-old-pw').value;
  const new_password = document.getElementById('p-new-pw').value;
  const confirm_password = document.getElementById('p-new-pw2').value;

  if (!old_password || !new_password) return toast('กรุณากรอกรหัสผ่านให้ครบ', 'warn');
  if (new_password.length < 6) return toast('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 'warn');
  if (new_password !== confirm_password) return toast('รหัสผ่านใหม่ไม่ตรงกัน', 'warn');

  try {
    const res = await apiFetch('/auth/profile/password', {
      method: 'PATCH',
      body: JSON.stringify({ old_password, new_password })
    });
    toast(res.message);
    document.getElementById('p-old-pw').value = '';
    document.getElementById('p-new-pw').value = '';
    document.getElementById('p-new-pw2').value = '';
  } catch (e) { toast(e.message, 'err'); }
}
