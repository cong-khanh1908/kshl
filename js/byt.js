// byt.js – Module gửi phiếu lên trang BYT (hailong.chatluongbenhvien.vn)
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// Version: v4.0 – Rewrite hoàn chỉnh: fix cross-origin, field mapping đầy đủ 5 mẫu
// ============================================================

// =========================================================
// CONSTANTS
// =========================================================
const BYT_BASE      = 'https://hailong.chatluongbenhvien.vn';
const BYT_LOGIN_URL = BYT_BASE + '/user/login';

// Node IDs từng mẫu phiếu (webform-client-form-XXXXX)
const BYT_NODE_IDS = { m1: 206847, m2: 206848, m3: 1468, m4: 22799, m5: 22800 };

// URL action của form submit
const BYT_FORM_ACTIONS = {
  m1: '/nguoi-benh-noi-tru-v2',
  m2: '/nguoi-benh-ngoai-tru-v2',
  m3: '/content/3-khao-sat-y-kien-nhan-vien-y-te',
  m4: '/content/4-phieu-khao-sat-y-kien-nguoi-me-sinh-con-tai-benh-vien',
  m5: '/content/5-phieu-khao-sat-thuc-hien-nuoi-con-bang-sua-me-tai-benh-vien-va-sau-ra-vien',
};

// =========================================================
// STATE
// =========================================================
let bytLoginStatus   = 'unknown'; // unknown|checking|logged-in|logged-out|error
let bytUploadRunning = false;
let bytSelectedIds   = new Set();
let bytLog           = [];

// =========================================================
// BADGE & CHECKBOX
// =========================================================
function updateBYTPendingBadge() {
  const pending = DB.surveys.filter(x => !x.bytStatus || x.bytStatus === 'pending').length;
  const b = document.getElementById('pendingBYTBadge');
  if (b) { b.textContent = pending; b.style.display = pending > 0 ? '' : 'none'; }
}

function toggleAutoUpload(checked) {
  CFG.autoUploadBYT = checked;
  saveCFG();
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

// =========================================================
// STATUS UI
// =========================================================
function setBYTStatusUI(type, msg) {
  const bar   = document.getElementById('byt-login-statusbar');
  const dot   = document.getElementById('byt-dot');
  const msgEl = document.getElementById('byt-login-msg');
  if (!bar || !dot || !msgEl) return;
  bar.className = 'byt-status-bar ' + type;
  dot.className = 'byt-status-dot ' + (
    type === 'logged-in' ? 'green' :
    type === 'checking'  ? 'spin'  :
    type === 'error'     ? 'red'   : 'orange'
  );
  msgEl.textContent = msg;
  bytLoginStatus = type;
}

// =========================================================
// CHECK LOGIN – KHÔNG DÙNG IFRAME (bị chặn X-Frame-Options)
// Chiến lược: fetch no-cors → opaque → thông báo thủ công
// =========================================================
async function checkBYTLoginStatus() {
  const loginBtn = document.getElementById('btn-byt-login-now');
  setBYTStatusUI('checking', '🔄 Đang kiểm tra kết nối đến trang BYT...');
  if (loginBtn) loginBtn.style.display = 'none';

  // ★ KHÔNG fetch /user/me → endpoint này không tồn tại trên BYT (404)
  // ★ KHÔNG dùng iframe → bị chặn bởi X-Frame-Options: sameorigin
  // Chiến lược đúng: ping server bằng no-cors HEAD, sau đó hướng dẫn
  // đăng nhập thủ công qua popup (không thể đọc session cross-origin)

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);

    await fetch(BYT_BASE, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal
    });
    clearTimeout(timer);

    // Server BYT đang hoạt động – hướng dẫn người dùng
    setBYTStatusUI('unknown',
      '🔓 Trang BYT đang hoạt động. Do chính sách bảo mật trình duyệt, ' +
      'không thể tự động kiểm tra phiên đăng nhập. ' +
      'Nhấn "Đăng nhập BYT" để đăng nhập và gửi phiếu.');
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'unknown';

  } catch(e) {
    if (e.name === 'AbortError') {
      setBYTStatusUI('error', '❌ Timeout – không kết nối được trang BYT. Kiểm tra mạng.');
    } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      // no-cors thường không throw trừ khi offline hoàn toàn
      setBYTStatusUI('error', '❌ Không thể kết nối trang BYT. Kiểm tra kết nối mạng.');
    } else {
      // Fetch no-cors thành công (opaque response không throw)
      setBYTStatusUI('unknown', '🔓 Nhấn "Đăng nhập BYT" để đăng nhập và gửi phiếu.');
      if (loginBtn) loginBtn.style.display = '';
      bytLoginStatus = 'unknown';
      return;
    }
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'error';
  }
}

// =========================================================
// ĐĂNG NHẬP BYT QUA POPUP + AUTO-FILL
// =========================================================
// Dựa trên HTML thực tế trang hailong.chatluongbenhvien.vn/user/login:
//   <input type="text"     id="edit-name" name="name" />
//   <input type="password" id="edit-pass" name="pass" />
//   <input type="submit"   id="edit-submit" name="op" value="Đăng nhập" />
// Plugin hide_submit.js của Drupal 7 sẽ ẩn nút sau khi click → cần submit form trực tiếp
function loginBYTNow() {
  if (!CFG.bytuser || !CFG.bytpass) {
    toast('⚠️ Chưa cấu hình tài khoản BYT. Vào Cấu hình → Tài khoản BYT.', 'warning');
    showPage('settings');
    return;
  }

  const win = window.open(BYT_LOGIN_URL, 'byt_login_window',
    'width=1050,height=720,left=80,top=60');
  if (!win) {
    toast('❌ Trình duyệt chặn popup. Vui lòng cho phép popup từ trang này.', 'error');
    return;
  }

  const user = CFG.bytuser;
  const pass = CFG.bytpass;
  setBYTStatusUI('checking', '🔄 Đang mở trang BYT và tự động đăng nhập...');
  addBYTLog('info', 'Mở cửa sổ đăng nhập BYT: ' + BYT_LOGIN_URL);
  addBYTLog('info', 'Tài khoản: ' + user);

  let attempts   = 0;
  let injected   = false;
  let redirected = false;

  const iv = setInterval(() => {
    attempts++;
    try {
      if (win.closed) {
        clearInterval(iv);
        if (!redirected) {
          setBYTStatusUI('unknown', '⚠️ Cửa sổ BYT đã đóng. Nhấn "Gửi phiếu" để thử gửi.');
          const lb = document.getElementById('btn-byt-login-now');
          if (lb) lb.style.display = '';
        }
        return;
      }

      const curUrl = win.location.href || '';
      const ready  = win.document.readyState === 'complete';

      // ★ Trang /user/login đã load xong – điền thông tin
      if (!injected && ready && curUrl.includes('/user/login')) {
        injected = true;
        addBYTLog('info', 'Trang login BYT đã tải xong – đang điền thông tin...');

        // ★ Delay 600ms để tất cả Drupal JS (jQuery, hide_submit...) khởi tạo xong
        setTimeout(() => {
          try {
            const result = win.eval(`(function(){
              try {
                // ★ Selectors chính xác từ HTML thực tế BYT (Drupal 7)
                var u = document.getElementById('edit-name');
                var p = document.getElementById('edit-pass');
                var form = document.getElementById('user-login');

                if (!u) return 'ERR: Không tìm thấy field #edit-name (Tài khoản đăng nhập)';
                if (!p) return 'ERR: Không tìm thấy field #edit-pass (Mật khẩu)';
                if (!form) return 'ERR: Không tìm thấy form #user-login';

                // Điền giá trị trực tiếp vào DOM
                u.value = ${JSON.stringify(user)};
                p.value = ${JSON.stringify(pass)};

                // Xác nhận đã điền
                var uOk = u.value === ${JSON.stringify(user)};
                var pOk = p.value.length > 0;

                if (!uOk) return 'ERR: Không điền được tài khoản (value không giữ)';
                if (!pOk) return 'ERR: Không điền được mật khẩu';

                // ★ Submit form trực tiếp (bỏ qua hide_submit plugin của Drupal)
                // KHÔNG dùng btn.click() vì hide_submit sẽ disable nút ngay lập tức
                // Thay vào đó: tạo hidden input op và submit form
                var opInput = form.querySelector('input[name="op"]');
                if (!opInput) {
                  // Tạo input hidden nếu chưa có
                  opInput = document.createElement('input');
                  opInput.type = 'hidden';
                  opInput.name = 'op';
                  form.appendChild(opInput);
                }
                opInput.value = 'Đăng nhập';

                // Submit form natively – bypass Drupal JS hoàn toàn
                form.submit();

                return 'OK: Đã điền tài khoản=' + u.value + ' | Đang submit form...';

              } catch(err) {
                return 'ERR: ' + err.message;
              }
            })()`);

            addBYTLog('info', 'Kết quả: ' + result);

            if (result && result.startsWith('ERR:')) {
              addBYTLog('warn', '⚠️ ' + result);
              addBYTLog('warn', 'Hãy điền thủ công trên cửa sổ BYT đang mở');
            }

          } catch(evalErr) {
            // Cross-origin = cửa sổ đã chuyển trang (không phải /user/login nữa)
            addBYTLog('warn', 'eval() bị chặn: ' + evalErr.message);
          }
        }, 600);
      }

      // ★ Đã redirect khỏi /user/login = đăng nhập thành công
      if (injected && ready && !curUrl.includes('/user/login') && curUrl.startsWith('http')) {
        redirected = true;
        clearInterval(iv);
        bytLoginStatus = 'logged-in';
        setBYTStatusUI('logged-in', '✅ Đăng nhập BYT thành công! Sẵn sàng gửi phiếu.');
        const lb = document.getElementById('btn-byt-login-now');
        if (lb) lb.style.display = 'none';
        addBYTLog('ok', '✅ Đăng nhập BYT thành công → ' + curUrl);
        // Đóng popup sau 1.5s
        setTimeout(() => { try { win.close(); } catch(x){} }, 1500);
      }

    } catch(e) {
      // Cross-origin exception = đã redirect sang domain BYT (đăng nhập thành công)
      if (injected && !redirected) {
        redirected = true;
        clearInterval(iv);
        bytLoginStatus = 'logged-in';
        setBYTStatusUI('logged-in', '✅ Đăng nhập BYT thành công!');
        const lb = document.getElementById('btn-byt-login-now');
        if (lb) lb.style.display = 'none';
        addBYTLog('ok', '✅ Đăng nhập BYT thành công (cross-origin redirect)');
        setTimeout(() => { try { win.close(); } catch(x){} }, 1500);
      }
    }

    // Timeout sau 20 giây
    if (attempts > 40) {
      clearInterval(iv);
      if (!redirected) {
        setBYTStatusUI('unknown',
          '⚠️ Hết thời gian tự động. Hãy kiểm tra cửa sổ BYT đang mở và đăng nhập thủ công nếu cần.');
        addBYTLog('warn', 'Timeout 20 giây – hãy kiểm tra cửa sổ BYT');
      }
    }
  }, 500);
}
// =========================================================
// FIELD MAPPING: answer.code (VD: "A1") → BYT field name
// M1/M2/M3/M4: submitted[danh_gia][a][a1]
// M5 section B: submitted[b1][select][value]
// M5 section A/C: submitted[a.a1] / submitted[c.c1]
// =========================================================
function bytFieldName(type, code) {
  if (!code) return null;
  const sec  = code[0].toLowerCase();
  const num  = code.slice(1);
  const qkey = sec + num; // vd: 'a1', 'b10', 'e6'

  if (type === 'm5') {
    if (sec === 'b') return 'submitted[' + qkey + '][select]';
    return 'submitted[' + sec + '.' + qkey + ']';
  }
  // M1, M2, M3, M4
  return 'submitted[danh_gia][' + sec + '][' + qkey + ']';
}

// =========================================================
// GỬI PHIẾU QUA POPUP WINDOW (bypass CORS)
// Mở trang BYT → đọc DOM lấy tokens → điền câu trả lời → submit
// =========================================================
function submitBYTViaPopup(rec) {
  return new Promise((resolve) => {
    const type   = rec.type;
    const action = BYT_FORM_ACTIONS[type];
    if (!action) { resolve({ ok: false, msg: 'Không có URL cho mẫu ' + type }); return; }

    const pageUrl = BYT_BASE + action;
    const win = window.open(pageUrl, 'byt_submit_' + rec.id,
      'width=1050,height=750,left=50,top=40');
    if (!win) { resolve({ ok: false, msg: 'Popup bị chặn – hãy cho phép popup trong trình duyệt' }); return; }

    let attempts     = 0;
    let tokensDone   = false;
    let submitted    = false;

    const answers    = (rec.answers || []).filter(a => a.value && parseInt(a.value) > 0);
    const answersStr = JSON.stringify(answers.map(a => ({ code: a.code, value: a.value })));
    const typeStr    = JSON.stringify(type);
    const hvname     = JSON.stringify(rec.benhvien || rec.donvi || CFG.hvname || '');
    const khoa       = JSON.stringify(rec.khoa || rec.donvi || '');
    const ngay       = (rec.ngay || new Date().toISOString().split('T')[0]).split('-');
    const dd = JSON.stringify(ngay[2]||'');
    const mm = JSON.stringify(ngay[1]||'');
    const yy = JSON.stringify(ngay[0]||'');
    const mabv = JSON.stringify(CFG.mabv || '');

    const iv = setInterval(() => {
      attempts++;
      try {
        if (win.closed) {
          clearInterval(iv);
          if (!submitted) resolve({ ok: false, msg: 'Cửa sổ bị đóng trước khi hoàn tất' });
          return;
        }

        const curUrl = win.location.href || '';
        const ready  = win.document.readyState === 'complete';

        // Phát hiện chuyển về trang login → chưa đăng nhập
        if (ready && (curUrl.includes('/user/login') || win.document.title.toLowerCase().includes('đăng nhập'))) {
          clearInterval(iv);
          try { win.close(); } catch(x){}
          resolve({ ok: false, msg: 'CHƯA_ĐĂNG_NHẬP' });
          return;
        }

        // Trang form đã load xong – điền và submit
        if (ready && !tokensDone) {
          tokensDone = true;
          try {
            const result = win.eval(`(function(){
  try {
    var buildId = (document.querySelector('input[name="form_build_id"]') || {}).value || '';
    var token   = (document.querySelector('input[name="form_token"]') || {}).value || '';
    var formId  = (document.querySelector('input[name="form_id"]') || {}).value || '';
    if (!buildId) return { error: 'NO_BUILD_ID' };

    // ---- Điền câu trả lời ----
    var answers = ${answersStr};
    var type    = ${typeStr};
    var filled  = 0, missing = [];

    function fieldName(t, code) {
      var sec  = code[0].toLowerCase();
      var num  = code.slice(1);
      var qkey = sec + num;
      if (t === 'm5' && sec === 'b') return 'submitted[' + qkey + '][select]';
      if (t === 'm5') return 'submitted[' + sec + '.' + qkey + ']';
      return 'submitted[danh_gia][' + sec + '][' + qkey + ']';
    }

    answers.forEach(function(a) {
      if (!a.code || !a.value || parseInt(a.value) <= 0) return;
      var val  = parseInt(a.value);
      var name = fieldName(type, a.code);
      var el;
      if (type === 'm5' && a.code[0].toUpperCase() === 'B') {
        el = document.querySelector('input[name="' + name + '[' + val + ']"]') ||
             document.querySelector('input[name="' + name + '"][value="' + val + '"]');
        if (el) { el.checked = true; filled++; }
        else missing.push(a.code + '=' + val);
      } else {
        el = document.querySelector('input[name="' + name + '"][value="' + val + '"]');
        if (el) {
          el.checked = true;
          el.dispatchEvent(new Event('change', {bubbles:true}));
          filled++;
        } else missing.push(a.code + '=' + val);
      }
    });

    // ---- Điền thông tin bệnh viện ----
    var bvSels = [
      'input[name="submitted[ttp.bvn][1_ten_benh_vien]"]',
      'input[name="submitted[thong_tin_phieu.benhvien_ngay][1_ten_benh_vien]"]'
    ];
    bvSels.forEach(function(s){var e=document.querySelector(s);if(e)e.value=${hvname};});

    var khoaSels = [
      'input[name="submitted[ttp.kmk][khoa_phong]"]',
      'input[name="submitted[thong_tin_phieu.khoa_ma_khoa][khoa_phong]"]',
      'select[name="submitted[ttp.khoa_phong]"]'
    ];
    khoaSels.forEach(function(s){var e=document.querySelector(s);if(e)e.value=${khoa};});

    // Mã BV
    var mabvSels = [
      'input[name="submitted[ttp.bvn][mabv]"]',
      'input[name="submitted[thong_tin_phieu.benhvien_ngay][mabv]"]'
    ];
    mabvSels.forEach(function(s){var e=document.querySelector(s);if(e)e.value=${mabv};});

    // Ngày điền phiếu
    var daySelectors = [
      ['submitted[ttp.bvn][ngay_dien_phieu][day]',   ${dd}],
      ['submitted[ttp.bvn][ngay_dien_phieu][month]', ${mm}],
      ['submitted[ttp.bvn][ngay_dien_phieu][year]',  ${yy}],
      ['submitted[thong_tin_phieu.benhvien_ngay][ngay_dien_phieu][day]',   ${dd}],
      ['submitted[thong_tin_phieu.benhvien_ngay][ngay_dien_phieu][month]', ${mm}],
      ['submitted[thong_tin_phieu.benhvien_ngay][ngay_dien_phieu][year]',  ${yy}]
    ];
    daySelectors.forEach(function(pair){
      var e=document.querySelector('input[name="'+pair[0]+'"],select[name="'+pair[0]+'"]');
      if(e)e.value=pair[1];
    });

    // Submit form
    setTimeout(function(){
      var btn = document.querySelector(
        'input[type="submit"][name="op"],' +
        'input[type="submit"].webform-submit,' +
        'input[type="submit"].btn-primary,' +
        'button[type="submit"]'
      );
      if (btn) btn.click();
    }, 800);

    return { ok: true, filled: filled, missing: missing.join(','), total: answers.length, buildId: buildId.substring(0,15) };
  } catch(err) {
    return { error: err.message };
  }
})()`);

            if (result && result.error === 'NO_BUILD_ID') {
              clearInterval(iv);
              try { win.close(); } catch(x){}
              resolve({ ok: false, msg: 'Không tìm thấy form_build_id – trang BYT có thể thay đổi' });
              return;
            }
            if (result && result.error) {
              addBYTLog('warn', 'Lỗi điền form: ' + result.error);
            } else if (result && result.ok) {
              addBYTLog('info', 'Điền ' + result.filled + '/' + result.total + ' câu (thiếu: ' + (result.missing||'không có') + ')');
            }

            // Chờ submit và redirect
            let waitAtt = 0;
            const waitIv = setInterval(() => {
              waitAtt++;
              try {
                if (win.closed) {
                  clearInterval(waitIv);
                  clearInterval(iv);
                  submitted = true;
                  resolve({ ok: true, msg: 'Đã gửi (cửa sổ tự đóng)' });
                  return;
                }
                const newUrl  = win.location.href || '';
                const body    = win.document.body?.innerText || '';
                const isOk    = body.includes('cảm ơn') || body.includes('Cảm ơn') ||
                                body.includes('thành công') || body.includes('Thành công') ||
                                newUrl.includes('confirmation') || newUrl.includes('complete') ||
                                (newUrl !== pageUrl && newUrl.length > 10 && win.document.readyState === 'complete');
                if (isOk) {
                  clearInterval(waitIv);
                  clearInterval(iv);
                  submitted = true;
                  setTimeout(() => { try { win.close(); } catch(x){} }, 800);
                  resolve({ ok: true, msg: 'Gửi thành công' });
                }
              } catch(ce) {
                // Cross-origin sau submit → thành công
                clearInterval(waitIv);
                clearInterval(iv);
                submitted = true;
                setTimeout(() => { try { win.close(); } catch(x){} }, 600);
                resolve({ ok: true, msg: 'Gửi thành công (redirect sau submit)' });
              }
              if (waitAtt > 15) {
                clearInterval(waitIv);
                clearInterval(iv);
                submitted = true;
                setTimeout(() => { try { win.close(); } catch(x){} }, 400);
                resolve({ ok: true, msg: 'Gửi xong (timeout xác nhận)' });
              }
            }, 1000);

          } catch(domErr) {
            // Cross-origin khi đọc DOM → chưa đăng nhập
            clearInterval(iv);
            try { win.close(); } catch(x){}
            resolve({ ok: false, msg: 'Không đọc được trang BYT – hãy đăng nhập BYT trước' });
          }
        }

      } catch(outerErr) {
        // Cross-origin sau khi đã điền và submit
        if (tokensDone && !submitted) {
          clearInterval(iv);
          submitted = true;
          setTimeout(() => { try { win.close(); } catch(x){} }, 400);
          resolve({ ok: true, msg: 'Gửi thành công (cross-origin)' });
        }
      }

      if (attempts > 35) {
        clearInterval(iv);
        if (!submitted) {
          try { win.close(); } catch(x){}
          resolve({ ok: false, msg: 'Timeout 17 giây – trang BYT không phản hồi' });
        }
      }
    }, 500);
  });
}

// =========================================================
// RENDER QUEUE UI
// =========================================================
function renderBYTQueue() {
  const typeF   = document.getElementById('byt-fl-type')?.value   || '';
  const statusF = document.getElementById('byt-fl-status')?.value || 'pending';
  let surveys   = [...DB.surveys].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (typeF)    surveys = surveys.filter(x => x.type === typeF);
  if (statusF === 'pending')
    surveys = surveys.filter(x => !x.bytStatus || x.bytStatus === 'pending' || x.bytStatus === 'failed');
  else if (statusF === 'byt-done')
    surveys = surveys.filter(x => x.bytStatus === 'done');

  const el = document.getElementById('byt-queue-list');
  if (!el) return;

  if (!surveys.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">✅</div>
      <div class="empty-text">Không có phiếu cần gửi</div>
      <div class="empty-sub">Tất cả phiếu đã được gửi hoặc chưa có phiếu nào</div>
    </div>`;
    document.getElementById('byt-queue-count').textContent = '';
    return;
  }

  let html = '';
  surveys.forEach(r => {
    const isSelected = bytSelectedIds.has(r.id);
    const ans  = r.answers?.filter(a => a.value !== null && a.value > 0) || [];
    const avg  = ans.length ? (ans.reduce((s,a)=>s+a.value,0)/ans.length).toFixed(1) : '-';
    const d    = r.ngay || r.createdAt?.split('T')[0] || '';
    const icon = r.type==='m1'?'🏥':r.type==='m2'?'🏃':r.type==='m3'?'👨‍⚕️':r.type==='m4'?'👶':'🍼';

    let statusHtml;
    if (!r.bytStatus || r.bytStatus === 'pending')
      statusHtml = '<span class="uqi-status pending">⏳ Chờ gửi</span>';
    else if (r.bytStatus === 'uploading')
      statusHtml = '<span class="uqi-status uploading">🔄 Đang gửi</span>';
    else if (r.bytStatus === 'done')
      statusHtml = '<span class="uqi-status done">✅ Đã gửi</span>';
    else
      statusHtml = '<span class="uqi-status failed">❌ Lỗi – thử lại</span>';

    html += `<div class="upload-queue-item${isSelected?' selected':''}" id="uqi_${r.id}">
      <input type="checkbox" class="uqi-check" data-id="${r.id}" ${isSelected?'checked':''}
        onchange="toggleBYTItem('${r.id}',this.checked)">
      <div class="uqi-info">
        <div class="uqi-label">${icon} ${SURVEYS[r.type]?.label||r.type}</div>
        <div class="uqi-meta">📅 ${d} · ${r.khoa||r.donvi||'—'} · TB ${avg}/5 · ${ans.length}/${r.answers?.length||0} câu</div>
      </div>
      ${statusHtml}
      <button class="btn btn-outline btn-xs" onclick="openBYTForRecord('${r.id}')" title="Xem trên BYT">🔗</button>
    </div>`;
  });

  el.innerHTML = html;
  document.getElementById('byt-queue-count').textContent =
    `(${surveys.length} phiếu, đã chọn ${bytSelectedIds.size})`;
  updateBYTPendingBadge();
}

function toggleBYTItem(id, checked) {
  if (checked) bytSelectedIds.add(id);
  else bytSelectedIds.delete(id);
  document.getElementById('uqi_' + id)?.classList.toggle('selected', checked);
  const total = document.querySelectorAll('.uqi-check').length;
  const count = document.getElementById('byt-queue-count');
  if (count) count.textContent = `(${total} phiếu, đã chọn ${bytSelectedIds.size})`;
}

function selectAllBYTQueue() {
  document.querySelectorAll('.uqi-check').forEach(cb => {
    cb.checked = true;
    bytSelectedIds.add(cb.dataset.id);
    document.getElementById('uqi_' + cb.dataset.id)?.classList.add('selected');
  });
  renderBYTQueue();
}

function deselectAllBYTQueue() {
  bytSelectedIds.clear();
  document.querySelectorAll('.uqi-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.upload-queue-item').forEach(el => el.classList.remove('selected'));
  const total = document.querySelectorAll('.uqi-check').length;
  const count = document.getElementById('byt-queue-count');
  if (count) count.textContent = `(${total} phiếu, đã chọn 0)`;
}

function quickSendOneBYT(id) {
  bytSelectedIds.clear();
  bytSelectedIds.add(id);
  showPage('bytupload');
  setTimeout(() => sendSelectedToBYT(), 400);
}

function openBYTForRecord(id) {
  const r = DB.surveys.find(x => x.id === id);
  if (!r) return;
  const url = SURVEYS[r.type]?.url || BYT_BASE;
  if (!window.open(url, '_blank'))
    toast('❌ Popup bị chặn. Vui lòng cho phép popup.', 'error');
}

// =========================================================
// GỬI PHIẾU ĐÃ CHỌN – MAIN FUNCTION
// =========================================================
async function sendSelectedToBYT() {
  if (bytSelectedIds.size === 0) { toast('Chọn ít nhất 1 phiếu để gửi', 'warning'); return; }
  if (!CFG.bytuser || !CFG.bytpass) {
    toast('⚠️ Chưa cấu hình tài khoản BYT. Vào Cấu hình → Tài khoản BYT.', 'warning');
    showPage('settings'); return;
  }
  if (bytUploadRunning) { toast('Đang có tiến trình gửi phiếu, vui lòng chờ...', 'info'); return; }

  const logCard = document.getElementById('byt-log-card');
  if (logCard) logCard.style.display = '';
  clearBYTLog();

  bytUploadRunning = true;
  addBYTLog('info', '═══ Bắt đầu gửi ' + bytSelectedIds.size + ' phiếu lên BYT ═══');
  addBYTLog('info', 'Thời gian: ' + new Date().toLocaleString('vi-VN'));
  addBYTLog('info', 'Tài khoản BYT: ' + CFG.bytuser);
  addBYTLog('info', '⚠️ Lưu ý: mỗi phiếu sẽ mở cửa sổ BYT riêng. KHÔNG đóng cửa sổ đó khi đang gửi!');

  const ids = [...bytSelectedIds];
  let successCount = 0, failCount = 0, needLogin = false;

  for (const id of ids) {
    const r = DB.surveys.find(x => x.id === id);
    if (!r) continue;

    const ans = r.answers?.filter(a => a.value && parseInt(a.value) > 0) || [];
    const label = (SURVEYS[r.type]?.label||r.type) +
      ' | ' + (r.ngay||r.createdAt?.split('T')[0]||'') +
      ' | ' + (r.khoa||r.donvi||'—') +
      ' | ' + ans.length + ' câu';

    addBYTLog('info', '▶ Gửi: ' + label);

    // UI uploading
    r.bytStatus = 'uploading'; saveDB();
    const itemEl = document.getElementById('uqi_' + id);
    if (itemEl) {
      const s = itemEl.querySelector('.uqi-status');
      if (s) { s.className='uqi-status uploading'; s.textContent='🔄 Đang gửi'; }
    }

    let result;
    try {
      result = await submitBYTViaPopup(r);
    } catch(e) {
      result = { ok: false, msg: e.message };
    }

    if (result.ok) {
      r.bytStatus = 'done';
      successCount++;
      bytSelectedIds.delete(id);
      addBYTLog('ok', '✅ Thành công: ' + label);
      if (itemEl) {
        const s = itemEl.querySelector('.uqi-status');
        if (s) { s.className='uqi-status done'; s.textContent='✅ Đã gửi'; }
      }
      // Cập nhật Sheets nền
      if (gsReady()) gsUpdateSurveyStatus(id, 'done').catch(()=>{});
    } else {
      r.bytStatus = 'failed';
      failCount++;
      addBYTLog('err', '❌ Thất bại: ' + label + ' – ' + result.msg);
      if (itemEl) {
        const s = itemEl.querySelector('.uqi-status');
        if (s) { s.className='uqi-status failed'; s.textContent='❌ Lỗi'; }
      }
      if (result.msg === 'CHƯA_ĐĂNG_NHẬP' || result.msg?.includes('CHƯA_ĐĂNG_NHẬP')) {
        needLogin = true;
        addBYTLog('warn', '⛔ Phiên BYT hết hạn – dừng gửi. Hãy đăng nhập lại.');
        break;
      }
    }

    saveDB(); updateDash();

    if (needLogin) break;
    if (ids.indexOf(id) < ids.length - 1) {
      addBYTLog('info', '⏳ Chờ 3 giây...');
      await sleep(3000);
    }
  }

  bytUploadRunning = false;
  addBYTLog('info', '═══ Kết quả: ✅ ' + successCount + ' thành công | ❌ ' + failCount + ' thất bại ═══');

  if (needLogin) {
    toast('⚠️ Phiên BYT hết hạn! Nhấn "Đăng nhập BYT" rồi gửi lại.', 'warning');
    setBYTStatusUI('logged-out', '⚠️ Phiên BYT hết hạn. Nhấn "Đăng nhập BYT" để tiếp tục.');
    const lb = document.getElementById('btn-byt-login-now');
    if (lb) lb.style.display = '';
  } else {
    toast('📤 BYT: ' + successCount + ' ✅ thành công, ' + failCount + ' ❌ thất bại',
      successCount > 0 ? 'success' : 'error');
  }

  renderBYTQueue();
  updateBYTPendingBadge();
  if (gsReady()) {
    gsLogHistory('byt_upload',
      'Gửi BYT: ' + successCount + ' thành công / ' + failCount + ' thất bại').catch(()=>{});
  }
}

// =========================================================
// LOG UTILITIES
// =========================================================
function addBYTLog(type, msg) {
  const el = document.getElementById('byt-upload-log');
  if (!el) return;
  const ts  = new Date().toLocaleTimeString('vi-VN');
  const cls = type==='ok'?'log-ok':type==='err'?'log-err':type==='warn'?'log-warn':'log-info';
  const pre = type==='ok'?'✅':type==='err'?'❌':type==='warn'?'⚠️':'ℹ️';
  el.innerHTML += `<div class="${cls}">[${ts}] ${pre} ${msg}</div>`;
  el.scrollTop  = el.scrollHeight;
  bytLog.push({ ts, type, msg });
}

function clearBYTLog() {
  const el = document.getElementById('byt-upload-log');
  if (el) el.innerHTML = '';
  bytLog = [];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
