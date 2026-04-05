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
// ACCOUNT REQUESTS SYSTEM
// =========================================================
const ACCT_REQUESTS_KEY = 'kshl_v4_acct_requests';

function getAccountRequests() {
  try { return JSON.parse(localStorage.getItem(ACCT_REQUESTS_KEY) || '[]'); } catch(e) { return []; }
}
function saveAccountRequests(reqs) {
  localStorage.setItem(ACCT_REQUESTS_KEY, JSON.stringify(reqs));
}

function openAccountRequest(type) {
  document.getElementById('acct-req-type').value = type;
  document.getElementById('acct-req-fullname').value = '';
  document.getElementById('acct-req-username').value = '';
  document.getElementById('acct-req-contact').value = '';
  document.getElementById('acct-req-dept').value = '';
  document.getElementById('acct-req-note').value = '';
  document.getElementById('acct-req-err').style.display = 'none';

  const badgeEl = document.getElementById('acct-req-type-badge');
  const titleEl = document.getElementById('acct-req-title');
  const unameGroup = document.getElementById('acct-req-username-group');

  if (type === 'new') {
    titleEl.textContent = '📋 Yêu cầu cấp tài khoản mới';
    badgeEl.textContent = '📋 Bạn chưa có tài khoản và muốn được cấp tài khoản để nhập phiếu khảo sát.';
    badgeEl.style.background = '#E8F0FE'; badgeEl.style.color = '#0D47A1'; badgeEl.style.borderColor = '#BBDEFB';
    unameGroup.style.display = '';
  } else {
    titleEl.textContent = '🔑 Yêu cầu reset mật khẩu';
    badgeEl.textContent = '🔑 Bạn đã có tài khoản nhưng quên mật khẩu. Admin sẽ reset về mật khẩu tạm thời.';
    badgeEl.style.background = '#FFF8E1'; badgeEl.style.color = '#E65100'; badgeEl.style.borderColor = '#FFE082';
    unameGroup.style.display = '';
  }
  openModal('modal-account-request');
}

function submitAccountRequest() {
  const type = document.getElementById('acct-req-type').value;
  const fullname = document.getElementById('acct-req-fullname').value.trim();
  const username = document.getElementById('acct-req-username').value.trim();
  const contact = document.getElementById('acct-req-contact').value.trim();
  const dept = document.getElementById('acct-req-dept').value.trim();
  const note = document.getElementById('acct-req-note').value.trim();
  const errEl = document.getElementById('acct-req-err');

  if (!fullname) { errEl.textContent = '⚠️ Vui lòng nhập họ tên'; errEl.style.display = 'block'; return; }
  if (!contact) { errEl.textContent = '⚠️ Vui lòng nhập SĐT/email liên hệ'; errEl.style.display = 'block'; return; }
  if (!username) { errEl.textContent = '⚠️ Vui lòng nhập tên đăng nhập'; errEl.style.display = 'block'; return; }

  const reqs = getAccountRequests();
  const req = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    type,
    fullname,
    username,
    contact,
    dept,
    note,
    createdAt: new Date().toISOString(),
    status: 'pending' // pending | done | rejected
  };
  reqs.unshift(req);
  saveAccountRequests(reqs);

  closeModal('modal-account-request');
  // Show success message
  const box = document.querySelector('.login-box');
  const info = document.createElement('div');
  info.style.cssText = 'margin-top:12px;padding:12px 14px;background:#E8F5E9;border-radius:10px;border:1.5px solid #A5D6A7;font-size:13px;color:#2E7D32;text-align:center;animation:loginAppear .3s ease;';
  info.innerHTML = `✅ <b>Đã gửi yêu cầu!</b><br>Admin sẽ xem xét và liên hệ lại theo: <b>${contact}</b>`;
  const existInfo = document.getElementById('req-success-info');
  if (existInfo) existInfo.remove();
  info.id = 'req-success-info';
  document.getElementById('login-staff-form').appendChild(info);
  setTimeout(() => info.remove(), 6000);
}

function renderAccountRequests() {
  const bodyEl = document.getElementById('acct-requests-body');
  if (!bodyEl) return;
  const reqs = getAccountRequests();
  const pending = reqs.filter(r => r.status === 'pending');

  updateReqBadge();

  if (!reqs.length) {
    bodyEl.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-icon" style="font-size:30px;">📭</div><div class="empty-text" style="font-size:13px;">Chưa có yêu cầu nào</div></div>';
    return;
  }

  let html = '';
  reqs.forEach(req => {
    const isNew = req.type === 'new';
    const typeLabel = isNew ? '📋 Cấp tài khoản mới' : '🔑 Reset mật khẩu';
    const statusBadge = req.status === 'pending'
      ? '<span class="chip chip-orange">⏳ Chờ xử lý</span>'
      : req.status === 'done'
        ? '<span class="chip chip-green">✅ Đã xử lý</span>'
        : '<span style="background:#FFEBEE;color:#B71C1C;font-size:11px;padding:2px 8px;border-radius:10px;">❌ Từ chối</span>';
    const d = new Date(req.createdAt).toLocaleString('vi-VN');
    html += `<div class="req-item req-${isNew?'new':'reset'}${req.status==='done'?' req-done':''}">
      <div class="req-item-icon">${isNew?'📋':'🔑'}</div>
      <div class="req-item-body">
        <div class="req-item-title">${typeLabel} – ${req.fullname} ${statusBadge}</div>
        <div class="req-item-meta">
          🕐 ${d}<br>
          👤 Tên đăng nhập: <b>${req.username||'—'}</b> &nbsp;|&nbsp; 📞 Liên hệ: <b>${req.contact}</b>
          ${req.dept ? `<br>🏬 Khoa/Phòng: ${req.dept}` : ''}
          ${req.note ? `<br>📝 Ghi chú: ${req.note}` : ''}
        </div>
        ${req.status==='pending' ? `<div class="req-item-actions">
          ${isNew ? `<button class="btn btn-primary btn-xs" onclick="approveNewAccount('${req.id}')">✅ Tạo tài khoản</button>` : ''}
          ${!isNew ? `<button class="btn btn-warning btn-xs" onclick="approveResetRequest('${req.id}')">🔑 Reset MK → BV@2024</button>` : ''}
          <button class="btn btn-outline btn-xs" onclick="rejectRequest('${req.id}')">❌ Từ chối</button>
          <button class="btn btn-danger btn-xs" onclick="deleteRequest('${req.id}')">🗑️</button>
        </div>` : `<div class="req-item-actions"><button class="btn btn-danger btn-xs" onclick="deleteRequest('${req.id}')">🗑️ Xóa</button></div>`}
      </div>
    </div>`;
  });
  bodyEl.innerHTML = html;
}

function updateReqBadge() {
  const reqs = getAccountRequests();
  const pendingCount = reqs.filter(r => r.status === 'pending').length;
  const badge = document.getElementById('req-badge');
  const navBadge = document.getElementById('reqBadgeNav');
  [badge, navBadge].forEach(b => {
    if (!b) return;
    b.textContent = pendingCount;
    b.style.display = pendingCount > 0 ? '' : 'none';
  });
  // Update topbar notification
  const topBtn = document.getElementById('topbar-req-btn');
  const topCount = document.getElementById('topbar-req-count');
  if (topBtn) { topBtn.style.display = pendingCount > 0 ? 'inline-flex' : 'none'; }
  if (topCount) topCount.textContent = pendingCount;
}

function approveNewAccount(reqId) {
  const reqs = getAccountRequests();
  const req = reqs.find(r => r.id === reqId);
  if (!req) return;
  // Pre-fill the add user modal
  document.getElementById('mu-id').value = '';
  document.getElementById('mu-username').value = req.username || '';
  document.getElementById('mu-fullname').value = req.fullname || '';
  document.getElementById('mu-role').value = 'user';
  document.getElementById('mu-password').value = 'BV@2024';
  document.getElementById('mu-password2').value = 'BV@2024';
  document.getElementById('modal-user-title').textContent = '➕ Tạo tài khoản từ yêu cầu';
  refreshDeptDropdowns();
  if (req.dept) {
    const deptSel = document.getElementById('mu-dept');
    const opt = Array.from(deptSel.options).find(o => o.text.includes(req.dept));
    if (opt) deptSel.value = opt.value;
  }
  openModal('modal-user');
  // Mark request as done after modal action
  req.status = 'done';
  saveAccountRequests(reqs);
  renderAccountRequests();
}

function approveResetRequest(reqId) {
  const reqs = getAccountRequests();
  const req = reqs.find(r => r.id === reqId);
  if (!req) return;
  const user = USERS.find(u => u.username === req.username);
  if (!user) {
    toast(`❌ Không tìm thấy tài khoản "${req.username}"`, 'error');
    return;
  }
  showConfirm(`Reset mật khẩu tài khoản "${req.username}" (${req.fullname}) về "BV@2024"?`, () => {
    user.password = 'BV@2024';
    user.mustChangePassword = true;
    saveUsers();
    if (navigator.onLine && gsReady()) gsPushUsers().catch(() => {});
    req.status = 'done';
    saveAccountRequests(reqs);
    renderAccountRequests();
    toast(`✅ Đã reset mật khẩu "${req.username}" → BV@2024`, 'success');
    gsLogHistory('reset_password', `Admin reset MK tài khoản: ${req.username}`);
  });
}

function rejectRequest(reqId) {
  const reqs = getAccountRequests();
  const req = reqs.find(r => r.id === reqId);
  if (req) { req.status = 'rejected'; saveAccountRequests(reqs); renderAccountRequests(); toast('Đã từ chối yêu cầu', 'info'); }
}
function deleteRequest(reqId) {
  const reqs = getAccountRequests().filter(r => r.id !== reqId);
  saveAccountRequests(reqs);
  renderAccountRequests();
}
function clearAllRequests() {
  showConfirm('Xóa tất cả yêu cầu tài khoản?', () => {
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



