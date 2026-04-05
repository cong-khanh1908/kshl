// users.js – Xác thực, quản lý tài khoản, khoa phòng, profile, yêu cầu TK
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// ============================================================

// =========================================================
// BOOTSTRAP – Cloud-first single-config-for-all-devices
// =========================================================

async function appBootstrap() {
  // ★ FIX MOBILE: Đọc ?sid= từ URL — admin chia sẻ link là xong
  const urlParams = new URLSearchParams(location.search);
  const urlSid = (urlParams.get('sid') || urlParams.get('sheetid') || '').trim();
  if (urlSid && !CFG.sheetid) {
    CFG.sheetid = urlSid;
    try { localStorage.setItem('kshl_v4_cfg', JSON.stringify(CFG)); } catch(e) {}
    // Xóa param khỏi URL (gọn hơn, bảo mật hơn) mà không reload trang
    history.replaceState({}, document.title, location.pathname + location.hash);
  }

  if (!CFG.sheetid) {
    // Thiết bị mới chưa có sheetid → hiện màn hình thiết lập
    document.getElementById('bootstrap-screen').classList.remove('hidden');
    return;
  }
  // Có sheetid → tải cấu hình từ Cloud trước khi vào đăng nhập
  showCloudLoading('☁️ Đang đồng bộ cấu hình từ Cloud...', 'Vui lòng chờ giây lát...');
  try {
    const timeout = new Promise((_,rej) => setTimeout(()=>rej(new Error('timeout')), 12000));
    await Promise.race([
      (async () => {
        await gsPullConfig();
        await gsPullUsers();
        await gsPullDepts();
        saveUsers(); saveCFG(); saveDepts();
      })().catch(() => {}),
      timeout
    ]).catch(() => {});
  } catch(e) { /* silent – dùng dữ liệu cục bộ */ }
  hideCloudLoading();
  showLoginScreen();
}

async function bootstrapConnect() {
  const sid = (document.getElementById('bs-sheetid')?.value||'').trim();
  if (!sid) { document.getElementById('bs-sheetid')?.focus(); return; }
  const btn = document.getElementById('bs-connect-btn');
  const errEl = document.getElementById('bs-err');
  const statusEl = document.getElementById('bs-status');
  const pBar = document.getElementById('bs-progress-bar');
  const pFill = document.getElementById('bs-progress-fill');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Đang kết nối...'; }
  if (errEl) errEl.style.display='none';
  if (pBar) pBar.style.display='';
  const setPct = (msg, pct) => { if(statusEl)statusEl.textContent=msg; if(pFill)pFill.style.width=pct+'%'; };

  CFG.sheetid = sid; _gsToken = null; _gsTokenExp = 0;
  try {
    setPct('🔑 Xác thực Service Account...', 15);
    await gsGetToken();
    setPct('📋 Kiểm tra cấu trúc Sheets...', 30);
    const tabs = await gsGetSheetsList();
    const needed = ['CONFIG','SURVEYS','USERS','DEPTS','HISTORY'];
    const missing = needed.filter(t => !tabs.includes(t));
    if (missing.length) {
      setPct('🏗️ Tạo ' + missing.length + ' tabs mới...', 45);
      await gsInitSheets();
      setPct('⬆️ Khởi tạo cấu hình mặc định lên Cloud...', 65);
      await gsPushAllData(false);
      setPct('👥 Đồng bộ tài khoản...', 80);
    } else {
      setPct('⬇️ Tải cấu hình từ Cloud...', 45);
      await gsPullConfig();
      setPct('👥 Tải tài khoản người dùng...', 65);
      await gsPullUsers();
      setPct('🏬 Tải danh mục khoa/phòng...', 80);
      await gsPullDepts();
    }
    setPct('💾 Lưu cục bộ...', 90);
    saveCFG(); saveUsers(); saveDepts();
    setPct('✅ Thành công! Đang chuyển tới đăng nhập...', 100);
    setTimeout(() => showLoginScreen(), 900);
  } catch(e) {
    CFG.sheetid = '';
    if (errEl) {
    let msg = e.message || 'Lỗi không xác định';
    if (msg.includes('not found') || msg.includes('404')) {
      msg = '❌ Không tìm thấy Spreadsheet. Kiểm tra:\n• ID có đúng không (copy đầy đủ từ URL)\n• Đã share cho: kshl-328@crack-descent-492209-c3.iam.gserviceaccount.com (Editor) chưa?';
    } else if (msg.includes('403') || msg.includes('permission') || msg.includes('PERMISSION')) {
      msg = '❌ Không có quyền truy cập. Hãy share Spreadsheet cho email SA với quyền Editor.';
    } else if (msg.includes('token') || msg.includes('401')) {
      msg = '❌ Lỗi xác thực Service Account. Thử lại sau vài giây.';
    } else if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch')) {
      msg = '❌ Lỗi mạng / timeout. Kiểm tra kết nối internet và thử lại.';
    } else {
      msg = '❌ ' + msg + '. Kiểm tra Spreadsheet ID và quyền chia sẻ.';
    }
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
    if (pBar) pBar.style.display='none';
    if (statusEl) statusEl.textContent='';
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='🔗 Kết nối & Tải cấu hình'; }
  }
}

// ★ Validate Spreadsheet ID format in real-time
function bsValidateId(val) {
  const hint = document.getElementById('bs-id-hint');
  const btn  = document.getElementById('bs-connect-btn');
  const err  = document.getElementById('bs-err');
  if (!hint) return;
  val = val.trim();
  if (!val) { hint.style.display='none'; return; }
  // Google Sheet IDs are 44 chars of alphanumeric + _ and -
  const valid = /^[A-Za-z0-9_-]{30,60}$/.test(val);
  // Detect if user pasted full URL instead of just ID
  if (val.includes('spreadsheets/d/')) {
    const match = val.match(/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
    if (match) {
      document.getElementById('bs-sheetid').value = match[1];
      hint.innerHTML = '✅ Đã tự động trích xuất ID từ URL!';
      hint.style.color = 'var(--success)';
      hint.style.display = '';
      if (err) err.style.display = 'none';
      return;
    }
  }
  if (val.length < 30) {
    hint.innerHTML = `⚠️ ID quá ngắn (${val.length} ký tự). Spreadsheet ID thường dài 44 ký tự.`;
    hint.style.color = 'var(--warning,#F57C00)';
  } else if (!valid) {
    hint.innerHTML = '⚠️ ID chứa ký tự không hợp lệ. Chỉ gồm chữ cái, số, - và _.';
    hint.style.color = 'var(--accent2,#E53935)';
  } else {
    hint.innerHTML = `✅ ID hợp lệ (${val.length} ký tự)`;
    hint.style.color = 'var(--success,#2E7D32)';
    if (err) err.style.display = 'none';
  }
  hint.style.display = '';
}

// ★ Copy SA email to clipboard
function bsCopyEmail() {
  const email = 'kshl-328@crack-descent-492209-c3.iam.gserviceaccount.com';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(email).then(() => {
      toast('📋 Đã copy email SA! Hãy share Spreadsheet cho email này (Editor).', 'success');
    }).catch(() => {
      prompt('Copy email SA này:', email);
    });
  } else {
    prompt('Copy email SA này:', email);
  }
}

function showCloudLoading(msg, sub) {
  const el=document.getElementById('cloud-loading-overlay'); if(!el)return;
  el.classList.remove('hidden');
  const m=document.getElementById('clo-msg'); if(m)m.textContent=msg;
  const s=document.getElementById('clo-sub'); if(s)s.textContent=sub||'';
}
function hideCloudLoading() {
  const el=document.getElementById('cloud-loading-overlay'); if(el)el.classList.add('hidden');
}
function showLoginScreen() {
  document.getElementById('bootstrap-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  const row=document.getElementById('login-sheetid-row');
  if(row) row.style.display=CFG.sheetid?'none':'';
}

// =========================================================
// AUTH
// =========================================================
async function doLogin() {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-err');
  const btn = document.getElementById('login-submit-btn');

  if (!u || !p) {
    errEl.textContent = '⚠️ Vui lòng nhập tên đăng nhập và mật khẩu';
    errEl.style.display = 'block'; return;
  }

  if (btn) { btn.innerHTML = '⏳ Đang đăng nhập...'; btn.disabled = true; }

  // Handle quick sheetid connect
  const quickSid = (document.getElementById('login-sheetid-quick')?.value||'').trim();
  if (!CFG.sheetid && quickSid) {
    CFG.sheetid = quickSid; _gsToken=null; _gsTokenExp=0; saveCFG();
    showCloudLoading('🔄 Đang kết nối Cloud...','');
    try { await gsPullConfig(); await gsPullUsers(); saveCFG(); saveUsers(); } catch(e){}
    hideCloudLoading();
  }

  await new Promise(r => setTimeout(r, 300)); // brief delay for UX

  const found = USERS.find(x => x.username === u && x.password === p);
  if (btn) { btn.innerHTML = '🔐 Đăng nhập'; btn.disabled = false; }

  if (!found) {
    errEl.textContent = '⚠️ Tên đăng nhập hoặc mật khẩu không đúng';
    errEl.style.display = 'block';
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
    // Shake animation
    const box = document.querySelector('.login-box');
    box.style.animation = 'none';
    setTimeout(() => { box.style.animation = 'loginShake .4s ease'; }, 10);
    return;
  }
  errEl.style.display = 'none';
  currentUser = found;
  enterApp();
}

function doLoginGuest() {
  currentUser = {id:'guest',username:'guest',fullname:'Người dân',role:'guest',dept:''};
  enterApp();
}

function doLogout() {
  currentUser = null;
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-username').value='';
  document.getElementById('login-password').value='';
  // Re-sync config+users silently so next login gets fresh data
  if (CFG.sheetid) {
    showCloudLoading('☁️ Đang cập nhật cấu hình...','');
    Promise.race([
      (async()=>{ await gsPullConfig(); await gsPullUsers(); saveCFG(); saveUsers(); })().catch(()=>{}),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),7000))
    ]).catch(()=>{}).finally(()=>hideCloudLoading());
  }
}

async function enterApp() {
  document.getElementById('login-screen').classList.add('hidden');
  applyRoleUI();
  buildAllForms();
  loadCfgToUI();
  updateDash();
  checkNet();
  renderBYTLinks();
  loadAutoUploadCheckboxes();
  updateBYTPendingBadge();
  if (currentUser.role==='guest') showPage('guest-home');
  else if (currentUser.role==='admin') { showPage('dashboard'); renderAccountRequests(); }
  else { showPage('m1'); loadMyProfile(); }
  // Check first login and prompt password change
  if (currentUser.role !== 'guest' && currentUser.mustChangePassword) {
    setTimeout(() => { toast('⚠️ Vui lòng đổi mật khẩu mặc định để bảo mật tài khoản!', 'warning'); if(currentUser.role==='user') showPage('profile'); }, 1500);
  }
  if (currentUser.role !== 'guest' && gsReady()) {
    gsLogHistory('login', `Đăng nhập: ${currentUser.fullname} (${currentUser.role})`);
    setTimeout(() => gsFullSyncOnLogin(), 1500);
  }
}

// Full background sync after login (surveys + depts)
async function gsFullSyncOnLogin() {
  const el = document.getElementById('gs-sync-status');
  if (el) el.innerHTML = '🔄 Đang đồng bộ dữ liệu...';
  try {
    await gsPullSurveys();
    await gsPullDepts();
    saveDB(); saveDepts();
    buildAllForms(); loadCfgToUI(); updateDash(); renderList();
    refreshDeptDropdowns(); loadAutoUploadCheckboxes();
    updateGSConnBadge(true); updateGSDashStatus();
    const now = new Date().toLocaleString('vi-VN');
    if (el) el.innerHTML = `✅ Đồng bộ lúc ${now}`;
    const pending = DB.surveys.filter(x=>x.status==='pending');
    if (pending.length) {
      for (const r of pending) { const ok=await gsPushOneSurvey(r); if(ok)r.status='synced'; }
      saveDB(); updateDash();
      toast(`☁️ Đã đồng bộ ${pending.length} phiếu lên Cloud`, 'success');
    }
  } catch(e) {
    updateGSConnBadge(false);
    if (el) el.innerHTML = `⚠️ Lỗi đồng bộ: ${e.message}`;
  }
}

function applyRoleUI() {
  const role = currentUser.role;
  // User info in sidebar
  document.getElementById('user-avatar').textContent = role==='admin'?'🔑':role==='user'?'👤':'👥';
  document.getElementById('user-display-name').textContent = currentUser.fullname;
  document.getElementById('user-display-role').textContent = role==='admin'?'Quản trị viên (Admin)':role==='user'?'Nhân viên Y tế':'Người dân (Khách)';
  if (CFG.hvname) document.getElementById('sb-hospital-name').textContent = CFG.hvname;
  // Role banner
  const rb = document.getElementById('roleBanner');
  rb.classList.remove('hidden','guest','user','admin');
  if (role==='guest') { rb.classList.add('guest'); rb.innerHTML='👥 Bạn đang sử dụng với tư cách <b>Người dân</b> – Chỉ xem và tham gia khảo sát. <a href="#" onclick="doLogout();return false" style="color:var(--primary);font-weight:700;margin-left:8px">🔐 Đăng nhập</a>'; }
  else if (role==='user') {
    rb.classList.add('user');
    const mustChange = currentUser.mustChangePassword ? ' <a href="#" onclick="showPage(\'profile\');return false" style="color:var(--warning);font-weight:700;margin-left:6px;">⚠️ Đổi mật khẩu ngay</a>' : '';
    rb.innerHTML=`✅ Đăng nhập: <b>${currentUser.fullname}</b> – Nhân viên Y tế${mustChange}`;
  }
  else { rb.classList.add('admin'); rb.innerHTML=`🔑 Đăng nhập: <b>${currentUser.fullname}</b> – Quản trị viên`; }
  // Show/hide nav by role
  document.querySelectorAll('.admin-only').forEach(el=>el.style.display=role==='admin'?'':'none');
  document.querySelectorAll('.staff-only').forEach(el=>el.style.display=(role==='admin'||role==='user')?'':'none');
  document.querySelectorAll('.guest-visible').forEach(el=>el.style.display=role==='guest'?'':'none');
  document.querySelectorAll('.user-only').forEach(el=>el.style.display=role==='user'?'':'none');
  // Profile nav: user only
  const bnProfile = document.getElementById('bn-profile');
  if(bnProfile) bnProfile.style.display=role==='user'?'flex':'none';
  // Bottom nav: dashboard only for admin/user
  const bnDash=document.getElementById('bn-dash');
  if(bnDash) bnDash.style.display=(role==='admin')?'flex':'none';
  const bnList=document.getElementById('bn-list');
  if(bnList) bnList.style.display=(role==='admin')?'flex':'none';
}

// =========================================================
// USER MANAGEMENT
// =========================================================
function renderUsers(){
  if(!document.getElementById('user-list-table'))return;
  let html=`<table class="data-table"><thead><tr>
    <th>#</th><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Khoa/Phòng</th><th>Trạng thái</th><th>Thao tác</th>
  </tr></thead><tbody>`;
  USERS.forEach((u,i)=>{
    const roleLabel=u.role==='admin'?'<span class="chip chip-purple">🔑 Admin</span>':'<span class="chip chip-green">👤 User</span>';
    const pwStatus=u.mustChangePassword?'<span style="font-size:10px;color:var(--warning);font-weight:700;">⚠️ Cần đổi MK</span>':'<span style="font-size:10px;color:var(--success);">✅ Bình thường</span>';
    const isAdmin=u.username==='admin';
    html+=`<tr>
      <td style="color:var(--text3);font-family:var(--mono);font-size:11px">${i+1}</td>
      <td><b>${u.username}</b></td>
      <td>${u.fullname}</td>
      <td>${roleLabel}</td>
      <td style="font-size:12px">${u.dept||'—'}</td>
      <td>${pwStatus}</td>
      <td><div class="flex-gap" style="gap:5px">
        <button class="btn btn-outline btn-xs" onclick="editUser('${u.id}')" title="Sửa thông tin">✏️</button>
        <button class="btn btn-warning btn-xs" onclick="openResetUserPw('${u.id}')" title="Reset mật khẩu">🔑</button>
        ${!isAdmin?`<button class="btn btn-danger btn-xs" onclick="deleteUser('${u.id}')" title="Xóa tài khoản">🗑️</button>`:'<span style="font-size:10px;color:var(--text3);">🔒</span>'}
      </div></td>
    </tr>`;
  });
  html+='</tbody></table>';
  document.getElementById('user-list-table').innerHTML=html;
  // Update request badge in nav
  updateReqBadge();
}

function openAddUser(){
  document.getElementById('mu-id').value='';
  document.getElementById('mu-username').value='';
  document.getElementById('mu-fullname').value='';
  document.getElementById('mu-role').value='user';
  document.getElementById('mu-password').value='';
  document.getElementById('mu-password2').value='';
  document.getElementById('modal-user-title').textContent='Thêm tài khoản';
  // Show username field (may have been hidden)
  const unameField = document.querySelector('#mu-username')?.closest('.form-group');
  if (unameField) unameField.style.display='';
  refreshDeptDropdowns();
  openModal('modal-user');
}

function editUser(id){
  const u=USERS.find(x=>x.id===id);
  if(!u)return;
  document.getElementById('mu-id').value=u.id;
  document.getElementById('mu-username').value=u.username;
  document.getElementById('mu-fullname').value=u.fullname;
  document.getElementById('mu-role').value=u.role;
  document.getElementById('mu-password').value='';
  document.getElementById('mu-password2').value='';
  document.getElementById('modal-user-title').textContent='Sửa tài khoản: '+u.username;
  // Update password placeholder to indicate it's optional when editing
  const pwEl=document.getElementById('mu-password');
  if(pwEl) pwEl.placeholder='Để trống = không đổi mật khẩu';
  refreshDeptDropdowns();
  document.getElementById('mu-dept').value=u.dept||'';
  // Disable username change for admin account
  const unameEl=document.getElementById('mu-username');
  if(unameEl) unameEl.disabled=(u.username==='admin');
  openModal('modal-user');
}

function saveUser(){
  const id=document.getElementById('mu-id').value;
  const u={
    username:document.getElementById('mu-username').value.trim(),
    fullname:document.getElementById('mu-fullname').value.trim(),
    role:document.getElementById('mu-role').value,
    dept:document.getElementById('mu-dept').value,
    password:document.getElementById('mu-password').value
  };
  if(!u.username||!u.fullname){toast('Điền đầy đủ thông tin','warning');return;}
  if(!id&&!u.password){toast('Nhập mật khẩu cho tài khoản mới','warning');return;}
  if(u.password && u.password.length < 6){toast('Mật khẩu tối thiểu 6 ký tự','warning');return;}
  const p2=document.getElementById('mu-password2').value;
  if(u.password&&u.password!==p2){toast('Mật khẩu xác nhận không khớp','error');return;}
  if(id){
    const idx=USERS.findIndex(x=>x.id===id);
    if(idx>=0){
      const prev=USERS[idx];
      USERS[idx]={...prev,...u,id};
      if(!u.password){USERS[idx].password=prev.password;} // keep old password if not changed
      else { USERS[idx].mustChangePassword=false; } // admin sets new pw → no force change
    }
  } else {
    if(USERS.find(x=>x.username===u.username)){toast('Tên đăng nhập đã tồn tại','error');return;}
    u.mustChangePassword=true; // force user to change default password
    USERS.push({...u,id:Date.now().toString()});
  }
  saveUsers();renderUsers();closeModal('modal-user');
  toast('✅ Đã lưu tài khoản','success');
  if(navigator.onLine&&gsReady()){
    gsPushUsers().then(()=>gsPushConfig())
      .then(()=>toast('☁️ Tài khoản đồng bộ Cloud','success'))
      .catch(()=>toast('⚠️ Lưu Cloud thất bại','warning'));
  }
  gsLogHistory('save_user',`Lưu tài khoản: ${u.username} (${u.role})`);
}

function deleteUser(id){showConfirm('Xóa tài khoản này?',()=>{USERS=USERS.filter(x=>x.id!==id);saveUsers();renderUsers();toast('Đã xóa tài khoản','info');if(navigator.onLine&&gsReady()){gsPushUsers().then(()=>gsPushConfig()).catch(()=>{});}});}

// =========================================================
// DEPARTMENT MANAGEMENT
// =========================================================
function renderDepts(){
  const el=document.getElementById('dept-list');if(!el)return;
  if(!DEPTS.length){el.innerHTML='<div style="color:var(--text3);font-size:12px;text-align:center;padding:20px;">Chưa có khoa/phòng nào. Thêm mới hoặc dùng "Import nhanh".</div>';return;}
  const grouped={lamsang:[],kham:[],canlam:[],hanhchinh:[]};
  DEPTS.forEach(d=>grouped[d.type||'lamsang'].push(d));
  const tLabel={lamsang:'🏥 Lâm sàng',kham:'🏃 Phòng khám',canlam:'🔬 Cận lâm sàng',hanhchinh:'📋 Hành chính/Chức năng'};
  let html='';
  Object.entries(grouped).forEach(([type,depts])=>{
    if(!depts.length)return;
    html+=`<div style="margin-bottom:12px;"><div style="font-size:10.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;">${tLabel[type]||type}</div>`;
    depts.forEach(d=>{html+=`<div class="dept-item"><span class="dept-name">${d.name}</span>${d.code?`<span class="dept-tag">${d.code}</span>`:''}<button class="btn btn-outline btn-xs" onclick="editDept('${d.id}')">✏️</button><button class="btn btn-danger btn-xs" onclick="deleteDept('${d.id}')">🗑️</button></div>`;});
    html+='</div>';
  });
  el.innerHTML=html;
}
function openAddDept(){document.getElementById('md-id').value='';document.getElementById('md-name').value='';document.getElementById('md-code').value='';document.getElementById('md-type').value='lamsang';document.getElementById('modal-dept-title').textContent='Thêm Khoa/Phòng';openModal('modal-dept');}
function editDept(id){const d=DEPTS.find(x=>x.id===id);if(!d)return;document.getElementById('md-id').value=d.id;document.getElementById('md-name').value=d.name;document.getElementById('md-code').value=d.code||'';document.getElementById('md-type').value=d.type||'lamsang';document.getElementById('modal-dept-title').textContent='Sửa Khoa/Phòng';openModal('modal-dept');}
function saveDept(){
  const id=document.getElementById('md-id').value;
  const d={name:document.getElementById('md-name').value.trim(),code:document.getElementById('md-code').value.trim(),type:document.getElementById('md-type').value};
  if(!d.name){toast('Nhập tên khoa/phòng','warning');return;}
  if(id){const idx=DEPTS.findIndex(x=>x.id===id);if(idx>=0)DEPTS[idx]={...DEPTS[idx],...d};}
  else{if(DEPTS.find(x=>x.name===d.name)){toast('Khoa này đã có trong danh mục','warning');return;}DEPTS.push({...d,id:Date.now().toString()});}
  saveDepts();renderDepts();refreshDeptDropdowns();closeModal('modal-dept');toast('✅ Đã lưu Khoa/Phòng','success');
  if(navigator.onLine&&gsReady()) gsPushDepts().catch(()=>{});
}
function deleteDept(id){showConfirm('Xóa khoa/phòng này khỏi danh mục?',()=>{DEPTS=DEPTS.filter(x=>x.id!==id);saveDepts();renderDepts();refreshDeptDropdowns();toast('Đã xóa','info');if(navigator.onLine&&gsReady())gsPushDepts().catch(()=>{});});}
function bulkImportDepts(){
  const raw=document.getElementById('dept-bulk-input').value;
  const lines=raw.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('//'));
  let added=0;
  lines.forEach(line=>{
    if(!DEPTS.find(x=>x.name===line)){
      let type='lamsang';
      if(/phòng khám|pk /i.test(line))type='kham';
      else if(/xét nghiệm|chẩn đoán|dược|phục hồi|vật lý|canlam/i.test(line))type='canlam';
      else if(/hành chính|phòng kế|phòng tổ|tài chính|kế hoạch|công nghệ/i.test(line))type='hanhchinh';
      DEPTS.push({id:Date.now().toString()+Math.random().toString(36).slice(2,5),name:line,code:'',type});
      added++;
    }
  });
  saveDepts();renderDepts();refreshDeptDropdowns();document.getElementById('dept-bulk-input').value='';
  toast(`✅ Đã import ${added} khoa/phòng mới (bỏ qua ${lines.length-added} trùng)`,added>0?'success':'warning');
  if(added>0&&navigator.onLine&&gsReady()){gsPushDepts().then(()=>gsPushConfig()).catch(()=>{});}
}
function loadSampleDepts(){
  const samples=['Khoa Nội tổng hợp','Khoa Nội tiết – Đái tháo đường','Khoa Tim mạch','Khoa Thần kinh','Khoa Hô hấp','Khoa Tiêu hóa','Khoa Thận – Lọc máu','Khoa Ngoại tổng hợp','Khoa Ngoại chấn thương chỉnh hình','Khoa Ngoại tiêu hóa','Khoa Ung bướu','Khoa Sản','Khoa Nhi','Khoa Hồi sức tích cực','Khoa Cấp cứu','Khoa Truyền nhiễm','Khoa Mắt','Khoa Tai – Mũi – Họng','Khoa Răng – Hàm – Mặt','Khoa Da liễu','Khoa Tâm thần','Khoa Phục hồi chức năng','Phòng khám Nội','Phòng khám Ngoại','Phòng khám Sản phụ khoa','Phòng khám Nhi','Phòng khám Mắt','Phòng khám TMH','Khoa Xét nghiệm','Khoa Chẩn đoán hình ảnh','Khoa Thăm dò chức năng','Khoa Giải phẫu bệnh','Khoa Dược','Khoa Kiểm soát nhiễm khuẩn','Khoa Dinh dưỡng','Phòng Kế hoạch tổng hợp','Phòng Tổ chức cán bộ','Phòng Tài chính – Kế toán','Phòng Hành chính – Quản trị','Phòng Điều dưỡng','Phòng Công tác xã hội','Phòng Quản lý chất lượng'];
  document.getElementById('dept-bulk-input').value=samples.join('\n');
  toast('Đã tải danh mục mẫu. Kiểm tra và nhấn Import.','info');
}

// =========================================================
// ACCOUNT REQUESTS SYSTEM – v3 Nâng Cấp
// =========================================================
const ACCT_REQUESTS_KEY = 'kshl_v4_acct_requests';

function getAccountRequests() {
  try { return JSON.parse(localStorage.getItem(ACCT_REQUESTS_KEY) || '[]'); } catch(e) { return []; }
}
function saveAccountRequests(reqs) {
  localStorage.setItem(ACCT_REQUESTS_KEY, JSON.stringify(reqs));
  // Đồng bộ lên Cloud nền nếu có kết nối
  if (navigator.onLine && gsReady()) {
    gsPushAccountRequests().catch(() => {});
  }
}

// ── Đẩy danh sách yêu cầu lên tab REQUESTS trên Google Sheets ──
async function gsPushAccountRequests() {
  const reqs = getAccountRequests();
  if (!reqs.length) return;
  try {
    const rows = [
      ['ID','Loại','Họ tên','Tên đăng nhập','Liên hệ','Khoa/Phòng','Lý do','Ưu tiên','Trạng thái','Thời gian tạo','Thời gian xử lý'],
      ...reqs.map(r => [
        r.id, r.type==='new'?'Cấp mới':'Reset MK',
        r.fullname, r.username||'', r.contact,
        r.dept||'', r.note||'', r.urgency==='urgent'?'Gấp':'Bình thường',
        r.status==='pending'?'Chờ xử lý':r.status==='done'?'Đã xử lý':'Từ chối',
        new Date(r.createdAt).toLocaleString('vi-VN'),
        r.doneAt ? new Date(r.doneAt).toLocaleString('vi-VN') : ''
      ])
    ];
    await gsWriteRange('REQUESTS', 'A1', rows);
  } catch(e) { /* silent */ }
}

// ── Kéo yêu cầu từ Cloud về (admin trên thiết bị khác có thể xem) ──
async function gsPullAccountRequests() {
  try {
    const data = await gsReadRange('REQUESTS!A2:K');
    if (!data || !data.length) return;
    const existing = getAccountRequests();
    const existIds = new Set(existing.map(r => r.id));
    let added = 0;
    data.forEach(row => {
      if (!row[0] || existIds.has(row[0])) return;
      existing.unshift({
        id: row[0],
        type: row[1]==='Cấp mới'?'new':'reset',
        fullname: row[2]||'',
        username: row[3]||'',
        contact: row[4]||'',
        dept: row[5]||'',
        note: row[6]||'',
        urgency: row[7]==='Gấp'?'urgent':'normal',
        status: row[8]==='Đã xử lý'?'done':row[8]==='Từ chối'?'rejected':'pending',
        createdAt: row[9]||new Date().toISOString(),
        doneAt: row[10]||null
      });
      added++;
    });
    if (added) { localStorage.setItem(ACCT_REQUESTS_KEY, JSON.stringify(existing)); }
  } catch(e) { /* silent */ }
}

// ── Mở modal theo loại ──
function openAccountRequest(type) {
  // Reset về step 1
  _acctReqCurrentStep = 1;
  _acctReqValid = false;
  acctReqGoStep(1);

  document.getElementById('acct-req-type').value = type;
  // Clear form
  ['acct-req-fullname','acct-req-username','acct-req-contact','acct-req-dept','acct-req-note'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.querySelectorAll('input[name="acct-req-urgency"]').forEach(r => { r.checked = r.value === 'normal'; });
  document.getElementById('acct-req-err').style.display = 'none';
  document.getElementById('acct-req-uname-ok').style.display = 'none';
  document.getElementById('acct-req-note-counter').textContent = '0/300 ký tự';

  const header = document.getElementById('acct-req-modal-header');
  const badge = document.getElementById('acct-req-type-badge');
  const icon = document.getElementById('acct-req-header-icon');
  const title = document.getElementById('acct-req-title');
  const sub = document.getElementById('acct-req-header-sub');
  const unameGrp = document.getElementById('acct-req-username-group');
  const urgGrp = document.getElementById('acct-req-urgency-group');
  const noteLabel = document.getElementById('acct-req-note-label');
  const btnNext = document.getElementById('acct-req-btn-next-label');

  if (type === 'new') {
    header.style.borderBottomColor = '#1565C0';
    icon.textContent = '📋';
    title.textContent = 'Yêu cầu cấp tài khoản mới';
    sub.textContent = 'Admin sẽ tạo tài khoản và thông báo cho bạn';
    badge.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start;">
      <span style="font-size:22px;flex-shrink:0;">📋</span>
      <div><b>Cấp tài khoản mới:</b> Dành cho nhân viên y tế chưa có tài khoản trong hệ thống. Điền đầy đủ thông tin để Admin xét duyệt và cấp tài khoản sớm nhất.</div>
    </div>`;
    badge.style.cssText = 'background:#E3F2FD;color:#0D47A1;border-color:#90CAF9;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12.5px;border:1.5px solid;';
    unameGrp.style.display = '';
    urgGrp.style.display = '';
    noteLabel.textContent = '📝 Lý do cần tài khoản / Ghi chú thêm';
    btnNext.textContent = 'Xem lại →';
    document.getElementById('acct-req-note').placeholder = 'VD: Tôi là điều dưỡng khoa Nội, cần nhập phiếu khảo sát hài lòng...';
  } else {
    header.style.borderBottomColor = '#E65100';
    icon.textContent = '🔑';
    title.textContent = 'Yêu cầu reset mật khẩu';
    sub.textContent = 'Quên mật khẩu – Admin sẽ cấp mật khẩu tạm thời';
    badge.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start;">
      <span style="font-size:22px;flex-shrink:0;">🔑</span>
      <div><b>Quên mật khẩu:</b> Bạn đã có tài khoản nhưng không nhớ mật khẩu. Admin sẽ reset về mật khẩu tạm thời <b>BV@2024</b>, sau đó bạn cần đổi lại mật khẩu.</div>
    </div>`;
    badge.style.cssText = 'background:#FFF8E1;color:#E65100;border-color:#FFE082;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:12.5px;border:1.5px solid;';
    unameGrp.style.display = '';
    urgGrp.style.display = 'none';
    noteLabel.textContent = '📝 Mô tả thêm (không bắt buộc)';
    btnNext.textContent = 'Xem lại →';
    document.getElementById('acct-req-note').placeholder = 'VD: Tôi quên mật khẩu sau kỳ nghỉ lễ, tài khoản nguyenvanb...';
    // Ẩn ô mật khẩu yêu cầu cho reset
    const unameLabel = document.querySelector('#acct-req-username-group .form-label');
    if (unameLabel) unameLabel.innerHTML = '🔤 Tên đăng nhập tài khoản của bạn <span class="req">*</span>';
  }

  // Populate dept datalist
  const dl = document.getElementById('acct-req-dept-list');
  if (dl) {
    dl.innerHTML = '';
    (DEPTS || []).forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      dl.appendChild(opt);
    });
  }
  // Ghi chú counter
  const noteEl = document.getElementById('acct-req-note');
  noteEl.oninput = function() {
    document.getElementById('acct-req-note-counter').textContent = `${this.value.length}/300 ký tự`;
    if (this.value.length > 300) this.value = this.value.slice(0, 300);
  };

  openModal('modal-account-request');
}

// ── Trạng thái step hiện tại ──
let _acctReqCurrentStep = 1;
let _acctReqValid = false;

function acctReqGoStep(step) {
  _acctReqCurrentStep = step;
  // Update step indicators
  [1,2,3].forEach(s => {
    const stepEl = document.getElementById(`acct-step-${s}`);
    if (!stepEl) return;
    if (s < step) {
      stepEl.style.background = '#C8E6C9'; stepEl.style.color = '#2E7D32';
    } else if (s === step) {
      const type = document.getElementById('acct-req-type')?.value || 'new';
      stepEl.style.background = type === 'new' ? '#E3F2FD' : '#FFF8E1';
      stepEl.style.color = type === 'new' ? '#1565C0' : '#E65100';
    } else {
      stepEl.style.background = 'var(--surface2)'; stepEl.style.color = 'var(--text3)';
    }
  });
  // Show/hide panels
  document.getElementById('acct-req-step1').style.display = step === 1 ? '' : 'none';
  document.getElementById('acct-req-step2').style.display = step === 2 ? '' : 'none';
  document.getElementById('acct-req-step3').style.display = step === 3 ? '' : 'none';
  // Footer buttons
  const cancelBtn = document.getElementById('acct-req-btn-cancel');
  const nextBtn = document.getElementById('acct-req-btn-next');
  const nextLabel = document.getElementById('acct-req-btn-next-label');
  if (step === 1) {
    cancelBtn.style.display = '';
    cancelBtn.textContent = 'Hủy';
    nextBtn.style.display = '';
    nextLabel.textContent = 'Xem lại →';
    nextBtn.className = 'btn btn-primary';
  } else if (step === 2) {
    cancelBtn.style.display = '';
    cancelBtn.textContent = '← Sửa lại';
    cancelBtn.onclick = () => acctReqGoStep(1);
    nextBtn.style.display = '';
    nextLabel.textContent = '📤 Xác nhận gửi';
    nextBtn.className = 'btn btn-success';
  } else {
    cancelBtn.style.display = 'none';
    nextBtn.style.display = '';
    nextLabel.textContent = '✓ Đóng';
    nextBtn.className = 'btn btn-primary';
    nextBtn.onclick = () => { closeModal('modal-account-request'); nextBtn.onclick = acctReqNextStep; };
  }
}

function acctReqNextStep() {
  if (_acctReqCurrentStep === 1) {
    if (!acctReqValidateStep1()) return;
    acctReqBuildPreview();
    acctReqGoStep(2);
  } else if (_acctReqCurrentStep === 2) {
    submitAccountRequest();
  }
}

function acctReqValidateStep1() {
  const type = document.getElementById('acct-req-type').value;
  const fullname = document.getElementById('acct-req-fullname').value.trim();
  const username = document.getElementById('acct-req-username').value.trim();
  const contact = document.getElementById('acct-req-contact').value.trim();
  const errEl = document.getElementById('acct-req-err');

  const showErr = (msg) => {
    errEl.innerHTML = `⚠️ ${msg}`;
    errEl.style.display = 'block';
    errEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  };
  errEl.style.display = 'none';

  if (!fullname || fullname.length < 3) return showErr('Vui lòng nhập họ tên đầy đủ (tối thiểu 3 ký tự)');

  if (!username) return showErr('Vui lòng nhập tên đăng nhập');
  if (username.length < 4) return showErr('Tên đăng nhập tối thiểu 4 ký tự');
  if (!/^[a-z0-9_]+$/.test(username)) return showErr('Tên đăng nhập chỉ dùng chữ thường không dấu, số và dấu gạch dưới (_)');

  if (!contact) return showErr('Vui lòng nhập số điện thoại hoặc email để Admin liên hệ');
  if (contact.length < 8) return showErr('Số điện thoại / email không hợp lệ (quá ngắn)');

  // Kiểm tra tên đăng nhập trùng (cho cấp mới)
  if (type === 'new') {
    if (USERS.find(u => u.username === username)) {
      return showErr(`Tên đăng nhập "<b>${username}</b>" đã tồn tại trong hệ thống. Vui lòng chọn tên khác hoặc liên hệ Admin.`);
    }
  }
  // Kiểm tra tài khoản tồn tại (cho reset)
  if (type === 'reset') {
    if (!USERS.find(u => u.username === username)) {
      return showErr(`Không tìm thấy tài khoản "<b>${username}</b>" trong hệ thống. Kiểm tra lại tên đăng nhập hoặc yêu cầu cấp tài khoản mới.`);
    }
  }
  // Kiểm tra yêu cầu trùng (chưa xử lý)
  const existing = getAccountRequests();
  const dup = existing.find(r => r.username === username && r.type === type && r.status === 'pending');
  if (dup) {
    return showErr(`Đã có yêu cầu ${type==='new'?'cấp tài khoản':'reset mật khẩu'} cho tên đăng nhập "<b>${username}</b>" đang chờ xử lý. Admin chưa xử lý yêu cầu trước đó.`);
  }

  return true;
}

function acctReqBuildPreview() {
  const type = document.getElementById('acct-req-type').value;
  const fullname = document.getElementById('acct-req-fullname').value.trim();
  const username = document.getElementById('acct-req-username').value.trim();
  const contact = document.getElementById('acct-req-contact').value.trim();
  const dept = document.getElementById('acct-req-dept').value.trim();
  const note = document.getElementById('acct-req-note').value.trim();
  const urgency = document.querySelector('input[name="acct-req-urgency"]:checked')?.value || 'normal';
  const isNew = type === 'new';

  const preview = document.getElementById('acct-req-preview');
  preview.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1.5px solid var(--border);">
      <span style="font-size:20px;">${isNew?'📋':'🔑'}</span>
      <div>
        <div style="font-weight:800;font-size:14px;color:${isNew?'#1565C0':'#E65100'};">${isNew?'Yêu cầu cấp tài khoản mới':'Yêu cầu reset mật khẩu'}</div>
        <div style="font-size:10.5px;color:var(--text3);">Vui lòng kiểm tra thông tin trước khi gửi</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <tr><td style="padding:5px 0;color:var(--text3);width:40%;">👤 Họ tên:</td><td style="font-weight:700;">${fullname}</td></tr>
      <tr><td style="padding:5px 0;color:var(--text3);">🔤 Tên đăng nhập:</td><td><code style="background:#F0F4FF;padding:2px 7px;border-radius:4px;font-size:12px;">${username}</code></td></tr>
      <tr><td style="padding:5px 0;color:var(--text3);">📞 Liên hệ:</td><td style="font-weight:700;color:var(--primary);">${contact}</td></tr>
      ${dept ? `<tr><td style="padding:5px 0;color:var(--text3);">🏬 Khoa/Phòng:</td><td>${dept}</td></tr>` : ''}
      ${isNew && urgency==='urgent' ? `<tr><td style="padding:5px 0;color:var(--text3);">⏰ Ưu tiên:</td><td><span style="color:#E53935;font-weight:700;">🔴 Gấp / Khẩn</span></td></tr>` : ''}
      ${note ? `<tr><td style="padding:5px 0;color:var(--text3);vertical-align:top;">📝 Ghi chú:</td><td style="font-style:italic;">${note}</td></tr>` : ''}
    </table>
    ${isNew ? `<div style="margin-top:12px;padding:8px 12px;background:#E8F5E9;border-radius:7px;font-size:11.5px;color:#2E7D32;">✅ Sau khi Admin tạo tài khoản, mật khẩu mặc định ban đầu là <b>BV@2024</b>. Bạn cần đổi mật khẩu sau khi đăng nhập lần đầu.</div>`
      : `<div style="margin-top:12px;padding:8px 12px;background:#FFF3E0;border-radius:7px;font-size:11.5px;color:#E65100;">🔑 Admin sẽ reset mật khẩu tài khoản <b>${username}</b> về <b>BV@2024</b>. Vui lòng đổi mật khẩu ngay sau khi đăng nhập.</div>`}
  `;
}

function submitAccountRequest() {
  const type = document.getElementById('acct-req-type').value;
  const fullname = document.getElementById('acct-req-fullname').value.trim();
  const username = document.getElementById('acct-req-username').value.trim();
  const contact = document.getElementById('acct-req-contact').value.trim();
  const dept = document.getElementById('acct-req-dept').value.trim();
  const note = document.getElementById('acct-req-note').value.trim();
  const urgency = document.querySelector('input[name="acct-req-urgency"]:checked')?.value || 'normal';

  const reqs = getAccountRequests();
  const req = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type,
    fullname,
    username,
    contact,
    dept,
    note,
    urgency,
    createdAt: new Date().toISOString(),
    doneAt: null,
    status: 'pending'
  };
  reqs.unshift(req);
  saveAccountRequests(reqs);

  // Cập nhật done message
  const doneMsg = document.getElementById('acct-req-done-msg');
  if (doneMsg) {
    doneMsg.innerHTML = type === 'new'
      ? `Yêu cầu cấp tài khoản cho <b>${fullname}</b><br>Admin sẽ liên hệ qua: <b style="color:var(--primary);">${contact}</b>`
      : `Yêu cầu reset mật khẩu tài khoản <b>${username}</b><br>Admin sẽ liên hệ qua: <b style="color:var(--primary);">${contact}</b>`;
  }

  // Chuyển sang step 3
  acctReqGoStep(3);
}

// ── Auto-generate username từ họ tên ──
function acctReqAutoUsername(fullname) {
  const type = document.getElementById('acct-req-type')?.value;
  const hint = document.getElementById('acct-req-fullname-hint');
  if (!fullname || fullname.length < 3) { if(hint) hint.style.display='none'; return; }

  const parts = fullname.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')
    .split(/\s+/).filter(Boolean);
  if (parts.length < 2) return;
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => p[0]).join('');
  const suggested = `${lastName}_${initials}`;

  const unameEl = document.getElementById('acct-req-username');
  if (unameEl && !unameEl.value) {
    unameEl.value = suggested;
    acctReqValidateUsername(suggested);
  }
  if (hint) {
    hint.innerHTML = `💡 Gợi ý: tên đăng nhập từ họ tên của bạn`;
    hint.style.display = '';
    hint.style.color = 'var(--text3)';
  }
}

// ── Validate username realtime ──
function acctReqValidateUsername(val) {
  const hint = document.getElementById('acct-req-uname-hint');
  const ok = document.getElementById('acct-req-uname-ok');
  const type = document.getElementById('acct-req-type')?.value;
  if (!val) { if(hint) hint.style.color='var(--text3)'; if(ok) ok.style.display='none'; return; }
  if (!/^[a-z0-9_]+$/.test(val)) {
    if(hint) { hint.textContent='⚠️ Chỉ dùng chữ thường không dấu, số và dấu gạch dưới (_)'; hint.style.color='#E53935'; }
    if(ok) ok.style.display='none';
  } else if (val.length < 4) {
    if(hint) { hint.textContent=`⚠️ Cần tối thiểu 4 ký tự (hiện ${val.length})`; hint.style.color='#F57C00'; }
    if(ok) ok.style.display='none';
  } else {
    const exists = USERS.find(u => u.username === val);
    if (type === 'new' && exists) {
      if(hint) { hint.textContent=`❌ Tên đăng nhập "${val}" đã tồn tại`; hint.style.color='#E53935'; }
      if(ok) ok.style.display='none';
    } else if (type === 'reset' && !exists) {
      if(hint) { hint.textContent=`⚠️ Không tìm thấy tài khoản "${val}" – kiểm tra lại chính tả`; hint.style.color='#F57C00'; }
      if(ok) ok.style.display='none';
    } else {
      if(hint) {
        hint.textContent = type === 'reset' ? `✅ Tìm thấy tài khoản "${val}"` : `✅ Tên đăng nhập hợp lệ`;
        hint.style.color='var(--success,#2E7D32)';
      }
      if(ok) ok.style.display='';
    }
  }
}

// ── Validate contact realtime ──
function acctReqValidateContact(val) {
  const hint = document.getElementById('acct-req-contact-hint');
  if (!hint) return;
  if (!val) { hint.style.display='none'; return; }
  const isPhone = /^0[0-9]{8,9}$/.test(val.replace(/\s/g,''));
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  if (isPhone) {
    hint.textContent='✅ Số điện thoại hợp lệ'; hint.style.color='var(--success)'; hint.style.display='';
  } else if (isEmail) {
    hint.textContent='✅ Email hợp lệ'; hint.style.color='var(--success)'; hint.style.display='';
  } else if (val.length > 5) {
    hint.textContent='ℹ️ Nhập SĐT (VD: 0901234567) hoặc email hợp lệ'; hint.style.color='var(--text3)'; hint.style.display='';
  } else {
    hint.style.display='none';
  }
}

// ── Thay đổi mức ưu tiên ──
function acctReqUrgencyChange(val) {
  const normalLbl = document.getElementById('urgency-normal-lbl');
  const urgentLbl = document.getElementById('urgency-urgent-lbl');
  if (normalLbl) normalLbl.style.borderColor = val==='normal'?'var(--success)':'var(--border)';
  if (urgentLbl) urgentLbl.style.borderColor = val==='urgent'?'#E53935':'var(--border)';
}

// =========================================================
// ADMIN: RENDER YÊU CẦU TÀI KHOẢN
// =========================================================
function renderAccountRequests() {
  const bodyEl = document.getElementById('acct-requests-body');
  if (!bodyEl) return;

  // Pull từ Cloud trước nếu có kết nối
  if (navigator.onLine && gsReady()) {
    gsPullAccountRequests().then(() => _renderAccountRequestsHTML()).catch(() => _renderAccountRequestsHTML());
  } else {
    _renderAccountRequestsHTML();
  }
}

function _renderAccountRequestsHTML() {
  const bodyEl = document.getElementById('acct-requests-body');
  if (!bodyEl) return;
  const reqs = getAccountRequests();

  updateReqBadge();

  if (!reqs.length) {
    bodyEl.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-icon" style="font-size:30px;">📭</div><div class="empty-text" style="font-size:13px;">Chưa có yêu cầu nào</div></div>';
    return;
  }

  // Nhóm: pending trước, sau đó done/rejected
  const pending = reqs.filter(r => r.status === 'pending');
  const processed = reqs.filter(r => r.status !== 'pending');

  let html = '';
  if (pending.length) {
    html += `<div style="font-size:10.5px;font-weight:700;color:var(--warning,#E65100);text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
      <span style="background:#FF6F00;color:#fff;border-radius:10px;padding:1px 8px;font-size:11px;">${pending.length}</span> Đang chờ xử lý
    </div>`;
    pending.forEach(req => { html += _reqItemHTML(req); });
  }
  if (processed.length) {
    html += `<div style="font-size:10.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin:14px 0 8px;">Đã xử lý (${processed.length})</div>`;
    processed.forEach(req => { html += _reqItemHTML(req); });
  }
  bodyEl.innerHTML = html;
}

function _reqItemHTML(req) {
  const isNew = req.type === 'new';
  const typeLabel = isNew ? '📋 Cấp tài khoản mới' : '🔑 Reset mật khẩu';
  const urgentTag = req.urgency === 'urgent' ? '<span style="background:#FFEBEE;color:#C62828;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;border:1px solid #EF9A9A;">🔴 Khẩn</span>' : '';
  const statusBadge = req.status === 'pending'
    ? '<span class="chip chip-orange">⏳ Chờ xử lý</span>'
    : req.status === 'done'
      ? '<span class="chip chip-green">✅ Đã xử lý</span>'
      : '<span style="background:#FFEBEE;color:#B71C1C;font-size:11px;padding:2px 8px;border-radius:10px;">❌ Từ chối</span>';
  const d = new Date(req.createdAt).toLocaleString('vi-VN');
  const doneInfo = req.doneAt ? `<br>🕐 Xử lý lúc: ${new Date(req.doneAt).toLocaleString('vi-VN')}` : '';
  return `<div class="req-item req-${isNew?'new':'reset'}${req.status!=='pending'?' req-done':''}${req.urgency==='urgent'?' req-urgent':''}">
    <div class="req-item-icon">${isNew?'📋':'🔑'}</div>
    <div class="req-item-body">
      <div class="req-item-title">${typeLabel} ${urgentTag} – <b>${req.fullname}</b> ${statusBadge}</div>
      <div class="req-item-meta">
        🕐 Gửi lúc: ${d}${doneInfo}<br>
        🔤 Tên đăng nhập: <code style="background:#F0F4FF;padding:1px 6px;border-radius:4px;">${req.username||'—'}</code>
        &nbsp;|&nbsp; 📞 <b>${req.contact}</b>
        ${req.dept ? `<br>🏬 Khoa/Phòng: <i>${req.dept}</i>` : ''}
        ${req.note ? `<br>📝 <i>${req.note}</i>` : ''}
      </div>
      ${req.status === 'pending' ? `<div class="req-item-actions">
        ${isNew ? `<button class="btn btn-primary btn-xs" onclick="approveNewAccount('${req.id}')">✅ Tạo tài khoản</button>` : ''}
        ${!isNew ? `<button class="btn btn-warning btn-xs" onclick="approveResetRequest('${req.id}')">🔑 Reset → BV@2024</button>` : ''}
        <button class="btn btn-outline btn-xs" onclick="rejectRequest('${req.id}')">❌ Từ chối</button>
        <button class="btn btn-danger btn-xs" onclick="deleteRequest('${req.id}')" title="Xóa yêu cầu">🗑️</button>
      </div>` : `<div class="req-item-actions"><button class="btn btn-danger btn-xs" onclick="deleteRequest('${req.id}')">🗑️ Xóa</button></div>`}
    </div>
  </div>`;
}

function updateReqBadge() {
  const reqs = getAccountRequests();
  const pendingCount = reqs.filter(r => r.status === 'pending').length;
  const urgentCount = reqs.filter(r => r.status === 'pending' && r.urgency === 'urgent').length;
  const badge = document.getElementById('req-badge');
  const navBadge = document.getElementById('reqBadgeNav');
  [badge, navBadge].forEach(b => {
    if (!b) return;
    b.textContent = pendingCount;
    b.style.display = pendingCount > 0 ? '' : 'none';
    if (urgentCount > 0) { b.style.background = '#E53935'; b.title = `${urgentCount} yêu cầu khẩn`; }
    else { b.style.background = 'var(--accent2)'; b.title = ''; }
  });
  const topBtn = document.getElementById('topbar-req-btn');
  const topCount = document.getElementById('topbar-req-count');
  if (topBtn) {
    topBtn.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    if (urgentCount > 0) { topBtn.style.background = '#FFEBEE'; topBtn.style.color = '#C62828'; topBtn.style.borderColor = '#EF9A9A'; }
    else { topBtn.style.background = '#FFF3E0'; topBtn.style.color = '#E65100'; topBtn.style.borderColor = '#FFCC80'; }
  }
  if (topCount) topCount.textContent = pendingCount;
}

function approveNewAccount(reqId) {
  const reqs = getAccountRequests();
  const req = reqs.find(r => r.id === reqId);
  if (!req) return;
  // Pre-fill modal thêm tài khoản
  document.getElementById('mu-id').value = '';
  document.getElementById('mu-username').value = req.username || '';
  document.getElementById('mu-fullname').value = req.fullname || '';
  document.getElementById('mu-role').value = 'user';
  document.getElementById('mu-password').value = 'BV@2024';
  document.getElementById('mu-password2').value = 'BV@2024';
  document.getElementById('modal-user-title').textContent = '✅ Tạo tài khoản từ yêu cầu';
  refreshDeptDropdowns();
  if (req.dept) {
    const deptSel = document.getElementById('mu-dept');
    const opt = Array.from(deptSel.options).find(o => o.text.includes(req.dept) || req.dept.includes(o.text));
    if (opt) deptSel.value = opt.value;
  }
  // Đánh dấu đã xử lý
  req.status = 'done';
  req.doneAt = new Date().toISOString();
  saveAccountRequests(reqs);
  renderAccountRequests();
  openModal('modal-user');
  toast(`✅ Đang tạo tài khoản cho "${req.fullname}"`, 'success');
  gsLogHistory('approve_new_acct', `Admin duyệt cấp TK mới: ${req.username} (${req.fullname})`);
}

function approveResetRequest(reqId) {
  const reqs = getAccountRequests();
  const req = reqs.find(r => r.id === reqId);
  if (!req) return;
  const user = USERS.find(u => u.username === req.username);
  if (!user) {
    // Tài khoản không còn tồn tại
    showConfirm(`⚠️ Không tìm thấy tài khoản "${req.username}" trong hệ thống. Có thể tài khoản đã bị xóa. Đánh dấu từ chối yêu cầu này?`, () => {
      req.status = 'rejected';
      req.doneAt = new Date().toISOString();
      saveAccountRequests(reqs);
      renderAccountRequests();
      toast(`Đã từ chối yêu cầu (tài khoản không tồn tại)`, 'warning');
    });
    return;
  }
  showConfirm(`Reset mật khẩu tài khoản "<b>${req.username}</b>" (${req.fullname}) về mật khẩu tạm: <b>BV@2024</b>?<br><small style="color:var(--text3);">Người dùng sẽ cần đổi mật khẩu khi đăng nhập lần tiếp.</small>`, () => {
    user.password = 'BV@2024';
    user.mustChangePassword = true;
    saveUsers();
    if (navigator.onLine && gsReady()) gsPushUsers().catch(() => {});
    req.status = 'done';
    req.doneAt = new Date().toISOString();
    saveAccountRequests(reqs);
    renderAccountRequests();
    toast(`✅ Đã reset mật khẩu "${req.username}" → BV@2024. Thông báo cho người dùng!`, 'success');
    gsLogHistory('reset_password', `Admin reset MK yêu cầu: ${req.username} (${req.fullname})`);
  });
}

function rejectRequest(reqId) {
  const reqs = getAccountRequests();
  const req = reqs.find(r => r.id === reqId);
  if (req) {
    showConfirm(`Từ chối yêu cầu của <b>${req.fullname}</b>?`, () => {
      req.status = 'rejected';
      req.doneAt = new Date().toISOString();
      saveAccountRequests(reqs);
      renderAccountRequests();
      toast('Đã từ chối yêu cầu', 'info');
    });
  }
}
function deleteRequest(reqId) {
  const reqs = getAccountRequests().filter(r => r.id !== reqId);
  saveAccountRequests(reqs);
  _renderAccountRequestsHTML();
}
function clearAllRequests() {
  showConfirm('Xóa tất cả yêu cầu tài khoản? Thao tác này không thể hoàn tác.', () => {
    saveAccountRequests([]);
    renderAccountRequests();
    toast('Đã xóa tất cả yêu cầu', 'info');
  });
}

// =========================================================
// PROFILE PAGE (for non-admin users)
// =========================================================
function loadMyProfile() {
  if (!currentUser || currentUser.role === 'guest') return;
  document.getElementById('profile-fullname').textContent = currentUser.fullname || '---';
  document.getElementById('profile-username').textContent = '@' + currentUser.username;
  document.getElementById('profile-dept-display').textContent = currentUser.dept ? '🏬 ' + currentUser.dept : '';
  document.getElementById('profile-avatar').textContent = currentUser.role === 'admin' ? '🔑' : '👤';
  const roleBadge = document.getElementById('profile-role-badge');
  if (roleBadge) {
    roleBadge.textContent = currentUser.role === 'admin' ? '🔑 Quản trị viên' : '👤 Nhân viên Y tế';
    roleBadge.className = currentUser.role === 'admin' ? 'chip chip-purple' : 'chip chip-green';
  }
  const fullnameEl = document.getElementById('prof-fullname');
  if (fullnameEl) fullnameEl.value = currentUser.fullname || '';
  // Populate dept select
  const deptSel = document.getElementById('prof-dept');
  if (deptSel) {
    refreshDeptDropdowns();
    deptSel.innerHTML = '<option value="">-- Chọn khoa --</option>';
    DEPTS.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name; opt.textContent = d.name;
      if (d.name === currentUser.dept) opt.selected = true;
      deptSel.appendChild(opt);
    });
  }
  // Clear password fields
  ['prof-pw-current','prof-pw-new','prof-pw-confirm'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('pw-strength-bar').style.display = 'none';
  document.getElementById('prof-pw-err').style.display = 'none';
}

function saveMyProfile() {
  if (!currentUser) return;
  const fullname = (document.getElementById('prof-fullname')?.value || '').trim();
  const dept = document.getElementById('prof-dept')?.value || '';
  if (!fullname) { toast('Vui lòng nhập họ tên', 'warning'); return; }
  const userIdx = USERS.findIndex(u => u.id === currentUser.id);
  if (userIdx < 0) { toast('Không tìm thấy tài khoản', 'error'); return; }
  USERS[userIdx].fullname = fullname;
  USERS[userIdx].dept = dept;
  currentUser.fullname = fullname;
  currentUser.dept = dept;
  saveUsers();
  applyRoleUI();
  loadMyProfile();
  toast('✅ Đã cập nhật thông tin tài khoản', 'success');
  if (navigator.onLine && gsReady()) gsPushUsers().catch(() => {});
  gsLogHistory('update_profile', `Cập nhật thông tin: ${currentUser.username}`);
}

function changeMyPassword() {
  if (!currentUser) return;
  const current = document.getElementById('prof-pw-current')?.value || '';
  const newPw = document.getElementById('prof-pw-new')?.value || '';
  const confirm = document.getElementById('prof-pw-confirm')?.value || '';
  const errEl = document.getElementById('prof-pw-err');

  if (!current || !newPw || !confirm) {
    errEl.textContent = '⚠️ Vui lòng điền đầy đủ tất cả các ô mật khẩu';
    errEl.style.display = 'block'; return;
  }
  const userRecord = USERS.find(u => u.id === currentUser.id);
  if (!userRecord || userRecord.password !== current) {
    errEl.textContent = '❌ Mật khẩu hiện tại không đúng';
    errEl.style.display = 'block'; return;
  }
  if (newPw.length < 6) {
    errEl.textContent = '⚠️ Mật khẩu mới phải có ít nhất 6 ký tự';
    errEl.style.display = 'block'; return;
  }
  if (newPw !== confirm) {
    errEl.textContent = '❌ Mật khẩu xác nhận không khớp';
    errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  userRecord.password = newPw;
  userRecord.mustChangePassword = false;
  currentUser.mustChangePassword = false;
  saveUsers();
  ['prof-pw-current','prof-pw-new','prof-pw-confirm'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('pw-strength-bar').style.display = 'none';
  toast('✅ Đổi mật khẩu thành công! Vui lòng ghi nhớ mật khẩu mới.', 'success');
  if (navigator.onLine && gsReady()) gsPushUsers().catch(() => {});
  gsLogHistory('change_password', `Đổi mật khẩu: ${currentUser.username}`);
}

function checkPwStrength(pw) {
  const bar = document.getElementById('pw-strength-bar');
  const fill = document.getElementById('pw-strength-fill');
  const label = document.getElementById('pw-strength-label');
  if (!bar || !fill || !label) return;
  if (!pw) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { pct: 20, color: '#E53935', text: 'Rất yếu', cls: 'pw-strength-weak' },
    { pct: 40, color: '#FF7043', text: 'Yếu', cls: 'pw-strength-weak' },
    { pct: 60, color: '#FFA726', text: 'Trung bình', cls: 'pw-strength-fair' },
    { pct: 80, color: '#8BC34A', text: 'Tốt', cls: 'pw-strength-good' },
    { pct: 100, color: '#2E7D32', text: 'Mạnh ✓', cls: 'pw-strength-strong' },
  ];
  const lv = levels[Math.min(score, 4)];
  fill.style.width = lv.pct + '%'; fill.style.background = lv.color;
  label.textContent = lv.text; label.style.color = lv.color;
}

// =========================================================
// ADMIN: RESET USER PASSWORD (direct)
// =========================================================
function openResetUserPw(userId) {
  const user = USERS.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('reset-user-id').value = userId;
  document.getElementById('reset-user-display').textContent = `${user.username} (${user.fullname})`;
  document.getElementById('reset-pw-new').value = '';
  document.getElementById('reset-pw-confirm').value = '';
  openModal('modal-reset-user-pw');
}

function setDefaultPassword() {
  document.getElementById('reset-pw-new').value = 'BV@2024';
  document.getElementById('reset-pw-confirm').value = 'BV@2024';
}

function doResetUserPassword() {
  const userId = document.getElementById('reset-user-id').value;
  const newPw = document.getElementById('reset-pw-new').value;
  const confirm = document.getElementById('reset-pw-confirm').value;
  if (!newPw || newPw.length < 6) { toast('Mật khẩu tối thiểu 6 ký tự', 'warning'); return; }
  if (newPw !== confirm) { toast('Mật khẩu xác nhận không khớp', 'error'); return; }
  const user = USERS.find(u => u.id === userId);
  if (!user) { toast('Không tìm thấy tài khoản', 'error'); return; }
  user.password = newPw;
  user.mustChangePassword = true; // force user to change on next login
  saveUsers();
  closeModal('modal-reset-user-pw');
  renderUsers();
  toast(`✅ Đã reset mật khẩu "${user.username}" → ${newPw}`, 'success');
  if (navigator.onLine && gsReady()) gsPushUsers().catch(() => {});
  gsLogHistory('admin_reset_pw', `Admin reset MK: ${user.username}`);
}

// =========================================================
// EXPORT USERS CSV
// =========================================================
function exportUsersCSV() {
  const hdr = ['ID','Tên đăng nhập','Họ tên','Vai trò','Khoa/Phòng','Cần đổi MK'];
  const rows = USERS.map(u => [u.id, u.username, u.fullname, u.role, u.dept||'', u.mustChangePassword?'Có':'Không']);
  const csv = [hdr,...rows].map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const b = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(b);
  a.download = 'users_'+new Date().toISOString().split('T')[0]+'.csv'; a.click();
  toast('✅ Xuất danh sách tài khoản CSV', 'success');
}




// =========================================================
// LOGIN PANEL – Yêu cầu tài khoản / Reset MK ngay trên form đăng nhập
// Hiển thị IN-PLACE trong login-box, không dùng modal overlay
// =========================================================

/**
 * Hiện panel yêu cầu (type = 'new' | 'reset')
 * Ẩn #lp-main, hiện #lp-new hoặc #lp-reset
 */
function loginPanelShow(type) {
  // Ẩn panel chính
  const main = document.getElementById('lp-main');
  if (main) main.style.display = 'none';

  // Reset panel về step 1
  lpResetPanel(type);

  // Populate datalist khoa phòng (nếu có)
  const dl = document.getElementById('lp-new-dept-list');
  if (dl) {
    dl.innerHTML = '';
    (DEPTS || []).forEach(d => {
      const opt = document.createElement('option'); opt.value = d.name; dl.appendChild(opt);
    });
  }

  // Hiện panel
  const panel = document.getElementById('lp-' + type);
  if (panel) { panel.style.display = ''; panel.style.animation = 'loginAppear .25s ease'; }

  // Scroll login-box về đầu
  const box = document.querySelector('.login-box');
  if (box) box.scrollTop = 0;
}

/** Quay lại panel đăng nhập chính */
function loginPanelBack() {
  ['lp-new', 'lp-reset'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const main = document.getElementById('lp-main');
  if (main) { main.style.display = ''; main.style.animation = 'loginAppear .2s ease'; }
  const box = document.querySelector('.login-box');
  if (box) box.scrollTop = 0;
}

/** Reset panel về trạng thái ban đầu (step 1) */
function lpResetPanel(type) {
  const prefix = 'lp-' + type + '-';
  // Show form, hide preview & done
  ['form','preview','done'].forEach((s,i) => {
    const el = document.getElementById(prefix + s);
    if (el) el.style.display = i === 0 ? '' : 'none';
  });
  // Clear fields
  const fields = ['fullname','username','contact','dept','note'];
  fields.forEach(f => {
    const el = document.getElementById(prefix + f);
    if (el) el.value = '';
  });
  // Clear error
  const err = document.getElementById(prefix + 'err');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  // Clear hints
  ['uname-hint','contact-hint','uname-ok'].forEach(h => {
    const el = document.getElementById(prefix + h);
    if (!el) return;
    if (h === 'uname-ok') { el.style.display = 'none'; }
    else if (h === 'uname-hint') {
      el.style.color = 'rgba(255,255,255,.45)';
      el.textContent = type === 'new'
        ? 'Chỉ dùng chữ thường, số, dấu gạch dưới (_). Tối thiểu 4 ký tự.'
        : 'Nhập chính xác tên đăng nhập đã được cấp.';
    } else { el.style.display = 'none'; }
  });
  // Reset urgency radio
  if (type === 'new') {
    const normalR = document.querySelector('input[name="lp-new-urgency"][value="normal"]');
    if (normalR) normalR.checked = true;
    lpUrgencyChange('new', 'normal');
  }
  // Reset note counter
  const ct = document.getElementById(prefix + 'note-ct');
  if (ct) ct.textContent = type === 'new' ? '0/300' : '0/200';
  // Reset steps
  lpStepIndicator(type, 1);
}

/** Cập nhật step indicator */
function lpStepIndicator(type, step) {
  [1,2,3].forEach(s => {
    const el = document.getElementById('lp-' + type + '-s' + s);
    if (!el) return;
    el.className = 'lp-step';
    if (s < step) {
      el.classList.add('lp-step-done');
    } else if (s === step) {
      el.classList.add('lp-step-active');
      if (type === 'reset') el.classList.add('lp-step-orange');
    }
    // Update step num
    const num = el.querySelector('.lp-step-num');
    if (num) {
      num.className = 'lp-step-num';
      if (s < step) num.textContent = '✓';
      else num.textContent = s;
      if (s === step && type === 'reset') num.classList.add('lp-step-num-orange');
    }
  });
}

/** Auto-generate username từ họ tên (cho form new) */
function lpAutoUsername(fullname) {
  if (!fullname || fullname.length < 3) return;
  const unameEl = document.getElementById('lp-new-username');
  if (!unameEl || unameEl.value) return; // không ghi đè nếu đã nhập
  const parts = fullname.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/đ/g,'d').replace(/[^a-z0-9\s]/g,'')
    .split(/\s+/).filter(Boolean);
  if (parts.length < 2) return;
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => p[0]).join('');
  unameEl.value = last + '_' + initials;
  lpValidateUsername(unameEl.value, 'new');
}

/** Validate username realtime */
function lpValidateUsername(val, type) {
  const hint = document.getElementById('lp-' + type + '-uname-hint');
  const ok   = document.getElementById('lp-' + type + '-uname-ok');
  if (!hint) return;
  if (!val) {
    hint.style.color = 'rgba(255,255,255,.45)';
    hint.textContent = type === 'new'
      ? 'Chỉ dùng chữ thường, số, dấu gạch dưới (_). Tối thiểu 4 ký tự.'
      : 'Nhập chính xác tên đăng nhập đã được cấp.';
    if (ok) ok.style.display = 'none';
    return;
  }
  if (!/^[a-z0-9_]+$/.test(val)) {
    hint.textContent = '⚠️ Chỉ dùng chữ thường không dấu, số và dấu gạch dưới (_)';
    hint.style.color = '#FF5252';
    if (ok) ok.style.display = 'none';
    return;
  }
  if (val.length < 4) {
    hint.textContent = `⚠️ Cần tối thiểu 4 ký tự (hiện ${val.length})`;
    hint.style.color = '#FFB74D';
    if (ok) ok.style.display = 'none';
    return;
  }
  // Kiểm tra tồn tại
  const exists = (USERS || []).find(u => u.username === val);
  if (type === 'new' && exists) {
    hint.textContent = `❌ Tên "${val}" đã tồn tại – chọn tên khác`;
    hint.style.color = '#FF5252';
    if (ok) ok.style.display = 'none';
  } else if (type === 'reset' && !exists) {
    hint.textContent = `⚠️ Không tìm thấy tài khoản "${val}" – kiểm tra lại`;
    hint.style.color = '#FFB74D';
    if (ok) ok.style.display = 'none';
  } else {
    hint.textContent = type === 'reset' ? `✅ Tìm thấy tài khoản "${val}"` : `✅ Tên đăng nhập hợp lệ`;
    hint.style.color = '#A5D6A7';
    if (ok) ok.style.display = 'inline';
  }
}

/** Validate contact realtime */
function lpValidateContact(val, type) {
  const hint = document.getElementById('lp-' + type + '-contact-hint');
  if (!hint) return;
  if (!val) { hint.style.display = 'none'; return; }
  const isPhone = /^0[0-9]{8,9}$/.test(val.replace(/\s/g,''));
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  if (isPhone) {
    hint.textContent = '✅ Số điện thoại hợp lệ';
    hint.style.color = '#A5D6A7';
  } else if (isEmail) {
    hint.textContent = '✅ Email hợp lệ';
    hint.style.color = '#A5D6A7';
  } else if (val.length > 5) {
    hint.textContent = 'ℹ️ Nhập SĐT (VD: 0901234567) hoặc email';
    hint.style.color = 'rgba(255,255,255,.45)';
  } else {
    hint.style.display = 'none'; return;
  }
  hint.style.display = '';
}

/** Đếm ký tự textarea */
function lpCountNote(el, counterId, max) {
  if (!el) return;
  if (el.value.length > max) el.value = el.value.slice(0, max);
  const ct = document.getElementById(counterId);
  if (ct) ct.textContent = el.value.length + '/' + max;
}

/** Thay đổi mức ưu tiên */
function lpUrgencyChange(type, val) {
  if (type !== 'new') return;
  const n = document.getElementById('lp-new-urg-n');
  const u = document.getElementById('lp-new-urg-u');
  if (n) n.style.borderColor = val === 'normal' ? 'rgba(165,214,167,.7)' : 'rgba(255,255,255,.15)';
  if (u) u.style.borderColor = val === 'urgent' ? 'rgba(255,82,82,.7)' : 'rgba(255,255,255,.15)';
}

/** Validate Step 1 và chuyển sang Step 2 (preview) */
function lpStep1Next(type) {
  const p = 'lp-' + type + '-';
  const fullname = (document.getElementById(p + 'fullname')?.value || '').trim();
  const username = (document.getElementById(p + 'username')?.value || '').trim();
  const contact  = (document.getElementById(p + 'contact')?.value || '').trim();
  const errEl    = document.getElementById(p + 'err');

  const showErr = msg => {
    errEl.innerHTML = '⚠️ ' + msg;
    errEl.style.display = 'block';
    errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  errEl.style.display = 'none';

  if (!fullname || fullname.length < 3) return showErr('Vui lòng nhập họ tên đầy đủ (tối thiểu 3 ký tự)');
  if (!username) return showErr('Vui lòng nhập tên đăng nhập');
  if (username.length < 4) return showErr('Tên đăng nhập tối thiểu 4 ký tự');
  if (!/^[a-z0-9_]+$/.test(username)) return showErr('Tên đăng nhập chỉ dùng chữ thường, số, dấu gạch dưới (_)');
  if (!contact || contact.length < 8) return showErr('Vui lòng nhập SĐT hoặc email liên hệ hợp lệ');

  // Kiểm tra tồn tại
  const exists = (USERS || []).find(u => u.username === username);
  if (type === 'new' && exists) return showErr(`Tên đăng nhập "<b>${username}</b>" đã tồn tại. Vui lòng chọn tên khác.`);
  if (type === 'reset' && !exists) return showErr(`Không tìm thấy tài khoản "<b>${username}</b>". Kiểm tra lại tên đăng nhập.`);

  // Kiểm tra yêu cầu pending trùng
  const reqs = getAccountRequests();
  const dup = reqs.find(r => r.username === username && r.type === type && r.status === 'pending');
  if (dup) return showErr(`Đã có yêu cầu ${type==='new'?'cấp tài khoản':'reset mật khẩu'} cho "<b>${username}</b>" đang chờ xử lý.`);

  // Build preview
  lpBuildPreview(type);
  // Chuyển sang step 2
  document.getElementById(p + 'form').style.display = 'none';
  document.getElementById(p + 'preview').style.display = '';
  lpStepIndicator(type, 2);
  const box = document.querySelector('.login-box');
  if (box) box.scrollTop = 0;
}

/** Build preview HTML */
function lpBuildPreview(type) {
  const p = 'lp-' + type + '-';
  const fullname = document.getElementById(p + 'fullname')?.value.trim() || '';
  const username = document.getElementById(p + 'username')?.value.trim() || '';
  const contact  = document.getElementById(p + 'contact')?.value.trim() || '';
  const dept     = document.getElementById(p + 'dept')?.value.trim() || '';
  const note     = document.getElementById(p + 'note')?.value.trim() || '';
  const urgency  = type === 'new'
    ? (document.querySelector('input[name="lp-new-urgency"]:checked')?.value || 'normal')
    : 'normal';

  const isNew = type === 'new';
  const previewEl = document.getElementById(p + 'preview-body');
  if (!previewEl) return;

  previewEl.innerHTML = `
    <div style="padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid rgba(255,255,255,.15);font-weight:800;font-size:14px;">
      ${isNew ? '📋 Yêu cầu cấp tài khoản mới' : '🔑 Yêu cầu reset mật khẩu'}
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td class="lp-pr-label" style="padding:3px 0;width:42%;font-size:11.5px;color:rgba(255,255,255,.5);">👤 Họ tên:</td><td style="font-weight:700;">${fullname}</td></tr>
      <tr><td class="lp-pr-label" style="padding:3px 0;font-size:11.5px;color:rgba(255,255,255,.5);">🔤 Tên đăng nhập:</td><td><code>${username}</code></td></tr>
      <tr><td class="lp-pr-label" style="padding:3px 0;font-size:11.5px;color:rgba(255,255,255,.5);">📞 Liên hệ:</td><td style="font-weight:700;color:#90CAF9;">${contact}</td></tr>
      ${dept ? `<tr><td class="lp-pr-label" style="padding:3px 0;font-size:11.5px;color:rgba(255,255,255,.5);">🏬 Khoa/Phòng:</td><td>${dept}</td></tr>` : ''}
      ${isNew && urgency === 'urgent' ? `<tr><td style="padding:3px 0;font-size:11.5px;color:rgba(255,255,255,.5);">⏰ Ưu tiên:</td><td style="color:#FF5252;font-weight:700;">🔴 Gấp / Khẩn</td></tr>` : ''}
      ${note ? `<tr><td style="padding:3px 0;font-size:11.5px;color:rgba(255,255,255,.5);vertical-align:top;">📝 Ghi chú:</td><td style="font-style:italic;font-size:12.5px;">${note}</td></tr>` : ''}
    </table>
    <div style="margin-top:12px;padding:8px 11px;background:rgba(255,255,255,.08);border-radius:7px;font-size:11.5px;color:rgba(255,255,255,.65);">
      ${isNew
        ? '✅ Mật khẩu mặc định sau khi Admin cấp: <b style="color:#90CAF9;">BV@2024</b>. Vui lòng đổi mật khẩu ngay sau khi đăng nhập lần đầu.'
        : '🔑 Admin sẽ reset mật khẩu tài khoản <b style="color:#FFCC80;">' + username + '</b> về <b>BV@2024</b>. Đổi mật khẩu ngay khi đăng nhập.'}
    </div>`;
}

/** Quay lại step 1 từ preview */
function lpPreviewBack(type) {
  const p = 'lp-' + type + '-';
  document.getElementById(p + 'preview').style.display = 'none';
  document.getElementById(p + 'form').style.display = '';
  lpStepIndicator(type, 1);
  const box = document.querySelector('.login-box');
  if (box) box.scrollTop = 0;
}

/** Xác nhận gửi yêu cầu */
function lpConfirmSubmit(type) {
  const p = 'lp-' + type + '-';
  const fullname = document.getElementById(p + 'fullname')?.value.trim() || '';
  const username = document.getElementById(p + 'username')?.value.trim() || '';
  const contact  = document.getElementById(p + 'contact')?.value.trim() || '';
  const dept     = document.getElementById(p + 'dept')?.value.trim() || '';
  const note     = document.getElementById(p + 'note')?.value.trim() || '';
  const urgency  = type === 'new'
    ? (document.querySelector('input[name="lp-new-urgency"]:checked')?.value || 'normal')
    : 'normal';

  const reqs = getAccountRequests();
  const req = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type,
    fullname,
    username,
    contact,
    dept,
    note,
    urgency,
    createdAt: new Date().toISOString(),
    doneAt: null,
    status: 'pending'
  };
  reqs.unshift(req);
  saveAccountRequests(reqs);

  // Cập nhật done message
  const doneMsg = document.getElementById(p + 'done-msg');
  if (doneMsg) {
    doneMsg.innerHTML = type === 'new'
      ? `Yêu cầu cấp tài khoản cho <b>${fullname}</b>.<br>Admin sẽ liên hệ qua: <b style="color:#90CAF9;">${contact}</b>`
      : `Yêu cầu reset mật khẩu tài khoản <b>${username}</b>.<br>Admin sẽ liên hệ qua: <b style="color:#FFCC80;">${contact}</b>`;
  }

  // Chuyển sang step 3 (done)
  document.getElementById(p + 'preview').style.display = 'none';
  document.getElementById(p + 'done').style.display = '';
  lpStepIndicator(type, 3);
  const box = document.querySelector('.login-box');
  if (box) box.scrollTop = 0;
}
