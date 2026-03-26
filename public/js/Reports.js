/* ═══════════════════════════════════════
   PAGE: REPORTS (SRS 2.8 - Full)
═══════════════════════════════════════ */
async function pageReports(){
  const c=document.getElementById('page-content');
  c.innerHTML=loadingState();
  try {
    const [summary, reqData] = await Promise.all([
      apiFetch('/reports/summary'),
      apiFetch('/reports/requests')
    ]);
    const T = summary.totals;
    const rows = reqData.rows || [];
    const mat = summary.materials;

    c.innerHTML=`
    <div class="flex jb ic mb2" style="flex-wrap:wrap;gap:.75rem">
      <div>
        <div style="font-size:1.1rem;font-weight:700">📊 รายงานและสรุปข้อมูล</div>
        <div class="text-muted text-xs">ออกรายงานสถิติ ประวัติงานซ่อม และข้อมูลวัสดุ ตาม SRS 2.8</div>
      </div>
    </div>

    <!-- TABS -->
    <div class="tab-bar" id="rpt-tabs">
      <button class="tab-btn on" onclick="switchRptTab(this,'repair')">🔧 รายงานการแจ้งซ่อม</button>
      <button class="tab-btn" onclick="switchRptTab(this,'materials')">📦 รายงานวัสดุ</button>
      <button class="tab-btn" onclick="switchRptTab(this,'perf')">👷 รายงานประสิทธิภาพ</button>
    </div>

    <!-- ════════════════════════════════ TAB 1: REPAIR ════════════════════════════════ -->
    <div id="rpt-repair">
      <!-- KPI row -->
      <div class="stats-grid mb2">
        ${[
          ['📋',T.total,'แจ้งซ่อมทั้งหมด','c-blue'],
          ['✅',T.done,'เสร็จสมบูรณ์','c-green'],
          ['⏳',T.pending,'รอดำเนินการ','c-amber'],
          ['📈',T.success_rate+'%','อัตราสำเร็จ','c-green'],
          ['⏱️', T.avg_resolution_hours ? T.avg_resolution_hours+' ชม.' : '–','เวลาเฉลี่ย/งาน','c-blue'],
          ['💰','฿'+(T.total_cost||0).toLocaleString(),'ค่าใช้จ่ายรวม','c-violet'],
        ].map(([ico,val,lbl,cls])=>`
          <div class="scard ${cls}">
            <div class="scard-row"><div class="scard-ico">${ico}</div></div>
            <div class="scard-val">${val||0}</div><div class="scard-lbl">${lbl}</div>
            <div class="scard-bar"></div><div class="scard-glow"></div>
          </div>`).join('')}
      </div>

      <div class="g2 mb2">
        <!-- จำนวนตามประเภท -->
        <div class="card">
          <div class="card-h"><div class="card-t">🏷️ จำนวนการแจ้งซ่อมตามประเภท</div></div>
          <div class="card-b">
            <div class="barchart">
              ${(()=>{
                const cats = summary.by_category||[];
                const max = Math.max(...cats.map(x=>x.count),1);
                return cats.length ? cats.map(x=>`
                  <div class="brow">
                    <div class="bl">${catIcon(x.category)} ${x.category}</div>
                    <div class="bt"><div class="bf" style="width:${Math.round(x.count/max*100)}%;background:var(--spark)"></div></div>
                    <div class="bv">${x.count}</div>
                  </div>`) .join('') : emptyState('🏷️','ไม่มีข้อมูล');
              })()}
            </div>
          </div>
        </div>

        <!-- แนวโน้มรายเดือน -->
        <div class="card">
          <div class="card-h"><div class="card-t">📈 แนวโน้มการชำรุด (รายเดือน)</div></div>
          <div class="card-b">
            <div style="display:flex;align-items:flex-end;gap:6px;height:130px">
              ${(()=>{
                const monthly = summary.monthly||[];
                const max = Math.max(...monthly.map(m=>m.total),1);
                return monthly.length ? monthly.map(m=>`
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                    <span style="font-size:.6rem;color:var(--spark);font-weight:700">${m.total}</span>
                    <div style="width:100%;border-radius:4px 4px 0 0;background:linear-gradient(180deg,var(--spark),var(--spark2));height:${Math.max(4,Math.round(m.total/max*110))}px"></div>
                    <span style="font-size:.55rem;color:var(--chalk3)">${m.month?m.month.slice(5):''}</span>
                  </div>`) .join('') : emptyState('📈','ไม่มีข้อมูล');
              })()}
            </div>
          </div>
        </div>
      </div>

      <!-- อัตราสำเร็จตามประเภท -->
      <div class="card mb2">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">📊 อัตราการแก้ไขสำเร็จ & ค่าใช้จ่าย ตามประเภท</div>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-ghost btn-sm" onclick="exportCSV('cat-table','รายงานประเภทงานซ่อม')">⬇️ CSV</button>
            <button class="btn btn-success btn-sm" onclick="exportExcel('cat-table','รายงานประเภทงานซ่อม')">📗 Excel</button>
            <button class="btn btn-primary btn-sm" onclick="printSection('rpt-repair','รายงานการแจ้งซ่อม')">🖨️ PDF</button>
          </div>
        </div>
        <div class="tw"><table id="cat-table">
          <thead><tr><th>ประเภทงาน</th><th>จำนวน</th><th>เสร็จแล้ว</th><th>อัตราสำเร็จ</th><th>ค่าใช้จ่าย</th></tr></thead>
          <tbody>
          ${(summary.by_category||[]).map(x=>{
            const rate=x.success_rate||0;
            return`<tr>
              <td>${catIcon(x.category)} <strong>${x.category}</strong></td>
              <td class="mono">${x.count}</td>
              <td><span class="badge b-green">${x.done}</span></td>
              <td>
                <div class="flex ic gap2">
                  <div class="progress" style="min-width:80px;flex:1"><div class="pbar" style="width:${rate}%;background:${rate>=80?'var(--green)':rate>=50?'var(--amber)':'var(--red)'}"></div></div>
                  <span class="text-xs mono">${rate}%</span>
                </div>
              </td>
              <td class="mono">฿${(x.cost||0).toLocaleString()}</td>
            </tr>`;}).join('')||`<tr><td colspan="5">${emptyState('📊','ไม่มีข้อมูล')}</td></tr>`}
          </tbody>
        </table></div>
      </div>

      <!-- ประวัติงานซ่อมทั้งหมด -->
      <div class="card">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">📋 ประวัติงานซ่อมทั้งหมด</div>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-ghost btn-sm" onclick="exportCSV('req-table','ประวัติงานซ่อม')">⬇️ CSV</button>
            <button class="btn btn-success btn-sm" onclick="exportExcel('req-table','ประวัติงานซ่อม')">📗 Excel</button>
          </div>
        </div>
        <div class="tw"><table id="req-table">
          <thead><tr><th>รหัส</th><th>ประเภท</th><th>สถานที่</th><th>ผู้แจ้ง</th><th>ความเร่งด่วน</th><th>สถานะ</th><th>ค่าใช้จ่าย</th><th>วันที่แจ้ง</th></tr></thead>
          <tbody>
          ${rows.map(r=>`<tr>
            <td class="mono text-xs tid">${r.tracking_code||r.id?.slice(0,8)||'–'}</td>
            <td>${catIcon(r.category)} ${r.category||'–'}</td>
            <td class="text-xs">${r.location||'–'}</td>
            <td class="text-xs">${r.requester_name||'–'}</td>
            <td>${uBadge(r.urgency||'ปกติ')}</td>
            <td>${sBadge(r.status||'รอดำเนินการ')}</td>
            <td class="mono text-xs">${r.repair_cost?'฿'+Number(r.repair_cost).toLocaleString():'–'}</td>
            <td class="text-xs">${fmtDate(r.created_at,true)}</td>
          </tr>`).join('')||`<tr><td colspan="8">${emptyState('📋','ไม่มีข้อมูล')}</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>

    <!-- ════════════════════════════════ TAB 2: MATERIALS ════════════════════════════════ -->
    <div id="rpt-materials" style="display:none">
      <div class="stats-grid mb2">
        ${[
          ['📦',mat.items,'รายการวัสดุทั้งหมด','c-blue'],
          ['💰','฿'+(mat.total_value||0).toLocaleString(),'มูลค่าวัสดุคงคลัง','c-green'],
          ['⚠️',mat.low_stock,'รายการใกล้หมด','c-red'],
          ['✅',mat.items-mat.low_stock,'สต็อกปกติ','c-green'],
        ].map(([ico,val,lbl,cls])=>`
          <div class="scard ${cls}">
            <div class="scard-row"><div class="scard-ico">${ico}</div></div>
            <div class="scard-val">${val||0}</div><div class="scard-lbl">${lbl}</div>
            <div class="scard-bar"></div><div class="scard-glow"></div>
          </div>`).join('')}
      </div>

      <div class="g2 mb2">
        <!-- วัสดุที่ใช้บ่อย -->
        <div class="card">
          <div class="card-h"><div class="card-t">🔥 วัสดุที่ใช้บ่อย (Top 5)</div></div>
          <div class="card-b">
            ${(mat.mat_most_used||[]).length ? `
            <div style="display:flex;flex-direction:column;gap:.625rem">
              ${(mat.mat_most_used||[]).map((m,i)=>`
                <div class="flex ic gap2">
                  <div style="width:22px;height:22px;background:var(--spark-g);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:var(--spark);flex-shrink:0">${i+1}</div>
                  <div style="flex:1">
                    <div style="font-size:.78rem;font-weight:600">${m.name}</div>
                    <div style="font-size:.65rem;color:var(--chalk3)">คงเหลือ ${m.quantity} ${m.unit} / จุดสั่ง ${m.reorder_point}</div>
                  </div>
                  <span class="badge ${m.quantity<=m.reorder_point?'b-red':'b-amber'}">${m.quantity<=m.reorder_point?'⚠️ ใกล้หมด':'ปกติ'}</span>
                </div>`).join('')}
            </div>` : emptyState('🔥','ไม่มีข้อมูล')}
          </div>
        </div>

        <!-- วัสดุเสื่อมสภาพ -->
        <div class="card">
          <div class="card-h"><div class="card-t">🗑️ วัสดุเสื่อมสภาพ/หมดสต็อก</div></div>
          <div class="card-b">
            ${(mat.mat_degraded||[]).length ? `
            <div style="display:flex;flex-direction:column;gap:.5rem">
              ${(mat.mat_degraded||[]).map(m=>`
                <div class="flex ic gap2">
                  <span class="badge b-red" style="font-size:.6rem">${m.quantity===0?'หมดแล้ว':'วิกฤต'}</span>
                  <div style="flex:1">
                    <div style="font-size:.78rem;font-weight:600">${m.name}</div>
                    <div style="font-size:.65rem;color:var(--chalk3)">คงเหลือ ${m.quantity} ${m.unit}</div>
                  </div>
                  <span class="text-xs mono" style="color:var(--red)">฿${(m.unit_price||0).toLocaleString()}</span>
                </div>`).join('')}
            </div>` : `<div class="empty"><div class="ei">✅</div><div>ไม่มีวัสดุเสื่อมสภาพ</div></div>`}
          </div>
        </div>
      </div>

      <!-- รายงานสต็อกคงเหลือ (Export) -->
      <div class="card mb2">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">📦 รายงานสต็อกคงเหลือ</div>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-ghost btn-sm" onclick="exportCSV('stock-table','รายงานสต็อกวัสดุ')">⬇️ CSV</button>
            <button class="btn btn-success btn-sm" onclick="exportExcel('stock-table','รายงานสต็อกวัสดุ')">📗 Excel</button>
            <button class="btn btn-primary btn-sm" onclick="printSection('rpt-materials','รายงานคลังวัสดุ')">🖨️ PDF</button>
          </div>
        </div>
        <div class="tw"><table id="stock-table">
          <thead><tr><th>รหัส SKU</th><th>ชื่อวัสดุ</th><th>หมวดหมู่</th><th>คงเหลือ</th><th>หน่วย</th><th>จุดสั่งซื้อ</th><th>ราคา/หน่วย</th><th>มูลค่ารวม</th><th>สถานะ</th></tr></thead>
          <tbody>
          ${(mat.low_stock_items||[]).map(m=>{
            const isLow=(m.quantity||0)<=(m.reorder_point||5);
            return`<tr>
              <td class="mono text-xs">${m.code||'–'}</td>
              <td><strong>${m.name}</strong></td>
              <td>${m.category||'–'}</td>
              <td><span class="badge ${isLow?'b-red':'b-green'}">${m.quantity||0}</span></td>
              <td>${m.unit||'ชิ้น'}</td>
              <td class="mono">${m.reorder_point||5}</td>
              <td class="mono">฿${(m.unit_price||0).toLocaleString()}</td>
              <td class="mono">฿${((m.quantity||0)*(m.unit_price||0)).toLocaleString()}</td>
              <td>${isLow?'<span class="badge b-red">⚠️ ต้องสั่งซื้อ</span>':'<span class="badge b-green">✅ ปกติ</span>'}</td>
            </tr>`;}).join('')||`<tr><td colspan="9">${emptyState('📦','ไม่มีรายการวัสดุใกล้หมด')}</td></tr>`}
          </tbody>
        </table></div>
      </div>

      ${mat.mat_degraded?.length>0?`
      <!-- รายงานวัสดุเสื่อมสภาพ (Export) -->
      <div class="card">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">🗑️ รายงานวัสดุเสื่อมสภาพ</div>
          <button class="btn btn-ghost btn-sm" onclick="exportCSV('degrade-table','รายงานวัสดุเสื่อมสภาพ')">⬇️ CSV</button>
        </div>
        <div class="tw"><table id="degrade-table">
          <thead><tr><th>รหัส</th><th>ชื่อวัสดุ</th><th>คงเหลือ</th><th>หน่วย</th><th>จุดสั่งซื้อ</th><th>สถานะ</th></tr></thead>
          <tbody>
          ${(mat.mat_degraded||[]).map(m=>`<tr>
            <td class="mono text-xs">${m.code||'–'}</td>
            <td><strong>${m.name}</strong></td>
            <td><span class="badge b-red">${m.quantity}</span></td>
            <td>${m.unit||'ชิ้น'}</td>
            <td>${m.reorder_point}</td>
            <td>${m.quantity===0?'<span class="badge b-red">🚫 หมดสต็อก</span>':'<span class="badge b-amber">⚠️ วิกฤต</span>'}</td>
          </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`:''}
    </div>

    <!-- ════════════════════════════════ TAB 3: PERF ════════════════════════════════ -->
    <div id="rpt-perf" style="display:none">
      <!-- Satisfaction breakdown -->
      <div class="g2 mb2">
        <div class="card">
          <div class="card-h"><div class="card-t">⭐ ความพึงพอใจของผู้ใช้</div></div>
          <div class="card-b">
            <div style="text-align:center;margin-bottom:1rem">
              <div style="font-size:3rem;font-weight:900;color:var(--amber);font-family:var(--mono)">${summary.satisfaction.avg||'–'}</div>
              <div class="text-muted text-xs">คะแนนเฉลี่ย / 5.0 (${summary.satisfaction.count} ผลประเมิน)</div>
            </div>
            ${[
              ['คุณภาพงานซ่อม',summary.satisfaction.quality||0,'var(--green)'],
              ['ความรวดเร็ว',summary.satisfaction.speed||0,'var(--spark)'],
              ['การให้บริการของช่าง',summary.satisfaction.service||0,'var(--violet)'],
            ].map(([lbl,val,color])=>`
              <div style="margin-bottom:.625rem">
                <div class="flex jb" style="margin-bottom:3px"><span class="text-xs">${lbl}</span><span class="mono text-xs">${val}/5</span></div>
                <div class="progress"><div class="pbar" style="width:${val/5*100}%;background:${color}"></div></div>
              </div>`).join('')}
          </div>
        </div>

        <!-- พื้นที่ที่มีปัญหาบ่อย -->
        <div class="card">
          <div class="card-h"><div class="card-t">📍 พื้นที่ที่มีปัญหาบ่อย</div></div>
          <div class="card-b">
            <div class="barchart">
              ${(()=>{
                const hs = summary.hotspots||[];
                const max = Math.max(...hs.map(x=>x.count),1);
                return hs.length ? hs.map(x=>`
                  <div class="brow">
                    <div class="bl" style="font-size:.7rem">${x.location}</div>
                    <div class="bt"><div class="bf" style="width:${Math.round(x.count/max*100)}%;background:var(--red)"></div></div>
                    <div class="bv">${x.count}</div>
                  </div>`) .join('') : emptyState('📍','ไม่มีข้อมูล');
              })()}
            </div>
          </div>
        </div>
      </div>

      <!-- Tech performance table -->
      <div class="card">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">👷 ผลการปฏิบัติงานของช่าง</div>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-ghost btn-sm" onclick="exportCSV('tech-table','รายงานประสิทธิภาพช่าง')">⬇️ CSV</button>
            <button class="btn btn-success btn-sm" onclick="exportExcel('tech-table','รายงานประสิทธิภาพช่าง')">📗 Excel</button>
            <button class="btn btn-primary btn-sm" onclick="printSection('rpt-perf','รายงานประสิทธิภาพ')">🖨️ PDF</button>
          </div>
        </div>
        <div class="tw"><table id="tech-table">
          <thead><tr><th>ชื่อช่าง</th><th>งานทั้งหมด</th><th>เสร็จแล้ว</th><th>กำลังดำเนินการ</th><th>ค่าใช้จ่ายรวม</th><th>อัตราสำเร็จ</th><th>ความพึงพอใจ</th></tr></thead>
          <tbody>
          ${(summary.tech_performance||[]).map(t=>{
            const rate=t.success_rate||0;
            return`<tr>
              <td><strong>${t.name}</strong></td>
              <td class="mono">${t.total}</td>
              <td><span class="badge b-green">${t.done}</span></td>
              <td><span class="badge b-blue">${t.in_progress||0}</span></td>
              <td class="mono text-xs">฿${(t.cost||0).toLocaleString()}</td>
              <td>
                <div class="flex ic gap2">
                  <div class="progress" style="min-width:80px;flex:1"><div class="pbar" style="width:${rate}%;background:${rate>=80?'var(--green)':rate>=50?'var(--amber)':'var(--red)'}"></div></div>
                  <span class="text-xs mono">${rate}%</span>
                </div>
              </td>
              <td>${t.avg_score>0?`<span style="color:var(--amber)">⭐ ${t.avg_score}</span>`:'–'}</td>
            </tr>`;}).join('')||`<tr><td colspan="7">${emptyState('👷','ไม่มีข้อมูลช่างซ่อม')}</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>`;
  } catch(e){ c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}

function switchRptTab(btn, tab) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  ['repair','materials','perf'].forEach(t=>{
    const el=document.getElementById('rpt-'+t);
    if(el) el.style.display = t===tab ? '' : 'none';
  });
}

/* ─── Export Excel (.xlsx) ─── */
function exportExcel(tableId, filename) {
  const table = document.getElementById(tableId);
  if(!table){ toast('ไม่พบตารางข้อมูล','err'); return; }
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(table);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  
  // Export file
  const d = new Date().toLocaleDateString('th-TH').replace(/\//g,'-');
  XLSX.writeFile(wb, `${filename}_${d}.xlsx`);
  toast('ดาวน์โหลด Excel เรียบร้อย ✅');
}

/* ─── Export CSV ─── */
function exportCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if(!table){ toast('ไม่พบตารางข้อมูล','err'); return; }
  const rows = [...table.querySelectorAll('tr')];
  const csv = rows.map(r =>
    [...r.querySelectorAll('th,td')].map(cell => {
      const text = cell.innerText.replace(/\n/g,' ').trim();
      return `"${text.replace(/"/g,'""')}"`;
    }).join(',')
  ).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`${filename}_${new Date().toLocaleDateString('th-TH').replace(/\//g,'-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('ดาวน์โหลด CSV เรียบร้อย ✅');
}

/* ─── Print / PDF ─── */
function printSection(sectionId, title) {
  const section = document.getElementById(sectionId);
  if(!section){ toast('ไม่พบส่วนข้อมูล','err'); return; }
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Sarabun',sans-serif;font-size:12px;color:#111;padding:1.5cm 1.8cm;background:#fff;}
      h1{font-size:22px;margin-bottom:8px;color:#1a1a2e;text-align:center;}
      .rpt-meta{font-size:12px;color:#4b5563;margin-bottom:24px;padding-bottom:12px;border-bottom:3px solid #1a1a2e;text-align:center;}
      table{width:100%;border-collapse:collapse;margin-top:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
      th{background:#1a1a2e;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;}
      td{padding:8px 12px;border-bottom:1px solid #e1e7ef;font-size:11px;vertical-align:middle;color:#1f2937;}
      tr:nth-child(even) td{background:#f9fafb;}
      .badge{display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;}
      .b-green{background:#d1fae5;color:#065f46;} .b-red{background:#fee2e2;color:#991b1b;}
      .b-amber{background:#fef3c7;color:#92400e;} .b-blue{background:#dbeafe;color:#1e40af;}
      .b-violet{background:#ede9fe;color:#5b21b6;}
      .stats-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px;}
      .scard{border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;text-align:center;}
      .scard-val{font-size:1.3rem;font-weight:900;} .scard-lbl{font-size:.65rem;color:#6b7280;}
      .card{border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;overflow:hidden;page-break-inside:avoid;}
      .card-h{padding:7px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:12px;background:#f8fafc;}
      .card-b{padding:10px 12px;}
      .g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;}
      .barchart{display:flex;flex-direction:column;gap:6px;}
      .brow{display:grid;grid-template-columns:120px 1fr 40px;align-items:center;gap:8px;}
      .bl{font-size:10px;color:#6b7280;text-align:right;}  .bv{font-size:10px;text-align:right;}
      .bt{background:#f1f5f9;border-radius:3px;height:6px;} .bf{height:100%;border-radius:3px;background:#1a1a2e;}
      .progress{background:#e5e7eb;border-radius:4px;height:6px;width:100px;display:inline-block;vertical-align:middle;}
      .pbar{height:6px;border-radius:4px;background:#1a1a2e;display:inline-block;}
      .tab-bar,.tab-btn,.btn{display:none!important}
      @media print{body{padding:0;}}
    </style>
  </head><body>
    <h1>${title}</h1>
    <div class="rpt-meta">ออกรายงาน ณ วันที่ ${new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'})} • ระบบแจ้งซ่อม SDDI-2025</div>
    ${section.innerHTML}
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
  </body></html>`);
  win.document.close();
}
