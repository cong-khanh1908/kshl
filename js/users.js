// users.js – Quản lý tài khoản người dùng
// KSHL v6.1 – Fixed & Complete
// ============================================================

let USERS = [];
let DEPTS = [];
let ACCOUNT_REQUESTS = [];

// =========================================================
// USERS LOAD/SAVE
// =========================================================
function loadUsers() {
  try {
    const raw = localStorage.getItem('kshl_users');
    USERS = raw ? JSON.parse(raw) : [];
    // Seed admin nếu chưa có
    if (!USERS.length) {
      USERS = [{
        id: 'admin_default',
        username: 'admin',
        fullname: 'Quản trị viên',
        role: 'admin',
        dept: '',
        pwHash: '' // Will be set on first login
      }];
      saveUsers();
    }
  } catch(e) { USERS = []; }
}

function saveUsers() {
  localStorage.setItem('kshl_users', JSON.stringify(USERS));
  if (gsReady()) gsSaveUsers(USERS).catch(() => {});
}

// =========================================================
// DEPTS LOAD/SAVE
// =========================================================
function loadDepts() {
  try {
    const raw = localStorage.getItem('kshl_depts');
    DEPTS = raw ? JSON.parse(raw) : [];
  } catch(e) { DEPTS = []; }
}

function saveDepts() {
  localStorage.setItem('kshl_depts', JSON.stringify(DEPTS));
  if (gsReady()) gsSaveDepts(DEPTS).catch(() => {});
}

// =========================================================
// ACCOUNT REQUESTS
// =========================================================
function loadRequests() {
  try {
    const raw = localStorage.getItem('kshl_requests');
    ACCOUNT_REQUESTS = raw ? JSON.parse(raw) : [];
  } catch(e) { ACCOUNT_REQUESTS = []; }
}

function saveRequests() {
  localStorage.setItem('kshl_requests', JSON.stringify(ACCOUNT_REQUESTS));
  updateReqBadge();
}

function updateReqBadge() {
  const pending = ACCOUNT_REQUESTS.filter(r => r.status === 'pending').length;
  ['reqBadgeNav','req-badge','topbar-req-count'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = pending;
  });
  const topBtn = document.getElementById('topbar-req-btn');
  if (topBtn) topBtn.style.display = pending > 0 ? 'flex' : 'none';
  const badge = document.getElementById('reqBadgeNav');
  if (badge) badge.style.display = pending > 0 ? '' : 'none';
}

// =========================================================
// AUTH
// =========================================================
async function doLogin() {
  const username = document.getElementById('login-username')?.value?.trim().toLowerCase();
  const password = document.getElementById('login-password')?.value;
  const errEl = document.getElementById('login-err');

  if (!username || !password) {
    if (errEl) { errEl.textContent = '⚠️ Vui lòng nhập tên đăng nhập và mật khẩu'; errEl.style.display = ''; }
    return;
  }

  const btn = document.getElementById('login-submit-btn');
  if (btn) btn.disabled = true;

  // Load users from Sheets if available
  if (gsReady()) {
    try {
      const sheetUsers = await gsLoadUsers();
      if (sheetUsers.length) { USERS = sheetUsers; saveUsers(); }
    } catch(e) { /* fallback to local */ }
  }

  const user = USERS.find(u => u.username.toLowerCase() === username);
  if (!user) {
    if (errEl) { errEl.textContent = '⚠️ Tài khoản không tồn tại'; errEl.style.display = ''; }
    if (btn) btn.disabled = false;
    return;
  }

  const pwHash = await hashPw(password);
  // Allow empty hash for first-time admin (set password on first login)
  const isFirstLogin = !user.pwHash && user.role === 'admin';
  if (!isFirstLogin && user.pwHash !== pwHash) {
    if (errEl) { errEl.textContent = '⚠️ Mật khẩu không đúng'; errEl.style.display = ''; }
    if (btn) btn.disabled = false;
    return;
  }

  if (isFirstLogin) {
    user.pwHash = pwHash;
    saveUsers();
  }

  if (errEl) errEl.style.display = 'none';
  setCurrentUser(user);
  localStorage.setItem('kshl_session', JSON.stringify({ userId: user.id, username: user.username, role: user.role, loginAt: Date.now() }));

  gsLogHistory('login', `Đăng nhập thành công: ${user.fullname} [${user.role}]`).catch(() => {});

  document.getElementById('login-screen').classList.add('hidden');
  if (btn) btn.disabled = false;
  initApp();
}

function doLoginGuest() {
  setCurrentUser({ id: 'guest', username: 'guest', fullname: 'Khách', role: 'guest' });
  document.getElementById('login-screen').classList.add('hidden');
  initApp(true);
}

function doLogout() {
  setCurrentUser(null);
  localStorage.removeItem('kshl_session');
  location.reload();
}

function switchLoginTab(tab) {
  document.getElementById('login-staff-form').style.display = tab === 'staff' ? '' : 'none';
  document.getElementById('login-guest-form').style.display  = tab === 'guest' ? '' : 'none';
  document.querySelectorAll('.login-tab').forEach((el, i) => el.classList.toggle('active', (i === 0 && tab === 'staff') || (i === 1 && tab === 'guest')));
}

function tryRestoreSession() {
  try {
    const raw = localStorage.getItem('kshl_session');
    if (!raw) return false;
    const sess = JSON.parse(raw);
    // Session expires after 8 hours
    if (Date.now() - sess.loginAt > 8 * 3600 * 1000) { localStorage.removeItem('kshl_session'); return false; }
    const user = USERS.find(u => u.id === sess.userId);
    if (!user) return false;
    setCurrentUser(user);
    return true;
  } catch(e) { return false; }
}

// =========================================================
// USER MANAGEMENT UI
// =========================================================
function renderUserList() {
  const el = document.getElementById('user-list-table');
  if (!el) return;
  if (!USERS.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Chưa có tài khoản</div></div>'; return; }

  let html = '<table class="data-table"><thead><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Khoa/Phòng</th><th>Thao tác</th></tr></thead><tbody>';
  USERS.forEach(u => {
    const roleBadge = u.role === 'admin'
      ? '<span class="chip chip-red">Admin</span>'
      : '<span class="chip chip-green">User</span>';
    const deptName = DEPTS.find(d => d.id === u.dept)?.name || u.dept || '—';
    const isMe = CURRENT_USER?.id === u.id;
    html += `<tr>
      <td><b>${u.username}</b>${isMe ? ' <span style="font-size:10px;color:var(--accent)">(Bạn)</span>' : ''}</td>
      <td>${u.fullname}</td>
      <td>${roleBadge}</td>
      <td style="font-size:12px;">${deptName}</td>
      <td>
        <div class="flex-gap" style="gap:5px;">
          <button class="btn btn-outline btn-sm" onclick="openEditUser('${u.id}')" style="padding:4px 8px;min-height:32px;">✏️</button>
          <button class="btn btn-outline btn-sm" onclick="openResetPw('${u.id}','${escHtml(u.fullname)}')" style="padding:4px 8px;min-height:32px;">🔑</button>
          ${!isMe ? `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')" style="padding:4px 8px;min-height:32px;">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function openAddUser() {
  document.getElementById('mu-id').value = '';
  document.getElementById('mu-username').value = '';
  document.getElementById('mu-fullname').value = '';
  document.getElementById('mu-role').value = 'user';
  document.getElementById('mu-dept').value = '';
  document.getElementById('mu-password').value = '';
  document.getElementById('mu-password2').value = '';
  document.getElementById('modal-user-title').textContent = 'Thêm tài khoản';
  populateDeptSelects();
  openModal('modal-user');
}

function openEditUser(id) {
  const u = USERS.find(x => x.id === id);
  if (!u) return;
  document.getElementById('mu-id').value = u.id;
  document.getElementById('mu-username').value = u.username;
  document.getElementById('mu-fullname').value = u.fullname;
  document.getElementById('mu-role').value = u.role || 'user';
  populateDeptSelects();
  document.getElementById('mu-dept').value = u.dept || '';
  document.getElementById('mu-password').value = '';
  document.getElementById('mu-password2').value = '';
  document.getElementById('modal-user-title').textContent = 'Sửa tài khoản';
  openModal('modal-user');
}

async function saveUser() {
  const id = document.getElementById('mu-id').value;
  const username = document.getElementById('mu-username').value.trim().toLowerCase();
  const fullname = document.getElementById('mu-fullname').value.trim();
  const role = document.getElementById('mu-role').value;
  const dept = document.getElementById('mu-dept').value;
  const pw = document.getElementById('mu-password').value;
  const pw2 = document.getElementById('mu-password2').value;

  if (!username || !fullname) { toast('⚠️ Vui lòng nhập đủ thông tin', 'warning'); return; }
  if (!id && !pw) { toast('⚠️ Cần nhập mật khẩu cho tài khoản mới', 'warning'); return; }
  if (pw && pw !== pw2) { toast('⚠️ Mật khẩu xác nhận không khớp', 'warning'); return; }

  // Check duplicate username
  const dup = USERS.find(u => u.username.toLowerCase() === username && u.id !== id);
  if (dup) { toast('⚠️ Tên đăng nhập đã tồn tại', 'warning'); return; }

  let pwHash = '';
  if (pw) pwHash = await hashPw(pw);

  if (id) {
    const u = USERS.find(x => x.id === id);
    if (u) {
      u.username = username; u.fullname = fullname; u.role = role; u.dept = dept;
      if (pwHash) u.pwHash = pwHash;
    }
  } else {
    USERS.push({ id: genId(), username, fullname, role, dept, pwHash });
  }

  saveUsers();
  closeModal('modal-user');
  renderUserList();
  toast('✅ Đã lưu tài khoản', 'success');
}

function deleteUser(id) {
  const u = USERS.find(x => x.id === id);
  if (!u) return;
  if (u.role === 'admin' && USERS.filter(x => x.role === 'admin').length <= 1) {
    toast('⚠️ Không thể xóa admin cuối cùng', 'warning'); return;
  }
  showConfirm(`Xóa tài khoản <b>${u.fullname}</b> (@${u.username})?`, () => {
    USERS = USERS.filter(x => x.id !== id);
    saveUsers(); renderUserList();
    toast('✅ Đã xóa tài khoản', 'success');
  });
}

function openResetPw(id, name) {
  document.getElementById('reset-user-id').value = id;
  document.getElementById('reset-user-display').textContent = name;
  document.getElementById('reset-pw-new').value = '';
  document.getElementById('reset-pw-confirm').value = '';
  openModal('modal-reset-user-pw');
}

async function doResetUserPassword() {
  const id = document.getElementById('reset-user-id').value;
  const pw  = document.getElementById('reset-pw-new').value;
  const pw2 = document.getElementById('reset-pw-confirm').value;
  if (!pw) { toast('⚠️ Nhập mật khẩu mới', 'warning'); return; }
  if (pw !== pw2) { toast('⚠️ Mật khẩu không khớp', 'warning'); return; }
  const u = USERS.find(x => x.id === id);
  if (!u) return;
  u.pwHash = await hashPw(pw);
  saveUsers();
  closeModal('modal-reset-user-pw');
  toast(`✅ Đã reset mật khẩu cho ${u.fullname}`, 'success');
}

function setDefaultPassword() {
  document.getElementById('reset-pw-new').value = 'BV@2024';
  document.getElementById('reset-pw-confirm').value = 'BV@2024';
}

// =========================================================
// DEPT MANAGEMENT
// =========================================================
function renderDeptList() {
  const el = document.getElementById('dept-list');
  if (!el) return;
  if (!DEPTS.length) { el.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-icon">🏬</div><div class="empty-text">Chưa có khoa phòng nào</div></div>'; return; }
  const typeLabel = { lamsang: 'Lâm sàng', kham: 'Phòng khám', canlam: 'Cận lâm sàng', hanhchinh: 'Hành chính' };
  let html = '<table class="data-table"><thead><tr><th>Tên Khoa/Phòng</th><th>Mã</th><th>Loại</th><th></th></tr></thead><tbody>';
  DEPTS.forEach(d => {
    html += `<tr>
      <td><b>${escHtml(d.name)}</b></td>
      <td style="font-size:12px;font-family:var(--mono);">${d.code||'—'}</td>
      <td><span class="chip chip-blue" style="font-size:10px;">${typeLabel[d.type]||d.type}</span></td>
      <td>
        <div class="flex-gap" style="gap:4px;">
          <button class="btn btn-outline btn-sm" onclick="openEditDept('${d.id}')" style="padding:3px 8px;min-height:30px;">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDept('${d.id}')" style="padding:3px 8px;min-height:30px;">🗑️</button>
        </div>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
  populateDeptSelects();
}

function openAddDept() {
  document.getElementById('md-id').value = '';
  document.getElementById('md-name').value = '';
  document.getElementById('md-code').value = '';
  document.getElementById('md-type').value = 'lamsang';
  document.getElementById('modal-dept-title').textContent = 'Thêm Khoa/Phòng';
  openModal('modal-dept');
}

function openEditDept(id) {
  const d = DEPTS.find(x => x.id === id);
  if (!d) return;
  document.getElementById('md-id').value = d.id;
  document.getElementById('md-name').value = d.name;
  document.getElementById('md-code').value = d.code || '';
  document.getElementById('md-type').value = d.type || 'lamsang';
  document.getElementById('modal-dept-title').textContent = 'Sửa Khoa/Phòng';
  openModal('modal-dept');
}

function saveDept() {
  const id   = document.getElementById('md-id').value;
  const name = document.getElementById('md-name').value.trim();
  const code = document.getElementById('md-code').value.trim();
  const type = document.getElementById('md-type').value;
  if (!name) { toast('⚠️ Nhập tên khoa', 'warning'); return; }
  if (id) {
    const d = DEPTS.find(x => x.id === id);
    if (d) { d.name = name; d.code = code; d.type = type; }
  } else {
    DEPTS.push({ id: genId(), name, code, type });
  }
  saveDepts(); closeModal('modal-dept'); renderDeptList();
  toast('✅ Đã lưu Khoa/Phòng', 'success');
}

function deleteDept(id) {
  const d = DEPTS.find(x => x.id === id);
  if (!d) return;
  showConfirm(`Xóa Khoa/Phòng <b>${d.name}</b>?`, () => {
    DEPTS = DEPTS.filter(x => x.id !== id);
    saveDepts(); renderDeptList();
    toast('✅ Đã xóa', 'success');
  });
}

function bulkImportDepts() {
  const raw = document.getElementById('dept-bulk-input')?.value || '';
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  if (!lines.length) { toast('⚠️ Chưa nhập danh sách', 'warning'); return; }
  let added = 0;
  lines.forEach(name => {
    if (!DEPTS.find(d => d.name.toLowerCase() === name.toLowerCase())) {
      DEPTS.push({ id: genId(), name, code: '', type: 'lamsang' });
      added++;
    }
  });
  saveDepts(); renderDeptList();
  toast(`✅ Đã import ${added} khoa/phòng`, 'success');
  document.getElementById('dept-bulk-input').value = '';
}

function loadSampleDepts() {
  const sample = [
    'Khoa Nội tổng hợp','Khoa Ngoại tổng hợp','Khoa Nhi','Khoa Sản','Khoa Hồi sức cấp cứu',
    'Khoa Cấp cứu','Khoa Xét nghiệm','Khoa Chẩn đoán hình ảnh','Khoa Dược','Khoa Nhiễm',
    'Khoa Tim mạch','Khoa Thần kinh','Khoa Thận – Tiết niệu','Khoa Da liễu','Khoa Mắt',
    'Khoa Tai – Mũi – Họng','Khoa Răng – Hàm – Mặt','Khoa Ung bướu','Khoa Phục hồi chức năng',
    'Khoa Kiểm soát nhiễm khuẩn','Phòng Kế hoạch – Điều dưỡng','Phòng Tài chính – Kế toán',
    'Phòng Tổ chức – Hành chính','Phòng Vật tư – Thiết bị','Phòng Quản lý chất lượng'
  ];
  document.getElementById('dept-bulk-input').value = sample.join('\n');
  toast('📋 Đã tải danh mục mẫu', 'info');
}

function populateDeptSelects() {
  const selects = document.querySelectorAll('#mu-dept, #prof-dept');
  selects.forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '<option value="">--Chọn khoa--</option>';
    DEPTS.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id; opt.textContent = d.name;
      sel.appendChild(opt);
    });
    sel.value = cur;
  });
  // Account request datalist
  const dl = document.getElementById('acct-req-dept-list');
  if (dl) {
    dl.innerHTML = '';
    DEPTS.forEach(d => { const o = document.createElement('option'); o.value = d.name; dl.appendChild(o); });
  }
}

function exportUsersCSV() {
  const rows = [['id','username','fullname','role','dept']];
  USERS.forEach(u => rows.push([u.id, u.username, u.fullname, u.role, u.dept || '']));
  downloadCSV(rows, 'users.csv');
}

// =========================================================
// MY PROFILE
// =========================================================
function loadProfileUI() {
  const u = CURRENT_USER;
  if (!u) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('profile-fullname', u.fullname);
  set('profile-username', '@' + u.username);
  const deptName = DEPTS.find(d => d.id === u.dept)?.name || u.dept || '(Chưa đặt)';
  set('profile-dept-display', '🏬 ' + deptName);
  const inp = document.getElementById('prof-fullname');
  if (inp) inp.value = u.fullname;
  populateDeptSelects();
  const deptSel = document.getElementById('prof-dept');
  if (deptSel) deptSel.value = u.dept || '';
  const roleBadge = document.getElementById('profile-role-badge');
  if (roleBadge) { roleBadge.textContent = u.role === 'admin' ? '🔑 Admin' : '👤 Nhân viên Y tế'; roleBadge.className = u.role === 'admin' ? 'chip chip-red' : 'chip chip-green'; }
  const avatar = document.getElementById('profile-avatar');
  if (avatar) avatar.textContent = (u.fullname || '?')[0].toUpperCase();
}

function saveMyProfile() {
  const fullname = document.getElementById('prof-fullname')?.value?.trim();
  const dept = document.getElementById('prof-dept')?.value || '';
  if (!fullname) { toast('⚠️ Nhập họ tên', 'warning'); return; }
  const u = USERS.find(x => x.id === CURRENT_USER?.id);
  if (u) { u.fullname = fullname; u.dept = dept; CURRENT_USER.fullname = fullname; CURRENT_USER.dept = dept; }
  saveUsers();
  loadProfileUI(); updateUserUI();
  toast('✅ Đã lưu thông tin', 'success');
}

async function changeMyPassword() {
  const cur = document.getElementById('prof-pw-current')?.value;
  const nw  = document.getElementById('prof-pw-new')?.value;
  const cf  = document.getElementById('prof-pw-confirm')?.value;
  const errEl = document.getElementById('prof-pw-err');
  const showErr = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = ''; } };
  if (!cur || !nw || !cf) { showErr('⚠️ Điền đủ các trường mật khẩu'); return; }
  if (nw.length < 6) { showErr('⚠️ Mật khẩu mới tối thiểu 6 ký tự'); return; }
  if (nw !== cf) { showErr('⚠️ Mật khẩu xác nhận không khớp'); return; }
  const u = USERS.find(x => x.id === CURRENT_USER?.id);
  if (!u) return;
  const curHash = await hashPw(cur);
  if (u.pwHash && u.pwHash !== curHash) { showErr('⚠️ Mật khẩu hiện tại không đúng'); return; }
  u.pwHash = await hashPw(nw);
  saveUsers();
  if (errEl) errEl.style.display = 'none';
  document.getElementById('prof-pw-current').value = '';
  document.getElementById('prof-pw-new').value = '';
  document.getElementById('prof-pw-confirm').value = '';
  toast('✅ Đổi mật khẩu thành công! Vui lòng đăng nhập lại.', 'success');
  setTimeout(() => doLogout(), 2000);
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
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  const levels = [
    { w: '20%', cls: 'pw-strength-weak', lbl: '😟 Quá yếu', color: 'var(--accent2)' },
    { w: '40%', cls: 'pw-strength-weak', lbl: '😐 Yếu', color: 'var(--accent2)' },
    { w: '60%', cls: 'pw-strength-fair', lbl: '🙂 Trung bình', color: 'var(--warning)' },
    { w: '80%', cls: 'pw-strength-good', lbl: '😊 Tốt', color: '#8BC34A' },
    { w: '100%', cls: 'pw-strength-strong', lbl: '💪 Mạnh', color: 'var(--success)' },
  ];
  const l = levels[Math.min(score, 4)];
  fill.style.width = l.w; fill.style.background = l.color;
  label.textContent = l.lbl; label.style.color = l.color;
}

function togglePwVis(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

// =========================================================
// ACCOUNT REQUESTS
// =========================================================
function openAccountRequest(type) {
  document.getElementById('acct-req-type').value = type;
  // Step 1 UI
  document.getElementById('acct-req-step1').style.display = '';
  document.getElementById('acct-req-step2').style.display = 'none';
  document.getElementById('acct-req-step3').style.display = 'none';
  document.getElementById('acct-req-footer').style.display = '';
  // Step indicators
  ['acct-step-1','acct-step-2','acct-step-3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) { el.style.background = i === 0 ? '#E3F2FD' : 'var(--surface2)'; el.style.color = i === 0 ? '#1565C0' : 'var(--text3)'; }
  });
  // Title & badge
  const isNew = type === 'new';
  document.getElementById('acct-req-title').textContent = isNew ? 'Yêu cầu cấp tài khoản mới' : 'Yêu cầu reset mật khẩu';
  document.getElementById('acct-req-header-icon').textContent = isNew ? '📋' : '🔑';
  document.getElementById('acct-req-username-group').style.display = isNew ? '' : 'none';
  document.getElementById('acct-req-urgency-group').style.display = isNew ? '' : 'none';
  document.getElementById('acct-req-type-badge').innerHTML = isNew
    ? '📋 Điền thông tin bên dưới, Admin sẽ tạo tài khoản và liên hệ lại cho bạn.'
    : '🔑 Nhập thông tin để Admin xác nhận và reset mật khẩu của bạn.';
  // Clear fields
  ['acct-req-fullname','acct-req-username','acct-req-contact','acct-req-dept','acct-req-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('acct-req-err').style.display = 'none';
  populateDeptSelects();
  openModal('modal-account-request');
}

function acctReqAutoUsername(fullname) {
  if (!fullname) return;
  // Auto-generate username from fullname
  const parts = fullname.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const initials = parts.slice(0, -1).map(p => p[0]).join('');
    document.getElementById('acct-req-username').value = last + '_' + initials;
  }
  const hint = document.getElementById('acct-req-fullname-hint');
  if (hint) { hint.style.display = ''; hint.textContent = '✅ Tên đã nhận'; }
}

function acctReqValidateUsername(val) {
  const ok = /^[a-z0-9_]{4,}$/.test(val);
  const el = document.getElementById('acct-req-uname-ok');
  const hint = document.getElementById('acct-req-uname-hint');
  if (el) el.style.display = ok ? '' : 'none';
  if (hint) hint.style.color = ok ? 'var(--success)' : 'var(--text3)';
}

function acctReqValidateContact(val) {
  const hint = document.getElementById('acct-req-contact-hint');
  if (!hint) return;
  const ok = val.length >= 6;
  hint.style.display = ok ? '' : 'none';
  hint.innerHTML = ok ? '<span style="color:var(--success)">✅ OK</span>' : '';
}

function acctReqNextStep() {
  const step1 = document.getElementById('acct-req-step1');
  const step2 = document.getElementById('acct-req-step2');
  const step3 = document.getElementById('acct-req-step3');
  const btnLabel = document.getElementById('acct-req-btn-next-label');
  const errEl = document.getElementById('acct-req-err');

  if (step2.style.display === 'none' && step3.style.display === 'none') {
    // Validate step 1
    const fullname = document.getElementById('acct-req-fullname').value.trim();
    const contact  = document.getElementById('acct-req-contact').value.trim();
    const type     = document.getElementById('acct-req-type').value;
    const username = document.getElementById('acct-req-username').value.trim();
    if (!fullname || !contact) { errEl.textContent = '⚠️ Vui lòng điền đầy đủ họ tên và số điện thoại/email'; errEl.style.display = ''; return; }
    if (type === 'new' && username && !/^[a-z0-9_]{4,}$/.test(username)) { errEl.textContent = '⚠️ Tên đăng nhập không hợp lệ (a-z, 0-9, _, tối thiểu 4 ký tự)'; errEl.style.display = ''; return; }
    errEl.style.display = 'none';
    // Show preview
    const preview = document.getElementById('acct-req-preview');
    if (preview) {
      preview.innerHTML = `
        <b>Họ tên:</b> ${escHtml(fullname)}<br>
        ${type === 'new' ? `<b>Tên đăng nhập:</b> ${escHtml(username || '(chưa đặt)')}<br>` : ''}
        <b>Liên hệ:</b> ${escHtml(contact)}<br>
        <b>Khoa/Phòng:</b> ${escHtml(document.getElementById('acct-req-dept').value || '(Không điền)')}<br>
        <b>Ghi chú:</b> ${escHtml(document.getElementById('acct-req-note').value || '(Không có)')}
      `;
    }
    step1.style.display = 'none'; step2.style.display = '';
    document.getElementById('acct-step-2').style.background = '#E3F2FD';
    document.getElementById('acct-step-2').style.color = '#1565C0';
    if (btnLabel) btnLabel.textContent = 'Gửi yêu cầu ✓';
  } else if (step2.style.display !== 'none') {
    // Submit
    const type     = document.getElementById('acct-req-type').value;
    const fullname = document.getElementById('acct-req-fullname').value.trim();
    const username = document.getElementById('acct-req-username').value.trim();
    const contact  = document.getElementById('acct-req-contact').value.trim();
    const dept     = document.getElementById('acct-req-dept').value.trim();
    const note     = document.getElementById('acct-req-note').value.trim();
    const urgency  = document.querySelector('input[name="acct-req-urgency"]:checked')?.value || 'normal';

    ACCOUNT_REQUESTS.push({
      id: genId(), type, fullname, username, contact, dept, note, urgency,
      status: 'pending', createdAt: new Date().toISOString()
    });
    saveRequests();
    renderAccountRequests();

    step2.style.display = 'none'; step3.style.display = '';
    document.getElementById('acct-step-3').style.background = '#E8F5E9';
    document.getElementById('acct-step-3').style.color = '#2E7D32';
    document.getElementById('acct-req-footer').style.display = 'none';
    document.getElementById('acct-req-done-msg').textContent = `Cảm ơn ${fullname}! Yêu cầu của bạn đã được ghi nhận.`;
  }
}

function renderAccountRequests() {
  const el = document.getElementById('acct-requests-body');
  if (!el) return;
  const pending = ACCOUNT_REQUESTS.filter(r => r.status === 'pending');
  if (!pending.length) { el.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-icon" style="font-size:30px;">📭</div><div class="empty-text" style="font-size:13px;">Chưa có yêu cầu nào</div></div>'; updateReqBadge(); return; }

  let html = '';
  pending.forEach(r => {
    const isNew = r.type === 'new';
    html += `<div class="req-item req-${isNew ? 'new' : 'reset'}">
      <div class="req-item-icon">${isNew ? '📋' : '🔑'}</div>
      <div class="req-item-body">
        <div class="req-item-title">${isNew ? 'Cấp tài khoản mới' : 'Reset mật khẩu'}: <b>${escHtml(r.fullname)}</b></div>
        <div class="req-item-meta">
          📞 ${escHtml(r.contact)} · 🏬 ${escHtml(r.dept || '—')} · ${r.urgency === 'urgent' ? '🔴 Gấp' : '🟢 Bình thường'}<br>
          ${r.username ? `🔤 ${escHtml(r.username)} · ` : ''}🕒 ${fmtDateTime(r.createdAt)}
          ${r.note ? `<br>📝 ${escHtml(r.note.slice(0,100))}` : ''}
        </div>
        <div class="req-item-actions">
          ${isNew ? `<button class="btn btn-primary btn-sm" onclick="acceptRequest('${r.id}')">✅ Cấp tài khoản</button>` : `<button class="btn btn-warning btn-sm" onclick="resetFromRequest('${r.id}')">🔑 Reset mật khẩu</button>`}
          <button class="btn btn-outline btn-sm" onclick="dismissRequest('${r.id}')">✖ Bỏ qua</button>
        </div>
      </div>
    </div>`;
  });
  el.innerHTML = html;
  updateReqBadge();
}

function acceptRequest(id) {
  const r = ACCOUNT_REQUESTS.find(x => x.id === id);
  if (!r) return;
  // Pre-fill add user modal
  document.getElementById('mu-id').value = '';
  document.getElementById('mu-username').value = r.username || '';
  document.getElementById('mu-fullname').value = r.fullname;
  document.getElementById('mu-role').value = 'user';
  document.getElementById('mu-password').value = 'BV@2024';
  document.getElementById('mu-password2').value = 'BV@2024';
  populateDeptSelects();
  document.getElementById('modal-user-title').textContent = 'Cấp tài khoản mới';
  r.status = 'done'; saveRequests(); renderAccountRequests();
  openModal('modal-user');
}

function resetFromRequest(id) {
  const r = ACCOUNT_REQUESTS.find(x => x.id === id);
  if (!r) return;
  const u = USERS.find(x => x.fullname.toLowerCase() === r.fullname.toLowerCase() || (r.username && x.username === r.username));
  if (u) { openResetPw(u.id, u.fullname); }
  else { toast(`⚠️ Không tìm thấy tài khoản "${r.fullname}". Tạo tài khoản mới?`, 'warning'); }
  r.status = 'done'; saveRequests(); renderAccountRequests();
}

function dismissRequest(id) {
  const r = ACCOUNT_REQUESTS.find(x => x.id === id);
  if (r) { r.status = 'done'; saveRequests(); renderAccountRequests(); }
}

function clearAllRequests() {
  ACCOUNT_REQUESTS = ACCOUNT_REQUESTS.filter(r => r.status !== 'pending');
  saveRequests(); renderAccountRequests();
  toast('✅ Đã xóa tất cả yêu cầu đang chờ', 'success');
}
