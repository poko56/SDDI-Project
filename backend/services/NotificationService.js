/* ══════════════════════════════════════════
   NotificationService.js  —  SRS 2.1.2
   Email: Resend (primary) or Nodemailer/SMTP (fallback)
   SMS: Twilio
══════════════════════════════════════════ */
const nodemailer = require('nodemailer');
const { db, Timestamp } = require('../db/database');

// ── Load config from Firestore (cached per cold-start) ─────────────────────
let _cfg = null;
async function getCfg() {
  if (_cfg) return _cfg;
  const doc = await db.collection('settings').doc('notifications').get();
  _cfg = doc.exists ? doc.data() : {};
  return _cfg;
}
function invalidateCfg() { _cfg = null; }

// ── Send Email ──────────────────────────────────────────────────────────────
// Priority: Resend API → Nodemailer SMTP
async function sendEmail(cfg, { to, subject, html }) {
  if (!to) return { ok: false, reason: 'No recipient' };

  // ── Option A: Resend (API Key only, no SMTP needed) ──────────────────
  if (cfg.resend_api_key) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(cfg.resend_api_key);
      const fromAddr = cfg.resend_from || 'onboarding@resend.dev';
      const { data, error } = await resend.emails.send({ from: fromAddr, to, subject, html });
      if (error) { console.error('[Resend] Error:', error); return { ok: false, reason: JSON.stringify(error) }; }
      console.log('[Resend] Sent to', to, '| ID:', data?.id);
      return { ok: true };
    } catch(e) {
      console.error('[Resend] Exception:', e.message);
      return { ok: false, reason: e.message };
    }
  }

  // ── Option B: Nodemailer / SMTP ──────────────────────────────────────
  if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
    return { ok: false, reason: 'No email provider configured (set Resend API key or SMTP)' };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port) || 587,
      secure: parseInt(cfg.smtp_port) === 465,
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
      tls: { rejectUnauthorized: false }
    });
    const info = await transporter.sendMail({
      from: `"${cfg.smtp_from_name || 'ระบบแจ้งซ่อม SDDI'}" <${cfg.smtp_user}>`,
      to, subject, html
    });
    console.log('[SMTP] Sent to', to, '| MsgID:', info.messageId);
    return { ok: true };
  } catch(e) {
    console.error('[SMTP] Error:', e.message);
    return { ok: false, reason: e.message };
  }
}


// ── Send SMS via Twilio ─────────────────────────────────────────────────────
async function sendSMS(cfg, { to, body }) {
  if (!cfg.twilio_sid || !cfg.twilio_token || !cfg.twilio_from || !to) {
    return { ok: false, reason: 'Twilio not configured or no phone number' };
  }
  // Auto-format Thai local number (08... -> +668...)
  let target = to.trim();
  if (target.startsWith('0') && target.length === 10) {
    target = '+66' + target.substring(1);
  }
  
  try {
    const twilio = require('twilio')(cfg.twilio_sid, cfg.twilio_token);
    const msg = await twilio.messages.create({ body, from: cfg.twilio_from, to: target });
    console.log('[SMS] Sent to', target, '| SID:', msg.sid);
    return { ok: true };
  } catch (e) {
    console.error('[SMS] Error:', e.message);
    return { ok: false, reason: e.message };
  }
}

// ── Resolve user contact info ───────────────────────────────────────────────
async function getUser(uid) {
  const doc = await db.collection('users').doc(String(uid)).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ── HTML Email template ─────────────────────────────────────────────────────
function emailHTML(title, lines, tracking, url) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;background:#f4f4f4;padding:20px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:#1a1a2e;padding:20px 24px">
      <div style="color:#00d4ff;font-weight:700;font-size:1.1rem">🔧 ระบบแจ้งซ่อม SDDI</div>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 12px;color:#1a1a2e;font-size:1.1rem">${title}</h2>
      ${lines.map(l=>`<p style="margin:6px 0;color:#374151;font-size:.9rem">${l}</p>`).join('')}
      ${tracking?`<div style="margin:16px 0;padding:12px;background:#f0f9ff;border-left:4px solid #00d4ff;border-radius:4px;font-weight:700;font-size:1rem">รหัสติดตาม: ${tracking}</div>`:''}
      ${url?`<a href="${url}" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#00d4ff;color:#1a1a2e;border-radius:6px;text-decoration:none;font-weight:700">เปิดระบบ &rarr;</a>`:''}
    </div>
    <div style="padding:12px 24px;background:#f9fafb;font-size:.8rem;color:#9ca3af">ส่งโดยระบบแจ้งซ่อมอัตโนมัติ SDDI-2025 • อย่าตอบกลับอีเมลนี้</div>
  </div></body></html>`;
}

// ════════════════════════════════════════════════════════
//  NOTIFICATION TRIGGERS
// ════════════════════════════════════════════════════════

/**
 * Trigger: ผู้ใช้แจ้งซ่อมใหม่
 * → Email ยืนยันกลับไปหา ผู้แจ้ง (พร้อมหมายเลขติดตาม)
 * → Email แจ้ง Manager/Admin ทุกคน
 * → SMS แจ้ง Manager/Admin เฉพาะกรณี ฉุกเฉิน เท่านั้น
 */
async function notifyNewRequest(request, requester) {
  try {
    const cfg = await getCfg();
    if (!cfg.enabled) return;
    const appUrl = 'https://sddi-2025.web.app';
    const isUrgent = request.urgency === 'ฉุกเฉิน';

    // ── 1. ส่งอีเมลยืนยันกลับไปหา ผู้แจ้ง ──────────────────────────
    if (cfg.email_enabled && requester?.email) {
      const title = `✅ รับแจ้งซ่อมเรียบร้อย — ${request.tracking_id}`;
      const lines = [
        `เรียน <strong>${requester.name || 'ผู้ใช้งาน'}</strong>`,
        `ระบบได้รับการแจ้งซ่อมของท่านเรียบร้อยแล้ว`,
        `&nbsp;`,
        `ประเภท: <strong>${request.category}</strong>`,
        `สถานที่: ${request.location || 'ไม่ระบุ'}`,
        `ความเร่งด่วน: <strong>${request.urgency}</strong>`,
        `รายละเอียด: ${request.description?.slice(0, 120) || '–'}`,
        `&nbsp;`,
        `ท่านสามารถติดตามสถานะงานซ่อมได้โดยใช้หมายเลขด้านล่าง`
      ];
      await sendEmail(cfg, {
        to: requester.email,
        subject: title,
        html: emailHTML(title, lines, request.tracking_id, `${appUrl}/index.html`)
      });
    }

    // ── 2. SMS ยืนยันกลับผู้แจ้ง (ทุกกรณี) ─────────────────────────
    if (cfg.sms_enabled && requester?.phone) {
      await sendSMS(cfg, {
        to: requester.phone,
        body: `[SDDI] รับแจ้งซ่อมแล้ว รหัส: ${request.tracking_id} ประเภท: ${request.category} (${request.urgency}) ติดตามที่ ${appUrl}`
      });
    }

    // ── 3. แจ้ง Manager/Admin ─────────────────────────────────────────
    const managers = await db.collection('users')
      .where('role', 'in', ['manager', 'admin'])
      .where('is_active', '==', 1)
      .get();

    for (const doc of managers.docs) {
      const m = doc.data();
      const mgTitle = `🔔 ${isUrgent ? '🚨 [ฉุกเฉิน] ' : ''}แจ้งซ่อมใหม่ — ${request.category}`;
      const mgLines = [
        `ผู้แจ้ง: <strong>${requester?.name || 'ผู้ใช้งาน'}</strong> (${requester?.email || '–'})`,
        `ประเภท: ${request.category}`,
        `สถานที่: ${request.location || 'ไม่ระบุ'}`,
        `ความเร่งด่วน: <strong>${request.urgency}</strong>`,
        `รายละเอียด: ${request.description?.slice(0, 100) || '–'}`
      ];
      const mgUrl = `${appUrl}/manager.html?view=request-detail&id=${request.id}`;

      // Email แจ้ง Manager ทุกกรณี
      if (cfg.email_enabled && m.email) {
        await sendEmail(cfg, { to: m.email, subject: mgTitle, html: emailHTML(mgTitle, mgLines, request.tracking_id, mgUrl) });
      }

      // SMS แจ้ง Manager เฉพาะกรณี ฉุกเฉิน เท่านั้น
      if (cfg.sms_enabled && m.phone && isUrgent) {
        await sendSMS(cfg, {
          to: m.phone,
          body: `🚨 [ฉุกเฉิน] แจ้งซ่อม ${request.tracking_id} โดย ${requester?.name || 'ผู้ใช้'} — ${request.location || ''} กรุณาดำเนินการด่วน!`
        });
      }
    }
  } catch(e) { console.error('[Notify] notifyNewRequest error:', e.message); }
}

/**
 * Trigger: มอบหมายงานให้ช่าง
 * → Email + SMS แจ้งช่าง + ผู้แจ้ง
 */
async function notifyAssigned(request, tech) {
  try {
    const cfg = await getCfg();
    if (!cfg.enabled) return;
    const url = `https://sddi-2025.web.app/technician.html?view=request-detail&id=${request.id}`;
    // Notify technician
    const title = `⚙️ งานใหม่ถูกมอบหมายให้คุณ`;
    const lines = [`รหัสงาน: ${request.tracking_id}`, `ประเภท: ${request.category}`, `สถานที่: ${request.location||'–'}`, `ความเร่งด่วน: ${request.urgency}`];
    if (cfg.email_enabled && tech?.email) {
      await sendEmail(cfg, { to: tech.email, subject: title, html: emailHTML(title, lines, request.tracking_id, url) });
    }
    if (cfg.sms_enabled && tech?.phone) {
      await sendSMS(cfg, { to: tech.phone, body: `[SDDI] งาน ${request.tracking_id} (${request.category}) ถูกมอบหมายให้คุณแล้ว กรุณาดูระบบ` });
    }
    // Notify requester
    const requester = await getUser(request.requester_id);
    if (requester) {
      const t2 = `✅ งานซ่อมของคุณได้รับการมอบหมายช่างแล้ว`;
      const l2 = [`รหัสงาน: ${request.tracking_id}`, `ช่างรับผิดชอบ: ${tech?.name||'–'}`, `กำลังดำเนินการซ่อม`];
      const url2 = `https://sddi-2025.web.app/user.html?view=request-detail&id=${request.id}`;
      if (cfg.email_enabled && requester.email) {
        await sendEmail(cfg, { to: requester.email, subject: t2, html: emailHTML(t2, l2, request.tracking_id, url2) });
      }
      if (cfg.sms_enabled && requester.phone) {
        await sendSMS(cfg, { to: requester.phone, body: `[SDDI] งาน ${request.tracking_id} ช่าง ${tech?.name||'–'} รับงานแล้ว` });
      }
    }
  } catch(e) { console.error('[Notify] notifyAssigned error:', e.message); }
}

/**
 * Trigger: งานเสร็จสมบูรณ์
 * → Email + SMS แจ้งผู้แจ้ง ขอประเมิน
 */
async function notifyCompleted(request) {
  try {
    const cfg = await getCfg();
    if (!cfg.enabled) return;
    const requester = await getUser(request.requester_id);
    if (!requester) return;
    const url = `https://sddi-2025.web.app/user.html?view=request-detail&id=${request.id}`;
    const title = `🎉 งานซ่อมของคุณเสร็จสมบูรณ์แล้ว`;
    const lines = [`รหัสงาน: ${request.tracking_id}`, `ประเภท: ${request.category}`, `กรุณาประเมินความพึงพอใจในระบบเพื่อพัฒนาการบริการ`];
    if (cfg.email_enabled && requester.email) {
      await sendEmail(cfg, { to: requester.email, subject: title, html: emailHTML(title, lines, request.tracking_id, url) });
    }
    if (cfg.sms_enabled && requester.phone) {
      await sendSMS(cfg, { to: requester.phone, body: `[SDDI] งาน ${request.tracking_id} เสร็จสมบูรณ์แล้ว กรุณาเข้าระบบเพื่อประเมิน` });
    }
  } catch(e) { console.error('[Notify] notifyCompleted error:', e.message); }
}

/**
 * Trigger: SLA ใกล้เกิน (เรียกจาก cron / manual)
 */
async function notifySLAWarning(request) {
  try {
    const cfg = await getCfg();
    if (!cfg.enabled) return;
    const managers = await db.collection('users').where('role','in',['manager','admin']).get();
    for (const doc of managers.docs) {
      const m = doc.data();
      const title = `⚠️ งานซ่อมใกล้เกิน SLA — ${request.tracking_id}`;
      const lines = [`งาน: ${request.description?.slice(0,60)}`, `ประเภท: ${request.category}`, `กำหนด SLA: ${new Date(request.sla_deadline).toLocaleString('th-TH')}`];
      if (cfg.email_enabled && m.email) {
        await sendEmail(cfg, { to: m.email, subject: title, html: emailHTML(title, lines, request.tracking_id) });
      }
    }
  } catch(e) { console.error('[Notify] notifySLAWarning error:', e.message); }
}

module.exports = { notifyNewRequest, notifyAssigned, notifyCompleted, notifySLAWarning, getCfg, invalidateCfg, sendEmail, sendSMS };
