// ui.js – Giao diện: navigation, modal, toast, connectivity, export/import, startup
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// ============================================================

// =========================================================
// EXPORT / IMPORT
// =========================================================
function exportCSV(){
  const hdr=['ID','Ngày tạo','Loại phiếu','QĐ','Ngày KS','Khoa','GT','Tuổi','Điểm TB','Câu TL','Tổng câu','Người nhập','Trạng thái'];
  const rows=DB.surveys.map(r=>{const ans=r.answers?.filter(a=>a.value!==null&&a.value>0)||[];const avg=ans.length?(ans.reduce((s,a)=>s+a.value,0)/ans.length).toFixed(2):'';return[r.id,r.createdAt,SURVEYS[r.type]?.label||r.type,SURVEYS[r.type]?.qd||'',r.ngay||'',r.khoa||r.donvi||'',r.gt||'',r.tuoi||'',avg,ans.length,r.answers?.length||0,r.submittedBy||'',r.status];});
  const csv=[hdr,...rows].map(r=>r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  dl('khaosat_'+new Date().toISOString().split('T')[0]+'.csv',csv,'text/csv');toast('✅ Xuất CSV','success');
}
function exportJSON(){dl('backup_'+new Date().toISOString().split('T')[0]+'.json',JSON.stringify(DB,null,2),'application/json');toast('✅ Xuất JSON','success');}
function importJSON(e){
  const file=e.target.files[0];if(!file)return;
  const rdr=new FileReader();
  rdr.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      if(!d.surveys)throw new Error('Sai định dạng');
      const exist=new Set(DB.surveys.map(x=>x.id));
      const news=d.surveys.filter(x=>!exist.has(x.id));
      DB.surveys.push(...news);
      saveDB();updateDash();
      toast(`✅ Import ${news.length} phiếu`,'success');
      // Push all to Sheets
      if(news.length&&navigator.onLine&&gsReady()){
        setTimeout(()=>{ gsPushSurveys().then(()=>toast(`☁️ Đã đồng bộ ${news.length} phiếu import lên Sheets`,'success')).catch(e=>toast('⚠️ Sync Sheets thất bại: '+e.message,'warning')); }, 500);
        gsLogHistory('import_json',`Import ${news.length} phiếu từ file JSON`);
      }
    }catch(err){toast('❌ File không hợp lệ','error');}
  };
  rdr.readAsText(file);e.target.value='';
}
function dl(name,content,type){const b=new Blob(['\ufeff'+content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();}

// =========================================================
// CONNECTIVITY
// =========================================================
function checkNet(){const on=navigator.onLine;document.getElementById('onlineIndicator').className=on?'online-dot':'offline-dot';document.getElementById('connectionStatus').textContent=on?'Trực tuyến':'Ngoại tuyến';document.getElementById('offlineBanner').classList.toggle('hidden',on);}
window.addEventListener('online',()=>{checkNet();autoSync();});window.addEventListener('offline',checkNet);

// =========================================================
// MOBILE NAV & SIDEBAR
// =========================================================
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  const isOpen = s.classList.contains('open');
  if (isOpen) closeSidebar();
  else { s.classList.add('open'); ov.classList.add('open'); document.body.style.overflow='hidden'; }
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  document.body.style.overflow='';
}
function mobileNavSurvey() {
  closeSidebar();
  const role = currentUser?.role||'guest';
  if (role==='guest') showPage('guest-home');
  else showPage('m1');
}
function updateBottomNavActive(name) {
  document.querySelectorAll('.bn-item').forEach(el=>el.classList.remove('active'));
  const map={dashboard:'bn-dash',m1:'bn-survey',m2:'bn-survey',m3:'bn-survey',m4:'bn-survey',m5:'bn-survey','guest-home':'bn-survey',datalist:'bn-list'};
  const target=map[name];
  if(target){const el=document.getElementById(target);if(el)el.classList.add('active');}
}
// Add main-content padding for bottom nav on mobile
function updateContentPadding() {
  const isMobile = window.innerWidth <= 768;
  const mc = document.querySelector('.main-content');
  if(mc) mc.style.paddingBottom = isMobile ? 'var(--bottom-nav-h)' : '0';
}
window.addEventListener('resize', updateContentPadding);
updateContentPadding();

// =========================================================
// NAVIGATION
// =========================================================
const PAGE_TITLES={dashboard:'Dashboard',m1:'Mẫu 1 – NB Nội trú (QĐ 56/2024)',m2:'Mẫu 2 – NB Ngoại trú (QĐ 56/2024)',m3:'Mẫu 3 – Nhân viên Y tế (QĐ 3869/2019)',m4:'Mẫu 4 – Người mẹ sinh con (QĐ 3869/2019)',m5:'Mẫu 5 – Nuôi con sữa mẹ (QĐ 3869/2019)',datalist:'Danh sách phiếu khảo sát',autofill:'Tự động điền BYT',bytupload:'Gửi phiếu lên trang BYT',baocao:'📑 Tạo báo cáo tổng hợp hài lòng',history:'🕒 Lịch sử hệ thống','guest-home':'Trang khảo sát người dân',settings:'Cấu hình hệ thống',users:'Quản lý tài khoản',depts:'Danh mục Khoa/Phòng',profile:'👤 Tài khoản của tôi'};
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById(`page-${name}`);if(pg)pg.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{if(n.getAttribute('onclick')?.includes(`'${name}'`))n.classList.add('active');});
  document.getElementById('topbarTitle').textContent=PAGE_TITLES[name]||name;
  if(name==='datalist')renderList();
  if(name==='dashboard')updateDash();
  if(name==='users'){renderUsers();renderAccountRequests();}
  if(name==='profile')loadMyProfile();
  if(name==='depts')renderDepts();
  if(name==='bytupload'){renderBYTQueue();loadAutoUploadCheckboxes();}
  if(name==='baocao'){renderBaoCaoPreview();}
  if(name==='history'){loadHistoryPreview();}
  updateBottomNavActive(name);
  // Close sidebar on mobile when navigating
  if(window.innerWidth<=768) closeSidebar();
}

// =========================================================
// MODALS
// =========================================================
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){
  document.getElementById(id).classList.remove('open');
  // Re-enable username field when user modal closes
  if(id==='modal-user'){
    const el=document.getElementById('mu-username');
    if(el){el.disabled=false;el.placeholder='VD: nguyen_van_a';}
    const pwEl=document.getElementById('mu-password');
    if(pwEl) pwEl.placeholder='Mật khẩu mới...';
  }
}
function showConfirm(msg,cb){document.getElementById('confirm-msg').textContent=msg;confirmCb=cb;openModal('modal-confirm');}
document.getElementById('confirm-ok').onclick=()=>{closeModal('modal-confirm');if(confirmCb)confirmCb();};
document.querySelectorAll('.modal-backdrop').forEach(b=>b.addEventListener('click',e=>{if(e.target===b)b.classList.remove('open');}));

// =========================================================
// TOAST
// =========================================================
function toast(msg,type='info'){const c=document.getElementById('toastContainer');const t=document.createElement('div');t.className=`toast toast-${type}`;const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};t.innerHTML=`<span>${icons[type]}</span><span>${msg}</span>`;c.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(100px)';t.style.transition='.3s';setTimeout(()=>t.remove(),300);},4000);}

// =========================================================
// UTILITY: Password visibility toggle
// =========================================================
function togglePwVis(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text'; btn.textContent = '🙈';
  } else {
    input.type = 'password'; btn.textContent = '👁';
  }
}

// =========================================================
// PERIODIC TASKS
// =========================================================
// =========================================================
// APP STARTUP
// =========================================================
document.addEventListener('DOMContentLoaded', () => setTimeout(() => appBootstrap(), 80));

setInterval(checkNet, 15000);

// Auto-push pending surveys every 90 seconds (with concurrency guard)
let _autoSyncRunning = false;
setInterval(async () => {
  if (_autoSyncRunning || !navigator.onLine || !gsReady()) return;
  _autoSyncRunning = true;
  try {
    const pending = DB.surveys.filter(x => x.status === 'pending');
    if (pending.length > 0) {
      await syncToSheets(false);
    }
  } catch(e) {
    // silent – will retry next interval
  } finally {
    _autoSyncRunning = false;
  }
}, 90000);