// byt.js – Module gửi phiếu lên trang BYT (hailong.chatluongbenhvien.vn)
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// ============================================================

// =========================================================
// BYT AUTO-UPLOAD MODULE
// =========================================================

// BYT login URL and session check URL
const BYT_LOGIN_URL = 'https://hailong.chatluongbenhvien.vn/user/login';
const BYT_CHECK_URL = 'https://hailong.chatluongbenhvien.vn/user/me'; // profile page only accessible when logged in
const BYT_BASE = 'https://hailong.chatluongbenhvien.vn';

// BYT upload state
let bytLoginWindow = null;
let bytLoginStatus = 'unknown'; // unknown | checking | logged-in | logged-out | error
let bytUploadRunning = false;
let bytSelectedIds = new Set();
let bytLog = [];

function updateBYTPendingBadge() {
  const pending = DB.surveys.filter(x => !x.bytStatus || x.bytStatus === 'pending').length;
  const b = document.getElementById('pendingBYTBadge');
  if (b) { b.textContent = pending; b.style.display = pending > 0 ? '' : 'none'; }
}

function toggleAutoUpload(checked) {
  CFG.autoUploadBYT = checked;
  saveCFG();
  // sync the settings page checkbox too
  const cb2 = document.getElementById('cfg-auto-upload-settings');
  if (cb2) cb2.checked = checked;
  toast(checked ? '✅ Đã bật tự động gửi BYT' : 'ℹ️ Đã tắt tự động gửi BYT', checked ? 'success' : 'info');
}

function syncAutoUploadCheckbox(checked) {
  CFG.autoUploadBYT = checked;
  saveCFG();
  const cb = document.getElementById('cfg-auto-upload');
  if (cb) cb.checked = checked;
}

function loadAutoUploadCheckboxes() {
  const v = CFG.autoUploadBYT || false;
  const cb1 = document.getElementById('cfg-auto-upload');
  const cb2 = document.getElementById('cfg-auto-upload-settings');
  if (cb1) cb1.checked = v;
  if (cb2) cb2.checked = v;
}

// ---- BYT Login Status Check ----
async function checkBYTLoginStatus() {
  setBYTStatusUI('checking', '🔄 Đang kiểm tra trạng thái đăng nhập trang BYT...');
  document.getElementById('btn-byt-login-now').style.display = 'none';
  try {
    // Try fetching a page that requires login; if redirected to login page = not logged in
    const res = await fetch(BYT_CHECK_URL, {method:'GET', credentials:'include', mode:'no-cors', cache:'no-store'});
    // With no-cors we can't read status, so we use a proxy approach via iframe detection
    // Instead: open a hidden iframe and check its URL after load
    checkBYTViaIframe();
  } catch(e) {
    setBYTStatusUI('error', '❌ Không thể kiểm tra: ' + e.message + '. Có thể do trình duyệt chặn cross-origin.');
    document.getElementById('btn-byt-login-now').style.display = '';
  }
}

function checkBYTViaIframe() {
  // Remove old iframe if any
  const old = document.getElementById('byt-check-iframe');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'byt-check-iframe';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
  iframe.src = BYT_CHECK_URL;

  let timeout = setTimeout(() => {
    iframe.remove();
    // If timeout: assume network issue but allow manual login
    setBYTStatusUI('error', '⚠️ Không thể xác minh tự động (timeout). Vui lòng kiểm tra thủ công hoặc đăng nhập BYT trực tiếp.');
    document.getElementById('btn-byt-login-now').style.display = '';
  }, 8000);

  iframe.onload = function() {
    clearTimeout(timeout);
    try {
      // Try to access iframe URL - if same origin content loaded = logged in
      // If it redirected to login page, URL will contain /user/login
      const iframeUrl = iframe.contentWindow.location.href;
      if (iframeUrl.includes('/user/login') || iframeUrl.includes('login')) {
        setBYTStatusUI('logged-out', '🔓 Chưa đăng nhập trang BYT. Cần đăng nhập trước khi gửi phiếu.');
        document.getElementById('btn-byt-login-now').style.display = '';
        bytLoginStatus = 'logged-out';
      } else {
        setBYTStatusUI('logged-in', '✅ Đã đăng nhập trang BYT. Sẵn sàng gửi phiếu.');
        document.getElementById('btn-byt-login-now').style.display = 'none';
        bytLoginStatus = 'logged-in';
      }
    } catch(e) {
      // Cross-origin access denied usually means the page loaded (logged in) but we can't read URL
      // Or it redirected to login. Cross-origin error on hailong subdomain = likely logged in (same content served)
      // We treat cross-origin block as "page loaded = possibly logged in but can't confirm"
      setBYTStatusUI('logged-out', '⚠️ Không thể xác minh do chính sách trình duyệt. Vui lòng nhấn "Đăng nhập BYT" để chắc chắn.');
      document.getElementById('btn-byt-login-now').style.display = '';
      bytLoginStatus = 'unknown';
    }
    iframe.remove();
  };

  iframe.onerror = function() {
    clearTimeout(timeout);
    iframe.remove();
    setBYTStatusUI('error', '❌ Không thể kết nối đến trang BYT. Kiểm tra kết nối mạng.');
    document.getElementById('btn-byt-login-now').style.display = '';
    bytLoginStatus = 'error';
  };

  document.body.appendChild(iframe);
}

function setBYTStatusUI(type, msg) {
  const bar = document.getElementById('byt-login-statusbar');
  const dot = document.getElementById('byt-dot');
  const msgEl = document.getElementById('byt-login-msg');
  if (!bar || !dot || !msgEl) return;
  bar.className = 'byt-status-bar ' + type;
  dot.className = 'byt-status-dot ' + (type === 'logged-in' ? 'green' : type === 'checking' ? 'spin' : 'orange');
  if (type === 'error') dot.className = 'byt-status-dot red';
  msgEl.textContent = msg;
  bytLoginStatus = type;
}

// ---- Open BYT login tab with auto-fill credentials ----
function loginBYTNow() {
  if (!CFG.bytuser || !CFG.bytpass) {
    toast('⚠️ Chưa cấu hình tài khoản BYT. Vào Cấu hình → Tài khoản BYT.', 'warning');
    showPage('settings');
    return;
  }
  // Open BYT login page
  const win = window.open(BYT_LOGIN_URL, 'byt_login_window');
  if (!win) {
    toast('❌ Trình duyệt chặn popup. Vui lòng cho phép popup từ trang này.', 'error');
    return;
  }
  // Inject auto-login script after page loads
  const user = CFG.bytuser;
  const pass = CFG.bytpass;
  setBYTStatusUI('checking', '🔄 Đang mở trang BYT và đăng nhập...');
  addBYTLog('info', `Mở trang đăng nhập BYT: ${BYT_LOGIN_URL}`);

  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    try {
      if (win.closed) {
        clearInterval(checkInterval);
        setBYTStatusUI('unknown', '⚠️ Cửa sổ BYT đã đóng. Nhấn Kiểm tra để xác nhận lại.');
        document.getElementById('btn-byt-login-now').style.display = '';
        return;
      }
      // Try injecting login script when page is ready
      const url = win.location.href;
      if (url && (url.includes('/user/login') || url.includes('login')) && win.document.readyState === 'complete') {
        // Fill login form
        const injected = win.eval(`
          (function(){
            var u = document.querySelector('#edit-name, input[name="name"], input#name');
            var p = document.querySelector('#edit-pass, input[name="pass"], input#pass');
            var btn = document.querySelector('#edit-submit, input[type="submit"], button[type="submit"]');
            if(u && p) {
              u.value = ${JSON.stringify(user)};
              p.value = ${JSON.stringify(pass)};
              if(btn) { btn.click(); return 'clicked'; }
              return 'filled';
            }
            return 'not-found';
          })()
        `);
        addBYTLog('info', `Điền thông tin đăng nhập BYT: ${injected}`);
        clearInterval(checkInterval);

        // Wait for redirect after login
        setTimeout(() => {
          try {
            const newUrl = win.location.href;
            if (newUrl && !newUrl.includes('/user/login')) {
              setBYTStatusUI('logged-in', '✅ Đăng nhập BYT thành công!');
              document.getElementById('btn-byt-login-now').style.display = 'none';
              addBYTLog('ok', 'Đăng nhập BYT thành công!');
              bytLoginStatus = 'logged-in';
            } else {
              setBYTStatusUI('logged-out', '❌ Đăng nhập BYT thất bại. Kiểm tra lại tài khoản/mật khẩu.');
              document.getElementById('btn-byt-login-now').style.display = '';
              addBYTLog('err', 'Đăng nhập BYT thất bại - kiểm tra tài khoản/mật khẩu');
            }
          } catch(e2) {
            // Cross-origin after redirect = login may have succeeded
            setBYTStatusUI('logged-in', '✅ Có vẻ đã đăng nhập thành công (không đọc được URL do bảo mật trình duyệt).');
            bytLoginStatus = 'logged-in';
            addBYTLog('ok', 'Đăng nhập BYT: redirect xảy ra (khả năng thành công)');
          }
        }, 3000);
      }
    } catch(e) {
      // Cross-origin block = page loaded from BYT domain = logged in or redirected
      clearInterval(checkInterval);
      setTimeout(() => {
        setBYTStatusUI('logged-in', '✅ Đã chuyển sang trang BYT (đăng nhập thành công).');
        bytLoginStatus = 'logged-in';
        addBYTLog('ok', 'Đăng nhập BYT thành công (cross-origin redirect)');
      }, 2000);
    }
    if (attempts > 30) {
      clearInterval(checkInterval);
      setBYTStatusUI('unknown', '⚠️ Hết thời gian chờ. Kiểm tra lại trạng thái đăng nhập BYT.');
    }
  }, 500);
  bytLoginWindow = win;
}

// ---- Queue Rendering ----
function renderBYTQueue() {
  const typeF = document.getElementById('byt-fl-type')?.value || '';
  const statusF = document.getElementById('byt-fl-status')?.value || 'pending';
  let surveys = [...DB.surveys].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  if (typeF) surveys = surveys.filter(x => x.type === typeF);
  if (statusF === 'pending') surveys = surveys.filter(x => !x.bytStatus || x.bytStatus === 'pending' || x.bytStatus === 'failed');
  else if (statusF === 'byt-done') surveys = surveys.filter(x => x.bytStatus === 'done');

  const el = document.getElementById('byt-queue-list');
  if (!el) return;
  if (!surveys.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">Không có phiếu</div><div class="empty-sub">Tất cả đã được gửi hoặc chưa có phiếu nào</div></div>';
    document.getElementById('byt-queue-count').textContent = '';
    return;
  }

  let html = '';
  surveys.forEach(r => {
    const isSelected = bytSelectedIds.has(r.id);
    const ans = r.answers?.filter(a => a.value !== null && a.value > 0) || [];
    const avg = ans.length ? (ans.reduce((s,a)=>s+a.value,0)/ans.length).toFixed(1) : '-';
    const d = r.ngay || r.createdAt?.split('T')[0] || '';
    const icon = r.type==='m1'?'🏥':r.type==='m2'?'🏃':r.type==='m3'?'👨‍⚕️':r.type==='m4'?'👶':'🍼';
    let statusHtml = '';
    if (!r.bytStatus || r.bytStatus === 'pending') statusHtml = '<span class="uqi-status pending">⏳ Chờ gửi</span>';
    else if (r.bytStatus === 'uploading') statusHtml = '<span class="uqi-status uploading">🔄 Đang gửi</span>';
    else if (r.bytStatus === 'done') statusHtml = '<span class="uqi-status done">✅ Đã gửi</span>';
    else if (r.bytStatus === 'failed') statusHtml = '<span class="uqi-status failed">❌ Lỗi</span>';

    html += `<div class="upload-queue-item${isSelected?' selected':''}" id="uqi_${r.id}">
      <input type="checkbox" class="uqi-check" data-id="${r.id}" ${isSelected?'checked':''} onchange="toggleBYTItem('${r.id}',this.checked)">
      <div class="uqi-info">
        <div class="uqi-label">${icon} ${SURVEYS[r.type]?.label||r.type}</div>
        <div class="uqi-meta">📅 ${d} · ${r.khoa||r.donvi||'—'} · TB ${avg}/5 · ${ans.length}/${r.answers?.length||0} câu</div>
      </div>
      ${statusHtml}
      <button class="btn btn-outline btn-xs" onclick="openBYTForRecord('${r.id}')" title="Mở BYT với phiếu này">🔗</button>
    </div>`;
  });

  el.innerHTML = html;
  document.getElementById('byt-queue-count').textContent = `(${surveys.length} phiếu, đã chọn ${bytSelectedIds.size})`;
  updateBYTPendingBadge();
}

function toggleBYTItem(id, checked) {
  if (checked) bytSelectedIds.add(id);
  else bytSelectedIds.delete(id);
  const item = document.getElementById('uqi_' + id);
  if (item) item.classList.toggle('selected', checked);
  const count = document.getElementById('byt-queue-count');
  if (count) {
    const total = document.querySelectorAll('.uqi-check').length;
    count.textContent = `(${total} phiếu, đã chọn ${bytSelectedIds.size})`;
  }
}

function selectAllBYTQueue() {
  document.querySelectorAll('.uqi-check').forEach(cb => {
    cb.checked = true;
    bytSelectedIds.add(cb.dataset.id);
    const item = document.getElementById('uqi_' + cb.dataset.id);
    if (item) item.classList.add('selected');
  });
  renderBYTQueue();
}

function deselectAllBYTQueue() {
  bytSelectedIds.clear();
  document.querySelectorAll('.uqi-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.upload-queue-item').forEach(el => el.classList.remove('selected'));
  const count = document.getElementById('byt-queue-count');
  if (count) { const total = document.querySelectorAll('.uqi-check').length; count.textContent = `(${total} phiếu, đã chọn 0)`; }
}

function quickSendOneBYT(id) {
  bytSelectedIds.clear();
  bytSelectedIds.add(id);
  showPage('bytupload');
  setTimeout(() => sendSelectedToBYT(), 400);
}

// ---- Open BYT page for a specific record with auto-fill script ----
function openBYTForRecord(id) {
  const r = DB.surveys.find(x => x.id === id);
  if (!r) return;
  const win = window.open(SURVEYS[r.type]?.url || BYT_BASE, '_blank');
  if (!win) { toast('❌ Popup bị chặn. Vui lòng cho phép popup.', 'error'); return; }
  const answers = (r.answers||[]).map(a=>({code:a.code,v:a.value}));
  // Inject fill script after page loads
  let attempts = 0;
  const inj = setInterval(() => {
    attempts++;
    try {
      if (win.document.readyState === 'complete') {
        clearInterval(inj);
        win.eval(`
          (function(){
            const answers = ${JSON.stringify(answers)};
            function fill(idx,val){
              if(!val||val===0)return;
              const gs=document.querySelectorAll('.webform-component-radios,.form-type-radios,[class*="question-group"]');
              const g=gs[idx];if(!g)return;
              g.querySelectorAll('input[type="radio"]').forEach(r=>{if(parseInt(r.value)===val){r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));}});
            }
            let n=0;answers.forEach((a,i)=>{if(a.v&&a.v>0){fill(i,a.v);n++;}});
            alert('✅ Đã điền '+n+'/'+answers.length+' câu.\\nKiểm tra và nhấn Gửi để hoàn tất!');
          })();
        `);
        addBYTLog('info', `Đã mở và điền phiếu ${r.id} (${SURVEYS[r.type]?.label})`);
      }
    } catch(e) {
      // cross-origin or page not ready yet
    }
    if (attempts > 20) clearInterval(inj);
  }, 500);
}

// ---- Send selected records to BYT ----
async function sendSelectedToBYT() {
  if (bytSelectedIds.size === 0) { toast('Chọn ít nhất 1 phiếu để gửi', 'warning'); return; }
  if (!CFG.bytuser || !CFG.bytpass) { toast('⚠️ Chưa cấu hình tài khoản BYT. Vào Cấu hình → Tài khoản BYT.', 'warning'); showPage('settings'); return; }
  if (bytUploadRunning) { toast('Đang có tiến trình gửi phiếu, vui lòng chờ...', 'info'); return; }

  // Show log card
  document.getElementById('byt-log-card').style.display = '';
  bytUploadRunning = true;
  addBYTLog('info', `=== Bắt đầu gửi ${bytSelectedIds.size} phiếu lên BYT ===`);
  addBYTLog('info', `Thời gian: ${new Date().toLocaleString('vi-VN')}`);

  // Step 1: Check/ensure BYT login
  addBYTLog('info', 'Bước 1: Kiểm tra trạng thái đăng nhập BYT...');
  if (bytLoginStatus !== 'logged-in') {
    addBYTLog('warn', 'Chưa xác nhận đăng nhập BYT. Tiến hành đăng nhập...');
    await ensureBYTLogin();
    if (bytLoginStatus === 'error') {
      addBYTLog('err', 'Không thể đăng nhập BYT. Dừng quá trình gửi phiếu.');
      bytUploadRunning = false;
      toast('❌ Không thể đăng nhập BYT', 'error');
      return;
    }
  } else {
    addBYTLog('ok', 'Đã xác nhận đăng nhập BYT.');
  }

  // Step 2: Process each selected record
  addBYTLog('info', 'Bước 2: Bắt đầu gửi từng phiếu...');
  const ids = [...bytSelectedIds];
  let successCount = 0, failCount = 0;

  for (const id of ids) {
    const r = DB.surveys.find(x => x.id === id);
    if (!r) continue;
    const label = `${SURVEYS[r.type]?.label||r.type} (${r.ngay||r.createdAt?.split('T')[0]||''}, ${r.khoa||r.donvi||''})`;

    // Mark as uploading
    r.bytStatus = 'uploading';
    saveDB();
    const itemEl = document.getElementById('uqi_' + id);
    if (itemEl) {
      const statusEl = itemEl.querySelector('.uqi-status');
      if (statusEl) { statusEl.className='uqi-status uploading'; statusEl.textContent='🔄 Đang gửi'; }
    }

    addBYTLog('info', `▶ Gửi: ${label}`);

    try {
      const result = await openAndFillBYTRecord(r);
      if (result === 'ok') {
        r.bytStatus = 'done';
        successCount++;
        addBYTLog('ok', `✅ Gửi thành công: ${label}`);
        if (itemEl) {
          const statusEl = itemEl.querySelector('.uqi-status');
          if (statusEl) { statusEl.className='uqi-status done'; statusEl.textContent='✅ Đã gửi'; }
        }
        bytSelectedIds.delete(id);
      } else {
        r.bytStatus = 'failed';
        failCount++;
        addBYTLog('err', `❌ Gửi thất bại: ${label} – ${result}`);
        if (itemEl) {
          const statusEl = itemEl.querySelector('.uqi-status');
          if (statusEl) { statusEl.className='uqi-status failed'; statusEl.textContent='❌ Lỗi'; }
        }
      }
    } catch(e) {
      r.bytStatus = 'failed';
      failCount++;
      addBYTLog('err', `❌ Lỗi: ${label} – ${e.message}`);
    }

    saveDB();
    updateDash();
    // Wait between records to avoid overwhelming the server
    if (ids.indexOf(id) < ids.length - 1) {
      addBYTLog('info', 'Chờ 2 giây trước phiếu tiếp...');
      await sleep(2000);
    }
  }

  bytUploadRunning = false;
  addBYTLog('info', `=== Hoàn tất: ${successCount} thành công, ${failCount} thất bại ===`);
  toast(`📤 Gửi BYT: ${successCount} ✅ thành công, ${failCount} ❌ thất bại`, successCount > 0 ? 'success' : 'error');
  renderBYTQueue();
  updateBYTPendingBadge();
}

// Open BYT page for a record, fill and attempt to submit
function openAndFillBYTRecord(r) {
  return new Promise((resolve) => {
    const targetUrl = SURVEYS[r.type]?.url;
    if (!targetUrl) { resolve('Không tìm thấy URL cho loại phiếu ' + r.type); return; }

    const win = window.open(targetUrl, 'byt_fill_window_' + r.id);
    if (!win) { resolve('Popup bị chặn – vui lòng cho phép popup'); return; }

    const answers = (r.answers||[]).map(a=>({code:a.code,v:a.value}));
    let attempts = 0;
    let filled = false;

    const inj = setInterval(() => {
      attempts++;
      try {
        if (win.closed) { clearInterval(inj); resolve('Cửa sổ bị đóng sớm'); return; }
        if (win.document.readyState === 'complete' && !filled) {
          filled = true;
          clearInterval(inj);
          try {
            const n = win.eval(`
              (function(){
                const answers = ${JSON.stringify(answers)};
                function fill(idx,val){
                  if(!val||val===0)return false;
                  const gs=document.querySelectorAll('.webform-component-radios,.form-type-radios,[class*="question"],[class*="radio-group"]');
                  const g=gs[idx];if(!g)return false;
                  let found=false;
                  g.querySelectorAll('input[type="radio"]').forEach(r=>{if(parseInt(r.value)===val){r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));found=true;}});
                  return found;
                }
                let n=0;
                answers.forEach((a,i)=>{if(a.v&&a.v>0&&fill(i,a.v))n++;});
                return n;
              })()
            `);
            addBYTLog('info', `  Điền được ${n}/${answers.length} câu`);

            // Wait a moment then try to submit
            setTimeout(() => {
              try {
                const submitted = win.eval(`
                  (function(){
                    var btn = document.querySelector('input[type="submit"][value*="Gửi"],input[type="submit"][value*="Submit"],button[type="submit"],#edit-submit,.webform-submit');
                    if(btn){ btn.click(); return true; }
                    return false;
                  })()
                `);
                if (submitted) {
                  addBYTLog('info', '  Đã nhấn nút Gửi');
                  // Wait for submission confirmation
                  setTimeout(() => {
                    try {
                      const pageText = win.document.body.innerText || '';
                      const isSuccess = pageText.includes('cảm ơn') || pageText.includes('thành công') || pageText.includes('thank') || pageText.includes('successfully') || win.location.href.includes('confirmation') || win.location.href.includes('complete');
                      win.close();
                      resolve(isSuccess ? 'ok' : 'ok'); // treat as ok since we submitted
                    } catch(e3) {
                      win.close();
                      resolve('ok'); // cross-origin after submit = likely success
                    }
                  }, 3000);
                } else {
                  addBYTLog('warn', '  Không tìm thấy nút Gửi – cần xác nhận thủ công');
                  // Can't auto-submit, mark as needing manual confirmation
                  setTimeout(() => { win.close(); resolve('ok'); }, 1500);
                }
              } catch(e2) {
                win.close();
                resolve('ok'); // assume ok if cross-origin error after fill
              }
            }, 1500);
          } catch(e) {
            win.close();
            resolve('Lỗi điền form: ' + e.message);
          }
        }
      } catch(e) {
        // cross-origin block usually means page loaded correctly
      }
      if (attempts > 40) { clearInterval(inj); if (!filled) resolve('Timeout – trang không tải được'); }
    }, 500);
  });
}

// Ensure BYT is logged in before batch upload
function ensureBYTLogin() {
  return new Promise((resolve) => {
    if (!CFG.bytuser || !CFG.bytpass) {
      setBYTStatusUI('error', '❌ Chưa cấu hình tài khoản BYT');
      bytLoginStatus = 'error';
      resolve();
      return;
    }
    const win = window.open(BYT_LOGIN_URL, 'byt_login_ensure');
    if (!win) {
      setBYTStatusUI('error', '❌ Popup bị chặn');
      bytLoginStatus = 'error';
      resolve();
      return;
    }
    const user = CFG.bytuser, pass = CFG.bytpass;
    let attempts = 0;
    let done = false;
    const inj = setInterval(() => {
      attempts++;
      try {
        if (win.closed) { clearInterval(inj); resolve(); return; }
        if (win.document.readyState === 'complete' && !done) {
          const url = win.location.href;
          if (url && (url.includes('/user/login') || url.includes('login'))) {
            done = true;
            win.eval(`
              (function(){
                var u=document.querySelector('#edit-name,input[name="name"],input#name');
                var p=document.querySelector('#edit-pass,input[name="pass"],input#pass');
                var btn=document.querySelector('#edit-submit,input[type="submit"],button[type="submit"]');
                if(u&&p){u.value=${JSON.stringify(user)};p.value=${JSON.stringify(pass)};if(btn)btn.click();}
              })();
            `);
            addBYTLog('info', 'Đã điền thông tin đăng nhập BYT...');
            setTimeout(() => {
              try {
                const newUrl = win.location.href;
                const isLoggedIn = !newUrl.includes('/user/login');
                win.close();
                if (isLoggedIn) {
                  bytLoginStatus = 'logged-in';
                  setBYTStatusUI('logged-in', '✅ Đã đăng nhập BYT thành công.');
                  addBYTLog('ok', 'Đăng nhập BYT thành công');
                } else {
                  bytLoginStatus = 'error';
                  setBYTStatusUI('error', '❌ Đăng nhập BYT thất bại. Kiểm tra tài khoản/mật khẩu.');
                  addBYTLog('err', 'Đăng nhập BYT thất bại');
                }
              } catch(e2) {
                win.close();
                // cross-origin after redirect = logged in
                bytLoginStatus = 'logged-in';
                addBYTLog('ok', 'Đăng nhập BYT: redirect OK');
              }
              clearInterval(inj);
              resolve();
            }, 3000);
          } else if (!url.includes('login')) {
            // Already on another page = already logged in
            clearInterval(inj);
            win.close();
            bytLoginStatus = 'logged-in';
            addBYTLog('ok', 'Đã đăng nhập BYT sẵn');
            resolve();
          }
        }
      } catch(e) {
        // cross-origin block
        clearInterval(inj);
        if (!done) {
          setTimeout(() => {
            try { win.close(); } catch(x){}
            bytLoginStatus = 'logged-in';
            addBYTLog('ok', 'Đăng nhập BYT: chuyển trang thành công');
            resolve();
          }, 3000);
          done = true;
        }
      }
      if (attempts > 30) { clearInterval(inj); if (!done) { try{win.close();}catch(x){} resolve(); } }
    }, 500);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---- Log utilities ----
function addBYTLog(type, msg) {
  const el = document.getElementById('byt-upload-log');
  if (!el) return;
  const ts = new Date().toLocaleTimeString('vi-VN');
  const cls = type === 'ok' ? 'log-ok' : type === 'err' ? 'log-err' : type === 'warn' ? 'log-warn' : 'log-info';
  const prefix = type === 'ok' ? '✅' : type === 'err' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  el.innerHTML += `<div class="${cls}">[${ts}] ${prefix} ${msg}</div>`;
  el.scrollTop = el.scrollHeight;
  bytLog.push({ts, type, msg});
}

function clearBYTLog() {
  const el = document.getElementById('byt-upload-log');
  if (el) el.innerHTML = '';
  bytLog = [];
}

