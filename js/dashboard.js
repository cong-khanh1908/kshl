// dashboard.js – Dashboard thống kê, chi tiết phiếu
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// ============================================================

// =========================================================
// DASHBOARD
// =========================================================
function updateDash() {
  const s=DB.surveys;
  const pending=s.filter(x=>x.status==='pending').length, synced=s.filter(x=>x.status==='synced').length;
  const now=new Date(), month=s.filter(x=>{const d=new Date(x.createdAt);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length;
  document.getElementById('st-total').textContent=s.length;
  document.getElementById('st-pending').textContent=pending;
  document.getElementById('st-synced').textContent=synced;
  document.getElementById('st-month').textContent=month;
  const pb=document.getElementById('pendingBadge');pb.textContent=pending;pb.style.display=pending>0?'':'none';
  const pbm=document.getElementById('pendingBadgeMobile');if(pbm){pbm.textContent=pending;pbm.style.display=pending>0?'':'none';}
  const cnt={};Object.keys(SURVEYS).forEach(k=>cnt[k]=0);s.forEach(x=>{if(cnt[x.type]!==undefined)cnt[x.type]++;});
  const max=Math.max(...Object.values(cnt),1);
  let ch='<div style="display:flex;flex-direction:column;gap:8px;">';
  Object.entries(SURVEYS).forEach(([k,v])=>{const c=cnt[k];const pct=Math.round(c/max*100);ch+=`<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span style="color:var(--text2)">${v.label}</span><b style="color:var(--primary)">${c}</b></div><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;});
  ch+='</div>';document.getElementById('dash-chart').innerHTML=ch;
  const rec=[...s].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,8);
  if(!rec.length){document.getElementById('dash-recent').innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Chưa có phiếu nào</div></div>';return;}
  let rh='';rec.forEach(r=>{const d=r.ngay||r.createdAt?.split('T')[0]||'';const sb=r.status==='synced'?'<span class="status-badge status-synced">✓</span>':'<span class="status-badge status-pending">⏳</span>';rh+=`<div onclick="showDetail('${r.id}')" style="padding:8px 14px;border-bottom:1px solid var(--surface2);cursor:pointer;display:flex;align-items:center;gap:8px;"><div style="flex:1"><div style="font-size:11.5px;font-weight:600">${SURVEYS[r.type]?.label||r.type}</div><div style="font-size:10px;color:var(--text3)">${d} · ${r.khoa||r.donvi||''}</div></div>${sb}</div>`;});
  document.getElementById('dash-recent').innerHTML=rh;
  const li=document.getElementById('local-info');if(li)li.innerHTML=`Tổng <b>${s.length}</b> phiếu · <b>${(JSON.stringify(DB).length/1024).toFixed(1)} KB</b>`;
  // BYT upload stats
  const bytPending=s.filter(x=>!x.bytStatus||x.bytStatus==='pending').length;
  const bytDone=s.filter(x=>x.bytStatus==='done').length;
  const bytFailed=s.filter(x=>x.bytStatus==='failed').length;
  const stBytP=document.getElementById('st-byt-pending');if(stBytP)stBytP.textContent=bytPending;
  const stBytD=document.getElementById('st-byt-done');if(stBytD)stBytD.textContent=bytDone;
  const stBytF=document.getElementById('st-byt-failed');if(stBytF)stBytF.textContent=bytFailed;
  const autoCfgEl=document.getElementById('dash-byt-autocfg');
  if(autoCfgEl){
    if(CFG.autoUploadBYT&&CFG.bytuser)autoCfgEl.innerHTML=`🟢 Tự động gửi BYT: <b style="color:var(--success)">Đang bật</b> · Tài khoản: <b>${CFG.bytuser}</b>`;
    else if(CFG.bytuser)autoCfgEl.innerHTML=`⚪ Tự động gửi BYT: Tắt · Tài khoản: <b>${CFG.bytuser}</b>`;
    else autoCfgEl.innerHTML=`⚠️ Chưa cấu hình tài khoản BYT. <a href="#" onclick="showPage('settings');return false" style="color:var(--primary)">Cấu hình ngay →</a>`;
  }
  updateBYTPendingBadge();
  updateGSDashStatus();
}
// =========================================================
function renderList(){
  const tf=document.getElementById('fl-type')?.value||'',sf=document.getElementById('fl-status')?.value||'',df=document.getElementById('fl-date')?.value||'';
  let ss=[...DB.surveys].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(tf)ss=ss.filter(x=>x.type===tf);if(sf)ss=ss.filter(x=>x.status===sf);if(df)ss=ss.filter(x=>(x.ngay||x.createdAt?.split('T')[0])===df);
  const listEl=document.getElementById('list-table');
  if(!ss.length){listEl.innerHTML='<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Không tìm thấy phiếu</div><div class="empty-sub">Thử thay đổi bộ lọc</div></div>';return;}
  
  // Desktop table view
  let html=`<div class="desktop-list-view"><table class="data-table"><thead><tr><th>#</th><th>Ngày</th><th>Loại phiếu</th><th>Khoa</th><th>Điểm TB</th><th>Câu TL</th><th>TT</th><th>Thao tác</th></tr></thead><tbody>`;
  ss.forEach((r,i)=>{
    // FIX BUG-10: answered inclui value=0 (KSD), avg só conta >0
    const answered=r.answers?.filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='')||[];
    const ans=answered.filter(a=>Number(a.value)>0);
    const avg=ans.length?(ans.reduce((s,a)=>s+Number(a.value),0)/ans.length).toFixed(2):'-';
    const d=r.ngay||r.createdAt?.split('T')[0]||'';
    const sb=r.status==='synced'?'<span class="status-badge status-synced">✓ Đồng bộ</span>':'<span class="status-badge status-pending">⏳ Chờ</span>';
    html+=`<tr><td style="color:var(--text3);font-family:var(--mono);font-size:11px">${i+1}</td><td style="font-size:12.5px">${d}</td><td><span class="chip chip-blue" style="font-size:9.5px">${SURVEYS[r.type]?.label||r.type}</span></td><td style="font-size:12.5px">${r.khoa||r.donvi||'—'}</td><td style="font-weight:700;color:var(--primary)">${avg}</td><td style="font-size:11px;color:var(--text3)">${answered.length}/${r.answers?.length||0}</td><td>${sb}</td><td><div class="flex-gap"><button class="btn btn-outline btn-xs" onclick="showDetail('${r.id}')">👁️</button><button class="btn btn-accent btn-xs" onclick="quickSendOneBYT('${r.id}')" title="Gửi lên BYT">📤</button><button class="btn btn-danger btn-xs" onclick="delRecord('${r.id}')">🗑️</button></div></td></tr>`;
  });
  html+=`</tbody></table></div>`;
  
  // Mobile card view
  html+=`<div class="mobile-list-view" style="padding:14px;display:none;">`;
  ss.forEach((r,i)=>{
    // FIX BUG-10: answered inclui value=0 (KSD), avg só conta >0
    const answered=r.answers?.filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='')||[];
    const ans=answered.filter(a=>Number(a.value)>0);
    const avg=ans.length?(ans.reduce((s,a)=>s+Number(a.value),0)/ans.length).toFixed(2):'-';
    const d=r.ngay||r.createdAt?.split('T')[0]||'';
    const sb=r.status==='synced'?'<span class="status-badge status-synced">✓ Đồng bộ</span>':'<span class="status-badge status-pending">⏳ Chờ</span>';
    const icon=r.type==='m1'?'🏥':r.type==='m2'?'🏃':r.type==='m3'?'👨‍⚕️':r.type==='m4'?'👶':'🍼';
    html+=`<div class="mobile-record-card">
      <div class="mrc-header">
        <div>
          <div class="mrc-type">${icon} ${SURVEYS[r.type]?.label||r.type}</div>
          <div class="mrc-meta" style="margin-top:5px;">
            <span>📅 ${d}</span>
            ${r.khoa||r.donvi?`<span>🏬 ${r.khoa||r.donvi}</span>`:''}
            <span>📊 TB: <b style="color:var(--primary)">${avg}/5</b></span>
            <span>✅ ${answered.length}/${r.answers?.length||0} câu</span>
          </div>
        </div>
        ${sb}
      </div>
      <div class="mrc-actions">
        <button class="btn btn-outline btn-sm" style="flex:1" onclick="showDetail('${r.id}')">👁️ Xem chi tiết</button>
        <button class="btn btn-danger btn-sm" onclick="delRecord('${r.id}')">🗑️</button>
      </div>
    </div>`;
  });
  html+=`</div>`;
  
  listEl.innerHTML=html;
  
  // Show appropriate view based on screen size
  applyListView();
}

function applyListView(){
  const isMobile=window.innerWidth<=768;
  document.querySelectorAll('.desktop-list-view').forEach(el=>el.style.display=isMobile?'none':'block');
  document.querySelectorAll('.mobile-list-view').forEach(el=>el.style.display=isMobile?'block':'none');
}
window.addEventListener('resize',applyListView);
function clearFilters(){['fl-type','fl-status','fl-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});renderList();}

// =========================================================
// DETAIL
// =========================================================
function showDetail(id){
  const r=DB.surveys.find(x=>x.id===id);if(!r)return;
  // FIX BUG-10
  const answered=r.answers?.filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='')||[];
  const ans=answered.filter(a=>Number(a.value)>0);
  const avg=ans.length?(ans.reduce((s,a)=>s+Number(a.value),0)/ans.length).toFixed(2):'-';
  document.getElementById('modal-detail-title').textContent=`${SURVEYS[r.type]?.label} – ${r.ngay||r.createdAt?.split('T')[0]}`;
  const secs={};(r.answers||[]).forEach(a=>{if(!secs[a.section])secs[a.section]=[];secs[a.section].push(a);});
  let body=`<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin-bottom:12px;padding:9px;background:var(--surface2);border-radius:8px;"><span>📅 <b>${r.ngay||'—'}</b></span><span>📊 TB: <b style="color:var(--primary)">${avg}/5</b></span><span>✅ ${answered.length}/${r.answers?.length||0} câu</span><span>${r.status==='synced'?'✅ Đồng bộ':'⏳ Chờ'}</span><span>👤 ${r.submittedBy||'—'}</span></div>`;
  Object.entries(secs).forEach(([sec,qs])=>{
    // FIX BUG-10: section avg only from scored answers
    const sa=qs.filter(q=>q.value!==null&&q.value!==undefined&&Number(q.value)>0);const savg=sa.length?(sa.reduce((s,q)=>s+Number(q.value),0)/sa.length).toFixed(1):'-';
    body+=`<div style="margin-bottom:10px;"><div style="font-size:11px;font-weight:700;color:var(--primary);margin-bottom:4px;display:flex;justify-content:space-between;">${sec}<span style="color:var(--accent)">TB: ${savg}</span></div>`;
    qs.forEach(q=>{const opt=q.value>0?LIKERT_OPTS.find(l=>l.v===q.value):null;const disp=q.value===0?'⓪ KSD':(q.value===null||q.value===undefined||q.value==='')?'—':`${opt?.e||''} ${'★'.repeat(Number(q.value))}${'☆'.repeat(5-Number(q.value))} (${q.value})`;body+=`<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--surface2);font-size:12px;"><span style="color:var(--text2);flex:1;padding-right:8px">${q.code}. ${q.question}</span><span style="color:var(--warning);white-space:nowrap;font-weight:600">${disp}</span></div>`;});
    body+='</div>';
  });
  document.getElementById('modal-detail-body').innerHTML=body;
  document.getElementById('btn-del-record').onclick=()=>{closeModal('modal-detail');delRecord(id);};
  document.getElementById('btn-af-record').onclick=()=>{closeModal('modal-detail');showPage('autofill');document.getElementById('af-type').value=r.type;loadAFList();setTimeout(()=>{document.getElementById('af-record').value=id;genScript();},200);};
  document.getElementById('btn-byt-record').onclick=()=>{closeModal('modal-detail');quickSendOneBYT(id);};
  openModal('modal-detail');
}
function delRecord(id){
  showConfirm('Xóa phiếu này?',()=>{
    DB.surveys=DB.surveys.filter(x=>x.id!==id);
    saveDB();updateDash();renderList();
    toast('Đã xóa phiếu','info');
    gsLogHistory('delete_survey',`Xóa phiếu ID: ${id}`);
    // Re-push surveys to Sheets to reflect deletion
    if(navigator.onLine&&gsReady()) gsPushSurveys().catch(()=>{});
  });
}
function confirmClear(){
  showConfirm('⚠️ Xóa TẤT CẢ dữ liệu? Không thể hoàn tác!',()=>{
    DB={surveys:[]};saveDB();updateDash();renderList();
    toast('Đã xóa tất cả','warning');
    if(navigator.onLine&&gsReady()) gsPushSurveys().catch(()=>{});
    gsLogHistory('clear_all','Xóa toàn bộ dữ liệu phiếu khảo sát');
  });
}

