/* ═══════════════════════════════════════
   PAGE: DASHBOARD — router by role
═══════════════════════════════════════ */
async function pageDashboard(){
  const role = APP.user?.role;
  if(role==='technician') return pageDashboardTech();
  if(role==='user') return pageDashboardUser();
  return pageDashboardAdmin();
}

/* ──────────────────────────────────────
   ADMIN / MANAGER DASHBOARD (SRS 2.7.2)
──────────────────────────────────────── */
async function pageDashboardAdmin(){
  const c=document.getElementById('page-content');
  c.innerHTML = loadingState();
  try {
    const data = await apiFetch('/dashboard');
    const tot = data.total;
    const catArr = data.by_category || [];
    const maxCat = Math.max(...catArr.map(x=>x.count), 1);
    const avgScore = data.satisfaction?.avg || 0;
    const techs = data.tech_perf || [];
    const monthly = data.monthly || [];
    const maxMon = Math.max(...monthly.map(m=>m.count), 1);

    const atRisk = data.at_risk_sla_items || [];
    const lowStock = data.low_stock_items || [];

    c.innerHTML=`
    ${(atRisk.length || lowStock.length) ? `
      <div class="mb2" style="display:flex;flex-direction:column;gap:.75rem">
        ${atRisk.map(r => `<div class="alert al-warn" style="display:flex;justify-content:space-between;align-items:center">
          <div>⏰ <strong>งานเสี่ยงเกิน SLA:</strong> ${r.tracking_id} (${r.description?.slice(0,40)}...)</div>
          <button class="btn btn-primary btn-xs" onclick="switchPage('request-detail', {id:'${r.id}'})">จัดการ</button>
        </div>`).join('')}
        ${lowStock.map(m => `<div class="alert al-danger" style="display:flex;justify-content:space-between;align-items:center">
          <div>⚠️ <strong>ของใกล้หมด:</strong> ${m.name} (คงเหลือ ${m.quantity} ${m.unit})</div>
          <button class="btn btn-primary btn-xs" onclick="switchPage('materials')">เติมของ</button>
        </div>`).join('')}
      </div>
    ` : ''}

    <div class="stats-grid">
      ${[['📋',tot.total,'ทั้งหมด','c-blue'],['⏳',tot.pending,'รอดำเนินการ','c-amber'],['⚙️',tot.in_progress,'กำลังดำเนินการ','c-blue'],['🔍',tot.review,'รอตรวจสอบ','c-violet'],['✅',tot.done,'เสร็จสมบูรณ์','c-green'],['🚨',tot.overdue,'เกิน SLA','c-red'],['⚡',tot.emergency,'ฉุกเฉิน','c-red']].map(([ico,val,lbl,cls])=>`
      <div class="scard ${cls}">
        <div class="scard-row"><div class="scard-ico">${ico}</div></div>
        <div class="scard-val">${val||0}</div><div class="scard-lbl">${lbl}</div>
        <div class="scard-bar"></div><div class="scard-glow"></div>
      </div>`).join('')}
    </div>

    <div class="g2 mb">
      <div class="card">
        <div class="card-h"><div class="card-t">📈 แนวโน้มรายเดือน</div></div>
        <div class="card-b">
          <div style="display:flex;align-items:flex-end;gap:6px;height:130px;padding-top:.5rem">
            ${monthly.length ? monthly.map(m=>`
              <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                <span style="font-size:.6rem;color:var(--spark);font-weight:700">${m.count}</span>
                <div style="width:100%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,var(--spark),var(--spark2));height:${Math.max(4,Math.round(m.count/maxMon*110))}px;opacity:.85"></div>
                <span style="font-size:.58rem;color:var(--chalk3)">${m.month?m.month.slice(5):''}</span>
              </div>`).join('') : emptyState('📊','ไม่มีข้อมูล')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><div class="card-t">🏷️ ประเภทงานซ่อม</div></div>
        <div class="card-b">
          <div class="barchart">
            ${catArr.length ? catArr.map(c=>`
              <div class="brow">
                <div class="bl">${catIcon(c.category)} ${c.category}</div>
                <div class="bt"><div class="bf" style="width:${Math.round(c.count/maxCat*100)}%;background:var(--spark)"></div></div>
                <div class="bv">${c.count}</div>
              </div>`).join('') : emptyState('🏷️','ไม่มีข้อมูล')}
          </div>
        </div>
      </div>
    </div>

    <div class="g3 mb">
      ${[['⭐','คะแนนพึงพอใจ',avgScore?avgScore+'/5.0':'–','var(--amber)'],['✅','อัตราสำเร็จ',tot.total?Math.round(tot.done/tot.total*100)+'%':'0%','var(--green)'],['📝','ผลประเมินทั้งหมด',(data.satisfaction?.count||0)+' รายการ','var(--violet)']].map(([ico,lbl,val,color])=>`
        <div class="card">
          <div class="card-b" style="display:flex;align-items:center;gap:1rem">
            <div style="font-size:1.75rem">${ico}</div>
            <div><div style="font-size:1.5rem;font-weight:900;color:${color};font-family:var(--mono)">${val}</div><div class="text-muted">${lbl}</div></div>
          </div>
        </div>`).join('')}
    </div>

    <div class="card">
      <div class="card-h"><div class="card-t">👷 ประสิทธิภาพช่างซ่อม</div></div>
      <div class="tw"><table>
        <thead><tr><th>ชื่อช่าง</th><th>งานทั้งหมด</th><th>เสร็จแล้ว</th><th>คะแนนเฉลี่ย</th><th>อัตราสำเร็จ</th></tr></thead>
        <tbody>${techs.map(t=>{
          const rate=t.total?Math.round(t.done/t.total*100):0;
          return`<tr>
            <td><strong>${t.name}</strong></td>
            <td class="mono">${t.total}</td>
            <td><span class="badge b-green">${t.done}</span></td>
            <td>${t.avg_score>0?`<span style="color:var(--amber)">⭐ ${t.avg_score}</span>`:'–'}</td>
            <td>
              <div class="flex ic gap2">
                <div class="progress" style="flex:1"><div class="pbar" style="width:${rate}%;background:${rate>=80?'var(--green)':rate>=50?'var(--amber)':'var(--red)'}"></div></div>
                <span class="text-xs mono">${rate}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')||'<tr><td colspan="5">'+emptyState('👷','ไม่มีข้อมูล')+'</td></tr>'}</tbody>
      </table></div>
    </div>`;
  } catch(e){ c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}

/* ──────────────────────────────────────
   TECHNICIAN DASHBOARD (SRS 2.7.3)
──────────────────────────────────────── */
async function pageDashboardTech(){
  const c=document.getElementById('page-content');
  c.innerHTML=loadingState();
  try {
    const data = await apiFetch('/dashboard/tech');
    const S = data.stats;

    const atRisk = data.at_risk_sla_items || [];

    c.innerHTML=`
    ${atRisk.length ? `
      <div class="mb2">
        ${atRisk.map(r => `<div class="alert al-warn" style="display:flex;justify-content:space-between;align-items:center">
          <div>⏰ <strong>งานเสี่ยงเกิน SLA (ใกล้ครบกำหนด):</strong> ${r.tracking_id}</div>
          <button class="btn btn-primary btn-xs" onclick="switchPage('request-detail', {id:'${r.id}'})">ไปจัดการ</button>
        </div>`).join('')}
      </div>
    ` : ''}

    <!-- Greeting -->
    <div style="margin-bottom:1.25rem">
      <div style="font-size:1.1rem;font-weight:700">👋 สวัสดี, ${APP.user.name}</div>
      <div class="text-muted text-xs">Dashboard ช่างซ่อม • ${new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    </div>

    <div class="stats-grid mb2">
      ${[
        ['📋',S.today,'งานวันนี้','c-blue'],
        ['⚙️',S.in_progress,'กำลังดำเนินการ','c-amber'],
        ['🔍',data.review_tasks?.length||0,'รอตรวจสอบ','c-violet'],
        ['✅',S.done,'เสร็จสมบูรณ์','c-green'],
        ['📊',S.total,'รวมงานที่รับ','c-blue'],
        ['⭐',S.avg_score?S.avg_score+'/5':'ยังไม่มี','คะแนนเฉลี่ย','c-violet'],
      ].map(([ico,val,lbl,cls])=>`
        <div class="scard ${cls}">
          <div class="scard-row"><div class="scard-ico">${ico}</div></div>
          <div class="scard-val">${val}</div><div class="scard-lbl">${lbl}</div>
          <div class="scard-bar"></div><div class="scard-glow"></div>
        </div>`).join('')}
    </div>

    <div class="g2 mb2">
      <!-- งานที่กำลังดำเนินการ -->
      <div class="card">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">⚙️ งานที่กำลังดำเนินการ</div>
          <button class="btn btn-ghost btn-sm" onclick="switchPage('requests-list')">ดูทั้งหมด →</button>
        </div>
        <div class="card-b" style="padding:0">
          ${(data.in_progress_tasks||[]).length ? (data.in_progress_tasks||[]).map(r=>`
            <div onclick="switchPage('request-detail',{id:'${r.id}'})" style="padding:.75rem 1.25rem;border-bottom:1px solid var(--wire);cursor:pointer;transition:background .12s" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background=''">
              <div class="flex jb ic">
                <div class="flex ic gap2">
                  <span class="tid">${r.tracking_code||r.id?.slice(0,8)}</span>
                  ${uBadge(r.urgency||'ปกติ')}
                </div>
                ${sBadge(r.status)}
              </div>
              <div style="font-size:.8rem;font-weight:600;margin:.25rem 0">${r.description?.slice(0,60)||'–'}${r.description?.length>60?'...':''}</div>
              <div class="text-xs text-muted">${catIcon(r.category)} ${r.category||'–'} • ${r.location||'–'}</div>
              ${r.sla_deadline&&new Date(r.sla_deadline)<new Date()?'<div class="text-xs" style="color:var(--red);margin-top:2px">🚨 เกิน SLA</div>':''}
            </div>`).join('') : `<div style="padding:1.5rem">${emptyState('⚙️','ยังไม่มีงานที่กำลังดำเนินการ')}</div>`}
        </div>
      </div>

      <!-- งานวันนี้ (ทั้งระบบ ยังไม่มีการมอบหมาย) -->
      <div class="card">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">📋 งานแจ้งเข้าวันนี้</div>
          <button class="btn btn-ghost btn-sm" onclick="switchPage('requests-list')">รับงาน →</button>
        </div>
        <div class="card-b" style="padding:0">
          ${(data.today_tasks||[]).length ? (data.today_tasks||[]).map(r=>`
            <div onclick="switchPage('request-detail',{id:'${r.id}'})" style="padding:.75rem 1.25rem;border-bottom:1px solid var(--wire);cursor:pointer;transition:background .12s" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background=''">
              <div class="flex jb ic" style="margin-bottom:3px">
                ${uBadge(r.urgency||'ปกติ')}
                ${sBadge(r.status)}
              </div>
              <div style="font-size:.78rem;font-weight:600">${r.description?.slice(0,55)||'–'}${(r.description?.length||0)>55?'...':''}</div>
              <div class="text-xs text-muted mt1">${catIcon(r.category)} ${r.category||'–'} • ${r.location||'–'}</div>
            </div>`).join('') : `<div style="padding:1.5rem">${emptyState('📋','ไม่มีงานแจ้งเข้าวันนี้')}</div>`}
        </div>
      </div>
    </div>

    <!-- งานรอตรวจสอบ -->
    ${(data.review_tasks||[]).length ? `
    <div class="card mb2">
      <div class="card-h"><div class="card-t">🔍 งานรอตรวจสอบ (Manager ต้องอนุมัติ)</div></div>
      <div class="tw"><table>
        <thead><tr><th>รหัส</th><th>รายละเอียด</th><th>สถานที่</th><th>เร่งด่วน</th><th>แจ้งเมื่อ</th></tr></thead>
        <tbody>
        ${(data.review_tasks||[]).map(r=>`<tr onclick="switchPage('request-detail',{id:'${r.id}'})" style="cursor:pointer">
          <td class="tid">${r.tracking_code||r.id?.slice(0,8)}</td>
          <td>${r.description?.slice(0,50)||'–'}</td>
          <td class="text-xs">${r.location||'–'}</td>
          <td>${uBadge(r.urgency||'ปกติ')}</td>
          <td class="text-xs">${fmtDate(r.created_at,true)}</td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : ''}

    <!-- วัสดุใกล้หมด -->
    ${(data.low_materials||[]).length ? `
    <div class="card">
      <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
        <div class="card-t">⚠️ วัสดุใกล้หมดสต็อก</div>
        <button class="btn btn-ghost btn-sm" onclick="switchPage('materials')">จัดการคลัง →</button>
      </div>
      <div class="card-b" style="display:flex;flex-direction:column;gap:.5rem">
        ${(data.low_materials||[]).map(m=>`
          <div class="flex jb ic">
            <div>
              <div style="font-size:.8rem;font-weight:600">${m.name}</div>
              <div class="text-xs text-muted">${m.code||''} • ${m.category||'–'}</div>
            </div>
            <div class="flex ic gap2">
              <span class="badge b-red">${m.quantity||0} ${m.unit||'ชิ้น'}</span>
              <span class="text-xs text-muted">/ ${m.reorder_point||5}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <!-- ประวัติงานที่ทำเสร็จ -->
    ${(data.completed_history||[]).length ? `
    <div class="card" style="margin-top:1.25rem">
      <div class="card-h"><div class="card-t">✅ งานที่เสร็จล่าสุด (5 รายการ)</div></div>
      <div class="tw"><table>
        <thead><tr><th>รหัส</th><th>รายละเอียด</th><th>ประเภท</th><th>สถานที่</th><th>เสร็จเมื่อ</th></tr></thead>
        <tbody>
        ${(data.completed_history||[]).map(r=>`<tr onclick="switchPage('request-detail',{id:'${r.id}'})" style="cursor:pointer">
          <td class="tid">${r.tracking_code||r.id?.slice(0,8)}</td>
          <td class="text-sm">${r.description?.slice(0,45)||'–'}${(r.description?.length||0)>45?'...':''}</td>
          <td class="text-xs">${catIcon(r.category)} ${r.category||'–'}</td>
          <td class="text-xs">${r.location||'–'}</td>
          <td class="text-xs">${fmtDate(r.updated_at,true)}</td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : ''}`;
  } catch(e){ c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}

/* ──────────────────────────────────────
   USER DASHBOARD (SRS 2.7.4)
──────────────────────────────────────── */
async function pageDashboardUser(){
  const c=document.getElementById('page-content');
  c.innerHTML=loadingState();
  try {
    const data = await apiFetch('/dashboard/user');
    const S = data.stats;

    c.innerHTML=`
    <!-- Greeting -->
    <div style="margin-bottom:1.25rem">
      <div style="font-size:1.1rem;font-weight:700">👋 สวัสดี, ${APP.user.name}</div>
      <div class="text-muted text-xs">ภาพรวมการแจ้งซ่อมของคุณ • ${new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    </div>

    <!-- KPI -->
    <div class="stats-grid mb2">
      ${[
        ['📋',S.total,'แจ้งซ่อมทั้งหมด','c-blue'],
        ['⏳',S.pending,'รอดำเนินการ','c-amber'],
        ['⚙️',S.in_progress,'อยู่ระหว่างซ่อม','c-blue'],
        ['✅',S.done,'เสร็จสมบูรณ์','c-green'],
        ['⏱️',S.avg_wait_hours?S.avg_wait_hours+' ชม.':'–','เวลารอเฉลี่ย','c-violet'],
        ['⭐',S.already_evaluated,'ประเมินแล้ว','c-green'],
      ].map(([ico,val,lbl,cls])=>`
        <div class="scard ${cls}">
          <div class="scard-row"><div class="scard-ico">${ico}</div></div>
          <div class="scard-val">${val}</div><div class="scard-lbl">${lbl}</div>
          <div class="scard-bar"></div><div class="scard-glow"></div>
        </div>`).join('')}
    </div>

    <!-- งานที่กำลังดำเนินการอยู่ -->
    <div class="card mb2">
      <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
        <div class="card-t">🔄 งานแจ้งซ่อมที่อยู่ระหว่างดำเนินการ</div>
        <button class="btn btn-primary btn-sm" onclick="switchPage('request-new')">➕ แจ้งซ่อมใหม่</button>
      </div>
      <div class="card-b" style="padding:0">
        ${(data.active||[]).length ? (data.active||[]).map(r=>`
          <div onclick="switchPage('request-detail',{id:'${r.id}'})" style="padding:.875rem 1.25rem;border-bottom:1px solid var(--wire);cursor:pointer;transition:background .12s" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background=''">
            <div class="flex jb ic" style="margin-bottom:.375rem">
              <div class="flex ic gap2">
                <span class="tid">${r.tracking_code||r.id?.slice(0,8)}</span>
                <span style="font-size:.8rem;font-weight:600">${r.description?.slice(0,50)||'–'}${(r.description?.length||0)>50?'...':''}</span>
              </div>
              ${sBadge(r.status)}
            </div>
            <div class="flex ic gap2 text-muted text-xs">
              <span>${catIcon(r.category)} ${r.category||'–'}</span>
              <span>•</span>
              <span>📍 ${r.location||'–'}</span>
              <span>•</span>
              <span>${uBadge(r.urgency||'ปกติ')}</span>
              <span>•</span>
              <span>แจ้งเมื่อ ${fmtDate(r.created_at,true)}</span>
            </div>
            <!-- Progress Timeline -->
            <div class="tl" style="margin-top:.625rem">
              ${['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์'].map((st,i,arr)=>{
                const sts=['รอดำเนินการ','กำลังดำเนินการ','รอตรวจสอบ','เสร็จสมบูรณ์'];
                const cur=sts.indexOf(r.status);
                const state=i<cur?'done':i===cur?'curr':'';
                return`<div class="tl-step">
                  <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                    <div class="tl-dot ${state}">${i<cur?'✓':i+1}</div>
                    <div class="tl-lbl ${state}" style="font-size:.52rem;max-width:55px;text-align:center">${st}</div>
                  </div>
                  ${i<arr.length-1?`<div class="tl-line ${i<cur?'done':''}"></div>`:''}
                </div>`;
              }).join('')}
            </div>
          </div>`).join('') : `
          <div style="padding:2rem;text-align:center">
            ${emptyState('🎉','ไม่มีงานที่ค้างอยู่ ทุกอย่างเรียบร้อยดี!')}
            <button class="btn btn-primary btn-sm mt2" onclick="switchPage('request-new')">➕ แจ้งซ่อมใหม่</button>
          </div>`}
      </div>
    </div>

    <!-- ประวัติงานที่เสร็จแล้ว -->
    ${(data.history||[]).length ? `
    <div class="card">
      <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
        <div class="card-t">✅ ประวัติงานที่เสร็จสมบูรณ์</div>
        <button class="btn btn-ghost btn-sm" onclick="switchPage('track')">🔍 ติดตามด้วยรหัส →</button>
      </div>
      <div class="tw"><table>
        <thead><tr><th>รหัสติดตาม</th><th>รายละเอียด</th><th>ประเภท</th><th>สถานที่</th><th>เสร็จเมื่อ</th><th>ประเมิน</th></tr></thead>
        <tbody>
        ${(data.history||[]).map(r=>`<tr onclick="switchPage('request-detail',{id:'${r.id}'})" style="cursor:pointer">
          <td class="tid">${r.tracking_code||r.id?.slice(0,8)}</td>
          <td class="text-sm">${r.description?.slice(0,45)||'–'}${(r.description?.length||0)>45?'...':''}</td>
          <td class="text-xs">${catIcon(r.category)} ${r.category||'–'}</td>
          <td class="text-xs">${r.location||'–'}</td>
          <td class="text-xs">${fmtDate(r.updated_at,true)}</td>
          <td><span class="badge ${r.evaluated?'b-green':'b-gray'}">${r.evaluated?'✅ แล้ว':'– ยังไม่ได้'}</span></td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : ''}`;
  } catch(e){ c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}
