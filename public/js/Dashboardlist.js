/* ═══════════════════════════════════════
   PAGE: DASHBOARD
═══════════════════════════════════════ */
async function pageDashboard(){
  const c=document.getElementById('page-content');
  c.innerHTML = loadingState();
  try {
    const data = await apiFetch('/dashboard');
    const tot = data.total;
    const catArr = data.by_category || [];
    const maxCat = Math.max(...catArr.map(x=>x.count), 1);
    const avgScore = data.satisfaction.avg || 0;
    const techs = data.tech_perf || [];
    const monthly = data.monthly || [];
    const maxMon = Math.max(...monthly.map(m=>m.count), 1);

    c.innerHTML=`
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
      ${[['⭐','คะแนนพึงพอใจ',avgScore?avgScore+'/5.0':'–','var(--amber)'],['✅','อัตราสำเร็จ',tot.total?Math.round(tot.done/tot.total*100)+'%':'0%','var(--green)'],['📝','ผลประเมินทั้งหมด',(data.satisfaction.count||0)+' รายการ','var(--violet)']].map(([ico,lbl,val,color])=>`
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
