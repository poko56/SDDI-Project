// ═══════════════════════════════════════
// CORE: API / STATE / ROUTING
// ═══════════════════════════════════════
const API = '/api';
let APP = { user: null, page: null, notifOpen: false };

// ─── API ──────────────────────────────
async function api(method, path, body = null, isForm = false) {
  const hdrs = {};
  const token = localStorage.getItem('token');
  if (token) hdrs['Authorization'] = `Bearer ${token}`;
  if (!isForm) hdrs['Content-Type'] = 'application/json';
  const opts = { method, headers: hdrs };
  if (body) opts.body = isForm ? body : JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── TOAST ────────────────────────────
function toast(msg, type = 'success') {
  let c = document.getElementById('toast-root');
  if (!c) { c = document.createElement('div'); c.id = 'toast-root'; document.body.appendChild(c); }
  const el = document.createElement('div');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.className = `toast t-${type}`;
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><div class="toast-msg">${msg}</div>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── MODAL ────────────────────────────
function openModal(html) {
  closeModal();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.id = 'modal-backdrop';
  bd.innerHTML = html;
  bd.addEventListener('click', e => { if (e.target === bd) closeModal(); });
  document.body.appendChild(bd);
  document.addEventListener('keydown', escHandler);
  return bd;
}
function closeModal() {
  document.getElementById('modal-backdrop')?.remove();
  document.removeEventListener('keydown', escHandler);
}
function escHandler(e) { if (e.key === 'Escape') closeModal(); }

// ─── HELPERS ──────────────────────────
function fmtDate(d, short = false) {
  if (!d) return '–';
  const dt = new Date(d);
  if (short) return dt.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
  return dt.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'เมื่อกี้';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

function statusBadge(s) {
  const map = { 'รอดำเนินการ': ['s-pending', '⏳'], 'กำลังดำเนินการ': ['s-progress', '⚙️'], 'รอตรวจสอบ': ['s-review', '🔍'], 'เสร็จสมบูรณ์': ['s-done', '✅'], 'ต้องส่งซ่อมภายนอก': ['s-external', '🔀'] };
  const [cls, icon] = map[s] || ['badge-gray', '?'];
  return `<span class="badge ${cls}">${icon} ${s}</span>`;
}

function urgencyBadge(u) {
  const map = { 'ฉุกเฉิน': 'u-emergency', 'เร่งด่วน': 'u-urgent', 'ปกติ': 'u-normal', 'ไม่เร่งด่วน': 'u-low' };
  return `<span class="badge ${map[u] || 'badge-gray'}">${u}</span>`;
}

function roleBadge(r) {
  const map = { admin: ['badge-red', '🛡️', 'แอดมิน'], manager: ['badge-purple', '📋', 'ผู้จัดการ'], technician: ['badge-cyan', '🔧', 'ช่างซ่อม'], user: ['badge-gray', '👤', 'ผู้ใช้'] };
  const [cls, icon, label] = map[r] || ['badge-gray', '?', r];
  return `<span class="badge ${cls}">${icon} ${label}</span>`;
}

function categoryIcon(c) {
  return { 'ไฟฟ้า': '⚡', 'ประปา': '💧', 'โครงสร้าง': '🏗️', 'อุปกรณ์อิเล็กทรอนิกส์': '💻', 'เครื่องปรับอากาศ': '❄️' }[c] || '🔧';
}

function roleTH(r) {
  return { admin: 'ผู้ดูแลระบบ', manager: 'ผู้จัดการ', technician: 'ช่างซ่อม', user: 'ผู้ใช้งาน' }[r] || r;
}

function loading(msg = 'กำลังโหลด...') {
  return `<div class="loading-wrap"><div class="spinner"></div><span class="text-muted">${msg}</span></div>`;
}

function emptyState(icon, msg) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-text">${msg}</div></div>`;
}

// ─── NAVIGATE ─────────────────────────
function navigate(page, params = {}) {
  APP.page = page;
  window.scrollTo(0, 0);
  document.querySelectorAll('.sb-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const titles = {
    dashboard: '📊 ภาพรวมระบบ', 'requests-list': '🔧 รายการแจ้งซ่อม',
    'request-new': '➕ แจ้งซ่อมใหม่', 'request-detail': '📋 รายละเอียดงานซ่อม',
    materials: '📦 คลังวัสดุ', 'materials-report': '📈 รายงานวัสดุ',
    users: '👥 จัดการผู้ใช้', track: '🔍 ติดตามงาน', profile: '👤 โปรไฟล์',
  };
  document.getElementById('page-title').textContent = titles[page] || 'ระบบแจ้งซ่อม';
  const c = document.getElementById('page-content');
  c.innerHTML = loading();
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'requests-list': renderRequestsList(params); break;
    case 'request-new': renderNewRequest(); break;
    case 'request-detail': renderRequestDetail(params.id); break;
    case 'materials': renderMaterials(); break;
    case 'materials-report': renderMaterialsReport(); break;
    case 'users': renderUsers(); break;
    case 'track': renderTrack(); break;
    case 'profile': renderProfile(); break;
    default: c.innerHTML = emptyState('🚧', 'หน้านี้กำลังพัฒนา');
  }
}

// ─── SIDEBAR ──────────────────────────
function buildSidebar() {
  const role = APP.user?.role;
  const nav = [
    { page: 'dashboard', icon: '📊', label: 'ภาพรวม (Dashboard)', roles: ['manager', 'admin'] },
    { page: 'requests-list', icon: '🔧', label: 'รายการแจ้งซ่อม', roles: ['user', 'technician', 'manager', 'admin'] },
    { page: 'request-new', icon: '➕', label: 'แจ้งซ่อมใหม่', roles: ['user', 'manager', 'admin'] },
    { section: 'ช่าง & คลัง', roles: ['technician', 'manager', 'admin'] },
    { page: 'materials', icon: '📦', label: 'คลังวัสดุ', roles: ['technician', 'manager', 'admin'] },
    { page: 'materials-report', icon: '📈', label: 'รายงานวัสดุ', roles: ['manager', 'admin'] },
    { section: 'จัดการ', roles: ['admin'] },
    { page: 'users', icon: '👥', label: 'จัดการผู้ใช้', roles: ['admin', 'manager'] },
    { section: 'ทั่วไป', roles: ['user', 'technician', 'manager', 'admin'] },
    { page: 'track', icon: '🔍', label: 'ติดตามงาน', roles: ['user', 'technician', 'manager', 'admin'] },
    { page: 'profile', icon: '👤', label: 'โปรไฟล์ของฉัน', roles: ['user', 'technician', 'manager', 'admin'] },
  ];
  const sb = document.getElementById('sb-nav');
  sb.innerHTML = nav.filter(n => n.roles.includes(role)).map(n => {
    if (n.section) return `<div class="sb-section-label">${n.section}</div>`;
    return `<div class="sb-item" data-page="${n.page}" onclick="navigate('${n.page}')"><span class="sb-icon">${n.icon}</span><span>${n.label}</span></div>`;
  }).join('');
  // avatar
  const u = APP.user;
  document.getElementById('sb-avatar').textContent = u.name?.[0] || '?';
  document.getElementById('sb-name').textContent = u.name;
  document.getElementById('sb-role').textContent = roleTH(u.role);
}

// ─── NOTIFICATIONS ────────────────────
async function loadNotifCount() {
  try {
    const { unread } = await api('GET', '/notifications');
    const dot = document.getElementById('notif-dot');
    const badge = document.getElementById('notif-badge');
    if (dot) dot.classList.toggle('hidden', unread === 0);
    if (badge) badge.textContent = unread > 9 ? '9+' : unread;
  } catch {}
}

async function toggleNotif() {
  const existing = document.getElementById('notif-panel');
  if (existing) { existing.remove(); APP.notifOpen = false; return; }
  APP.notifOpen = true;
  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.className = 'notif-panel';
  panel.innerHTML = `<div class="notif-header"><span style="font-weight:600;font-size:.85rem">🔔 การแจ้งเตือน</span><button class="btn btn-sm btn-ghost" onclick="markAllRead()">อ่านทั้งหมด</button></div><div id="notif-list">${loading()}</div>`;
  document.getElementById('app-shell').appendChild(panel);
  const { items } = await api('GET', '/notifications');
  document.getElementById('notif-list').innerHTML = items.length ? items.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick(${n.id},${n.ref_request_id||'null'})">
      ${!n.is_read ? '<div class="notif-dot-ind"></div>' : '<div style="width:7px"></div>'}
      <div><div class="notif-item-text">${n.title}</div><div class="notif-item-msg">${n.message}</div><div class="notif-item-time">${timeAgo(n.created_at)}</div></div>
    </div>`).join('') : emptyState('🔔', 'ไม่มีการแจ้งเตือน');
  loadNotifCount();
}

async function markAllRead() {
  await api('PATCH', '/notifications/read-all');
  document.getElementById('notif-panel')?.remove();
  APP.notifOpen = false;
  loadNotifCount();
}

function handleNotifClick(id, requestId) {
  api('PATCH', `/notifications/${id}/read`);
  if (requestId) navigate('request-detail', { id: requestId });
  document.getElementById('notif-panel')?.remove();
  APP.notifOpen = false;
}

// ─── AUTH ─────────────────────────────
function showAuth() {
  document.getElementById('root').innerHTML = `
    <div class="auth-wrap">
      <div class="auth-visual">
        <div class="auth-visual-grid"></div>
        <div class="auth-visual-content">
          <div class="auth-visual-icon">🔧</div>
          <h1>ระบบแจ้งซ่อม</h1>
          <p>Maintenance Reporting System สำหรับการจัดการงานซ่อมบำรุงอย่างมีระบบ</p>
          <div class="auth-features">
            <div class="auth-feat"><div class="auth-feat-icon">📋</div> ติดตามสถานะงานซ่อมแบบ Real-time</div>
            <div class="auth-feat"><div class="auth-feat-icon">👷</div> มอบหมายงานช่างและจัดลำดับความสำคัญ</div>
            <div class="auth-feat"><div class="auth-feat-icon">📦</div> บริหารจัดการคลังวัสดุอุปกรณ์</div>
            <div class="auth-feat"><div class="auth-feat-icon">📊</div> Dashboard สรุปผลและวิเคราะห์ข้อมูล</div>
          </div>
        </div>
      </div>
      <div class="auth-form-wrap">
        <div class="auth-card">
          <div class="auth-logo-sm"><span class="icon">🔧</span><div><h2>ระบบแจ้งซ่อม</h2><span>Maintenance Reporting System</span></div></div>
          <div class="auth-tabs">
            <div class="auth-tab active" id="tab-login" onclick="switchTab('login')">เข้าสู่ระบบ</div>
            <div class="auth-tab" id="tab-register" onclick="switchTab('register')">สมัครสมาชิก</div>
          </div>
          <div id="auth-area"></div>
        </div>
      </div>
    </div>`;
  renderLogin();
}

function switchTab(t) {
  document.querySelectorAll('.auth-tab').forEach(el => el.classList.toggle('active', el.id === `tab-${t}`));
  if (t === 'login') renderLogin(); else renderRegister();
}

function renderLogin() {
  document.getElementById('auth-area').innerHTML = `
    <div id="auth-alert"></div>
    <div class="form-group"><label class="form-label">อีเมล</label><input class="form-control" id="l-email" type="email" placeholder="your@school.ac.th" value="warataya@school.ac.th"></div>
    <div class="form-group"><label class="form-label">รหัสผ่าน</label><input class="form-control" id="l-pass" type="password" placeholder="รหัสผ่าน" value="user1234" onkeydown="if(event.key==='Enter')doLogin()"></div>
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:.5rem" onclick="doLogin()">🔑 เข้าสู่ระบบ</button>
    <div style="margin-top:1.25rem;padding:1rem;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border)">
      <div style="font-size:.72rem;color:var(--text3);margin-bottom:.5rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em">บัญชีทดสอบ</div>
      ${[['admin@school.ac.th','admin1234','🛡️ Admin'],['supachok@school.ac.th','manager1234','📋 Manager'],['wasurat@school.ac.th','tech1234','🔧 ช่าง'],['warataya@school.ac.th','user1234','👤 ผู้ใช้']].map(([e,p,l]) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.75rem;color:var(--text2)">${l}</span>
          <button class="btn btn-ghost btn-sm" style="font-size:.68rem" onclick="document.getElementById('l-email').value='${e}';document.getElementById('l-pass').value='${p}'">ใช้งาน</button>
        </div>`).join('')}
    </div>`;
}

function renderRegister() {
  document.getElementById('auth-area').innerHTML = `
    <div id="auth-alert"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">ชื่อ-นามสกุล <span class="req">*</span></label><input class="form-control" id="r-name" placeholder="ชื่อ นามสกุล"></div>
      <div class="form-group"><label class="form-label">รหัสนักศึกษา</label><input class="form-control" id="r-sid" placeholder="68030xxx"></div>
    </div>
    <div class="form-group"><label class="form-label">อีเมล <span class="req">*</span></label><input class="form-control" id="r-email" type="email" placeholder="your@school.ac.th"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">รหัสผ่าน <span class="req">*</span></label><input class="form-control" id="r-pass" type="password" placeholder="≥ 6 ตัวอักษร"></div>
      <div class="form-group"><label class="form-label">สาขา/แผนก</label><input class="form-control" id="r-dept" placeholder="คอมพิวเตอร์"></div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:.5rem" onclick="doRegister()">📝 สมัครสมาชิก</button>`;
}

async function doLogin() {
  const email = document.getElementById('l-email').value;
  const password = document.getElementById('l-pass').value;
  const alert = document.getElementById('auth-alert');
  try {
    const d = await api('POST', '/auth/login', { email, password });
    localStorage.setItem('token', d.token);
    APP.user = d.user;
    APP.user.unread = d.unread_notifications || 0;
    showApp();
  } catch (e) {
    alert.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  }
}

async function doRegister() {
  const name = document.getElementById('r-name').value;
  const email = document.getElementById('r-email').value;
  const password = document.getElementById('r-pass').value;
  const student_id = document.getElementById('r-sid').value;
  const department = document.getElementById('r-dept').value;
  const alert = document.getElementById('auth-alert');
  try {
    await api('POST', '/auth/register', { name, email, password, student_id, department });
    alert.innerHTML = `<div class="alert alert-success">✅ สมัครสำเร็จ กรุณาเข้าสู่ระบบ</div>`;
    setTimeout(() => switchTab('login'), 1500);
  } catch (e) {
    alert.innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
  }
}

function logout() {
  localStorage.removeItem('token');
  APP.user = null;
  showAuth();
}

// ─── APP SHELL ────────────────────────
function showApp() {
  const u = APP.user;
  const defPage = u.role === 'user' ? 'requests-list' : u.role === 'technician' ? 'requests-list' : 'dashboard';
  document.getElementById('root').innerHTML = `
    <div id="app-shell" style="display:flex;min-height:100vh">
      <nav class="sidebar" id="sidebar">
        <div class="sb-header">
          <div class="sb-logo">🔧</div>
          <div class="sb-title">ระบบแจ้งซ่อม<span>Maintenance System</span></div>
        </div>
        <div class="sb-nav" id="sb-nav"></div>
        <div class="sb-user">
          <div class="sb-avatar" id="sb-avatar">?</div>
          <div class="sb-user-info"><div class="sb-user-name" id="sb-name"></div><div class="sb-user-role" id="sb-role"></div></div>
          <button class="sb-logout" onclick="logout()" title="ออกจากระบบ">↩</button>
        </div>
      </nav>
      <div class="main">
        <header class="topbar">
          <button class="btn btn-ghost btn-sm" id="menu-btn" onclick="toggleMenu()" style="display:none">☰</button>
          <h1 class="topbar-title" id="page-title">ระบบแจ้งซ่อม</h1>
          <div class="topbar-actions">
            <div class="notif-btn" onclick="toggleNotif()">
              🔔
              <div class="notif-dot hidden" id="notif-dot"></div>
            </div>
            <div style="font-size:.78rem;color:var(--text2);padding:0 .5rem">สวัสดี, <strong>${u.name?.split(' ')[0]}</strong></div>
          </div>
        </header>
        <main class="page" id="page-content"></main>
      </div>
    </div>
    <div id="toast-root"></div>`;

  buildSidebar();
  loadNotifCount();
  navigate(defPage);

  if (window.innerWidth <= 768) document.getElementById('menu-btn').style.display = 'flex';
}

function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ─── BOOT ─────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const u = await api('GET', '/auth/me');
      APP.user = u;
      showApp();
    } catch {
      localStorage.removeItem('token');
      showAuth();
    }
  } else {
    showAuth();
  }
});