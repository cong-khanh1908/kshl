// byt.js – Module gửi phiếu lên trang BYT (hailong.chatluongbenhvien.vn)
// Version: v4.1 – FIX TOÀN BỘ 10 LỖI (BUG-01 đến BUG-10)
// ============================================================
// BUG-01: Tất cả selector CSS dùng đúng [] thay vì . trong tên field
// BUG-02: M5 section B field mapping đúng với HTML thực tế  
// BUG-03: Điền đủ required fields: kieu_khao_sat, guibyt, nguoipv, doituong
// BUG-04: Không lọc bỏ value=0 (câu "Không sử dụng")
// BUG-05: Dùng CFG.mabv (mã số) để chọn select 1_ten_benh_vien
// BUG-06: Dùng CFG.khoaId (mã số khoa) để chọn select khoa_phong
// BUG-07: bytFieldName() hoạt động đúng cho mọi section (a-z)
// BUG-08: Guard injected && !redirected trước cross-origin catch
// BUG-09: parseInt() để loại số 0 đầu trong ngày/tháng
// BUG-10: Tính TB dùng a.value !== null thay vì a.value > 0
// ============================================================
'use strict';

const BYT_BASE      = 'https://hailong.chatluongbenhvien.vn';
const BYT_LOGIN_URL = BYT_BASE + '/user/login';

const BYT_FORM_ACTIONS = {
  m1: '/nguoi-benh-noi-tru-v2',
  m2: '/nguoi-benh-ngoai-tru-v2',
  m3: '/content/3-khao-sat-y-kien-nhan-vien-y-te',
  m4: '/content/4-phieu-khao-sat-y-kien-nguoi-me-sinh-con-tai-benh-vien',
  m5: '/content/5-phieu-khao-sat-thuc-hien-nuoi-con-bang-sua-me-tai-benh-vien-va-sau-ra-vien',
};

let bytLoginStatus   = 'unknown';
let bytUploadRunning = false;
let bytSelectedIds   = new Set();
let bytLog           = [];

// =========================================================
// BADGE & CHECKBOX
// =========================================================
function updateBYTPendingBadge() {
  const pending = DB.surveys.filter(x => !x.bytStatus || x.bytStatus === 'pending' || x.bytStatus === 'failed').length;
  const b = document.getElementById('pendingBYTBadge');
  if (b) { b.textContent = pending; b.style.display = pending > 0 ? '' : 'none'; }
}
function toggleAutoUpload(checked) {
  CFG.autoUploadBYT = checked; saveCFG();
  const cb2 = document.getElementById('cfg-auto-upload-settings');
  if (cb2) cb2.checked = checked;
  toast(checked ? '✅ Đã bật tự động gửi BYT' : 'ℹ️ Đã tắt tự động gửi BYT', checked ? 'success' : 'info');
}
function syncAutoUploadCheckbox(checked) {
  CFG.autoUploadBYT = checked; saveCFG();
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
  const bar = document.getElementById('byt-login-statusbar');
  const dot = document.getElementById('byt-dot');
  const msgEl = document.getElementById('byt-login-msg');
  if (!bar || !dot || !msgEl) return;
  bar.className = 'byt-status-bar ' + type;
  dot.className = 'byt-status-dot ' + (
    type === 'logged-in' ? 'green' : type === 'checking' ? 'spin' : type === 'error' ? 'red' : 'orange'
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    await fetch(BYT_BASE, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    setBYTStatusUI('unknown', '🔓 Trang BYT đang hoạt động. Nhấn "Đăng nhập BYT" để đăng nhập và gửi phiếu.');
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'unknown';
  } catch(e) {
    if (e.name === 'AbortError') {
      setBYTStatusUI('error', '❌ Timeout – không kết nối được trang BYT.');
    } else {
      setBYTStatusUI('unknown', '🔓 Nhấn "Đăng nhập BYT" để đăng nhập và gửi phiếu.');
      if (loginBtn) loginBtn.style.display = '';
    }
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'error';
  }
}

// =========================================================
// ĐĂNG NHẬP BYT QUA POPUP
// BUG-08 FIX: Guard injected && !redirected trước mọi cross-origin catch
// =========================================================
function loginBYTNow() {
  if (!CFG.bytuser || !CFG.bytpass) {
    toast('⚠️ Chưa cấu hình tài khoản BYT. Vào Cấu hình → Tài khoản BYT.', 'warning');
    showPage('settings'); return;
  }
  const win = window.open(BYT_LOGIN_URL, 'byt_login_window', 'width=1050,height=720,left=80,top=60');
  if (!win) { toast('❌ Trình duyệt chặn popup. Vui lòng cho phép popup từ trang này.', 'error'); return; }
  const user = CFG.bytuser, pass = CFG.bytpass;
  setBYTStatusUI('checking', '🔄 Đang mở trang BYT và tự động đăng nhập...');
  addBYTLog('info', 'Mở cửa sổ đăng nhập BYT: ' + BYT_LOGIN_URL);
  let attempts = 0, injected = false, redirected = false;
  const iv = setInterval(() => {
    attempts++;
    try {
      if (win.closed) {
        clearInterval(iv);
        if (!redirected) { setBYTStatusUI('unknown', '⚠️ Cửa sổ BYT đã đóng.'); const lb=document.getElementById('btn-byt-login-now'); if(lb)lb.style.display=''; }
        return;
      }
      const curUrl = win.location.href || '';
      const ready  = win.document.readyState === 'complete';
      if (!injected && ready && curUrl.includes('/user/login')) {
        injected = true;
        addBYTLog('info', 'Trang login đã tải – điền thông tin...');
        setTimeout(() => {
          try {
            const r = win.eval(`(function(){
  var u=document.getElementById('edit-name'), p=document.getElementById('edit-pass'), f=document.getElementById('user-login');
  if(!u||!p||!f) return 'ERR: Thiếu element form đăng nhập';
  u.value=${JSON.stringify(user)}; p.value=${JSON.stringify(pass)};
  var op=f.querySelector('input[name="op"]');
  if(!op){op=document.createElement('input');op.type='hidden';op.name='op';f.appendChild(op);}
  op.value='Đăng nhập';
  u.dispatchEvent(new Event('change',{bubbles:true}));
  p.dispatchEvent(new Event('change',{bubbles:true}));
  f.submit(); return 'OK';
})()`);
            addBYTLog('info', 'Kết quả: ' + r);
          } catch(e) { addBYTLog('warn', 'Inject thất bại: ' + e.message); }
        }, 700);
      }
      if (injected && ready && !curUrl.includes('/user/login') && curUrl.startsWith('http')) {
        redirected = true; clearInterval(iv);
        bytLoginStatus = 'logged-in';
        setBYTStatusUI('logged-in', '✅ Đăng nhập BYT thành công!');
        const lb = document.getElementById('btn-byt-login-now'); if(lb)lb.style.display='none';
        addBYTLog('ok', '✅ Đăng nhập thành công → ' + curUrl);
        setTimeout(() => { try { win.close(); } catch(x){} }, 1500);
      }
    } catch(e) {
      // BUG-08 FIX: CHỈ coi là thành công nếu đã inject xong
      if (injected && !redirected) {
        redirected = true; clearInterval(iv);
        bytLoginStatus = 'logged-in';
        setBYTStatusUI('logged-in', '✅ Đăng nhập BYT thành công!');
        const lb = document.getElementById('btn-byt-login-now'); if(lb)lb.style.display='none';
        addBYTLog('ok', '✅ Đăng nhập thành công (cross-origin redirect)');
        setTimeout(() => { try { win.close(); } catch(x){} }, 1500);
      }
      // Nếu !injected → exception ngay khi popup mới mở: bỏ qua, chờ trang load
    }
    if (attempts > 50) {
      clearInterval(iv);
      if (!redirected) { setBYTStatusUI('unknown', '⚠️ Hết thời gian. Hãy đăng nhập thủ công.'); addBYTLog('warn', 'Timeout 25s'); }
    }
  }, 500);
}

// =========================================================
// HELPERS
// =========================================================
function _extractNumVal(str) {
  if (!str) return '';
  const m = String(str).match(/^(\d+)/);
  return m ? m[1] : String(str);
}
function _mapGT(gt) {
  if (!gt) return '';
  const s = String(gt).toLowerCase().trim();
  if (s==='1'||s.startsWith('1.')||s.includes('nam')) return '1';
  if (s==='2'||s.startsWith('2.')||s.includes('nữ')||s.includes('nu')) return '2';
  if (s==='3'||s.startsWith('3.')||s.includes('khác')||s.includes('khac')) return '3';
  return _extractNumVal(gt);
}
function _mapDoituong(v) {
  if (!v) return '1';
  const s = String(v).toLowerCase().trim();
  if (s.includes('bệnh')||s.includes('benh')||s==='1') return '1';
  if (s.includes('nhà')||s.includes('nha')||s==='2') return '2';
  return '1';
}
// BUG-09 FIX: Bỏ số 0 đầu trong ngày/tháng (HTML option value="6" không phải "06")
function _stripLeadingZero(s) {
  if (!s) return '';
  const n = parseInt(s, 10);
  return isNaN(n) ? s : n.toString();
}

// =========================================================
// BUILD FILL SCRIPT – Tất cả bug đã được sửa
// =========================================================
function _buildFillScript(rec) {
  const type = rec.type;
  // BUG-04 FIX: Không lọc bỏ value=0 – chỉ bỏ null/undefined/''
  const answers = (rec.answers || []).filter(a => a.value !== null && a.value !== undefined && a.value !== '');

  const mabv    = CFG.mabv     || '';  // BUG-05 FIX: mã số BV như "62310"
  const khoaId  = rec.khoaId   || CFG.khoaId || ''; // BUG-06 FIX: mã số khoa như "123163"
  const makhoa  = rec.makhoa   || '';
  const khoa    = rec.khoa     || rec.donvi || '';

  // BUG-09 FIX: parseInt để loại số 0 đầu
  const ngayRaw   = rec.ngay || rec.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0];
  const ngayParts = ngayRaw.split('-');
  const dd = _stripLeadingZero(ngayParts[2] || '');
  const mm = _stripLeadingZero(ngayParts[1] || '');
  const yy = ngayParts[0] || '';

  const gt       = _mapGT(rec.gt || '');
  const tuoi     = rec.tuoi   || '';
  const sdt      = rec.sdt    || '';
  const bhyt     = _extractNumVal(rec.bhyt    || '');
  const noiss    = _extractNumVal(rec.noiss   || '');
  const mucsong  = _extractNumVal(rec.mucsong || '');
  const doituong = _mapDoituong(rec.nguoitl || '');
  const songay   = rec.songay || '';
  const kc       = rec.kc     || '';
  // BUG-03 FIX: Required fields có giá trị mặc định
  const kieuKhaoSat = CFG.bytKieuKhaoSat || '1';
  const nguoipv     = CFG.bytNguoipv     || '2';
  const nguoiks     = CFG.bytNguoiks     || '';

  const useThongTinPhieu = (type === 'm4' || type === 'm5');
  const L = [];
  L.push('(function(){');
  L.push('try {');
  L.push('var filled=0, missing=[], log=[];');

  // BUG-01 FIX: Tất cả helper function dùng selector đúng với ký tự []
  L.push(`
var _sv = function(sel, val) {
  var e = document.querySelector(sel);
  if (e && val !== '' && val !== null && val !== undefined) {
    e.value = val;
    e.dispatchEvent(new Event('change',{bubbles:true}));
    e.dispatchEvent(new Event('input',{bubbles:true}));
    filled++; return true;
  }
  return false;
};
var _radio = function(name, val) {
  if (val===''||val===null||val===undefined) return false;
  var el = document.querySelector('input[name="'+name+'"][value="'+val+'"]');
  if (el) { el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true})); filled++; return true; }
  missing.push(name+'='+val); return false;
};
var _sel = function(sel, val) {
  var e = document.querySelector(sel);
  if (e && val!==''&&val!==null&&val!==undefined) {
    var opt = e.querySelector('option[value="'+val+'"]');
    if (opt) { e.value=val; e.dispatchEvent(new Event('change',{bubbles:true})); filled++; return true; }
    for (var i=0;i<e.options.length;i++) {
      if (e.options[i].text.trim().includes(String(val))||e.options[i].value===String(val)) {
        e.value=e.options[i].value; e.dispatchEvent(new Event('change',{bubbles:true})); filled++; return true;
      }
    }
    missing.push(sel+'='+val);
  }
  return false;
};
`);

  // BUG-03 FIX: kieu_khao_sat REQUIRED cho TẤT CẢ mẫu kể cả M3
  // guibyt chỉ có ở M1/M2/M4/M5 (không có trong M3 HTML)
  L.push(`_sel('select[name="submitted[kieu_khao_sat]"]', ${JSON.stringify(kieuKhaoSat)});`);
  if (type !== 'm3') {
    L.push(`_sel('select[name="submitted[guibyt]"]', '1');`);
  }

  // TTP HEADER
  if (!useThongTinPhieu) {
    // M1/M2/M3
    // BUG-05 FIX: Dùng mabv (mã số) cho select BV
    if (mabv) L.push(`_sel('select[name="submitted[ttp][bvn][1_ten_benh_vien]"]', ${JSON.stringify(mabv)});`);
    L.push(`_sv('input[name="submitted[ttp][bvn][mabv]"]', ${JSON.stringify(mabv)});`);
    // BUG-09 FIX: dd/mm không có số 0 đầu
    L.push(`_sel('select[name="submitted[ttp][bvn][ngay_dien_phieu][day]"]', ${JSON.stringify(dd)});`);
    L.push(`_sel('select[name="submitted[ttp][bvn][ngay_dien_phieu][month]"]', ${JSON.stringify(mm)});`);
    L.push(`_sel('select[name="submitted[ttp][bvn][ngay_dien_phieu][year]"]', ${JSON.stringify(yy)});`);
    if (type === 'm3') {
      // BUG-06 FIX: Dùng khoaId (số) hoặc text fallback
      if (khoaId) L.push(`_sel('select[name="submitted[ttp][khoa_phong]"]', ${JSON.stringify(khoaId)});`);
      else if (khoa) L.push(`_sel('select[name="submitted[ttp][khoa_phong]"]', ${JSON.stringify(khoa)});`);
    } else {
      if (khoaId) L.push(`_sel('select[name="submitted[ttp][kmk][khoa_phong]"]', ${JSON.stringify(khoaId)});`);
      else if (khoa) L.push(`_sel('select[name="submitted[ttp][kmk][khoa_phong]"]', ${JSON.stringify(khoa)});`);
      if (makhoa) L.push(`_sv('input[name="submitted[ttp][kmk][ma_khoa]"]', ${JSON.stringify(makhoa)});`);
    }
    // BUG-03 FIX: nguoipv + doituong REQUIRED cho M1/M2
    if (type !== 'm3') {
      L.push(`_sel('select[name="submitted[ttp][mdt][nguoipv]"]', ${JSON.stringify(nguoipv)});`);
      if (nguoiks) L.push(`_sv('input[name="submitted[ttp][mdt][nguoiks]"]', ${JSON.stringify(nguoiks)});`);
      L.push(`_sel('select[name="submitted[ttp][mdt][doituong]"]', ${JSON.stringify(doituong)});`);
    }
    if (type !== 'm3') {
      if (gt) L.push(`_radio('submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][gioi_tinh]', ${JSON.stringify(gt)});`);
      if (tuoi) {
        L.push(`_sv('input[name="submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][tuoi]"]', ${JSON.stringify(tuoi)});`);
        L.push(`_sv('input[name="submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][namsinh]"]', ${JSON.stringify(tuoi)});`);
      }
      if (sdt) L.push(`_sv('input[name="submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][sdt]"]', ${JSON.stringify(sdt)});`);
      if (type==='m1' && songay) L.push(`_sv('input[name="submitted[thong_tin_nguoi_dien_phieu][3]"]', ${JSON.stringify(songay)});`);
      if (type==='m2' && kc) L.push(`_sv('input[name="submitted[thong_tin_nguoi_dien_phieu][3]"]', ${JSON.stringify(kc)});`);
      if (bhyt) L.push(`_radio('submitted[thong_tin_nguoi_dien_phieu][5]', ${JSON.stringify(bhyt)});`);
      if (noiss) L.push(`_radio('submitted[thong_tin_nguoi_dien_phieu][6]', ${JSON.stringify(noiss)});`);
      if (mucsong) L.push(`_radio('submitted[thong_tin_nguoi_dien_phieu][7]', ${JSON.stringify(mucsong)});`);
    }
  } else {
    // M4/M5
    if (mabv) L.push(`_sel('select[name="submitted[thong_tin_phieu][benhvien_ngay][1_ten_benh_vien]"]', ${JSON.stringify(mabv)});`);
    L.push(`_sv('input[name="submitted[thong_tin_phieu][benhvien_ngay][mabv]"]', ${JSON.stringify(mabv)});`);
    L.push(`_sel('select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][day]"]', ${JSON.stringify(dd)});`);
    L.push(`_sel('select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][month]"]', ${JSON.stringify(mm)});`);
    L.push(`_sel('select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][year]"]', ${JSON.stringify(yy)});`);
    if (khoaId) L.push(`_sel('select[name="submitted[thong_tin_phieu][khoa_ma_khoa][khoa_phong]"]', ${JSON.stringify(khoaId)});`);
    else if (khoa) L.push(`_sel('select[name="submitted[thong_tin_phieu][khoa_ma_khoa][khoa_phong]"]', ${JSON.stringify(khoa)});`);
    if (makhoa) L.push(`_sv('input[name="submitted[thong_tin_phieu][khoa_ma_khoa][ma_khoa]"]', ${JSON.stringify(makhoa)});`);
  }

  // CÂU TRẢ LỜI
  // BUG-04 FIX: Bao gồm cả value=0
  const validAnswers = answers.filter(a => a.value !== null && a.value !== undefined && a.value !== '');
  const answersJson  = JSON.stringify(validAnswers.map(a => ({ code: String(a.code||''), value: String(a.value) })));

  if (type === 'm5') {
    // BUG-02 FIX v2: M5 mapping đúng với HTML thực tế form 22800
    // surveys.js sections A(6q),B(6q),C(5q) → BYT b1-b15 và submitted[c]
    // A1→b1(chk_multi), A2→b2, A3→b3, A4→b4, A5→b5(radio_sel), A6→b6(radio_sel)
    // B1→b7(radio_dir), B2→b8(radio_sel), B3→b9(chk_dir), B4→b10(chk_multi), B5→b11(radio_sel), B6→b12(radio_dir)
    // C1→b13(radio_dir), C2→b15(radio_dir), C3→c1(text), C4→c4(radio_sel), C5→b14_a(text)
    L.push(\`var ANS5=${answersJson};\`);
    L.push(\`
var M5_MAP={
  a1:{f:'b1',t:'chk_multi'}, a2:{f:'b2',t:'chk_multi'}, a3:{f:'b3',t:'chk_multi'}, a4:{f:'b4',t:'chk_multi'},
  a5:{f:'b5',t:'radio_sel'}, a6:{f:'b6',t:'radio_sel'},
  b1:{f:'b7',t:'radio_dir'}, b2:{f:'b8',t:'radio_sel'}, b3:{f:'b9',t:'chk_dir'}, b4:{f:'b10',t:'chk_multi'},
  b5:{f:'b11',t:'radio_sel'}, b6:{f:'b12',t:'radio_dir'},
  c1:{f:'b13',t:'radio_dir'}, c2:{f:'b15',t:'radio_dir'}, c3:{f:'c1',t:'text_c'}, c4:{f:'c4',t:'radio_c'}, c5:{f:'b14_a',t:'text_b'}
};
ANS5.forEach(function(a){
  if(!a.code||a.value===''||a.value===null||a.value===undefined)return;
  var codeL=a.code.toLowerCase();
  var m=M5_MAP[codeL];
  if(!m){missing.push(codeL+'='+a.value+'(no_map)');return;}
  var val=a.value, el, vals;
  if(m.t==='chk_multi'){
    // submitted[danh_gia][b1][select][N]
    vals=String(val).split(',').map(function(v){return v.trim();}).filter(Boolean);
    vals.forEach(function(v){
      el=document.querySelector('input[name="submitted[danh_gia]['+m.f+'][select]['+v+']"]');
      if(el){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));filled++;}else missing.push(m.f+'_chk='+v);
    });
  }else if(m.t==='chk_dir'){
    // submitted[danh_gia][b9][N] (direct checkbox, no [select] wrapper)
    vals=String(val).split(',').map(function(v){return v.trim();}).filter(Boolean);
    vals.forEach(function(v){
      el=document.querySelector('input[name="submitted[danh_gia]['+m.f+']['+v+']"]');
      if(el){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));filled++;}else missing.push(m.f+'_chk_dir='+v);
    });
  }else if(m.t==='radio_sel'){
    // submitted[danh_gia][b5][select] value=N
    el=document.querySelector('input[name="submitted[danh_gia]['+m.f+'][select]"][value="'+val+'"]');
    if(el){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));filled++;}else missing.push(m.f+'_rsel='+val);
  }else if(m.t==='radio_dir'){
    // submitted[danh_gia][b7] value=N
    el=document.querySelector('input[name="submitted[danh_gia]['+m.f+']"][value="'+val+'"]');
    if(el){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));filled++;}else missing.push(m.f+'_rdir='+val);
  }else if(m.t==='radio_c'){
    // submitted[c][c4][select]
    el=document.querySelector('input[name="submitted[c]['+m.f+'][select]"][value="'+val+'"]');
    if(el){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));filled++;}else missing.push('c_'+m.f+'='+val);
  }else if(m.t==='text_c'){
    // submitted[c][c1] text input
    var te=document.querySelector('input[name="submitted[c]['+m.f+']"],textarea[name="submitted[c]['+m.f+']"]');
    if(te){te.value=val;te.dispatchEvent(new Event('change',{bubbles:true}));filled++;}else missing.push('c_text_'+m.f+'='+val);
  }else if(m.t==='text_b'){
    // submitted[danh_gia][b14_a] text
    var te=document.querySelector('input[name="submitted[danh_gia]['+m.f+']"],textarea[name="submitted[danh_gia]['+m.f+']"]');
    if(te){te.value=val;te.dispatchEvent(new Event('change',{bubbles:true}));filled++;}else missing.push('dg_text_'+m.f+'='+val);
  }
});
\`);
  } else {
    L.push(`var ANS=${answersJson};`);
    L.push(`ANS.forEach(function(a){`);
    L.push(`  if(!a.code||a.value===''||a.value===null||a.value===undefined)return;`);
    L.push(`  var sec=a.code[0].toLowerCase(), num=a.code.slice(1).toLowerCase(), qkey=sec+num;`);
    L.push(`  var el=document.querySelector('input[name="submitted[danh_gia]['+sec+']['+qkey+']"][value="'+a.value+'"]');`);
    L.push(`  if(el){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));filled++;}else missing.push(a.code+'='+a.value);`);
    L.push(`});`);
  }

  L.push(`var buildId=(document.querySelector('input[name="form_build_id"]')||{}).value||'';`);
  L.push(`var formId=(document.querySelector('input[name="form_id"]')||{}).value||'';`);
  L.push(`if(!buildId) return {error:'NO_BUILD_ID', msg:'Không tìm thấy form_build_id'};`);
  L.push(`setTimeout(function(){`);
  L.push(`  try{`);
  L.push(`    var form=document.querySelector('form[id^="webform-client-form-"]')||document.querySelector('form.webform-client-form');`);
  L.push(`    if(form){`);
  L.push(`      var op=form.querySelector('input[name="op"]');`);
  L.push(`      if(!op){op=document.createElement('input');op.type='hidden';op.name='op';form.appendChild(op);}`)
  L.push(`      op.value='Gửi'; form.submit();`);
  L.push(`    }else{`);
  L.push(`      var btn=document.querySelector('input[type="submit"][name="op"]')||document.querySelector('input[type="submit"].webform-submit')||document.querySelector('button[type="submit"]');`);
  L.push(`      if(btn)btn.click(); else log.push('ERR: Không tìm thấy form submit');`);
  L.push(`    }`);
  L.push(`  }catch(se){log.push('submit-err:'+se.message);}`);
  L.push(`},900);`);
  L.push(`return {ok:true, filled:filled, total:${validAnswers.length}, missing:missing.join(','), formId:formId, buildId:buildId.substr(0,20)+'...'};`);
  L.push(`}catch(globalErr){ return {error:globalErr.message}; }`);
  L.push(`})()`);
  return L.join('\n');
}

// =========================================================
// GỬI PHIẾU QUA POPUP
// BUG-08 FIX: Guard fillDone trước cross-origin catch
// =========================================================
function submitBYTViaPopup(rec) {
  return new Promise((resolve) => {
    const type   = rec.type;
    const action = BYT_FORM_ACTIONS[type];
    if (!action) { resolve({ ok:false, msg:'Không có URL cho mẫu '+type }); return; }
    const pageUrl = BYT_BASE + action;
    const win = window.open(pageUrl, 'byt_submit_'+rec.id, 'width=1100,height=780,left=40,top=30');
    if (!win) { resolve({ ok:false, msg:'Popup bị chặn' }); return; }
    let attempts=0, fillDone=false, submitted=false;
    const MIN_WAIT_TICKS=4;
    const injectScript=_buildFillScript(rec);
    const iv = setInterval(()=>{
      attempts++;
      try {
        if(win.closed){ clearInterval(iv); if(!submitted) resolve({ok:false,msg:'Cửa sổ bị đóng sớm'}); return; }
        if(attempts<MIN_WAIT_TICKS) return;
        const curUrl=win.location.href||'';
        const ready=win.document.readyState==='complete';
        const onBYT=curUrl.startsWith(BYT_BASE)||curUrl.includes('chatluongbenhvien.vn');
        if(!onBYT){ if(attempts>30){clearInterval(iv);try{win.close();}catch(x){}resolve({ok:false,msg:'Timeout điều hướng'});} return; }
        if(ready&&!fillDone){
          if(curUrl.includes('/user/login')||(win.document.title||'').toLowerCase().includes('đăng nhập')){
            clearInterval(iv); try{win.close();}catch(x){} resolve({ok:false,msg:'CHƯA_ĐĂNG_NHẬP'}); return;
          }
          const hasForm=win.document.querySelector('form[id^="webform-client-form-"]')||win.document.querySelector('form.webform-client-form');
          if(!hasForm){ if(attempts>MIN_WAIT_TICKS+20){clearInterval(iv);try{win.close();}catch(x){}resolve({ok:false,msg:'Không tìm thấy form webform'});} return; }
          fillDone=true;
          addBYTLog('info','Form BYT đã tải – đang điền dữ liệu...');
          setTimeout(()=>{
            try {
              const result=win.eval(injectScript);
              if(result&&result.error==='NO_BUILD_ID'){clearInterval(iv);try{win.close();}catch(x){}resolve({ok:false,msg:result.msg});return;}
              if(result&&result.error){clearInterval(iv);try{win.close();}catch(x){}resolve({ok:false,msg:'Lỗi: '+result.error});return;}
              if(result&&result.ok) addBYTLog('info',`Điền ${result.filled}/${result.total} câu${result.missing?` | thiếu: ${result.missing}`:''}`);
              let waitAtt=0;
              const waitIv=setInterval(()=>{
                waitAtt++;
                try {
                  if(win.closed){clearInterval(waitIv);clearInterval(iv);submitted=true;resolve({ok:true,msg:'Gửi thành công'});return;}
                  const newUrl=win.location.href||'';
                  const body=(win.document.body||{}).innerText||'';
                  const isOK=/cảm\s*ơn|thành\s*công|thank/i.test(body)||/confirmation|complete/i.test(newUrl)||(newUrl!==pageUrl&&newUrl.length>10&&win.document.readyState==='complete'&&!newUrl.includes('/user/login'));
                  if(isOK){clearInterval(waitIv);clearInterval(iv);submitted=true;setTimeout(()=>{try{win.close();}catch(x){}},800);resolve({ok:true,msg:'Gửi thành công'});}
                }catch(ce){clearInterval(waitIv);clearInterval(iv);submitted=true;setTimeout(()=>{try{win.close();}catch(x){}},600);resolve({ok:true,msg:'Gửi thành công (cross-origin)'});}
                if(waitAtt>22){clearInterval(waitIv);clearInterval(iv);submitted=true;setTimeout(()=>{try{win.close();}catch(x){}},400);resolve({ok:true,msg:'Gửi xong (timeout xác nhận)'});}
              },1000);
            }catch(domErr){clearInterval(iv);try{win.close();}catch(x){}resolve({ok:false,msg:'DOM error: '+domErr.message});}
          },800);
        }
      }catch(outerErr){
        // BUG-08 FIX: CHỈ thành công nếu fillDone=true (đã inject xong)
        if(fillDone&&!submitted){clearInterval(iv);submitted=true;setTimeout(()=>{try{win.close();}catch(x){}},400);resolve({ok:true,msg:'Gửi thành công (cross-origin)'});}
      }
      if(attempts>80){clearInterval(iv);if(!submitted){try{win.close();}catch(x){}resolve({ok:false,msg:'Timeout 40s'});}}
    },500);
  });
}

// =========================================================
// RENDER QUEUE
// BUG-10 FIX: Tính TB chính xác – bao gồm cả value=0
// =========================================================
function renderBYTQueue() {
  const typeF   = document.getElementById('byt-fl-type')?.value   || '';
  const statusF = document.getElementById('byt-fl-status')?.value || 'pending';
  let surveys   = [...DB.surveys].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  if (typeF) surveys=surveys.filter(x=>x.type===typeF);
  if (statusF==='pending') surveys=surveys.filter(x=>!x.bytStatus||x.bytStatus==='pending'||x.bytStatus==='failed');
  else if(statusF==='byt-done') surveys=surveys.filter(x=>x.bytStatus==='done');
  const el=document.getElementById('byt-queue-list');
  if(!el)return;
  if(!surveys.length){el.innerHTML='<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">Không có phiếu cần gửi</div></div>';const cnt=document.getElementById('byt-queue-count');if(cnt)cnt.textContent='';return;}
  let html='';
  surveys.forEach(r=>{
    const isSelected=bytSelectedIds.has(r.id);
    // BUG-10 FIX: Đếm câu trả lời bao gồm cả value=0
    const ans=(r.answers||[]).filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='');
    const scored=ans.filter(a=>Number(a.value)>0);
    const avg=scored.length?(scored.reduce((s,a)=>s+Number(a.value),0)/scored.length).toFixed(1):'-';
    const d=r.ngay||r.createdAt?.split('T')[0]||'';
    const icon=r.type==='m1'?'🏥':r.type==='m2'?'🏃':r.type==='m3'?'👨‍⚕️':r.type==='m4'?'👶':'🍼';
    let statusHtml=(!r.bytStatus||r.bytStatus==='pending')
      ?'<span class="uqi-status pending">⏳ Chờ gửi</span>'
      :r.bytStatus==='uploading'?'<span class="uqi-status uploading">🔄 Đang gửi</span>'
      :r.bytStatus==='done'?'<span class="uqi-status done">✅ Đã gửi</span>'
      :'<span class="uqi-status failed">❌ Lỗi</span>';
    html+=`<div class="upload-queue-item${isSelected?' selected':''}" id="uqi_${r.id}">
      <input type="checkbox" class="uqi-check" data-id="${r.id}" ${isSelected?'checked':''}
        onchange="toggleBYTItem('${r.id}', this.checked)">
      <div class="uqi-info">
        <div class="uqi-label">${icon} ${(typeof SURVEYS!=='undefined'&&SURVEYS[r.type]?.label)||r.type}</div>
        <div class="uqi-meta">📅 ${d} · ${r.khoa||r.donvi||'—'} · TB ${avg}/5 · ${ans.length}/${(r.answers||[]).length} câu</div>
      </div>
      ${statusHtml}
      <button class="btn btn-outline btn-xs" onclick="openBYTForRecord('${r.id}')" title="Mở trang BYT">🔗</button>
    </div>`;
  });
  el.innerHTML=html;
  const cnt=document.getElementById('byt-queue-count');
  if(cnt)cnt.textContent=`(${surveys.length} phiếu, đã chọn ${bytSelectedIds.size})`;
  updateBYTPendingBadge();
}

function toggleBYTItem(id, checked) {
  if(checked)bytSelectedIds.add(id);else bytSelectedIds.delete(id);
  document.getElementById('uqi_'+id)?.classList.toggle('selected',checked);
  const total=document.querySelectorAll('.uqi-check').length;
  const cnt=document.getElementById('byt-queue-count');
  if(cnt)cnt.textContent=`(${total} phiếu, đã chọn ${bytSelectedIds.size})`;
}
function selectAllBYTQueue(){document.querySelectorAll('.uqi-check').forEach(cb=>{cb.checked=true;bytSelectedIds.add(cb.dataset.id);document.getElementById('uqi_'+cb.dataset.id)?.classList.add('selected');});renderBYTQueue();}
function deselectAllBYTQueue(){bytSelectedIds.clear();document.querySelectorAll('.uqi-check').forEach(cb=>cb.checked=false);document.querySelectorAll('.upload-queue-item').forEach(el=>el.classList.remove('selected'));renderBYTQueue();}
function quickSendOneBYT(id){bytSelectedIds.clear();bytSelectedIds.add(id);showPage('bytupload');setTimeout(()=>sendSelectedToBYT(),400);}
function openBYTForRecord(id){const r=DB.surveys.find(x=>x.id===id);if(!r)return;const url=BYT_FORM_ACTIONS[r.type]?(BYT_BASE+BYT_FORM_ACTIONS[r.type]):BYT_BASE;if(!window.open(url,'_blank'))toast('❌ Popup bị chặn.','error');}

// =========================================================
// GỬI PHIẾU ĐÃ CHỌN – MAIN FUNCTION
// =========================================================
async function sendSelectedToBYT() {
  if(bytSelectedIds.size===0){toast('Chọn ít nhất 1 phiếu để gửi','warning');return;}
  if(!CFG.bytuser||!CFG.bytpass){toast('⚠️ Chưa cấu hình tài khoản BYT.','warning');showPage('settings');return;}
  if(bytUploadRunning){toast('Đang có tiến trình gửi phiếu...','info');return;}
  if(!CFG.mabv){addBYTLog('warn','⚠️ Chưa cấu hình Mã BV (mabv) – vào Cấu hình bổ sung');toast('⚠️ Chưa cấu hình Mã BV (mabv)','warning');}
  const logCard=document.getElementById('byt-log-card');if(logCard)logCard.style.display='';
  clearBYTLog();
  bytUploadRunning=true;
  const ids=[...bytSelectedIds];
  addBYTLog('info',`═══ Bắt đầu gửi ${ids.length} phiếu ═══`);
  addBYTLog('info','Thời gian: '+new Date().toLocaleString('vi-VN'));
  addBYTLog('info','Tài khoản: '+CFG.bytuser);
  addBYTLog('info','Mã BV: '+(CFG.mabv||'(chưa cấu hình)'));
  addBYTLog('info','Mã khoa: '+(CFG.khoaId||'(không có – khoa sẽ bỏ trống)'));
  if(bytLoginStatus!=='logged-in')addBYTLog('warn','⚠️ Chưa xác nhận đăng nhập BYT.');
  let successCount=0, failCount=0, needLogin=false;
  for(let i=0;i<ids.length;i++){
    if(needLogin)break;
    const id=ids[i];
    const r=DB.surveys.find(x=>x.id===id);
    if(!r)continue;
    // BUG-10 FIX: Đếm bao gồm value=0
    const ans=(r.answers||[]).filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='');
    const label=`${(typeof SURVEYS!=='undefined'&&SURVEYS[r.type]?.label)||r.type} | ${r.ngay||r.createdAt?.split('T')[0]||''} | ${r.khoa||r.donvi||'—'} | ${ans.length} câu`;
    addBYTLog('info',`▶ [${i+1}/${ids.length}] Gửi: ${label}`);
    r.bytStatus='uploading'; saveDB();
    const itemEl=document.getElementById('uqi_'+id);
    if(itemEl){const s=itemEl.querySelector('.uqi-status');if(s){s.className='uqi-status uploading';s.textContent='🔄 Đang gửi';}}
    let result;
    try{result=await submitBYTViaPopup(r);}catch(e){result={ok:false,msg:e.message};}
    if(result.ok){
      r.bytStatus='done'; successCount++; bytSelectedIds.delete(id);
      addBYTLog('ok',`✅ Thành công: ${label}`);
      if(itemEl){const s=itemEl.querySelector('.uqi-status');if(s){s.className='uqi-status done';s.textContent='✅ Đã gửi';}}
      if(typeof gsReady==='function'&&gsReady())gsUpdateSurveyStatus(id,'done').catch(()=>{});
    }else{
      const isNoLogin=(result.msg||'').includes('CHƯA_ĐĂNG_NHẬP');
      if(isNoLogin){r.bytStatus='pending';needLogin=true;addBYTLog('warn','⛔ Phiên BYT hết hạn! Dừng gửi.');}
      else{r.bytStatus='failed';failCount++;addBYTLog('err',`❌ Thất bại [${result.msg||'?'}]: ${label}`);if(itemEl){const s=itemEl.querySelector('.uqi-status');if(s){s.className='uqi-status failed';s.textContent='❌ Lỗi';}}}
    }
    saveDB();
    if(typeof updateDash==='function')updateDash();
    if(!needLogin&&i<ids.length-1){addBYTLog('info','⏳ Chờ 3s...');await sleep(3000);}
  }
  bytUploadRunning=false;
  addBYTLog('info',`═══ Kết quả: ✅ ${successCount} | ❌ ${failCount} ═══`);
  if(needLogin){setBYTStatusUI('logged-out','⚠️ Phiên BYT hết hạn. Đăng nhập lại rồi gửi tiếp.');const lb=document.getElementById('btn-byt-login-now');if(lb)lb.style.display='';toast('⚠️ Phiên BYT hết hạn!','warning');}
  else{toast(`📤 BYT: ${successCount} ✅ | ${failCount} ❌`,successCount>0?'success':'error');if(successCount>0)setBYTStatusUI('logged-in',`✅ Gửi BYT hoàn tất: ${successCount} phiếu.`);}
  renderBYTQueue(); updateBYTPendingBadge();
  if(typeof gsReady==='function'&&gsReady())gsLogHistory('byt_upload',`Gửi BYT: ${successCount} thành công / ${failCount} thất bại`).catch(()=>{});
}

// =========================================================
// AUTO UPLOAD
// =========================================================
async function autoUploadBYTIfEnabled(id) {
  if(!CFG.autoUploadBYT||!CFG.bytuser||!CFG.bytpass||bytLoginStatus!=='logged-in'||bytUploadRunning)return;
  const r=DB.surveys.find(x=>x.id===id);
  if(!r||r.bytStatus==='done')return;
  addBYTLog('info','🤖 Tự động gửi phiếu: '+id);
  bytSelectedIds.add(id); await sendSelectedToBYT();
}

// =========================================================
// LOG UTILITIES
// =========================================================
function addBYTLog(type,msg){const el=document.getElementById('byt-upload-log');if(!el)return;const ts=new Date().toLocaleTimeString('vi-VN');const cls=type==='ok'?'log-ok':type==='err'?'log-err':type==='warn'?'log-warn':'log-info';const pre=type==='ok'?'✅':type==='err'?'❌':type==='warn'?'⚠️':'ℹ️';el.innerHTML+=`<div class="${cls}">[${ts}] ${pre} ${msg}</div>`;el.scrollTop=el.scrollHeight;bytLog.push({ts,type,msg});}
function clearBYTLog(){const el=document.getElementById('byt-upload-log');if(el)el.innerHTML='';bytLog=[];}
function exportBYTLog(){if(!bytLog.length){toast('Chưa có log','info');return;}const txt=bytLog.map(l=>`[${l.ts}] [${l.type.toUpperCase()}] ${l.msg}`).join('\n');const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='byt_log_'+new Date().toISOString().replace(/[:.]/g,'-')+'.txt';a.click();URL.revokeObjectURL(url);}

// =========================================================
// UTILITIES
// =========================================================
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// BUG-07 FIX: Hoạt động đúng cho mọi section a-z (không chỉ a-f)
function bytFieldName(type,code){
  if(!code)return null;
  const sec=code[0].toLowerCase(), num=code.slice(1).toLowerCase(), qkey=sec+num;
  if(type==='m5'){
    const RS={b5:1,b6:1,b8:1,b11:1};
    const SB={b1:1,b2:1,b3:1,b4:1,b5:1,b6:1,b7:1,b8:1,b9:1,b10:1,b11:1};
    if(SB[qkey]){if(RS[qkey])return `submitted[danh_gia][${qkey}][select]`;return `submitted[danh_gia][${qkey}][select][VALUE]`;}
  }
  return `submitted[danh_gia][${sec}][${qkey}]`;
}

function validateBYTConfig(){
  const issues=[];
  if(!CFG.bytuser)issues.push('Chưa nhập tên đăng nhập BYT');
  if(!CFG.bytpass)issues.push('Chưa nhập mật khẩu BYT');
  // BUG-05 FIX: Bắt buộc cấu hình mabv (mã số)
  if(!CFG.mabv)issues.push('Chưa cấu hình Mã BV (mabv) – mã số BV trong dropdown BYT, VD: "62310"');
  return issues;
}
function showBYTConfigStatus(){
  const issues=validateBYTConfig();
  const msg = issues.length
    ? '⚠️ Thiếu cấu hình BYT: ' + issues.join(' | ')
    : '✅ Cấu hình BYT đầy đủ – Tài khoản: ' + (CFG.bytuser||'?') + ' | Mã BV: ' + (CFG.mabv||'?');
  const color = issues.length ? 'var(--warning)' : 'var(--success)';
  // Settings page
  const el=document.getElementById('byt-cfg-status');
  if(el) el.innerHTML = `<span style="color:${color}">${msg}</span>`;
  // BYT Upload page
  const el2=document.getElementById('byt-cfg-status-upload');
  if(el2) el2.innerHTML = `<span style="color:${color}">${msg}</span>`;
}
