/* ═══════════════════════════════════════
   PAGE: MATERIALS
═══════════════════════════════════════ */
async function pageMaterials(){
  const c=document.getElementById('page-content');
  const dRole=APP.user.role;
  const canEdit=['admin','manager'].includes(dRole);

  c.innerHTML = loadingState();

  try {
    const data = await apiFetch('/materials');
    const items = data.items || [];
    const tb = items.reduce((sum,m)=>sum+(m.quantity||0),0);
    const low = items.filter(m=>(m.quantity||0)<=(m.reorder_point||5));

    c.innerHTML=`
    <div class="flex jb ic mb2">
      <div class="g2" style="width:100%;max-width:400px">
        <div class="scard c-blue"><div class="scard-row"><div class="scard-ico">📦</div></div><div class="scard-val">${tb}</div><div class="scard-lbl">ชิ้นในคลัง</div></div>
        <div class="scard c-red"><div class="scard-row"><div class="scard-ico">⚠️</div></div><div class="scard-val">${low.length}</div><div class="scard-lbl">รายการใกล้หมด</div></div>
      </div>
      <div>${canEdit?`<button class="btn btn-primary" onclick="openMatModal()">➕ เพิ่มวัสดุ</button>`:''}</div>
    </div>
    <div class="card">
      <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--wire);display:flex;gap:.5rem;align-items:center">
        <input class="fc" id="f-mat" placeholder="ค้นหาชื่อวัสดุ..." style="max-width:300px" oninput="filtMat(this.value)">
      </div>
      <div class="tw"><table>
        <thead><tr><th>ชื่อวัสดุ/อุปกรณ์</th><th>รหัส</th><th>หมวดหมู่</th><th>คงเหลือ</th><th>หน่วย</th>${canEdit?'<th>จัดการ</th>':''}</tr></thead>
        <tbody id="mat-tb">
        ${items.length?items.map(m=>{
          const isL=(m.quantity||0)<=(m.reorder_point||5);
          return`<tr class="mat-tr" data-nm="${m.name.toLowerCase()}">
            <td><strong>${m.name}</strong>${isL?'<br><span class="badge b-red" style="font-size:.6rem;padding:2px 4px;margin-top:4px">⚠️ ใกล้หมด</span>':''}</td>
            <td class="mono text-xs">${m.code||'-'}</td>
            <td>${m.category||'-'}</td>
            <td><span class="badge ${isL?'b-red':'b-green'}">${m.quantity||0}</span></td>
            <td>${m.unit||'ชิ้น'}</td>
            ${canEdit?`<td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="openStockModal('${m.id}','${m.name}',${m.quantity||0})">+/- สต็อก</button><button class="btn btn-ghost btn-sm" onclick='openMatModal(${JSON.stringify(m).replace(/'/g,"&#39;")})'>✎ แก้ไข</button></td>`:''}
          </tr>`;
        }).join(''):`<tr><td colspan="${canEdit?6:5}">${emptyState('📦','ไม่มีวัสดุในคลัง')}</td></tr>`}
        </tbody>
      </table></div>
    </div>`;
  } catch(e) { c.innerHTML=`<div class="alert al-danger">❌ ${e.message}</div>`; }
}

function filtMat(v){
  const q=v.toLowerCase();
  document.querySelectorAll('.mat-tr').forEach(tr=>{tr.style.display=tr.dataset.nm.includes(q)?'':'none';});
}

function openMatModal(m=null){
  const t=m?'✏️ แก้ไขวัสดุ':'➕ เพิ่มวัสดุ';
  openModal(`<div class="modal"><div class="mh"><div class="mt">${t}</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="frow">
      <div class="fg"><label class="fl">ชื่อวัสดุ <span class="req">*</span></label><input class="fc" id="m-nm" value="${m?m.name:''}"></div>
      <div class="fg"><label class="fl">รหัส (SKU)</label><input class="fc" id="m-cd" value="${m?m.code||'':''}"></div>
    </div>
    <div class="frow">
      <div class="fg"><label class="fl">หมวดหมู่</label><select class="fc" id="m-cat"><option value="">-- เลือก --</option>${['ไฟฟ้า','ประปา','ฮาร์ดแวร์','อิเล็กทรอนิกส์','ทั่วไป'].map(c=>`<option${m&&m.category===c?' selected':''}>${c}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">หน่วยเรียก</label><input class="fc" id="m-un" value="${m?m.unit||'ชิ้น':'ชิ้น'}"></div>
    </div>
    <div class="frow" ${m?'style="display:none"':''}>
      <div class="fg"><label class="fl">จำนวนตั้งต้น <span class="req">*</span></label><input class="fc" id="m-st" type="number" value="${m?m.quantity:0}" min="0"></div>
      <div class="fg"><label class="fl">จุดสั่งซื้อ (Min Stock)</label><input class="fc" id="m-min" type="number" value="${m?m.reorder_point||5:5}" min="0"></div>
    </div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="saveMat('${m?m.id:''}')">✅ บันทึก</button></div></div>`);
}

async function saveMat(id){
  const name=document.getElementById('m-nm').value.trim();
  const code=document.getElementById('m-cd').value.trim();
  const cat=document.getElementById('m-cat').value;
  const un=document.getElementById('m-un').value.trim();
  if(!name){toast('กรุณากรอกชื่อวัสดุ','warn');return;}
  
  const payload = { name, code, category: cat, unit: un };
  if(!id) {
    payload.quantity = parseInt(document.getElementById('m-st').value)||0;
    payload.reorder_point = parseInt(document.getElementById('m-min').value)||5;
  }
  
  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/materials/${id}` : '/materials';
    const res = await apiFetch(url, { method, body:JSON.stringify(payload) });
    toast(res.message);
    closeModal();
    pageMaterials();
  } catch(e) { toast(e.message, 'err'); }
}

function openStockModal(id,name,cur){
  openModal(`<div class="modal"><div class="mh"><div class="mt">📦 ปรับปรุงสต็อก</div><button class="mx" onclick="closeModal()">✕</button></div>
  <div class="mb2">
    <div class="alert al-info mb2">วัสดุ: <strong>${name}</strong><br>คงเหลือปัจจุบัน: <strong>${cur}</strong></div>
    <div class="frow">
      <div class="fg"><label class="fl">ประเภทรายการ</label><select class="fc" id="st-t"><option value="in">➕ รับเข้า (เพิ่ม)</option><option value="out">➖ เบิกออก (ลด)</option></select></div>
      <div class="fg"><label class="fl">จำนวน</label><input class="fc" id="st-qty" type="number" min="1" value="1"></div>
    </div>
    <div class="fg"><label class="fl">หมายเหตุ / อ้างอิง</label><input class="fc" id="st-rem" placeholder="เช่น สั่งซื้อลอต PR-2024 / เบิกซ่อม TRK-001"></div>
  </div>
  <div class="mf"><button class="btn btn-ghost" onclick="closeModal()">ยกเลิก</button><button class="btn btn-primary" onclick="saveStock('${id}')">✅ ยืนยัน</button></div></div>`);
}

async function saveStock(id){
  const t=document.getElementById('st-t').value;
  const q=parseInt(document.getElementById('st-qty').value);
  const r=document.getElementById('st-rem').value.trim();
  if(!q||q<1){toast('จำนวนไม่ถูกต้อง','warn');return;}
  
  try {
    const action = t === 'in' ? 'add' : 'subtract';
    const res = await apiFetch(`/materials/${id}/stock`, { method:'PATCH', body:JSON.stringify({ action, amount: q, reason: r }) });
    toast(res.message);
    closeModal();
    pageMaterials();
  } catch(e) { toast(e.message, 'err'); }
}
