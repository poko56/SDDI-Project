/* ═══════════════════════════════════════
   PAGE: SETTINGS HUB (ADMIN/MANAGER)
   Consolidates User, Log, and Notif Settings
═══════════════════════════════════════ */
function pageSettings() {
  const c = document.getElementById('page-content');
  const role = APP.user?.role;
  if (!['admin', 'manager'].includes(role)) {
    c.innerHTML = `<div class="alert al-danger">❌ เฉพาะ Admin และ Manager เท่านั้น</div>`;
    return;
  }

  const items = [
    {
      id: 'users',
      title: '👥 จัดการผู้ใช้',
      desc: 'เพิ่ม, ลบ, แก้ไขข้อมูลสมาชิก และกำหนดสิทธิ์การใช้งานระบบ',
      icon: '👥',
      roles: ['admin', 'manager'],
      color: 'var(--blue)'
    },
    {
      id: 'system-log',
      title: '📋 บันทึกกิจกรรมระบบ',
      desc: 'ตรวจสอบประวัติการทำงานของระบบ (Audit Log) ย้อนหลัง',
      icon: '📋',
      roles: ['admin', 'manager'],
      color: 'var(--green)'
    },
    {
      id: 'notif-settings',
      title: '🔔 ตั้งค่าแจ้งเตือน',
      desc: 'กำหนดค่า SMTP, Twilio และเปิด/ปิดระบบกระจายงานอัตโนมัติ',
      icon: '🔔',
      roles: ['admin'],
      color: 'var(--amber)'
    }
  ];

  c.innerHTML = `
    <div style="max-width:960px">
      <div class="flex ic jb mb2">
        <div>
          <div style="font-size:1.1rem;font-weight:700;margin-bottom:.25rem">⚙️ ตั้งค่าระบบ (System Settings)</div>
          <div class="text-muted text-xs">เลือกจัดการส่วนงานต่างๆ ของระบบสำหรับผู้ดูแล</div>
        </div>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.25rem">
        ${items.filter(it => it.roles.includes(role)).map(it => `
          <div class="card hov" style="cursor:pointer;padding:1.5rem;transition:transform .2s ease" onclick="switchPage('${it.id}')">
            <div style="font-size:2.5rem;margin-bottom:1rem">${it.icon}</div>
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:.5rem">${it.title}</div>
            <p class="text-xs text-muted" style="line-height:1.6">${it.desc}</p>
            <div style="margin-top:1.5rem;display:flex;justify-content:flex-end">
              <span class="btn btn-ghost btn-xs" style="color:${it.color}">จัดการส่วนนี้ →</span>
            </div>
          </div>
        `).join('')}
      </div>

      ${role === 'admin' ? `
        <div class="divider" style="margin:2.5rem 0"></div>
        <div class="card" style="border-color:rgba(255,71,87,0.3);background:rgba(255,71,87,0.03)">
          <div class="card-h"><div class="card-t" style="color:var(--red)">🚨 พื้นที่อันตราย (Danger Zone)</div></div>
          <div class="card-b flex ic jb">
            <div>
              <div style="font-weight:700;margin-bottom:.25rem">ล้างข้อมูลระบบทั้งหมด (Factory Reset)</div>
              <div class="text-xs text-muted">ลบข้อมูลงานซ่อม, วัสดุ, ใบสั่งซื้อ, และประวัติกิจกรรมทั้งหมด (ยกเว้นบัญชีผู้ใช้)</div>
            </div>
            <button class="btn btn-danger" onclick="triggerReset()">🔴 ล้างข้อมูล</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

async function triggerReset() {
  const conf1 = confirm('⚠️ คำเตือน: คุณกำลังจะล้างข้อมูลระบบทั้งหมด!\nข้อมูลงานซ่อมและประวัติทั้งหมดจะหายไปถาวร ยืนยันใช่หรือไม่?');
  if (!conf1) return;
  
  const conf2 = prompt('เพื่อยืนยัน โปรดพิมพ์คำว่า "RESET" ในช่องด้านล่าง:');
  if (conf2 !== 'RESET') {
    toast('การยืนยันไม่ถูกต้อง ระบบยกเลิกการล้างข้อมูล', 'warn');
    return;
  }

  try {
    const res = await apiFetch('/system/reset', { method: 'POST' });
    toast(res.message);
    switchPage('dashboard');
  } catch (e) {
    toast(e.message, 'err');
  }
}
