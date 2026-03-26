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

  const res = await fetch(getApiUrl(endpoint), { ...options, headers: { ...headers, ...options.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server Error');
  return data;
}

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
    {p:'purchase-orders',i:'📋',l:'ใบจัดซื้อ (PO)',r:['manager','admin']},
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

  // update sidebar highlight
  document.querySelectorAll('.sb-link').forEach(el=>el.classList.remove('on'));
  const l=document.querySelector(`.sb-link[data-page="${vp}"]`);
  if(l)l.classList.add('on');
  if(window.innerWidth<=900)document.getElementById('sidebar')?.classList.remove('open');

  const titles={dashboard:'📊 ภาพรวมระบบ','requests-list':'🔧 รายการแจ้งซ่อม','request-new':'➕ แจ้งซ่อมใหม่','request-detail':'📋 รายละเอียดงานซ่อม',materials:'📦 คลังวัสดุ',schedule:'📅 ตารางงาน & เวรฉุกเฉิน','purchase-orders':'📋 ใบจัดซื้อ (PO)',reports:'📊 รายงาน & Export',users:'👥 จัดการผู้ใช้','system-log':'📋 บันทึกกิจกรรมระบบ','notif-settings':'🔔 ตั้งค่าแจ้งเตือน',settings:'⚙️ ตั้งค่าระบบ',track:'🔍 ติดตามงาน',profile:'👤 โปรไฟล์'};
  const tEl=document.getElementById('page-title');
  if(tEl) tEl.textContent=titles[vp]||'ระบบแจ้งซ่อม';

  // route
  if(vp==='dashboard' && typeof pageDashboard==='function') pageDashboard();
  else if(vp==='requests-list' && typeof pageRequestsList==='function') pageRequestsList(Object.fromEntries(new URLSearchParams(window.location.search)));
  else if(vp==='request-new' && typeof pageNewRequest==='function') pageNewRequest();
  else if(vp==='request-detail' && typeof pageRequestDetail==='function') {
    const id = new URLSearchParams(window.location.search).get('id');
    pageRequestDetail(id);
  }
  else if(vp==='materials' && typeof pageMaterials==='function') pageMaterials();
  else if(vp==='schedule' && typeof pageSchedule==='function') pageSchedule();
  else if(vp==='purchase-orders' && typeof pagePurchaseOrders==='function') pagePurchaseOrders();
  else if(vp==='reports' && typeof pageReports==='function') pageReports();
  else if(vp==='users' && typeof pageUsers==='function') pageUsers();
  else if(vp==='system-log' && typeof pageSystemLog==='function') pageSystemLog();
  else if(vp==='notif-settings' && typeof pageNotifSettings==='function') pageNotifSettings();
  else if(vp==='settings' && typeof pageSettings==='function') pageSettings();
  else if(vp==='track' && typeof pageTrack==='function') pageTrack();
  else if(vp==='profile' && typeof pageProfile==='function') pageProfile();
  else {
    document.getElementById('page-content').innerHTML = emptyState('⚠️', 'ไม่พบหน้านี้ หรือคุณไม่มีสิทธิ์เข้าถึง');
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
