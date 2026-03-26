/* ═══════════════════════════════════════
   PAGE: NOTIFICATION SETTINGS (SRS 2.1.2)
   Admin-only: configure SMTP + Twilio
═══════════════════════════════════════ */
async function pageNotifSettings(){
  const c=document.getElementById('page-content');
  if(APP.user?.role !== 'admin'){ c.innerHTML=`<div class="alert al-danger">❌ เฉพาะ Admin เท่านั้น</div>`; return; }
  c.innerHTML=loadingState();
  try {
    const cfg = await apiFetch('/notification-settings');
    c.innerHTML=`
    <div style="max-width:720px">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:.25rem">🔔 ตั้งค่าการแจ้งเตือน Email / SMS</div>
      <div class="text-muted text-xs mb2">SRS 2.1.2 • กำหนด SMTP สำหรับ Email และ Twilio สำหรับ SMS ระบบจะส่งอัตโนมัติเมื่อมีงานใหม่, มอบหมายงาน, งานเสร็จ</div>

      <!-- Master Toggle -->
      <div class="card mb2">
        <div class="card-b" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700">🔔 เปิดใช้งานการแจ้งเตือน</div>
            <div class="text-muted text-xs">เมื่อปิด ระบบจะไม่ส่ง Email/SMS ใดๆ แต่ยังมี In-app notification ปกติ</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="cfg-enabled" ${cfg.enabled?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="divider"></div>
        <div class="card-b" style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:700">🤖 มอบหมายงานช่างอัตโนมัติ (Auto-Assign)</div>
            <div class="text-muted text-xs">เมื่อมีงานใหม่ ระบบจะเลือกช่างที่งานว่างที่สุดให้ทันที</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="cfg-auto-assign" ${cfg.auto_assign_enabled?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- EMAIL Settings -->
      <div class="card mb2">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">📧 Email</div>
          <label class="toggle-switch">
            <input type="checkbox" id="cfg-email-en" ${cfg.email_enabled?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="card-b">

          <!-- RESEND (Recommended) -->
          <div class="alert al-info mb2" style="font-size:.82rem">
            ⭐ <strong>Resend (แนะนำ)</strong> — ใส่แค่ API Key ส่งได้ทุกเมล ฟรี 100 เมล/วัน
            <a href="https://resend.com" target="_blank" style="color:var(--spark);margin-left:6px">สมัครที่นี่ →</a>
          </div>
          <div class="frow">
            <div class="fg"><label class="fl">Resend API Key <span class="req">*</span></label>
              <input class="fc" id="cfg-resend-key" type="password" placeholder="re_xxxxxxxxxxxxxxxxxxxx" value="${cfg.resend_api_key||''}">
            </div>
            <div class="fg"><label class="fl">From Address (optional)</label>
              <input class="fc" id="cfg-resend-from" placeholder="noreply@yourdomain.com (ว่าง=ใช้ค่าเริ่มต้น)" value="${cfg.resend_from||''}">
            </div>
          </div>
          <div class="alert al-info mt2" style="font-size:.78rem">
            💡 ถ้าไม่ได้ verify domain ให้ใช้ from ว่างไว้ จะใช้ <code>onboarding@resend.dev</code> อัตโนมัติ (ส่งได้เฉพาะสมาชิก Resend ในช่วง trial)
            หรือ verify domain ของคุณที่ resend.com → Domains เพื่อส่งหาทุกเมลได้
          </div>

          <div class="divider" style="margin:1rem 0"></div>

          <!-- SMTP (Fallback) -->
          <details style="cursor:pointer">
            <summary style="font-size:.82rem;color:var(--chalk2);font-weight:600;margin-bottom:.75rem">⚙️ ทางเลือก: SMTP (Gmail App Password)</summary>
            <div class="frow">
              <div class="fg"><label class="fl">SMTP Host</label><input class="fc" id="cfg-smtp-host" placeholder="smtp.gmail.com" value="${cfg.smtp_host||''}"></div>
              <div class="fg" style="max-width:100px"><label class="fl">Port</label><input class="fc" id="cfg-smtp-port" type="number" placeholder="587" value="${cfg.smtp_port||587}"></div>
            </div>
            <div class="frow">
              <div class="fg"><label class="fl">Email ผู้ส่ง</label><input class="fc" id="cfg-smtp-user" placeholder="your@gmail.com" value="${cfg.smtp_user||''}"></div>
              <div class="fg"><label class="fl">App Password</label><input class="fc" id="cfg-smtp-pass" type="password" value="${cfg.smtp_pass||''}" placeholder="รหัส 16 ตัวจาก Google Account"></div>
            </div>
          </details>

          <div class="flex jb mt2" style="gap:.5rem">
            <button class="btn btn-primary" onclick="saveNotifSettings()">💾 บันทึก</button>
            <button class="btn btn-ghost" onclick="testEmail()">📤 ทดสอบส่ง Email</button>
          </div>
        </div>
      </div>

      <!-- SMS Settings -->
      <div class="card mb2">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">📱 SMS (Twilio)</div>
          <label class="toggle-switch">
            <input type="checkbox" id="cfg-sms-en" ${cfg.sms_enabled?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="card-b">
          <div class="frow">
            <div class="fg"><label class="fl">Account SID <span class="req">*</span></label><input class="fc" id="cfg-twilio-sid" placeholder="ACxxxxxxxxxxxxxxxx" value="${cfg.twilio_sid||''}"></div>
            <div class="fg"><label class="fl">Auth Token</label><input class="fc" id="cfg-twilio-token" type="password" value="${cfg.twilio_token||''}" placeholder="Auth Token จาก Twilio"></div>
          </div>
          <div class="fg"><label class="fl">Twilio Phone Number</label><input class="fc" id="cfg-twilio-from" placeholder="+1xxxxxxxxxx (E.164)" value="${cfg.twilio_from||''}"></div>

          <div class="alert al-info mt2" style="font-size:.8rem">
            <strong>💡 Twilio:</strong> ลงทะเบียนที่ <a href="https://www.twilio.com" target="_blank" style="color:var(--spark)">twilio.com</a> → รับ Trial หมายเลข → คัดลอก Account SID และ Auth Token<br>
            เบอร์โทรปลายทางต้องเป็นรูปแบบ E.164 เช่น +66XXXXXXXXX
          </div>
          <div class="flex jb mt2" style="gap:.5rem">
            <button class="btn btn-primary" onclick="saveNotifSettings()">💾 บันทึก</button>
            <button class="btn btn-ghost" onclick="testSMS()">📤 ทดสอบส่ง SMS</button>
          </div>
        </div>
      </div>

      <!-- Event Triggers Info -->
      <div class="card">
        <div class="card-h"><div class="card-t">⚡ เหตุการณ์ที่ระบบจะส่งแจ้งเตือน</div></div>
        <div class="card-b" style="padding:0">
          ${[
            {e:'แจ้งซ่อมใหม่', who:'Manager / Admin', icon:'🆕'},
            {e:'มอบหมายงานให้ช่าง', who:'ช่าง + ผู้แจ้ง', icon:'⚙️'},
            {e:'งานซ่อมเสร็จสมบูรณ์', who:'ผู้แจ้งซ่อม (ขอประเมิน)', icon:'✅'},
            {e:'ใกล้เกิน SLA', who:'Manager / Admin', icon:'⚠️'},
          ].map(ev=>`
          <div class="flex jb ic" style="padding:.625rem 1.25rem;border-bottom:1px solid var(--wire)">
            <div class="flex ic gap2"><span>${ev.icon}</span><div class="text-sm">${ev.e}</div></div>
            <div class="text-xs text-muted">${ev.who}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  } catch(e){ c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}

async function saveNotifSettings(){
  const payload = {
    enabled: document.getElementById('cfg-enabled')?.checked,
    email_enabled: document.getElementById('cfg-email-en')?.checked,
    sms_enabled: document.getElementById('cfg-sms-en')?.checked,
    resend_api_key: document.getElementById('cfg-resend-key')?.value,
    resend_from: document.getElementById('cfg-resend-from')?.value.trim(),
    smtp_host: document.getElementById('cfg-smtp-host')?.value.trim(),
    smtp_port: parseInt(document.getElementById('cfg-smtp-port')?.value)||587,
    smtp_user: document.getElementById('cfg-smtp-user')?.value.trim(),
    smtp_pass: document.getElementById('cfg-smtp-pass')?.value,
    smtp_from_name: document.getElementById('cfg-smtp-name')?.value?.trim()||'',
    twilio_sid: document.getElementById('cfg-twilio-sid')?.value.trim(),
    twilio_token: document.getElementById('cfg-twilio-token')?.value,
    twilio_from: document.getElementById('cfg-twilio-from')?.value.trim(),
    auto_assign_enabled: document.getElementById('cfg-auto-assign')?.checked,
  };
  try {
    const r = await apiFetch('/notification-settings', {method:'POST', body: JSON.stringify(payload)});
    toast(r.message);
  } catch(e){ toast(e.message,'err'); }
}

async function testEmail(){
  try {
    await saveNotifSettings(); // save first
    const r = await apiFetch('/notification-settings/test-email', {method:'POST', body:'{}'});
    toast(r.message);
  } catch(e){ toast(e.message,'err'); }
}

async function testSMS(){
  const phone = prompt('กรอกเบอร์โทรทดสอบ (E.164 เช่น +66812345678):');
  if(!phone) return;
  try {
    await saveNotifSettings();
    const r = await apiFetch('/notification-settings/test-sms', {method:'POST', body: JSON.stringify({phone})});
    toast(r.message);
  } catch(e){ toast(e.message,'err'); }
}
