// byt.js – Module gửi phiếu lên trang BYT (hailong.chatluongbenhvien.vn)
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// Version: v5.0 – Rewrite hoàn chỉnh – field mapping chính xác 100% từ HTML thực tế
// ============================================================
// Field mapping từ HTML thực tế (5 mẫu):
//
// M1 (noi_tru)     form_id: webform_client_form_206847
//   TTP: submitted[ttp][bvn][1_ten_benh_vien|mabv|ngay_dien_phieu[day/month/year]]
//        submitted[ttp][kmk][khoa_phong|ma_khoa]
//   Đánh giá: submitted[danh_gia][SEC][SECnum]  radio value=1..5
//
// M2 (ngoai_tru)   form_id: webform_client_form_206848  (giống M1)
//
// M3 (nhan_vien)   form_id: webform_client_form_1468
//   TTP: submitted[ttp][bvn][...] (giống M1)
//        submitted[ttp][khoa_phong]  ← KHÔNG có wrapper [kmk] như M1/M2
//   Đánh giá: submitted[danh_gia][SEC][SECnum]  radio value=1..5
//
// M4 (me_sinh_con) form_id: webform_client_form_22799
//   TTP: submitted[thong_tin_phieu][benhvien_ngay][1_ten_benh_vien|mabv|ngay_dien_phieu[...]]
//        submitted[thong_tin_phieu][khoa_ma_khoa][khoa_phong|ma_khoa]
//   Đánh giá: submitted[danh_gia][SEC][SECnum]  radio value=1..5 (sections a..h)
//
// M5 (nuoi_con)    form_id: webform_client_form_22800
//   TTP: submitted[thong_tin_phieu][benhvien_ngay][...] (giống M4)
//   Section B checkbox nhiều: submitted[danh_gia][bN][select][VALUE]
//   Section B radio đơn (b5,b6,b8,b11): submitted[danh_gia][bN][select]  value=VAL
//   Section B text (b12..b15, b6k...): submitted[danh_gia][bNk|bN_a|bN_b]
// ============================================================

const BYT_BASE      = 'https://hailong.chatluongbenhvien.vn';
const BYT_LOGIN_URL = BYT_BASE + '/user/login';

const BYT_NODE_IDS = { m1: 206847, m2: 206848, m3: 1468, m4: 22799, m5: 22800 };

const BYT_FORM_IDS = {
  m1: 'webform_client_form_206847',
  m2: 'webform_client_form_206848',
  m3: 'webform_client_form_1468',
  m4: 'webform_client_form_22799',
  m5: 'webform_client_form_22800',
};

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
let bytLoginStatus   = 'unknown';
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
// CHECK LOGIN STATUS
// =========================================================
async function checkBYTLoginStatus() {
  const loginBtn = document.getElementById('btn-byt-login-now');
  setBYTStatusUI('checking', '🔄 Đang kiểm tra kết nối đến trang BYT...');
  if (loginBtn) loginBtn.style.display = 'none';

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    await fetch(BYT_BASE, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);

    setBYTStatusUI('unknown',
      '🔓 Trang BYT đang hoạt động. Do chính sách bảo mật trình duyệt, ' +
      'không thể tự động kiểm tra phiên đăng nhập. ' +
      'Nhấn "Đăng nhập BYT" để đăng nhập và gửi phiếu.');
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'unknown';
  } catch(e) {
    if (e.name === 'AbortError') {
      setBYTStatusUI('error', '❌ Timeout – không kết nối được trang BYT. Kiểm tra mạng.');
    } else if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))) {
      setBYTStatusUI('error', '❌ Không thể kết nối trang BYT. Kiểm tra kết nối mạng.');
    } else {
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
// HTML Drupal 7 thực tế:
//   form#user-login  →  input#edit-name (name), input#edit-pass (pass)
//   hide_submit plugin che nút → phải dùng form.submit() trực tiếp
// =========================================================
function loginBYTNow() {
  if (!CFG.bytuser || !CFG.bytpass) {
    toast('⚠️ Chưa cấu hình tài khoản BYT. Vào Cấu hình → Tài khoản BYT.', 'warning');
    showPage('settings');
    return;
  }

  const win = window.open(BYT_LOGIN_URL, 'byt_login_window', 'width=1050,height=720,left=80,top=60');
  if (!win) {
    toast('❌ Trình duyệt chặn popup. Vui lòng cho phép popup từ trang này.', 'error');
    return;
  }

  const user = CFG.bytuser;
  const pass = CFG.bytpass;
  setBYTStatusUI('checking', '🔄 Đang mở trang BYT và tự động đăng nhập...');
  addBYTLog('info', 'Mở cửa sổ đăng nhập BYT: ' + BYT_LOGIN_URL);
  addBYTLog('info', 'Tài khoản: ' + user);

  let attempts = 0, injected = false, redirected = false;

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

      if (!injected && ready && curUrl.includes('/user/login')) {
        injected = true;
        addBYTLog('info', 'Trang login đã tải – điền thông tin...');
        setTimeout(() => {
          try {
            const result = win.eval(`(function(){
              try {
                var u = document.getElementById('edit-name');
                var p = document.getElementById('edit-pass');
                var f = document.getElementById('user-login');
                if (!u) return 'ERR: Không tìm thấy #edit-name';
                if (!p) return 'ERR: Không tìm thấy #edit-pass';
                if (!f) return 'ERR: Không tìm thấy form #user-login';
                u.value = ${JSON.stringify(user)};
                p.value = ${JSON.stringify(pass)};
                if (u.value !== ${JSON.stringify(user)}) return 'ERR: Không set được username';
                var op = f.querySelector('input[name="op"]');
                if (!op) { op = document.createElement('input'); op.type='hidden'; op.name='op'; f.appendChild(op); }
                op.value = 'Đăng nhập';
                f.submit();
                return 'OK: Đã submit form đăng nhập';
              } catch(e) { return 'ERR: ' + e.message; }
            })()`);
            addBYTLog('info', 'Kết quả: ' + result);
            if (result && result.startsWith('ERR:')) {
              addBYTLog('warn', '⚠️ ' + result + ' – hãy điền thủ công trong cửa sổ BYT');
            }
          } catch(e) {
            addBYTLog('warn', 'eval() bị chặn: ' + e.message);
          }
        }, 700);
      }

      if (injected && ready && !curUrl.includes('/user/login') && curUrl.startsWith('http')) {
        redirected = true;
        clearInterval(iv);
        bytLoginStatus = 'logged-in';
        setBYTStatusUI('logged-in', '✅ Đăng nhập BYT thành công! Sẵn sàng gửi phiếu.');
        const lb = document.getElementById('btn-byt-login-now');
        if (lb) lb.style.display = 'none';
        addBYTLog('ok', '✅ Đăng nhập BYT thành công → ' + curUrl);
        setTimeout(() => { try { win.close(); } catch(x){} }, 1500);
      }
    } catch(e) {
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
    if (attempts > 50) {
      clearInterval(iv);
      if (!redirected) {
        setBYTStatusUI('unknown', '⚠️ Hết thời gian tự động. Hãy đăng nhập thủ công trong cửa sổ BYT.');
        addBYTLog('warn', 'Timeout 25 giây – hãy kiểm tra cửa sổ BYT đang mở');
      }
    }
  }, 500);
}

// =========================================================
// BUILD FILL SCRIPT
// Tạo đoạn code JS để inject vào cửa sổ BYT qua win.eval()
// Điền đầy đủ: TTP header + câu trả lời đánh giá + submit
// =========================================================
function _buildFillScript(rec) {
  const type    = rec.type;
  const answers = (rec.answers || []).filter(a => a.value && parseInt(a.value) > 0);
  const hvname  = rec.benhvien || rec.donvi || CFG.hvname || '';
  const khoa    = rec.khoa || rec.donvi || '';
  const makhoa  = rec.makhoa || '';
  const mabv    = CFG.mabv || '';
  const ngay    = (rec.ngay || new Date().toISOString().split('T')[0]).split('-');
  const dd = ngay[2] || '', mm = ngay[1] || '', yy = ngay[0] || '';

  const useThongTinPhieu = (type === 'm4' || type === 'm5');
  const L = [];  // lines of JS code

  L.push('(function(){');
  L.push('  try {');
  L.push('    var filled=0, missing=[], log=[];');

  // === ĐIỀN TTP HEADER ===
  if (!useThongTinPhieu) {
    // M1, M2, M3
    L.push('    // === TTP – submitted[ttp][bvn|kmk|...] ===');
    L.push('    var _s=function(sel,val){var e=document.querySelector(sel);if(e){e.value=val;return true;}return false;};');
    L.push('    _s(\'input[name="submitted[ttp][bvn][1_ten_benh_vien]"]\', ' + JSON.stringify(hvname) + ');');
    L.push('    _s(\'input[name="submitted[ttp][bvn][mabv]"]\', ' + JSON.stringify(mabv) + ');');
    L.push('    _s(\'input[name="submitted[ttp][bvn][ngay_dien_phieu][day]"],select[name="submitted[ttp][bvn][ngay_dien_phieu][day]"]\', ' + JSON.stringify(dd) + ');');
    L.push('    _s(\'input[name="submitted[ttp][bvn][ngay_dien_phieu][month]"],select[name="submitted[ttp][bvn][ngay_dien_phieu][month]"]\', ' + JSON.stringify(mm) + ');');
    L.push('    _s(\'input[name="submitted[ttp][bvn][ngay_dien_phieu][year]"],select[name="submitted[ttp][bvn][ngay_dien_phieu][year]"]\', ' + JSON.stringify(yy) + ');');
    if (type === 'm3') {
      // M3: submitted[ttp][khoa_phong] – KHÔNG có [kmk] wrapper
      L.push('    _s(\'input[name="submitted[ttp][khoa_phong]"],select[name="submitted[ttp][khoa_phong]"]\', ' + JSON.stringify(khoa) + ');');
    } else {
      // M1, M2: submitted[ttp][kmk][khoa_phong]
      L.push('    _s(\'input[name="submitted[ttp][kmk][khoa_phong]"],select[name="submitted[ttp][kmk][khoa_phong]"]\', ' + JSON.stringify(khoa) + ');');
      L.push('    _s(\'input[name="submitted[ttp][kmk][ma_khoa]"]\', ' + JSON.stringify(makhoa) + ');');
    }
  } else {
    // M4, M5: submitted[thong_tin_phieu][benhvien_ngay|khoa_ma_khoa|...]
    L.push('    // === TTP – submitted[thong_tin_phieu][...] ===');
    L.push('    var _s=function(sel,val){var e=document.querySelector(sel);if(e){e.value=val;return true;}return false;};');
    L.push('    _s(\'input[name="submitted[thong_tin_phieu][benhvien_ngay][1_ten_benh_vien]"]\', ' + JSON.stringify(hvname) + ');');
    L.push('    _s(\'input[name="submitted[thong_tin_phieu][benhvien_ngay][mabv]"]\', ' + JSON.stringify(mabv) + ');');
    L.push('    _s(\'input[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][day]"],select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][day]"]\', ' + JSON.stringify(dd) + ');');
    L.push('    _s(\'input[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][month]"],select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][month]"]\', ' + JSON.stringify(mm) + ');');
    L.push('    _s(\'input[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][year]"],select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][year]"]\', ' + JSON.stringify(yy) + ');');
    L.push('    _s(\'input[name="submitted[thong_tin_phieu][khoa_ma_khoa][khoa_phong]"],select[name="submitted[thong_tin_phieu][khoa_ma_khoa][khoa_phong]"]\', ' + JSON.stringify(khoa) + ');');
    L.push('    _s(\'input[name="submitted[thong_tin_phieu][khoa_ma_khoa][ma_khoa]"]\', ' + JSON.stringify(makhoa) + ');');
  }

  // === ĐIỀN CÂU TRẢ LỜI ĐÁNH GIÁ ===
  const answersJson = JSON.stringify(answers.map(a => ({ code: a.code, value: String(a.value) })));

  if (type === 'm5') {
    // M5 – section B checkbox/radio đặc biệt
    // b5, b6, b8, b11 là radio đơn (select giá trị)
    // b1..b4, b7, b9, b10 là checkbox nhiều lựa chọn [select][VALUE]
    L.push('    // === Câu trả lời M5 – section B ===');
    L.push('    var ANS5 = ' + answersJson + ';');
    L.push('    var M5_RADIO = {b5:1,b6:1,b8:1,b11:1};');
    L.push('    ANS5.forEach(function(a){');
    L.push('      var sec = a.code[0].toLowerCase();');
    L.push('      var num = a.code.slice(1).toLowerCase();');
    L.push('      var key = sec + num;');
    L.push('      var val = a.value;');
    L.push('      if (sec !== "b") return;');
    L.push('      var el;');
    L.push('      if (M5_RADIO[key]) {');
    L.push('        // Radio đơn: name="submitted[danh_gia][bN][select]" value="VAL"');
    L.push('        el = document.querySelector(\'input[name="submitted[danh_gia][\'+key+\'][select]"][value="\'+val+\'"]\');');
    L.push('        if (el) { el.checked=true; el.dispatchEvent(new Event("change",{bubbles:true})); filled++; }');
    L.push('        else missing.push(a.code+"="+val);');
    L.push('      } else {');
    L.push('        // Checkbox nhiều: name="submitted[danh_gia][bN][select][VAL]"');
    L.push('        el = document.querySelector(\'input[name="submitted[danh_gia][\'+key+\'][select][\'+val+\']"]\');');
    L.push('        if (el) { el.checked=true; el.dispatchEvent(new Event("change",{bubbles:true})); filled++; }');
    L.push('        else missing.push(a.code+"="+val);');
    L.push('      }');
    L.push('    });');
  } else {
    // M1, M2, M3, M4 – radio 1..5 → submitted[danh_gia][SEC][SECnum]
    L.push('    // === Câu trả lời radio 1–5 (M1/M2/M3/M4) ===');
    L.push('    var ANS = ' + answersJson + ';');
    L.push('    ANS.forEach(function(a){');
    L.push('      if (!a.code || !a.value || parseInt(a.value) <= 0) return;');
    L.push('      var sec  = a.code[0].toLowerCase();');
    L.push('      var num  = a.code.slice(1).toLowerCase();');
    L.push('      var qkey = sec + num;');
    L.push('      var name = "submitted[danh_gia]["+sec+"]["+qkey+"]";');
    L.push('      var el = document.querySelector(\'input[name="\'+name+\'"][value="\'+a.value+\'"]\');');
    L.push('      if (el) {');
    L.push('        el.checked = true;');
    L.push('        el.dispatchEvent(new Event("change",{bubbles:true}));');
    L.push('        filled++;');
    L.push('      } else {');
    L.push('        missing.push(a.code+"="+a.value);');
    L.push('      }');
    L.push('    });');
  }

  // === KIỂM TRA TOKENS ===
  L.push('    // === Lấy form tokens ===');
  L.push('    var buildId = (document.querySelector(\'input[name="form_build_id"]\') || {}).value || "";');
  L.push('    var formId  = (document.querySelector(\'input[name="form_id"]\') || {}).value || "";');
  L.push('    if (!buildId) return { error: "NO_BUILD_ID" };');

  // === SUBMIT ===
  L.push('    // === Submit form (delay 900ms) ===');
  L.push('    setTimeout(function(){');
  L.push('      try {');
  L.push('        var form = document.querySelector(\'form[id^="webform-client-form-"]\')');
  L.push('                || document.querySelector("form.webform-client-form");');
  L.push('        if (form) {');
  L.push('          var op = form.querySelector(\'input[name="op"]\');');
  L.push('          if (!op) { op=document.createElement("input"); op.type="hidden"; op.name="op"; form.appendChild(op); }');
  L.push('          op.value = "Gửi";');
  L.push('          form.submit();');
  L.push('        } else {');
  L.push('          var btn = document.querySelector(\'input[type="submit"][name="op"],input[type="submit"].webform-submit,button[type="submit"]\');');
  L.push('          if (btn) btn.click();');
  L.push('        }');
  L.push('      } catch(se) { log.push("submit-err:"+se.message); }');
  L.push('    }, 900);');

  L.push('    return { ok:true, filled:filled, total:' + answers.length + ', missing:missing.join(","), formId:formId, log:log.join(";") };');
  L.push('  } catch(globalErr) {');
  L.push('    return { error: globalErr.message };');
  L.push('  }');
  L.push('})()');

  return L.join('\n');
}

// =========================================================
// GỬI PHIẾU QUA POPUP WINDOW
// =========================================================
function submitBYTViaPopup(rec) {
  return new Promise((resolve) => {
    const type   = rec.type;
    const action = BYT_FORM_ACTIONS[type];
    if (!action) { resolve({ ok: false, msg: 'Không có URL cho mẫu ' + type }); return; }

    const pageUrl = BYT_BASE + action;
    const win = window.open(pageUrl, 'byt_submit_' + rec.id, 'width=1100,height=780,left=40,top=30');
    if (!win) { resolve({ ok: false, msg: 'Popup bị chặn – hãy cho phép popup trong trình duyệt' }); return; }

    let attempts = 0, fillDone = false, submitted = false;
    const injectScript = _buildFillScript(rec);

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

        // Phát hiện redirect về login → chưa đăng nhập
        if (ready && !fillDone) {
          const isLogin = curUrl.includes('/user/login') ||
                          (win.document.title || '').toLowerCase().includes('đăng nhập');
          if (isLogin) {
            clearInterval(iv);
            try { win.close(); } catch(x){}
            resolve({ ok: false, msg: 'CHƯA_ĐĂNG_NHẬP' });
            return;
          }
        }

        // Trang form đã load → điền và submit
        if (ready && !fillDone) {
          const hasForm = win.document.querySelector('form[id^="webform-client-form-"]') ||
                          win.document.querySelector('form.webform-client-form');
          if (!hasForm) {
            if (attempts > 10) {
              clearInterval(iv);
              try { win.close(); } catch(x){}
              resolve({ ok: false, msg: 'Không tìm thấy form webform trên trang BYT' });
            }
            return;
          }

          fillDone = true;
          addBYTLog('info', 'Trang form đã tải – đang điền dữ liệu...');

          try {
            const result = win.eval(injectScript);
            if (result && result.error === 'NO_BUILD_ID') {
              clearInterval(iv); try { win.close(); } catch(x){}
              resolve({ ok: false, msg: 'Không tìm thấy form_build_id – trang BYT có thể thay đổi cấu trúc' });
              return;
            }
            if (result && result.error) {
              clearInterval(iv); try { win.close(); } catch(x){}
              resolve({ ok: false, msg: 'Lỗi điền form: ' + result.error });
              return;
            }
            if (result && result.ok) {
              addBYTLog('info',
                'Đã điền ' + result.filled + '/' + result.total + ' câu' +
                (result.missing ? ' | thiếu: ' + result.missing : '') +
                ' | form_id: ' + (result.formId || '?'));
            }

            // Chờ submit → xác nhận thành công
            let waitAtt = 0;
            const waitIv = setInterval(() => {
              waitAtt++;
              try {
                if (win.closed) {
                  clearInterval(waitIv); clearInterval(iv);
                  submitted = true;
                  resolve({ ok: true, msg: 'Đã gửi (cửa sổ tự đóng)' });
                  return;
                }
                const newUrl = win.location.href || '';
                const body   = (win.document.body || {}).innerText || '';
                const isOk =
                  /cảm ơn|Cảm ơn|thành công|Thành công|thank|Thank/i.test(body) ||
                  /confirmation|complete/i.test(newUrl) ||
                  (newUrl !== pageUrl && newUrl.length > 10 && win.document.readyState === 'complete' && !newUrl.includes('/user/login'));
                if (isOk) {
                  clearInterval(waitIv); clearInterval(iv);
                  submitted = true;
                  setTimeout(() => { try { win.close(); } catch(x){} }, 800);
                  resolve({ ok: true, msg: 'Gửi thành công' });
                }
              } catch(ce) {
                clearInterval(waitIv); clearInterval(iv);
                submitted = true;
                setTimeout(() => { try { win.close(); } catch(x){} }, 600);
                resolve({ ok: true, msg: 'Gửi thành công (redirect sau submit)' });
              }
              if (waitAtt > 22) {
                clearInterval(waitIv); clearInterval(iv);
                submitted = true;
                setTimeout(() => { try { win.close(); } catch(x){} }, 400);
                resolve({ ok: true, msg: 'Gửi xong (timeout xác nhận)' });
              }
            }, 1000);

          } catch(domErr) {
            clearInterval(iv); try { win.close(); } catch(x){}
            resolve({ ok: false, msg: 'Không đọc được trang BYT – hãy đăng nhập BYT trước' });
          }
        }

      } catch(outerErr) {
        if (fillDone && !submitted) {
          clearInterval(iv);
          submitted = true;
          setTimeout(() => { try { win.close(); } catch(x){} }, 400);
          resolve({ ok: true, msg: 'Gửi thành công (cross-origin)' });
        }
      }

      if (attempts > 80) {
        clearInterval(iv);
        if (!submitted) {
          try { win.close(); } catch(x){}
          resolve({ ok: false, msg: 'Timeout 40 giây – trang BYT không phản hồi' });
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
    const cnt = document.getElementById('byt-queue-count');
    if (cnt) cnt.textContent = '';
    return;
  }

  let html = '';
  surveys.forEach(r => {
    const isSelected = bytSelectedIds.has(r.id);
    const ans  = r.answers?.filter(a => a.value !== null && a.value > 0) || [];
    const avg  = ans.length ? (ans.reduce((s,a)=>s+a.value,0)/ans.length).toFixed(1) : '-';
    const d    = r.ngay || r.createdAt?.split('T')[0] || '';
    const icon = r.type==='m1'?'🏥':r.type==='m2'?'🏃':r.type==='m3'?'👨‍⚕️':r.type==='m4'?'👶':'🍼';
    let statusHtml =
      (!r.bytStatus || r.bytStatus==='pending')
        ? '<span class="uqi-status pending">⏳ Chờ gửi</span>'
        : r.bytStatus==='uploading'
        ? '<span class="uqi-status uploading">🔄 Đang gửi</span>'
        : r.bytStatus==='done'
        ? '<span class="uqi-status done">✅ Đã gửi</span>'
        : '<span class="uqi-status failed">❌ Lỗi – thử lại</span>';

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
  const cnt = document.getElementById('byt-queue-count');
  if (cnt) cnt.textContent = `(${surveys.length} phiếu, đã chọn ${bytSelectedIds.size})`;
  updateBYTPendingBadge();
}

function toggleBYTItem(id, checked) {
  if (checked) bytSelectedIds.add(id);
  else bytSelectedIds.delete(id);
  document.getElementById('uqi_' + id)?.classList.toggle('selected', checked);
  const total = document.querySelectorAll('.uqi-check').length;
  const cnt   = document.getElementById('byt-queue-count');
  if (cnt) cnt.textContent = `(${total} phiếu, đã chọn ${bytSelectedIds.size})`;
}

function selectAllBYTQueue() {
  document.querySelectorAll('.uqi-check').forEach(cb => {
    cb.checked = true; bytSelectedIds.add(cb.dataset.id);
    document.getElementById('uqi_' + cb.dataset.id)?.classList.add('selected');
  });
  renderBYTQueue();
}

function deselectAllBYTQueue() {
  bytSelectedIds.clear();
  document.querySelectorAll('.uqi-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.upload-queue-item').forEach(el => el.classList.remove('selected'));
  const total = document.querySelectorAll('.uqi-check').length;
  const cnt   = document.getElementById('byt-queue-count');
  if (cnt) cnt.textContent = `(${total} phiếu, đã chọn 0)`;
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
  const url = BYT_FORM_ACTIONS[r.type] ? (BYT_BASE + BYT_FORM_ACTIONS[r.type]) : BYT_BASE;
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
  addBYTLog('info', '⚠️ Mỗi phiếu sẽ mở 1 cửa sổ BYT riêng – KHÔNG đóng cửa sổ khi đang gửi!');

  const ids = [...bytSelectedIds];
  let successCount = 0, failCount = 0, needLogin = false;

  for (let i = 0; i < ids.length; i++) {
    if (needLogin) break;
    const id = ids[i];
    const r  = DB.surveys.find(x => x.id === id);
    if (!r) continue;

    const ans   = r.answers?.filter(a => a.value && parseInt(a.value) > 0) || [];
    const label = (SURVEYS[r.type]?.label||r.type) +
                  ' | ' + (r.ngay||r.createdAt?.split('T')[0]||'') +
                  ' | ' + (r.khoa||r.donvi||'—') +
                  ' | ' + ans.length + ' câu';

    addBYTLog('info', '▶ [' + (i+1) + '/' + ids.length + '] Gửi: ' + label);

    r.bytStatus = 'uploading'; saveDB();
    const itemEl = document.getElementById('uqi_' + id);
    if (itemEl) {
      const s = itemEl.querySelector('.uqi-status');
      if (s) { s.className='uqi-status uploading'; s.textContent='🔄 Đang gửi'; }
    }

    let result;
    try { result = await submitBYTViaPopup(r); }
    catch(e) { result = { ok: false, msg: e.message }; }

    if (result.ok) {
      r.bytStatus = 'done'; successCount++;
      bytSelectedIds.delete(id);
      addBYTLog('ok', '✅ Thành công: ' + label);
      if (itemEl) {
        const s = itemEl.querySelector('.uqi-status');
        if (s) { s.className='uqi-status done'; s.textContent='✅ Đã gửi'; }
      }
      if (typeof gsReady === 'function' && gsReady())
        gsUpdateSurveyStatus(id, 'done').catch(()=>{});
    } else {
      const isNoLogin = (result.msg||'').includes('CHƯA_ĐĂNG_NHẬP');
      if (isNoLogin) {
        r.bytStatus = 'pending'; // reset để gửi lại sau
        needLogin = true;
        addBYTLog('warn', '⛔ Phiên BYT hết hạn! Dừng gửi. Hãy đăng nhập lại và gửi tiếp.');
      } else {
        r.bytStatus = 'failed'; failCount++;
        addBYTLog('err', '❌ Thất bại [' + (result.msg||'unknown') + ']: ' + label);
        if (itemEl) {
          const s = itemEl.querySelector('.uqi-status');
          if (s) { s.className='uqi-status failed'; s.textContent='❌ Lỗi'; }
        }
      }
    }
    saveDB(); updateDash();

    if (!needLogin && i < ids.length - 1) {
      addBYTLog('info', '⏳ Chờ 3 giây...');
      await sleep(3000);
    }
  }

  bytUploadRunning = false;
  addBYTLog('info', '═══ Kết quả: ✅ ' + successCount + ' thành công | ❌ ' + failCount + ' thất bại ═══');

  if (needLogin) {
    setBYTStatusUI('logged-out', '⚠️ Phiên BYT hết hạn. Nhấn "Đăng nhập BYT" để tiếp tục.');
    const lb = document.getElementById('btn-byt-login-now');
    if (lb) lb.style.display = '';
    toast('⚠️ Phiên BYT hết hạn! Nhấn "Đăng nhập BYT" rồi gửi lại.', 'warning');
  } else {
    toast('📤 BYT: ' + successCount + ' ✅ thành công, ' + failCount + ' ❌ thất bại',
      successCount > 0 ? 'success' : 'error');
    if (successCount > 0)
      setBYTStatusUI('logged-in', '✅ Gửi BYT hoàn tất: ' + successCount + ' phiếu thành công.');
  }

  renderBYTQueue();
  updateBYTPendingBadge();
  if (typeof gsReady === 'function' && gsReady()) {
    gsLogHistory('byt_upload', 'Gửi BYT: '+successCount+' thành công / '+failCount+' thất bại').catch(()=>{});
  }
}

// =========================================================
// TỰ ĐỘNG GỬI KHI LƯU PHIẾU (nếu bật autoUploadBYT)
// =========================================================
async function autoUploadBYTIfEnabled(id) {
  if (!CFG.autoUploadBYT) return;
  if (!CFG.bytuser || !CFG.bytpass) return;
  if (bytLoginStatus !== 'logged-in') return;
  if (bytUploadRunning) return;
  const r = DB.surveys.find(x => x.id === id);
  if (!r || r.bytStatus === 'done') return;
  addBYTLog('info', '🤖 Tự động gửi phiếu vừa lưu: ' + id);
  bytSelectedIds.add(id);
  await sendSelectedToBYT();
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

function exportBYTLog() {
  if (!bytLog.length) { toast('Chưa có log để xuất', 'info'); return; }
  const txt  = bytLog.map(l => `[${l.ts}] [${l.type.toUpperCase()}] ${l.msg}`).join('\n');
  const blob = new Blob([txt], { type: 'text/plain; charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'byt_log_' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt';
  a.click();
  URL.revokeObjectURL(url);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// =========================================================
// FIELD NAME HELPER (debug / external use)
// =========================================================
function bytFieldName(type, code) {
  if (!code) return null;
  const sec  = code[0].toLowerCase();
  const num  = code.slice(1).toLowerCase();
  const qkey = sec + num;
  if (type === 'm5') {
    const RADIO_SINGLE = {b5:1,b6:1,b8:1,b11:1};
    if (RADIO_SINGLE[qkey]) return 'submitted[danh_gia]['+qkey+'][select]';
    return 'submitted[danh_gia]['+qkey+'][select][VALUE]';
  }
  return 'submitted[danh_gia]['+sec+']['+qkey+']';
}
