/* ═══════════════════════════════════════
   PAGE: SYSTEM LOG (AUDIT LOGS)
   Admin-only: view system activity
═══════════════════════════════════════ */
async function pageSystemLog() {
  const c = document.getElementById('page-content');
  if (!['admin', 'manager'].includes(APP.user?.role)) {
    c.innerHTML = `<div class="alert al-danger">❌ เฉพาะ Admin และ Manager เท่านั้น</div>`;
    return;
  }
  
  c.innerHTML = loadingState();
  
  try {
    const data = await apiFetch('/audit-logs?limit=100');
    const logs = data.items;
    
    c.innerHTML = `
    <div style="max-width:960px">
      <div class="flex ic jb mb2">
        <div>
          <div style="font-size:1.1rem;font-weight:700;margin-bottom:.25rem">📋 บันทึกกิจกรรมระบบ (System Audit Log)</div>
          <div class="text-muted text-xs">ตรวจสอบความเคลื่อนไหวและการทำงานของระบบย้อนหลัง</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="pageSystemLog()">↺ รีเฟรช</button>
      </div>

      <div class="card">
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>วัน-เวลา</th>
                <th>ผู้กระทำ</th>
                <th>กิจกรรม (Action)</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length ? logs.map(l => `
                <tr>
                  <td class="text-xs" style="white-space:nowrap">${fmtDate(l.created_at, true)}</td>
                  <td>
                    <div style="font-weight:600;font-size:.85rem">${l.user_id === 'SYSTEM' ? '🤖 {SYSTEM}' : (l.user_name || l.user_id)}</div>
                    <div class="text-xs text-muted">${l.user_id}</div>
                  </td>
                  <td><span class="badge ${logBadge(l.action)}">${l.action}</span></td>
                  <td class="text-sm" style="color:var(--chalk2)">${l.detail || '–'}</td>
                </tr>
              `).join('') : `<tr><td colspan="4">${emptyState('📑', 'ยังไม่มีบันทึกกิจกรรม')}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
  } catch (e) {
    c.innerHTML = `<div class="alert al-danger">❌ ${e.message}</div>`;
  }
}

function logBadge(action) {
  if (action.includes('CREATE')) return 'b-green';
  if (action.includes('DELETE')) return 'b-red';
  if (action.includes('UPDATE') || action.includes('ASSIGN')) return 'b-blue';
  if (action.includes('WITHDRAW')) return 'b-amber';
  return 'b-gray';
}
