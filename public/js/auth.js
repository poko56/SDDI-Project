/* ═══════════════════════════════════════
   AUTH MODULE
═══════════════════════════════════════ */
function showAuth(){
  document.getElementById('root').innerHTML=`
  <div class="auth-shell">
    <div class="auth-left">
      <div class="auth-grid"></div>
      <div class="auth-left-content">
        <div class="auth-icon">🔧</div>
        <h1 class="auth-h1">ระบบแจ้งซ่อม</h1>
        <p class="auth-sub">Maintenance Reporting System<br>สำหรับการจัดการงานซ่อมบำรุงอย่างมีระบบและมีประสิทธิภาพ</p>
        <div class="auth-feat">
          <div class="af"><div class="af-i">📋</div> ติดตามสถานะงานซ่อมแบบ Real-time</div>
          <div class="af"><div class="af-i">👷</div> มอบหมายช่าง จัดลำดับความสำคัญ SLA</div>
          <div class="af"><div class="af-i">📦</div> บริหารคลังวัสดุอุปกรณ์ Low-stock Alert</div>
          <div class="af"><div class="af-i">📊</div> Dashboard วิเคราะห์ข้อมูลเชิงลึก</div>
          <div class="af"><div class="af-i">⭐</div> ระบบประเมินความพึงพอใจ</div>
        </div>
      </div>
    </div>
    <div class="auth-right">
      <div class="auth-card">
        <div class="auth-logo">
          <span class="ico">🔧</span>
          <div><div class="nm">ระบบแจ้งซ่อม</div><span class="sub">Maintenance Reporting System</span></div>
        </div>
        <div class="auth-tabs">
          <div class="atab on" id="atab-login" onclick="switchAuthTab('login')">เข้าสู่ระบบ</div>
          <div class="atab" id="atab-register" onclick="switchAuthTab('register')">สมัครสมาชิก</div>
        </div>
        <div id="auth-area"></div>
      </div>
    </div>
  </div>`;
  renderLogin();
}

function switchAuthTab(t){
  document.querySelectorAll('.atab').forEach(el=>el.classList.toggle('on',el.id===`atab-${t}`));
  if(t==='login')renderLogin();else renderRegister();
}

function renderLogin(){
  document.getElementById('auth-area').innerHTML=`
    <div id="auth-alert"></div>
    <div class="fg"><label class="fl">อีเมล</label><input class="fc" id="l-email" type="email" value="admin@school.ac.th"></div>
    <div class="fg"><label class="fl">รหัสผ่าน</label><input class="fc" id="l-pass" type="password" value="admin1234" onkeydown="if(event.key==='Enter')doLogin()"></div>
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:.5rem" onclick="doLogin()">🔑 เข้าสู่ระบบ</button>
    <div class="demo-panel">
      <div class="demo-title">บัญชีทดสอบ — คลิกเพื่อเลือก</div>
      ${[['admin@school.ac.th','admin1234','🛡️ Admin'],['supachok@school.ac.th','manager1234','📋 Manager'],['wasurat@school.ac.th','tech1234','🔧 ช่างซ่อม'],['warataya@school.ac.th','user1234','👤 ผู้ใช้']].map(([e,p,l])=>`
        <div class="demo-row">
          <span class="demo-label">${l}</span>
          <button class="demo-btn" onclick="document.getElementById('l-email').value='${e}';document.getElementById('l-pass').value='${p}'">ใช้งาน</button>
        </div>`).join('')}
    </div>`;
}

function renderRegister(){
  document.getElementById('auth-area').innerHTML=`
    <div id="auth-alert"></div>
    <div class="frow">
      <div class="fg"><label class="fl">ชื่อ-นามสกุล <span class="req">*</span></label><input class="fc" id="r-name" placeholder="ชื่อ นามสกุล"></div>
      <div class="fg"><label class="fl">รหัสนักศึกษา</label><input class="fc" id="r-sid" placeholder="68030xxx"></div>
    </div>
    <div class="fg"><label class="fl">อีเมล <span class="req">*</span></label><input class="fc" id="r-email" type="email" placeholder="your@school.ac.th"></div>
    <div class="frow">
      <div class="fg"><label class="fl">รหัสผ่าน <span class="req">*</span></label><input class="fc" id="r-pass" type="password" placeholder="≥ 6 ตัวอักษร"></div>
      <div class="fg"><label class="fl">สาขา/แผนก</label><input class="fc" id="r-dept" placeholder="คอมพิวเตอร์"></div>
    </div>
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:.5rem" onclick="doRegister()">📝 สมัครสมาชิก</button>`;
}

async function doLogin(){
  const email=document.getElementById('l-email').value.trim().toLowerCase();
  const pass=document.getElementById('l-pass').value;
  const alert = document.getElementById('auth-alert');
  try {
    const data = await apiFetch('/auth/login', { method:'POST', body:JSON.stringify({email,password:pass}) });
    localStorage.setItem('APP_TOKEN', data.token);
    APP.user = data.user;
    saveApp();
    
    // Redirect to the correct role page
    window.location.href = `${data.user.role}.html`;
  } catch(e) {
    alert.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`;
  }
}

async function doRegister(){
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim().toLowerCase();
  const pass=document.getElementById('r-pass').value;
  const el=document.getElementById('auth-alert');
  if(!name||!email||!pass){el.innerHTML=`<div class="alert al-warn">⚠️ กรุณากรอกข้อมูลที่จำเป็น</div>`;return;}
  if(pass.length<6){el.innerHTML=`<div class="alert al-warn">⚠️ รหัสผ่านต้องมีอย่างน้อย 6 ตัว</div>`;return;}
  
  try {
    const res = await apiFetch('/auth/register', { method:'POST', body:JSON.stringify({
      name, email, password:pass, student_id:document.getElementById('r-sid').value||null, department:document.getElementById('r-dept').value||null
    })});
    el.innerHTML=`<div class="alert al-success">✅ ${res.message}</div>`;
    setTimeout(()=>switchAuthTab('login'),1500);
  } catch(e) {
    el.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`;
  }
}

function logout(){
  APP.user=null;
  saveApp();
  localStorage.removeItem('APP_TOKEN');
  window.location.href='index.html';
}
