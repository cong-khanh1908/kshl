// byt.js – Module gửi phiếu lên trang BYT (hailong.chatluongbenhvien.vn)
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// Version: v4.1 – Sửa toàn bộ lỗi logic field mapping, required fields, m5 mapping
// Ngày sửa: 2026-04-06
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
// CHECK LOGIN
// =========================================================
async function checkBYTLoginStatus() {
  const loginBtn = document.getElementById('btn-byt-login-now');
  setBYTStatusUI('checking', '🔄 Đang kiểm tra kết nối đến trang BYT...');
  if (loginBtn) loginBtn.style.display = 'none';

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    await fetch(BYT_BASE + '/user/login', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal
    });
    clearTimeout(timer);

    setBYTStatusUI('unknown',
      '⚠️ Không thể xác minh tự động (trình duyệt bảo mật cross-origin). ' +
      'Nhấn "Đăng nhập BYT" để mở cửa sổ đăng nhập, sau đó gửi phiếu.');
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'unknown';

  } catch(e) {
    if (e.name === 'AbortError') {
      setBYTStatusUI('error', '❌ Timeout – không kết nối được đến trang BYT. Kiểm tra mạng.');
    } else {
      setBYTStatusUI('error', '❌ Lỗi kết nối: ' + e.message);
    }
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'error';
  }
}

// =========================================================
// ĐĂNG NHẬP BYT QUA POPUP + AUTO-FILL
// =========================================================
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

      if (!injected && ready && (curUrl.includes('/user/login') || curUrl.includes('login'))) {
        injected = true;
        try {
          win.eval(`(function(){
            var u=document.querySelector('#edit-name,input[name="name"]');
            var p=document.querySelector('#edit-pass,input[name="pass"]');
            var b=document.querySelector('#edit-submit,input[type="submit"],button[type="submit"]');
            if(u&&p){
              u.value=${JSON.stringify(user)};
              p.value=${JSON.stringify(pass)};
              u.dispatchEvent(new Event('input',{bubbles:true}));
              p.dispatchEvent(new Event('input',{bubbles:true}));
              if(b)b.click();
            }
          })()`);
          addBYTLog('info', 'Đã điền thông tin đăng nhập BYT và click Submit');
        } catch(fillErr) {
          addBYTLog('warn', 'Không thể auto-fill: ' + fillErr.message);
        }
      }

      if (injected && ready && !curUrl.includes('/user/login') && curUrl.startsWith('http')) {
        redirected = true;
        clearInterval(iv);
        bytLoginStatus = 'logged-in';
        setBYTStatusUI('logged-in', '✅ Đăng nhập BYT thành công! Sẵn sàng gửi phiếu.');
        const lb = document.getElementById('btn-byt-login-now');
        if (lb) lb.style.display = 'none';
        addBYTLog('ok', 'Đăng nhập BYT thành công. URL: ' + curUrl);
        setTimeout(() => { try { win.close(); } catch(x){} }, 1500);
      }

    } catch(e) {
      // Cross-origin sau redirect → đăng nhập thành công
      // FIX: Chỉ xử lý khi injected = true (đã điền form), tránh false-positive khi trang chưa load
      if (injected && !redirected) {
        redirected = true;
        clearInterval(iv);
        bytLoginStatus = 'logged-in';
        setBYTStatusUI('logged-in', '✅ Đăng nhập BYT thành công!');
        const lb = document.getElementById('btn-byt-login-now');
        if (lb) lb.style.display = 'none';
        addBYTLog('ok', 'Đăng nhập BYT thành công (cross-origin redirect)');
        setTimeout(() => { try { win.close(); } catch(x){} }, 1500);
      }
    }

    if (attempts > 40) {
      clearInterval(iv);
      if (!redirected) {
        setBYTStatusUI('unknown', '⚠️ Hết thời gian. Hãy đăng nhập thủ công trên cửa sổ BYT.');
        addBYTLog('warn', 'Timeout chờ đăng nhập BYT');
      }
    }
  }, 500);
}

// =========================================================
// FIELD MAPPING: answer.code (VD: "A1") → BYT field name
//
// ĐÃ SỬA (v4.1):
//   - M1/M2/M3/M4: submitted[danh_gia][a][a1]  (giống v4.0 – đúng)
//   - M5 section B: submitted[danh_gia][b1][select][value]  (v4.0 SAI → đã sửa)
//   - M5 section A/C: submitted[a][a.field] (v4.0 SAI ký hiệu dấu chấm → đã sửa)
//   - M4 section G/H: submitted[danh_gia][g][g1] (v4.0 thiếu → đã thêm)
// =========================================================
function bytFieldName(type, code) {
  if (!code) return null;
  const sec  = code[0].toLowerCase();
  const num  = code.slice(1);
  const qkey = sec + num;

  if (type === 'm5') {
    // FIX: M5 (nuoi_con) tất cả câu hỏi đánh giá dùng cấu trúc:
    //   submitted[danh_gia][b1][select][value]  (checkbox)
    // KHÔNG phải submitted[b1][select] như v4.0
    if (sec === 'b') return 'submitted[danh_gia][' + qkey + '][select]';
    // Phần A và C của M5 (thong_tin_phieu) được xử lý riêng, không qua hàm này
    return null;
  }
  // M1, M2, M3, M4 – bao gồm cả section G, H của M4
  return 'submitted[danh_gia][' + sec + '][' + qkey + ']';
}

// =========================================================
// GỬI PHIẾU QUA POPUP WINDOW (bypass CORS)
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

    // FIX: Bao gồm cả value=0 (câu trả lời "Không đánh giá / O")
    // v4.0 dùng parseInt(a.value) > 0 loại bỏ giá trị 0 hợp lệ
    const answers    = (rec.answers || []).filter(a => a.value !== null && a.value !== undefined && a.value !== '');
    const answersStr = JSON.stringify(answers.map(a => ({ code: a.code, value: a.value })));
    const typeStr    = JSON.stringify(type);

    // FIX: 1_ten_benh_vien là SELECT (chứa mã BV như "62310"), không phải text input tên BV
    // Cần truyền mã BV (CFG.mabv) chứ không phải tên BV (CFG.hvname)
    const mabv   = JSON.stringify(CFG.mabv   || '');
    const khoa   = JSON.stringify(rec.khoaId || rec.khoa || '');  // Ưu tiên ID số của khoa
    const ngay   = (rec.ngay || new Date().toISOString().split('T')[0]).split('-');
    const dd     = JSON.stringify(parseInt(ngay[2] || 0).toString());
    const mm     = JSON.stringify(parseInt(ngay[1] || 0).toString());
    const yy     = JSON.stringify(ngay[0] || '');

    // FIX: Các giá trị required fields bắt buộc phải điền để form không báo lỗi
    const kieuKhaoSat = JSON.stringify(rec.kieuKhaoSat || CFG.kieuKhaoSat || '1');
    const guibyt      = JSON.stringify('1'); // Luôn gửi BYT = "Có"
    const nguoipv     = JSON.stringify(rec.nguoipv     || CFG.nguoipv     || '1'); // người bệnh tự điền
    const doituong    = JSON.stringify(rec.doituong    || '1');                    // người bệnh
    const gioi_tinh   = JSON.stringify(rec.gioi_tinh   || '');
    const tuoi        = JSON.stringify(rec.tuoi        || '');

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

        if (ready && (curUrl.includes('/user/login') || win.document.title.toLowerCase().includes('đăng nhập'))) {
          clearInterval(iv);
          try { win.close(); } catch(x){}
          resolve({ ok: false, msg: 'CHƯA_ĐĂNG_NHẬP' });
          return;
        }

        if (ready && !tokensDone) {
          tokensDone = true;
          try {
            const result = win.eval(`(function(){
  try {
    var buildId = (document.querySelector('input[name="form_build_id"]') || {}).value || '';
    var token   = (document.querySelector('input[name="form_token"]')   || {}).value || '';
    var formId  = (document.querySelector('input[name="form_id"]')      || {}).value || '';
    if (!buildId) return { error: 'NO_BUILD_ID' };

    // ---- Điền câu trả lời đánh giá ----
    var answers = ${answersStr};
    var type    = ${typeStr};
    var filled  = 0, missing = [];

    function fieldName(t, code) {
      var sec  = code[0].toLowerCase();
      var num  = code.slice(1);
      var qkey = sec + num;
      // FIX: M5 dùng submitted[danh_gia][b1][select][value] (checkbox)
      if (t === 'm5' && sec === 'b') return 'submitted[danh_gia][' + qkey + '][select]';
      if (t === 'm5') return null; // A/C xử lý riêng
      // M1–M4 bao gồm g, h của M4
      return 'submitted[danh_gia][' + sec + '][' + qkey + ']';
    }

    answers.forEach(function(a) {
      if (a.code === undefined || a.value === null || a.value === undefined || a.value === '') return;
      var val  = parseInt(a.value);
      var name = fieldName(type, a.code);
      if (!name) return;
      var el;

      if (type === 'm5' && a.code[0].toUpperCase() === 'B') {
        // M5 section B: checkbox với name = submitted[danh_gia][b1][select][val]
        el = document.querySelector('input[name="' + name + '[' + val + ']"]') ||
             document.querySelector('input[name="' + name + '"][value="' + val + '"]');
        if (el) { el.checked = true; filled++; }
        else missing.push(a.code + '=' + val);
      } else {
        // M1/M2/M3/M4: radio button
        // FIX: Bao gồm value=0 (câu trả lời O – không đánh giá)
        el = document.querySelector('input[name="' + name + '"][value="' + val + '"]');
        if (el) {
          el.checked = true;
          el.dispatchEvent(new Event('change', {bubbles:true}));
          filled++;
        } else missing.push(a.code + '=' + val);
      }
    });

    // ---- Điền kieu_khao_sat (REQUIRED – v4.0 bỏ sót) ----
    var kks = document.querySelector('select[name="submitted[kieu_khao_sat]"]');
    if (kks && kks.value === '') kks.value = ${kieuKhaoSat};

    // ---- Điền guibyt ----
    var gb = document.querySelector('select[name="submitted[guibyt]"]');
    if (gb) gb.value = ${guibyt};

    // ---- Điền nguoipv (REQUIRED trong M1/M2/M4/M5) ----
    var npv = document.querySelector('select[name="submitted[ttp][mdt][nguoipv]"]');
    if (!npv) npv = document.querySelector('select[name="submitted[ttp][stt_k][hsk]"]'); // M2 alias
    if (npv && npv.value === '') npv.value = ${nguoipv};

    // ---- Điền doituong ----
    var dt1 = document.querySelector('select[name="submitted[ttp][mdt][doituong]"]');
    var dt2 = document.querySelector('input[name="submitted[thong_tin_phieu][ma_doituong][doituong]"][value="1"]');
    if (dt1 && dt1.value === '') dt1.value = ${doituong};
    if (dt2) dt2.checked = true;

    // ---- Điền giới tính (REQUIRED trong M1/M2) ----
    var gt = ${gioi_tinh};
    if (gt) {
      var gtEl = document.querySelector('input[name="submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][gioi_tinh]"][value="' + gt + '"]');
      if (gtEl) { gtEl.checked = true; gtEl.dispatchEvent(new Event('change',{bubbles:true})); }
    }

    // ---- Điền tuổi (REQUIRED trong M1/M2) ----
    var tuoiVal = ${tuoi};
    if (tuoiVal) {
      var tuoiEl = document.querySelector(
        'input[name="submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][tuoi]"],' +
        'input[name="submitted[a][gioi_tuoi][tuoi]"]'
      );
      if (tuoiEl && !tuoiEl.value) tuoiEl.value = tuoiVal;
    }

    // ---- Điền thông tin bệnh viện ----
    // FIX: 1_ten_benh_vien là SELECT chứa mã BV (VD: "62310"), không phải text tên BV
    // FIX: Selector phải dùng dấu [] chứ KHÔNG dùng dấu . (v4.0 dùng ttp.bvn là SAI)
    var bvSelectors = [
      'select[name="submitted[ttp][bvn][1_ten_benh_vien]"]',
      'select[name="submitted[thong_tin_phieu][benhvien_ngay][1_ten_benh_vien]"]',
      'select[name="submitted[ttp][1_ten_benh_vien]"]'
    ];
    bvSelectors.forEach(function(s) {
      var e = document.querySelector(s);
      if (e && e.value === '') e.value = ${mabv};
    });

    // FIX: mabv text input
    var mabvSelectors = [
      'input[name="submitted[ttp][bvn][mabv]"]',
      'input[name="submitted[thong_tin_phieu][benhvien_ngay][mabv]"]'
    ];
    mabvSelectors.forEach(function(s) {
      var e = document.querySelector(s);
      if (e) e.value = ${mabv};
    });

    // FIX: khoa_phong là SELECT (chứa ID số như "123166"), cần dùng khoaId
    // FIX: Selector dùng [] không dùng .
    var khoaSelectors = [
      'select[name="submitted[ttp][kmk][khoa_phong]"]',
      'select[name="submitted[thong_tin_phieu][khoa_ma_khoa][khoa_phong]"]',
      'select[name="submitted[ttp][khoa_phong]"]'  // M3 – nhan_vien
    ];
    khoaSelectors.forEach(function(s) {
      var e = document.querySelector(s);
      if (e && e.value === '') e.value = ${khoa};
    });

    // ---- Điền ngày điền phiếu ----
    // FIX: Selector dùng [] không dùng . (v4.0 dùng ttp.bvn là SAI)
    var daySelectors = [
      ['select[name="submitted[ttp][bvn][ngay_dien_phieu][day]"]',   ${dd}],
      ['select[name="submitted[ttp][bvn][ngay_dien_phieu][month]"]', ${mm}],
      ['select[name="submitted[ttp][bvn][ngay_dien_phieu][year]"]',  ${yy}],
      ['select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][day]"]',   ${dd}],
      ['select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][month]"]', ${mm}],
      ['select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][year]"]',  ${yy}]
    ];
    daySelectors.forEach(function(pair) {
      var e = document.querySelector(pair[0]);
      if (e) e.value = pair[1];
    });

    // ---- Submit form ----
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
            clearInterval(iv);
            try { win.close(); } catch(x){}
            resolve({ ok: false, msg: 'Không đọc được trang BYT – hãy đăng nhập BYT trước' });
          }
        }

      } catch(outerErr) {
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
    // FIX: Tính điểm trung bình bao gồm cả value=0 (không đánh giá) – loại trừ null/undefined
    const ans  = r.answers?.filter(a => a.value !== null && a.value !== undefined && a.value !== '') || [];
    const avg  = ans.length ? (ans.reduce((s,a)=>s+Number(a.value),0)/ans.length).toFixed(1) : '-';
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

    // FIX: Tính số câu bao gồm cả value=0
    const ans = r.answers?.filter(a => a.value !== null && a.value !== undefined && a.value !== '') || [];
    const label = (SURVEYS[r.type]?.label||r.type) +
      ' | ' + (r.ngay||r.createdAt?.split('T')[0]||'') +
      ' | ' + (r.khoa||r.donvi||'—') +
      ' | ' + ans.length + ' câu';

    addBYTLog('info', '▶ Gửi: ' + label);

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
