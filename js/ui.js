// ui.js – UI Utilities: Navigation, Toast, Modal, App Shell
// KSHL v6.1 – Fixed & Complete
// ============================================================

let currentPage = 'dashboard';

// =========================================================
// APP INIT
// =========================================================
function initApp(isGuest = false) {
  loadDepts();
  loadUsers();
  loadRequests();
  updateUserUI();
  applyRoleVisibility();
  populateDeptSelects();

  // Render survey pages
  Object.keys(SURVEYS).forEach(type => renderSurveyPage(type));

  // Load settings UI
  loadSettingsUI();
  loadAutoUploadCheckboxes();

  // Check for URL params (shared link)
  const urlParams = new URLSearchParams(location.search);
  const sid = urlParams.get('sid');
  if (sid && !CFG.sheetId) {
    CFG.sheetId = sid;
    saveCFG();
    if (gsReady()) gsPullAllData(false).catch(() => {});
  }

  // Load settings fields
  loadSettingsUI();

  // Show appropriate first page
  if (isGuest) {
    showPage('guest-home');
  } else {
    updateDash();
    showPage('dashboard');
  }

  // Update badges
  updateBYTPendingBadge();
  renderBYTLinks();
  updateReqBadge();
  renderAccountRequests();

  // Online/offline
  updateConnectionStatus();
  window.addEventListener('online',  () => { updateConnectionStatus(); if (gsReady()) syncToSheets(); });
  window.addEventListener('offline', () => updateConnectionStatus());
}

function updateUserUI() {
  const u = CURRENT_USER;
  if (!u) return;
  const avatar = u.fullname?.charAt(0)?.toUpperCase() || '?';
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('user-display-name', u.fullname || u.username);
  setTxt('user-display-role', u.role === 'admin' ? '🔑 Quản trị viên' : u.role === 'guest' ? '👤 Khách' : '👤 Nhân viên Y tế');
  const av = document.getElementById('user-avatar');
  if (av) av.textContent = avatar;
  setTxt('sb-hospital-name', CFG.hvname || 'Hệ thống khảo sát');
  // Set bc-hvname default
  const bcHv = document.getElementById('bc-hvname');
  if (bcHv && !bcHv.value) bcHv.value = CFG.hvname || '';
}

function applyRoleVisibility() {
  const isAdmin = CURRENT_USER?.role === 'admin';
  const isStaff = CURRENT_USER?.role === 'admin' || CURRENT_USER?.role === 'user';
  const isGuest = CURRENT_USER?.role === 'guest';
  const isUser  = CURRENT_USER?.role === 'user';

  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  document.querySelectorAll('.staff-only').forEach(el => el.style.display = isStaff ? '' : 'none');
  document.querySelectorAll('.guest-visible').forEach(el => el.style.display = '');
  document.querySelectorAll('.user-only').forEach(el => el.style.display = isUser ? 'flex' : 'none');

  // Bottom nav
  const bnList = document.getElementById('bn-list');
  const bnDash = document.getElementById('bn-dash');
  if (bnList) bnList.style.display = isAdmin ? '' : 'none';
  if (bnDash) bnDash.style.display = isAdmin ? '' : 'none';
}

function updateConnectionStatus() {
  const dot = document.getElementById('onlineIndicator');
  const status = document.getElementById('connectionStatus');
  const banner = document.getElementById('offlineBanner');
  const online = navigator.onLine;
  if (dot) { dot.className = online ? 'online-dot' : 'offline-dot'; }
  if (status) status.textContent = online ? 'Trực tuyến' : 'Ngoại tuyến';
  if (banner) banner.classList.toggle('hidden', online);
}

// =========================================================
// NAVIGATION
// =========================================================
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  'm1': 'Mẫu 1 – NB Nội trú',
  'm2': 'Mẫu 2 – NB Ngoại trú',
  'm3': 'Mẫu 3 – Nhân viên Y tế',
  'm4': 'Mẫu 4 – Người mẹ sinh con',
  'm5': 'Mẫu 5 – Nuôi con bằng sữa mẹ',
  datalist: 'Danh sách phiếu',
  autofill: 'Tự động điền BYT',
  bytupload: 'Gửi phiếu lên BYT',
  baocao: 'Tạo báo cáo tổng hợp',
  history: 'Lịch sử hệ thống',
  settings: 'Cấu hình hệ thống',
  users: 'Quản lý tài khoản',
  profile: 'Tài khoản của tôi',
  depts: 'Danh mục Khoa Phòng',
  'guest-home': 'Chọn phiếu khảo sát',
};

function showPage(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));

  // Show target page
  const el = document.getElementById(`page-${pageId}`);
  if (!el) { console.warn('Page not found:', pageId); return; }
  el.classList.add('active');
  currentPage = pageId;

  // Update topbar title
  const title = document.getElementById('topbarTitle');
  if (title) title.textContent = PAGE_TITLES[pageId] || pageId;

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Trigger page-specific loads
  switch(pageId) {
    case 'dashboard':
      updateDash();
      break;
    case 'datalist':
      renderList();
      updateLocalInfo();
      break;
    case 'bytupload':
      renderBYTQueue();
      checkBYTLoginStatus();
      break;
    case 'settings':
      loadSettingsUI();
      break;
    case 'users':
      renderUserList();
      renderAccountRequests();
      break;
    case 'depts':
      renderDeptList();
      break;
    case 'autofill':
      renderBYTLinks();
      break;
    case 'profile':
      loadProfileUI();
      break;
    case 'baocao':
      const bcYear = document.getElementById('bc-year');
      if (bcYear && !bcYear.value) bcYear.value = new Date().getFullYear();
      const bcHv = document.getElementById('bc-hvname');
      if (bcHv && !bcHv.value) bcHv.value = CFG.hvname || '';
      break;
  }

  // Scroll to top
  const main = document.querySelector('.main-content');
  if (main) main.scrollTop = 0;

  // Close sidebar on mobile
  closeSidebar();
  updateBottomNav(pageId);
}

function updateBottomNav(pageId) {
  document.querySelectorAll('.bn-item').forEach(el => el.classList.remove('active'));
  const map = { dashboard: 'bn-dash', 'm1': 'bn-survey', 'm2': 'bn-survey', 'm3': 'bn-survey', 'm4': 'bn-survey', 'm5': 'bn-survey', datalist: 'bn-list', profile: 'bn-profile' };
  const bnId = map[pageId];
  if (bnId) document.getElementById(bnId)?.classList.add('active');
}

function mobileNavSurvey() {
  if (CURRENT_USER?.role === 'guest') {
    showPage('guest-home');
  } else {
    showPage('m1');
  }
  closeSidebar();
}

// =========================================================
// SIDEBAR
// =========================================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const isOpen = sidebar?.classList.contains('open');
  if (isOpen) { closeSidebar(); } else { openSidebar(); }
}

function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

// =========================================================
// TOAST
// =========================================================
function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// =========================================================
// MODAL
// =========================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

function showConfirm(msg, onConfirm) {
  const msgEl = document.getElementById('confirm-msg');
  const okBtn = document.getElementById('confirm-ok');
  if (msgEl) msgEl.innerHTML = msg;
  if (okBtn) {
    okBtn.onclick = () => { closeModal('modal-confirm'); onConfirm(); };
  }
  openModal('modal-confirm');
}

// Close modals on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    closeModal(e.target.id);
  }
});

// =========================================================
// ESCAPE HTML
// =========================================================
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =========================================================
// PERIOD type change (Báo cáo)
// =========================================================
function onBCPeriodTypeChange() {
  const type = document.getElementById('bc-period-type')?.value;
  document.getElementById('bc-month-group').style.display  = type === 'thang' ? '' : 'none';
  document.getElementById('bc-qui-group').style.display    = type === 'qui'   ? '' : 'none';
  document.getElementById('bc-giai-doan-group').style.display = type === 'giai-doan' ? '' : 'none';
}

// =========================================================
// BOOTSTRAP / URL param auto-detect
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
  // Check URL for ?sid=
  const urlParams = new URLSearchParams(location.search);
  const sid = urlParams.get('sid');

  loadCFG();
  loadDB();
  loadUsers();
  loadDepts();
  loadRequests();

  if (sid && !CFG.sheetId) {
    CFG.sheetId = sid;
    saveCFG();
  }

  // Decide what to show
  if (!CFG.sheetId) {
    // First-time: show bootstrap screen
    document.getElementById('bootstrap-screen')?.classList.remove('hidden');
    document.getElementById('login-screen')?.classList.add('hidden');
    return;
  }

  // Try restore session
  if (tryRestoreSession()) {
    document.getElementById('login-screen')?.classList.add('hidden');
    initApp(CURRENT_USER?.role === 'guest');
  } else {
    // Show login
    document.getElementById('login-screen')?.classList.remove('hidden');
  }
});
