/* ═══════════════════════════════════════
   API FETCH CONSTANTS
═══════════════════════════════════════ */
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://127.0.0.1:5001/sddi-project/asia-east1/api' 
  : '/api'; 

const USE_RELATIVE_API = true; 
const getApiUrl = (endpoint) => USE_RELATIVE_API ? `/api${endpoint}` : `${API_BASE}${endpoint}`;

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('APP_TOKEN');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  if (options.body instanceof FormData) {
    delete headers['Content-Type']; 
  }

  const signal = options.signal || NAV_ABORT_CONTROLLER?.signal;

  try {
    const res = await fetch(getApiUrl(endpoint), { ...options, signal, headers: { ...headers, ...options.headers } });
    
    // Handle specific HTTP Status Codes before parsing JSON
    if (res.status === 401) {
      // Force logout on 401 Unauthorized
      localStorage.removeItem('APP_TOKEN');
      localStorage.removeItem('APP_DATA');
      if (!window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html?err=session_expired';
      }
      throw new Error('session_expired');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'server_error');
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Fetch aborted:', endpoint);
      return new Promise(() => {}); 
    }
    // Wrap the error with a friendly Thai message
    err.message = translateError(err.message);
    throw err;
  }
}

function translateError(msg) {
  const m = {
    'session_expired': 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
    'Failed to fetch': 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต',
    'NetworkError when attempting to fetch resource': 'การเชื่อมต่อเครือข่ายขัดข้อง',
    'Forbidden': 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้',
    'Unauthorized': 'กรุณาเข้าสู่ระบบก่อน',
    'Not Found': 'ไม่พบข้อมลที่ต้องการ',
    'server_error': 'ระบบขัดข้องทางเทคนิค กรุณาลองใหม่อีกครั้ง',
    'Unexpected token': 'เซิร์ฟเวอร์ตอบสนองผิดพลาด (Format Error)',
    'ขนาดไฟล์เกินกำหนด (สูงสุด 5MB)': 'รูปภาพมีขนาดใหญ่เกินไป (สูงสุด 5MB)',
    'อนุญาตให้อัปโหลดเฉพาะไฟล์ JPG และ PNG เท่านั้น': 'รองรับเฉพาะไฟล์รูปภาพ .jpg และ .png เท่านั้น'
  };
  // Partial matching for common browser errors
  if (msg.includes('Failed to fetch')) return m['Failed to fetch'];
  if (msg.includes('NetworkError')) return m['NetworkError when attempting to fetch resource'];
  if (msg.includes('Unexpected token')) return m['Unexpected token'];
  
  return m[msg] || msg;
}

// Global crash protection for unhandled errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.name !== 'AbortError') {
    const msg = translateError(event.reason.message || String(event.reason));
    toast(msg, 'err');
  }
});

async function uploadMedia(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch('/media/upload', {
    method: 'POST',
    body: formData
  });
}

function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d.toISOString();}
function isoDate(d){return d.toISOString();}

/* ═══════════════════════════════════════
   APP STATE
═══════════════════════════════════════ */
let APP = JSON.parse(localStorage.getItem('APP_DATA')) || {user:null,page:null,notifOpen:false}; 
function saveApp() { localStorage.setItem('APP_DATA', JSON.stringify(APP)); }

/* ═══════════════════════════════════════
   HELPERS & UI
═══════════════════════════════════════ */
function fmtDate(d,short=false){
  if(!d)return'–';
  const dt=new Date(d);
  if(short)return dt.toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'});
  return dt.toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function timeAgo(d){
  if(!d)return'ยังไม่เคย';
  const m=Math.floor((Date.now()-new Date(d))/60000);
  if(m<1)return'เมื่อกี้';if(m<60)return`${m} นาทีที่แล้ว`;
  const h=Math.floor(m/60);if(h<24)return`${h} ชั่วโมงที่แล้ว`;
  return`${Math.floor(h/24)} วันที่แล้ว`;
}
function sBadge(s){
  const m={'รอดำเนินการ':['b-amber','⏳'],'กำลังดำเนินการ':['b-blue','⚙️'],'รอตรวจสอบ':['b-violet','🔍'],'เสร็จสมบูรณ์':['b-green','✅'],'ต้องส่งซ่อมภายนอก':['b-red','🔀']};
  const[c,i]=m[s]||['b-gray','?'];return`<span class="badge ${c}">${i} ${s}</span>`;
}
function uBadge(u){
  const m={'ฉุกเฉิน':'b-red','เร่งด่วน':'b-amber','ปกติ':'b-green','ไม่เร่งด่วน':'b-gray'};
  return`<span class="badge ${m[u]||'b-gray'}">${u}</span>`;
}
function roleBadge(r){
  const m={admin:['b-red','🛡️','แอดมิน'],manager:['b-violet','📋','ผู้จัดการ'],technician:['b-blue','🔧','ช่าง'],user:['b-gray','👤','ผู้ใช้']};
  const[c,i,l]=m[r]||['b-gray','?',r];return`<span class="badge ${c}">${i} ${l}</span>`;
}
function catIcon(c){return{'ไฟฟ้า':'⚡','ประปา':'💧','โครงสร้าง':'🏗️','อุปกรณ์อิเล็กทรอนิกส์':'💻','เครื่องปรับอากาศ':'❄️'}[c]||'🔧';}
function roleTH(r){return{admin:'ผู้ดูแลระบบ',manager:'ผู้จัดการ',technician:'ช่างซ่อม',user:'ผู้ใช้งาน'}[r]||r;}
function loadingState(){return`<div class="loading-state"><div class="spinner"></div><span class="text-muted">กำลังโหลด...</span></div>`;}
function setLoading(viewName, navId) {
  if (viewName === CURRENT_VIEW && (navId === undefined || navId === LATEST_NAV_ID)) {
    const container = document.getElementById('page-content');
    if (container) container.innerHTML = loadingState();
  }
}
function emptyState(i,t){return`<div class="empty"><div class="ei">${i}</div><div>${t}</div></div>`;}

function toast(msg,type='ok'){
  let c=document.getElementById('toasts');
  if(!c){ c=document.createElement('div'); c.id='toasts'; document.body.appendChild(c); }
  const el=document.createElement('div');
  const icons={ok:'✅',err:'❌',warn:'⚠️',info:'ℹ️'};
  el.className=`toast t-${type}`;
  el.innerHTML=`<span>${icons[type]||'ℹ️'}</span><div>${msg}</div>`;
  c.appendChild(el);setTimeout(()=>el.remove(),3500);
}
function openModal(html){
  closeModal();
  const bd=document.createElement('div');bd.className='backdrop';bd.id='modal-bd';
  bd.innerHTML=html;bd.addEventListener('click',e=>{if(e.target===bd)closeModal();});
  document.body.appendChild(bd);
  document.addEventListener('keydown',escH);
}
function closeModal(){document.getElementById('modal-bd')?.remove();document.removeEventListener('keydown',escH);}
function escH(e){if(e.key==='Escape')closeModal();}

function previewImg(input, previewId) {
  const el = document.getElementById(previewId);
  const file = input.files[0];
  if (!file) { el.innerHTML = 'ไม่ได้เลือกไฟล์'; return; }
  const reader = new FileReader();
  reader.onload = e => {
    el.innerHTML = `<img src="${e.target.result}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;border:2px solid var(--spark)">`;
  };
  reader.readAsDataURL(file);
}

function openImgModal(url) {
  openModal(`<div class="modal" style="background:transparent;box-shadow:none;border:none;max-width:90vw;width:auto">
    <div style="position:relative">
      <button class="mx" style="position:absolute;top:-40px;right:0;background:rgba(0,0,0,0.5);color:#fff;border-radius:50%" onclick="closeModal()">✕</button>
      <img src="${url}" style="max-width:100%;max-height:80vh;border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);border:2px solid var(--wire)">
    </div>
  </div>`);
}

/* ═══════════════════════════════════════
   BUILD SHELL (ROLE-BASED SPA)
═══════════════════════════════════════ */
async function buildShell(role){
  const token = localStorage.getItem('APP_TOKEN');
  if(!token){ window.location.href='index.html'; return; }

  // ── Always refresh user data from server (fixes stale role bug) ──────────
  try {
    const freshUser = await apiFetch('/auth/me');
    APP.user = { ...APP.user, ...freshUser };
    saveApp();
  } catch(e) {
    // Token expired or invalid → force re-login
    localStorage.removeItem('APP_TOKEN');
    localStorage.removeItem('APP_DATA');
    window.location.href = 'index.html';
    return;
  }

  const u = APP.user;
  if(!u){ window.location.href='index.html'; return; }
  if(u.role !== role) {
    window.location.href = `${u.role}.html`; return;
  }

  const nav=[
    {p:'dashboard',i:'📊',l:'ภาพรวม (Dashboard)',r:['user','technician','manager','admin']},
    {p:'requests-list',i:'🔧',l:'รายการแจ้งซ่อม',r:['user','technician','manager','admin']},
    {p:'request-new',i:'➕',l:'แจ้งซ่อมใหม่',r:['user','manager','admin']},
    {sec:'การจัดการ',r:['technician','manager','admin']},
    {p:'materials',i:'📦',l:'คลังวัสดุ',r:['technician','manager','admin']},
    {p:'schedule',i:'📅',l:'ตารางงาน/เวร',r:['technician','manager','admin']},
    {p:'reports',i:'📊',l:'รายงาน & Export',r:['manager','admin']},
    {sec:'ทั่วไป',r:['user','technician','manager','admin']},
    {p:'track',i:'🔍',l:'ติดตามงาน',r:['user','technician','manager','admin']},
    {p:'settings',i:'⚙️',l:'ตั้งค่าระบบ',r:['admin','manager']},
    {p:'profile',i:'👤',l:'โปรไฟล์ของฉัน',r:['user','technician','manager','admin']},
  ];
  
  document.getElementById('root').innerHTML=`
  <div class="shell" id="shell">
    <nav class="sidebar" id="sidebar">
      <div class="sb-brand">
        <div class="sb-logo">🔧</div>
        <div class="sb-name">ระบบแจ้งซ่อม<small>Maintenance System</small></div>
      </div>
      <div class="sb-nav" id="sb-nav">
        ${nav.filter(n=>n.r.includes(role)).map(n=>{
          if(n.sec)return`<div class="sb-sec">${n.sec}</div>`;
          return`<a href="#" class="sb-link" data-page="${n.p}" onclick="switchPage('${n.p}')"><span class="ico">${n.i}</span><span>${n.l}</span></a>`;
        }).join('')}
      </div>
      <div class="sb-foot">
        <div class="sb-av">${(u.name||u.email||'?')[0].toUpperCase()}</div>
        <div><div class="sb-uname">${u.name||u.email||'–'}</div><div class="sb-urole">${roleTH(u.role)}</div></div>
        <button class="sb-out" onclick="logout()" title="ออกจากระบบ">↩</button>
      </div>
    </nav>
    <div class="main">
      <header class="topbar">
        <button class="menu-toggle" id="menu-btn" onclick="toggleSidebar()">☰</button>
        <div class="tb-title" id="page-title">ระบบแจ้งซ่อม</div>
        <div class="tb-actions">
          <div class="icon-btn" onclick="toggleNotif()" id="notif-btn" title="การแจ้งเตือน">🔔</div>
          <div class="user-chip">
            <div style="width:22px;height:22px;background:linear-gradient(135deg,var(--spark2),var(--violet));border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:#fff;flex-shrink:0">${(u.name||u.email||'?')[0].toUpperCase()}</div>
            <span>${(u.name||u.email||'').split(' ')[0]}</span>
          </div>
        </div>
      </header>
      <main class="page" id="page-content"></main>
    </div>
  </div>`;
  
  if(window.innerWidth<=900)document.getElementById('menu-btn').classList.remove('hidden');
  
  // Initial page setup
  renderCurrentPage();

  // Polling or initial fetch of notifications
  try {
    const data = await apiFetch('/notifications');
    if (data.unread > 0) {
      document.getElementById('notif-btn').innerHTML += `<div class="badge-dot" id="notif-dot"></div>`;
    }
    window.APP_NOTIFS = data.items;
  } catch(e) { console.error('Failed to load notifications', e); }
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

/* ═══════════════════════════════════════
   SPA NAVIGATION
═══════════════════════════════════════ */
let CURRENT_VIEW = ''; // ติดตามหน้าที่กำลังแสดงผลอยู่ปัจจุบัน
let LATEST_NAV_ID = 0; // ลำดับคำสั่งการนำทางล่าสุด
let NAV_ABORT_CONTROLLER = null; // ตัวจัดการการยกเลิก Request สำหรับหน้าเก่า

function switchPage(page, params = {}) {
  let url = new URL(window.location);
  url.searchParams.set('view', page);
  for(let k in params) url.searchParams.set(k, params[k]);
  window.history.pushState(null, '', url.toString());
  renderCurrentPage();
}

window.addEventListener('popstate', renderCurrentPage);

function renderCurrentPage() {
  const u = APP.user;
  if(!u) { window.location.href='index.html'; return; }
  
  let vp = new URLSearchParams(window.location.search).get('view');
  if(!vp) {
    vp = 'dashboard';
    let url=new URL(window.location);url.searchParams.set('view',vp);
    window.history.replaceState(null,'',url.toString());
  }

  CURRENT_VIEW = vp; // อัปเดตหน้าที่ผู้ใช้พยายามจะเปิดอยู่ปัจจุบัน
  
  // Abort previous navigation requests and start a new one
  if (NAV_ABORT_CONTROLLER) NAV_ABORT_CONTROLLER.abort();
  NAV_ABORT_CONTROLLER = new AbortController();
  const navId = ++LATEST_NAV_ID;

  // update sidebar highlight
  document.querySelectorAll('.sb-link').forEach(el=>el.classList.remove('on'));
  const l=document.querySelector(`.sb-link[data-page="${vp}"]`);
  if(l)l.classList.add('on');
  if(window.innerWidth<=900)document.getElementById('sidebar')?.classList.remove('open');

  const titles={dashboard:'📊 ภาพรวมระบบ','requests-list':'🔧 รายการแจ้งซ่อม','request-new':'➕ แจ้งซ่อมใหม่','request-detail':'📋 รายละเอียดงานซ่อม',materials:'📦 คลังวัสดุ',schedule:'📅 ตารางงาน & เวรฉุกเฉิน',reports:'📊 รายงาน & Export',users:'👥 จัดการผู้ใช้','system-log':'📋 บันทึกกิจกรรมระบบ','notif-settings':'🔔 ตั้งค่าแจ้งเตือน',settings:'⚙️ ตั้งค่าระบบ',track:'🔍 ติดตามงาน',profile:'👤 โปรไฟล์'};
  const tEl=document.getElementById('page-title');
  if(tEl) tEl.textContent=titles[vp]||'ระบบแจ้งซ่อม';

  // route - Pass navId to all page functions
  if(vp==='dashboard' && typeof pageDashboard==='function') pageDashboard(navId);
  else if(vp==='requests-list' && typeof pageRequestsList==='function') pageRequestsList(Object.fromEntries(new URLSearchParams(window.location.search)), navId);
  else if(vp==='request-new' && typeof pageNewRequest==='function') pageNewRequest(navId);
  else if(vp==='request-detail' && typeof pageRequestDetail==='function') {
    const id = new URLSearchParams(window.location.search).get('id');
    pageRequestDetail(id, navId);
  }
  else if(vp==='materials' && typeof pageMaterials==='function') pageMaterials(navId);
  else if(vp==='schedule' && typeof pageSchedule==='function') pageSchedule(navId);
  else if(vp==='reports' && typeof pageReports==='function') pageReports(navId);
  else if(vp==='users' && typeof pageUsers==='function') pageUsers(navId);
  else if(vp==='system-log' && typeof pageSystemLog==='function') pageSystemLog(navId);
  else if(vp==='notif-settings' && typeof pageNotifSettings==='function') pageNotifSettings(navId);
  else if(vp==='settings' && typeof pageSettings==='function') pageSettings(navId);
  else if(vp==='track' && typeof pageTrack==='function') pageTrack(navId);
  else if(vp==='profile' && typeof pageProfile==='function') pageProfile(navId);
  else {
    document.getElementById('page-content').innerHTML = emptyState('⚠️', 'ไม่พบหน้านี้ หรือคุณไม่มีสิทธิ์เข้าถึง');
  }
}

/**
 * ฟังก์ชันกลางสำหรับการตรวจสอบและเรนเดอร์เนื้อหาหน้าจอ
 * ป้องกันปัญหา Race Condition เมื่อมีการเปลี่ยนหน้าเร็วๆ
 */
function renderContent(html, viewName, navId) {
  // ตรวจสอบทั้งชื่อวิว และรหัสการนำทางล่าสุด
  if (viewName !== CURRENT_VIEW || (navId !== undefined && navId !== LATEST_NAV_ID)) {
    console.warn(`Race condition prevented: ignored render for [${viewName}] (navId: ${navId}, latest: ${LATEST_NAV_ID})`);
    return;
  }
  const container = document.getElementById('page-content');
  if (container) {
    container.innerHTML = html;
  }
}

/* ═══════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════ */
async function toggleNotif(){
  const ex=document.getElementById('notif-panel');
  if(ex){ex.remove();APP.notifOpen=false;return;}
  APP.notifOpen=true;
  
  const myNotifs = window.APP_NOTIFS || [];
  
  const panel=document.createElement('div');
  panel.id='notif-panel';panel.className='notif-panel';
  panel.innerHTML=`
    <div class="np-h">
      <span style="font-weight:700;font-size:.83rem">🔔 การแจ้งเตือน</span>
      <button class="btn btn-ghost btn-sm" onclick="markAllRead()">อ่านทั้งหมด</button>
    </div>
    ${myNotifs.length?myNotifs.map(n=>`
      <div class="ni ${n.is_read?'':'unread'}" onclick="clickNotif('${n.id}','${n.ref_request_id||''}')">
        ${!n.is_read?'<div class="ni-dot"></div>':'<div style="width:7px"></div>'}
        <div><div class="ni-t">${n.title}</div><div class="ni-m">${n.message}</div><div class="ni-tm">${timeAgo(n.created_at)}</div></div>
      </div>`).join(''):emptyState('🔔','ไม่มีการแจ้งเตือน')}`;
  document.getElementById('shell').appendChild(panel);
}

async function markAllRead(){
  try {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    if(window.APP_NOTIFS) window.APP_NOTIFS.forEach(n=>n.is_read=1);
    document.getElementById('notif-panel')?.remove();APP.notifOpen=false;
    document.getElementById('notif-dot')?.remove();
    toast('อ่านทั้งหมดแล้ว');
  } catch(e){ toast(e.message,'err'); }
}

async function clickNotif(id,reqId){
  try {
    const n = window.APP_NOTIFS?.find(x=>x.id===id);
    if(n && !n.is_read){
      n.is_read=1;
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    }
  } catch(e){}
  if(reqId)switchPage('request-detail',{id:reqId});
  document.getElementById('notif-panel')?.remove();APP.notifOpen=false;
}
