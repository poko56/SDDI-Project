/* ═══════════════════════════════════════
   PAGE: PURCHASE ORDERS (SRS 2.6.2-2.6.3)
═══════════════════════════════════════ */
async function pagePurchaseOrders(){
  const c=document.getElementById('page-content');
  const role=APP.user?.role;
  const canManage=['admin','manager'].includes(role);
  c.innerHTML=loadingState();
  try {
    const [poData, expiryData, matData] = await Promise.all([
      apiFetch('/purchase-orders'),
      apiFetch('/purchase-orders/expiry-alerts'),
      apiFetch('/materials')
    ]);
    const pos = poData.items || [];
    const expiring = expiryData.items || [];
    const mats = matData.items || [];

    const statusColor = {
      'รออนุมัติ':'b-amber','อนุมัติแล้ว':'b-blue','รับของแล้ว':'b-green','ยกเลิก':'b-red'
    };

    c.innerHTML=`
    <div class="flex jb ic mb2" style="flex-wrap:wrap;gap:.75rem">
      <div>
        <div style="font-size:1.1rem;font-weight:700">📋 ใบจัดซื้อและตรวจรับวัสดุ</div>
        <div class="text-muted text-xs">SRS 2.6.2-2.6.3 • สร้าง PO, อนุมัติ, รับสินค้า, ติดตามอายุการใช้งาน</div>
      </div>
      ${canManage?`<button class="btn btn-primary" onclick="openCreatePO(${JSON.stringify(mats).replace(/"/g,'&quot;')})">➕ สร้างใบจัดซื้อ</button>`:''}
    </div>

    <!-- Expiry Alerts -->
    ${expiring.length ? `
    <div class="alert al-warn mb2" style="flex-direction:column;align-items:flex-start;gap:.5rem">
      <div style="font-weight:700;font-size:.85rem">⏰ แจ้งเตือนวัสดุใกล้/หมดอายุ (${expiring.length} รายการ)</div>
      ${expiring.map(m=>`
        <div class="flex jb ic w100">
          <span class="text-sm"><strong>${m.name}</strong> (${m.code||'–'})</span>
          <span class="badge ${m.expired?'b-red':'b-amber'}">
            ${m.expired?`🚨 หมดอายุแล้ว ${Math.abs(m.days_left)} วัน`:`⏰ อีก ${m.days_left} วัน (${new Date(m.expiry_date).toLocaleDateString('th-TH')})`}
          </span>
        </div>`).join('')}
    </div>` : ''}

    <!-- Tabs -->
    <div class="tab-bar mb2" id="po-tabs">
      <button class="tab-btn on" onclick="switchPOTab(this,'list')">📋 รายการใบจัดซื้อ (${pos.length})</button>
      <button class="tab-btn" onclick="switchPOTab(this,'expiry')">⏰ อายุการใช้งาน</button>
    </div>

    <!-- PO List -->
    <div id="po-list">
      ${pos.length ? `
      <div class="card">
        <div class="tw"><table>
          <thead><tr><th>รหัส PO</th><th>Supplier</th><th>รายการ</th><th>มูลค่ารวม</th><th>วันที่สร้าง</th><th>กำหนดรับ</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody>
          ${pos.map(po=>`<tr>
            <td class="mono text-xs" style="color:var(--spark)">${po.code}</td>
            <td><strong>${po.supplier}</strong></td>
            <td class="text-xs">${(po.items||[]).length} รายการ</td>
            <td class="mono">฿${(po.total_amount||0).toLocaleString()}</td>
            <td class="text-xs">${fmtDate(po.created_at,true)}</td>
            <td class="text-xs">${po.expected_date?fmtDate(po.expected_date,true):'–'}</td>
            <td><span class="badge ${statusColor[po.status]||'b-gray'}">${po.status}</span></td>
            <td style="white-space:nowrap">
              <button class="btn btn-ghost btn-sm" onclick="viewPODetail(${JSON.stringify(po).replace(/"/g,'&quot;')})">👁 ดู</button>
              ${canManage&&po.status==='รออนุมัติ'?`<button class="btn btn-success btn-sm" onclick="approvePO('${po.id}')">✅ อนุมัติ</button>`:''}
              ${(canManage||role==='technician')&&po.status==='อนุมัติแล้ว'?`<button class="btn btn-primary btn-sm" onclick="openReceivePO(${JSON.stringify(po).replace(/"/g,'&quot;')})">📦 รับของ</button>`:''}
              ${canManage&&['รออนุมัติ','อนุมัติแล้ว'].includes(po.status)?`<button class="btn btn-danger btn-sm" onclick="cancelPO('${po.id}')">✕ ยกเลิก</button>`:''}
            </td>
          </tr>`).join('')}
          </tbody>
        </table></div>
      </div>` : `
      <div class="card"><div class="card-b">${emptyState('📋','ยังไม่มีใบจัดซื้อ' + (canManage?' กดปุ่ม "สร้างใบจัดซื้อ" เพื่อเริ่มต้น':''))}</div></div>`}
    </div>

    <!-- Expiry Management -->
    <div id="po-expiry" style="display:none">
      <div class="card">
        <div class="card-h" style="display:flex;justify-content:space-between;align-items:center">
          <div class="card-t">⏰ รายการวัสดุและอายุการใช้งาน</div>
          <button class="btn btn-ghost btn-sm" onclick="exportCSV('expiry-table','รายงานอายุวัสดุ')">⬇️ Export CSV</button>
        </div>
        <div class="tw"><table id="expiry-table">
          <thead><tr><th>ชื่อวัสดุ</th><th>รหัส</th><th>หมวดหมู่</th><th>คงเหลือ</th><th>หน่วย</th><th>วันหมดอายุ</th><th>สถานะ</th></tr></thead>
          <tbody>
          ${mats.map(m=>{
            const hasExpiry = !!m.expiry_date;
            const expDate = hasExpiry ? new Date(m.expiry_date?.toDate ? m.expiry_date.toDate() : m.expiry_date) : null;
            const now = Date.now();
            const expMs = expDate?.getTime();
            const daysLeft = expDate ? Math.ceil((expMs-now)/86400000) : null;
            const expired = daysLeft !== null && daysLeft < 0;
            const nearExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
            return `<tr>
              <td><strong>${m.name}</strong></td>
              <td class="mono text-xs">${m.code||'–'}</td>
              <td>${m.category||'–'}</td>
              <td><span class="badge b-blue">${m.quantity||0}</span></td>
              <td>${m.unit||'ชิ้น'}</td>
              <td class="text-xs">${expDate?expDate.toLocaleDateString('th-TH'):'<span class="text-muted">ไม่ระบุ</span>'}</td>
              <td>${expired?'<span class="badge b-red">🚨 หมดอายุ</span>':nearExpiry?`<span class="badge b-amber">⏰ อีก ${daysLeft} วัน</span>`:hasExpiry?'<span class="badge b-green">✅ ปกติ</span>':'<span class="badge b-gray">– ไม่มีวันหมดอายุ</span>'}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table></div>
      </div>
    </div>`;
  } catch(e){ c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}

function switchPOTab(btn, tab) {
  document.querySelectorAll('#po-tabs .tab-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  ['list','expiry'].forEach(t=>{
    const el=document.getElementById('po-'+t);
    if(el) el.style.display=t===tab?'':'none';
  });
}

/* ─── Create PO Modal ─── */
function openCreatePO(mats) {
  let rows = [{material_id:'',name:'',quantity:1,unit_price:0}];
  const matOptions = mats.map(m=>`<option value="${m.id}" data-price="${m.unit_price||0}" data-unit="${m.unit||'ชิ้น'}">${m.name} (${m.code||'–'})</option>`).join('');

  const renderRows = () => rows.map((r,i)=>`
    <div class="flex ic gap2 mb1" style="flex-wrap:wrap">
      <select class="fc" style="flex:2;min-width:150px" onchange="poRowChange(${i},this)" id="po-mat-${i}">
        <option value="">-- เลือกวัสดุ --</option>${matOptions}
      </select>
      <input class="fc" type="number" min="1" value="${r.quantity}" placeholder="จำนวน" style="width:80px" onchange="poRows[${i}].quantity=+this.value">
      <input class="fc" type="number" min="0" value="${r.unit_price}" placeholder="ราคา/หน่วย" id="po-price-${i}" style="width:100px" onchange="poRows[${i}].unit_price=+this.value">
      <button class="btn btn-danger btn-sm" onclick="removePoRow(${i})" ${rows.length<2?'disabled':''}>✕</button>
    </div>`).join('');

  window.poRows = rows;
  window.poRowChange = (i, sel) => {
    const opt = sel.options[sel.selectedIndex];
    window.poRows[i].material_id = sel.value;
    window.poRows[i].name = opt.text;
    const priceEl = document.getElementById(`po-price-${i}`);
    if(priceEl) { priceEl.value = opt.dataset.price||0; window.poRows[i].unit_price = +(opt.dataset.price||0); }
  };
  window.removePoRow = (i) => { if(window.poRows.length<2) return; window.poRows.splice(i,1); document.getElementById('po-rows').innerHTML=renderRowsNow(); };
  window.addPoRow = () => { window.poRows.push({material_id:'',name:'',quantity:1,unit_price:0}); document.getElementById('po-rows').innerHTML=renderRowsNow(); };
  const renderRowsNow = () => window.poRows.map((r,i)=>`
    <div class="flex ic gap2 mb1" style="flex-wrap:wrap">
      <select class="fc" style="flex:2;min-width:150px" onchange="poRowChange(${i},this)">
        <option value="">-- เลือกวัสดุ --</option>${matOptions.replace(`value="${r.material_id}"`,`value="${r.material_id}" selected`)}
      </select>
      <input class="fc" type="number" min="1" value="${r.quantity}" style="width:80px" onchange="poRows[${i}].quantity=+this.value">
      <input class="fc" type="number" min="0" value="${r.unit_price}" id="po-price-${i}" style="width:100px" onchange="poRows[${i}].unit_price=+this.value">
      <button class="btn btn-danger btn-sm" onclick="removePoRow(${i})">✕</button>
    </div>`).join('');

  openModal(`<div class="modal modal-lg"><div class="mh"><div class="mt">➕ สร้างใบจัดซื้อ (PO)</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="frow">
      <div class="fg"><label class="fl">Supplier / ผู้ขาย <span class="req">*</span></label><input class="fc" id="po-supplier" placeholder="ชื่อบริษัท/ร้านค้า"></div>
      <div class="fg"><label class="fl">กำหนดรับของ</label><input class="fc" id="po-expdate" type="date"></div>
    </div>
    <div class="fg"><label class="fl">หมายเหตุ</label><input class="fc" id="po-note" placeholder="หมายเหตุเพิ่มเติม"></div>
    <div style="margin:.75rem 0;font-weight:700;font-size:.8rem;color:var(--chalk2)">📦 รายการวัสดุที่สั่งซื้อ</div>
    <div id="po-rows">${renderRows()}</div>
    <button class="btn btn-ghost btn-sm mt1" onclick="addPoRow()">➕ เพิ่มรายการ</button>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="submitCreatePO()">✅ สร้าง PO</button></div></div>`);
}

async function submitCreatePO() {
  const supplier = document.getElementById('po-supplier').value.trim();
  const expected_date = document.getElementById('po-expdate').value;
  const note = document.getElementById('po-note').value.trim();
  if(!supplier){ toast('กรุณากรอกชื่อ Supplier','warn'); return; }
  const items = window.poRows.filter(r=>r.material_id);
  if(!items.length){ toast('กรุณาเลือกวัสดุอย่างน้อย 1 รายการ','warn'); return; }
  try {
    const res = await apiFetch('/purchase-orders', { method:'POST', body: JSON.stringify({ supplier, items, expected_date, note }) });
    toast(`สร้าง PO สำเร็จ: ${res.code}`);
    closeModal(); pagePurchaseOrders();
  } catch(e){ toast(e.message,'err'); }
}

/* ─── View PO Detail ─── */
function viewPODetail(po) {
  const statusColor = {'รออนุมัติ':'b-amber','อนุมัติแล้ว':'b-blue','รับของแล้ว':'b-green','ยกเลิก':'b-red'};
  openModal(`<div class="modal modal-lg"><div class="mh"><div class="mt">📋 ${po.code}</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="g2 mb2">
      <div><div class="text-muted text-xs">Supplier</div><div style="font-weight:700">${po.supplier}</div></div>
      <div><div class="text-muted text-xs">สถานะ</div><span class="badge ${statusColor[po.status]||'b-gray'}">${po.status}</span></div>
      <div><div class="text-muted text-xs">วันที่สร้าง</div><div class="text-sm">${fmtDate(po.created_at,true)}</div></div>
      <div><div class="text-muted text-xs">กำหนดรับ</div><div class="text-sm">${po.expected_date?fmtDate(po.expected_date,true):'–'}</div></div>
      <div><div class="text-muted text-xs">มูลค่ารวม</div><div class="mono" style="color:var(--green);font-weight:700">฿${(po.total_amount||0).toLocaleString()}</div></div>
      ${po.received_at?`<div><div class="text-muted text-xs">รับของเมื่อ</div><div class="text-sm">${fmtDate(po.received_at,true)}</div></div>`:''}
    </div>
    ${po.note?`<div class="alert al-info mb2">${po.note}</div>`:''}
    <div style="font-weight:700;font-size:.8rem;margin-bottom:.5rem">📦 รายการวัสดุ</div>
    <div class="tw"><table>
      <thead><tr><th>วัสดุ</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>รวม</th></tr></thead>
      <tbody>
      ${(po.items||[]).map(i=>`<tr>
        <td>${i.name||i.material_id}</td>
        <td class="mono">${i.quantity}</td>
        <td class="mono">฿${(i.unit_price||0).toLocaleString()}</td>
        <td class="mono">฿${((i.quantity||0)*(i.unit_price||0)).toLocaleString()}</td>
      </tr>`).join('')}
      </tbody>
    </table></div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ปิด</button></div></div>`);
}

/* ─── Approve PO ─── */
async function approvePO(id) {
  if(!confirm('ยืนยันการอนุมัติใบจัดซื้อนี้?')) return;
  try { const r=await apiFetch(`/purchase-orders/${id}/approve`,{method:'PATCH'}); toast(r.message); pagePurchaseOrders(); } catch(e){ toast(e.message,'err'); }
}

/* ─── Cancel PO ─── */
async function cancelPO(id) {
  if(!confirm('ยืนยันการยกเลิกใบจัดซื้อนี้?')) return;
  try { const r=await apiFetch(`/purchase-orders/${id}/cancel`,{method:'PATCH',body:'{}'}); toast(r.message); pagePurchaseOrders(); } catch(e){ toast(e.message,'err'); }
}

/* ─── Receive PO Modal ─── */
function openReceivePO(po) {
  openModal(`<div class="modal modal-lg"><div class="mh"><div class="mt">📦 รับสินค้า - ${po.code}</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="alert al-info mb2">Supplier: <strong>${po.supplier}</strong></div>
    <div style="font-weight:700;font-size:.8rem;margin-bottom:.5rem">📋 ยืนยันรายการที่ได้รับ พร้อมระบุวันหมดอายุ (ถ้ามี)</div>
    ${(po.items||[]).map((item,i)=>`
    <div class="card" style="margin-bottom:.75rem">
      <div class="card-b">
        <div style="font-weight:700;margin-bottom:.5rem">${item.name||'วัสดุ'}</div>
        <div class="frow">
          <div class="fg"><label class="fl">จำนวนที่ได้รับ</label><input class="fc" type="number" min="0" value="${item.quantity}" id="recv-qty-${i}"></div>
          <div class="fg"><label class="fl">วันหมดอายุ (ถ้ามี)</label><input class="fc" type="date" id="recv-exp-${i}"></div>
        </div>
        <input type="hidden" id="recv-mid-${i}" value="${item.material_id}">
        <input type="hidden" id="recv-price-${i}" value="${item.unit_price||0}">
        <input type="hidden" id="recv-name-${i}" value="${item.name||''}">
      </div>
    </div>`).join('')}
    <div class="fg"><label class="fl">หมายเหตุการตรวจรับ</label><input class="fc" id="recv-note" placeholder="หมายเหตุ เช่น สภาพสินค้าดี..."></div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="submitReceivePO('${po.id}',${(po.items||[]).length})">✅ ยืนยันรับของ</button></div></div>`);
}

async function submitReceivePO(poId, itemCount) {
  const note = document.getElementById('recv-note').value.trim();
  const received_items = [];
  for(let i=0;i<itemCount;i++){
    const qty = parseInt(document.getElementById(`recv-qty-${i}`)?.value||0);
    const mid = document.getElementById(`recv-mid-${i}`)?.value;
    const exp = document.getElementById(`recv-exp-${i}`)?.value;
    const price = parseFloat(document.getElementById(`recv-price-${i}`)?.value||0);
    const name = document.getElementById(`recv-name-${i}`)?.value;
    if(mid && qty>0) received_items.push({ material_id:mid, name, quantity:qty, unit_price:price, expiry_date:exp||null });
  }
  if(!received_items.length){ toast('กรุณากรอกจำนวนที่ได้รับอย่างน้อย 1 รายการ','warn'); return; }
  try {
    const r=await apiFetch(`/purchase-orders/${poId}/receive`,{method:'PATCH',body:JSON.stringify({received_items,note})});
    toast(r.message); closeModal(); pagePurchaseOrders();
  } catch(e){ toast(e.message,'err'); }
}
