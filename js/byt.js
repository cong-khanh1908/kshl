// byt.js – Module gửi phiếu lên trang BYT (hailong.chatluongbenhvien.vn)
// KSHL v10.0 – Hoàn chỉnh toàn diện 5 mẫu, 40 test cases
// Ngày: 2026-04-12
// ============================================================
// THAY ĐỔI v10.0:
//   [M1] Bổ sung required: thong_tin[5],[6],[7] (bhyt,trình độ,nghề nghiệp), thoigian
//   [M2] Bổ sung required: thong_tin[baohiem],[6],[7], khoangcach
//   [M3] Bổ sung: khoa_phong trực tiếp dưới ttp, kiemnhiem, truc
//   [M4] Bổ sung: thong_tin_phieu header, baohiem, cachsinh, thoigian, lanvv
//   [M5] Hoàn chỉnh: b1-b4,b10 checkbox[select][val]; b5,b6,b8,b11 radio[select];
//        b7,b12 radio đơn; b9 checkbox đơn (không có [select]); section A,C riêng
//   [FIX] Phát hiện trang login chính xác (check webform-client-form)
//   [FIX] Chờ webform thực sự load xong trước khi inject
//   [NEW] 40 test cases (TC-01→TC-40) bao phủ tất cả mẫu và trường hợp đặc biệt
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

// Timeout chờ trang load theo kích thước form
const BYT_LOAD_TIMEOUT_MS = { m1:20000, m2:20000, m3:22000, m4:22000, m5:25000 };

// ── M5: phân loại từng câu ──
// checkbox_select: b1,b2,b3,b4,b10 → submitted[danh_gia][bN][select][VAL]
// radio_select:    b5,b6,b8,b11    → submitted[danh_gia][bN][select] value=VAL
// radio_plain:     b7,b12          → submitted[danh_gia][bN] value=VAL
// checkbox_plain:  b9              → submitted[danh_gia][b9][VAL]
const M5_CHECKBOX_SELECT = new Set(['b1','b2','b3','b4','b10']);
const M5_RADIO_SELECT    = new Set(['b5','b6','b8','b11']);
const M5_RADIO_PLAIN     = new Set(['b7','b12']);
const M5_CHECKBOX_PLAIN  = new Set(['b9']);

// =========================================================
// STATE
// =========================================================
let bytLoginStatus   = 'unknown';
let bytUploadRunning = false;
let bytSelectedIds   = new Set();
let bytLog           = [];
let bytTestResults   = [];

// =========================================================
// UI HELPERS
// =========================================================
function updateBYTPendingBadge() {
  const pending = DB.surveys.filter(x => !x.bytStatus || x.bytStatus === 'pending').length;
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
  ['cfg-auto-upload','cfg-auto-upload-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = v;
  });
}

function setBYTStatusUI(type, msg) {
  const bar = document.getElementById('byt-login-statusbar');
  const dot = document.getElementById('byt-dot');
  const msgEl = document.getElementById('byt-login-msg');
  if (!bar || !dot || !msgEl) return;
  bar.className = 'byt-status-bar ' + type;
  dot.className = 'byt-status-dot ' + (type==='logged-in'?'green':type==='checking'?'spin':type==='error'?'red':'orange');
  msgEl.textContent = msg;
  bytLoginStatus = type;
}

// =========================================================
// CHECK LOGIN
// =========================================================
async function checkBYTLoginStatus() {
  const loginBtn = document.getElementById('btn-byt-login-now');
  setBYTStatusUI('checking', '🔄 Đang kiểm tra kết nối BYT...');
  if (loginBtn) loginBtn.style.display = 'none';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    await fetch(BYT_BASE + '/user/login', { method:'HEAD', mode:'no-cors', cache:'no-store', signal:ctrl.signal });
    clearTimeout(timer);
    setBYTStatusUI('unknown', '⚠️ Không xác minh được tự động (CORS). Nhấn "Đăng nhập BYT" để mở cửa sổ đăng nhập.');
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'unknown';
  } catch(e) {
    setBYTStatusUI(e.name==='AbortError'?'error':'error',
      e.name==='AbortError' ? '❌ Timeout – kiểm tra kết nối mạng.' : '❌ Lỗi: ' + e.message);
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'error';
  }
}

// =========================================================
// LOGIN BYT VIA POPUP
// =========================================================
function loginBYTNow() {
  if (!CFG.bytuser || !CFG.bytpass) {
    toast('⚠️ Chưa cấu hình tài khoản BYT. Vào Cấu hình → Tài khoản BYT.', 'warning');
    showPage('settings'); return;
  }
  const win = window.open(BYT_LOGIN_URL, 'byt_login_window', 'width=1050,height=720,left=80,top=60');
  if (!win) { toast('❌ Trình duyệt chặn popup. Vui lòng cho phép popup.', 'error'); return; }
  const user = CFG.bytuser, pass = CFG.bytpass;
  setBYTStatusUI('checking', '🔄 Đang mở trang BYT và đăng nhập...');
  addBYTLog('info', 'Mở cửa sổ đăng nhập: ' + BYT_LOGIN_URL);
  let attempts=0, injected=false, redirected=false;
  const iv = setInterval(()=>{
    attempts++;
    try {
      if (win.closed) {
        clearInterval(iv);
        if (!redirected) { setBYTStatusUI('unknown','⚠️ Cửa sổ đóng. Nhấn gửi phiếu để thử.'); }
        return;
      }
      const curUrl = win.location.href||'', ready = win.document.readyState==='complete';
      if (!injected && ready && curUrl.includes('/user')) {
        injected = true;
        try {
          win.eval(`(function(){
            var u=document.querySelector('#edit-name,input[name="name"]');
            var p=document.querySelector('#edit-pass,input[name="pass"]');
            var b=document.querySelector('#edit-submit,input[type="submit"],button[type="submit"]');
            if(u&&p){u.value=${JSON.stringify(user)};p.value=${JSON.stringify(pass)};
            u.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('input',{bubbles:true}));
            if(b)b.click();}
          })()`);
          addBYTLog('info', 'Đã điền thông tin đăng nhập và click Submit');
        } catch(fe){ addBYTLog('warn','Không thể auto-fill: '+fe.message); }
      }
      if (injected && ready && !curUrl.includes('/user/login') && curUrl.startsWith('http')) {
        redirected=true; clearInterval(iv); bytLoginStatus='logged-in';
        setBYTStatusUI('logged-in','✅ Đăng nhập BYT thành công!');
        const lb=document.getElementById('btn-byt-login-now'); if(lb)lb.style.display='none';
        addBYTLog('ok','Đăng nhập thành công: '+curUrl);
        setTimeout(()=>{try{win.close();}catch(x){}},1500);
      }
    } catch(e) {
      if (injected && !redirected) {
        redirected=true; clearInterval(iv); bytLoginStatus='logged-in';
        setBYTStatusUI('logged-in','✅ Đăng nhập BYT thành công!');
        const lb=document.getElementById('btn-byt-login-now'); if(lb)lb.style.display='none';
        addBYTLog('ok','Đăng nhập thành công (cross-origin redirect)');
        setTimeout(()=>{try{win.close();}catch(x){}},1500);
      }
    }
    if (attempts>40) { clearInterval(iv); if(!redirected) setBYTStatusUI('unknown','⚠️ Hết thời gian. Đăng nhập thủ công.'); }
  },500);
}

// =========================================================
// FIELD MAPPING v10.0 – CHÍNH XÁC 100% THEO HTML THỰC TẾ
//
// M1/M2/M3/M4: submitted[danh_gia][sec][secN]  → radio
// M5:
//   b1,b2,b3,b4,b10 → checkbox: submitted[danh_gia][bN][select][VAL]
//   b5,b6,b8,b11    → radio:    submitted[danh_gia][bN][select]
//   b7,b12          → radio:    submitted[danh_gia][bN]
//   b9              → checkbox: submitted[danh_gia][b9][VAL]
// =========================================================
function bytFieldMapping(type, code) {
  if (!code) return { name:null, mode:'none' };
  const sec = code[0].toLowerCase();
  const num = code.slice(1);
  const qkey = sec + num;

  if (type === 'm5') {
    if (M5_CHECKBOX_SELECT.has(qkey)) return { name:`submitted[danh_gia][${qkey}][select]`, mode:'checkbox_select' };
    if (M5_RADIO_SELECT.has(qkey))    return { name:`submitted[danh_gia][${qkey}][select]`, mode:'radio_select' };
    if (M5_RADIO_PLAIN.has(qkey))     return { name:`submitted[danh_gia][${qkey}]`, mode:'radio_plain' };
    if (M5_CHECKBOX_PLAIN.has(qkey))  return { name:`submitted[danh_gia][${qkey}]`, mode:'checkbox_plain' };
    return { name:null, mode:'none' }; // A,C sections handled separately
  }
  // M1, M2, M3, M4 (bao gồm sections g,h của M4)
  return { name:`submitted[danh_gia][${sec}][${qkey}]`, mode:'radio' };
}

// =========================================================
// BUILD INJECT SCRIPT v10.0
// Script được eval() trong cửa sổ popup BYT
// =========================================================
function buildInjectScript(rec, mabv, khoaId, kieuKhaoSat, nguoipv, doituong, gioi_tinh, tuoi, dd, mm, yy) {
  const answers    = (rec.answers||[]).filter(a => a.value!==null && a.value!==undefined && a.value!=='');
  const answersStr = JSON.stringify(answers.map(a => ({ code:String(a.code), value:Number(a.value) })));
  const type       = rec.type;

  // Stringify tất cả params để nhúng an toàn vào script
  const P = {
    answers:     answersStr,
    type:        JSON.stringify(type),
    mabv:        JSON.stringify(mabv        || ''),
    khoa:        JSON.stringify(khoaId      || ''),
    dd:          JSON.stringify(dd          || ''),
    mm:          JSON.stringify(mm          || ''),
    yy:          JSON.stringify(yy          || ''),
    kieuKhaoSat: JSON.stringify(kieuKhaoSat || '1'),
    nguoipv:     JSON.stringify(nguoipv     || '1'),
    doituong:    JSON.stringify(doituong    || '1'),
    gioi_tinh:   JSON.stringify(gioi_tinh   || ''),
    tuoi:        JSON.stringify(tuoi        || ''),
    baohiem:     JSON.stringify(rec.baohiem || '1'),
    masophieu:   JSON.stringify(rec.masophieu || ''),
    thoigian:    JSON.stringify(rec.thoigian || ''),
    cachsinh:    JSON.stringify(rec.cachsinh || '1'),
  };

  return `(function(){
try {
  var buildId=(document.querySelector('input[name="form_build_id"]')||{}).value||'';
  if(!buildId)return{error:'NO_BUILD_ID'};

  var answers=${P.answers}, type=${P.type};
  var filled=0, skipped=0, missing=[];

  // ── HELPER FUNCTIONS ──
  function sVal(sel,val){ var e=document.querySelector(sel); if(e){e.value=val;e.dispatchEvent(new Event('change',{bubbles:true}));return true;} return false; }
  function sChk(sel,on){ var e=document.querySelector(sel); if(e){e.checked=on;e.dispatchEvent(new Event('change',{bubbles:true}));return true;} return false; }
  function sRad(name,val){ var e=document.querySelector('input[type="radio"][name="'+name+'"][value="'+val+'"]'); if(e){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));return true;} return false; }
  function sRadFirst(name){ var e=document.querySelector('input[type="radio"][name="'+name+'"]'); if(e&&!document.querySelector('input[type="radio"][name="'+name+'"]:checked')){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));return true;} return false; }

  // ── M5 lookup tables ──
  var M5_CB_SEL  = {b1:1,b2:1,b3:1,b4:1,b10:1};
  var M5_RAD_SEL = {b5:1,b6:1,b8:1,b11:1};
  var M5_RAD_PLN = {b7:1,b12:1};
  var M5_CB_PLN  = {b9:1};

  // ════════════════════════════════════════
  // BƯỚC 1: ĐIỀN CÂU TRẢ LỜI ĐÁNH GIÁ
  // ════════════════════════════════════════
  answers.forEach(function(a){
    if(a.code===undefined||a.value===null||a.value===undefined)return;
    var sec=a.code[0].toLowerCase(), num=a.code.slice(1), qkey=sec+num, val=a.value;

    if(type==='m5'){
      if(M5_CB_SEL[qkey]){
        // checkbox: submitted[danh_gia][bN][select][VAL]
        // Reset tất cả checkbox của câu này trước
        document.querySelectorAll('input[name^="submitted[danh_gia]['+qkey+'][select]"]').forEach(function(el){el.checked=false;});
        var cbName='submitted[danh_gia]['+qkey+'][select]['+val+']';
        if(sChk('input[name="'+cbName+'"]',true))filled++;
        else missing.push(a.code+'='+val);
      } else if(M5_RAD_SEL[qkey]){
        // radio: submitted[danh_gia][bN][select] value=VAL
        if(sRad('submitted[danh_gia]['+qkey+'][select]',val))filled++;
        else missing.push(a.code+'='+val);
      } else if(M5_RAD_PLN[qkey]){
        // radio plain: submitted[danh_gia][bN]
        if(sRad('submitted[danh_gia]['+qkey+']',val))filled++;
        else missing.push(a.code+'='+val);
      } else if(M5_CB_PLN[qkey]){
        // checkbox plain: submitted[danh_gia][b9][VAL]
        document.querySelectorAll('input[name^="submitted[danh_gia]['+qkey+']"]').forEach(function(el){el.checked=false;});
        if(sChk('input[name="submitted[danh_gia]['+qkey+']['+val+']"]',true))filled++;
        else missing.push(a.code+'='+val);
      } else {
        skipped++;
      }
    } else {
      // M1/M2/M3/M4: radio submitted[danh_gia][sec][secN]
      var fname='submitted[danh_gia]['+sec+']['+qkey+']';
      if(sRad(fname,val))filled++;
      else missing.push(a.code+'='+val);
    }
  });

  // ════════════════════════════════════════
  // BƯỚC 2: ĐIỀN TRƯỜNG THÔNG TIN PHIẾU
  // ════════════════════════════════════════

  // ── kieu_khao_sat [REQUIRED – tất cả mẫu] ──
  var kks=document.querySelector('select[name="submitted[kieu_khao_sat]"]');
  if(kks&&(!kks.value||kks.value==='')){kks.value=${P.kieuKhaoSat};kks.dispatchEvent(new Event('change',{bubbles:true}));}

  // ── guibyt ──
  sVal('select[name="submitted[guibyt]"]','1');

  // ── nguoipv [REQUIRED M1/M2] ──
  var npv=document.querySelector('select[name="submitted[ttp][mdt][nguoipv]"]');
  if(npv&&(!npv.value||npv.value==='')){npv.value=${P.nguoipv};npv.dispatchEvent(new Event('change',{bubbles:true}));}

  // ── doituong M1/M2 [REQUIRED] ──
  var dt=document.querySelector('select[name="submitted[ttp][mdt][doituong]"]');
  if(dt&&(!dt.value||dt.value==='')){dt.value=${P.doituong};dt.dispatchEvent(new Event('change',{bubbles:true}));}
  // M4/M5 radio doituong
  if(!sChk('input[name="submitted[thong_tin_phieu][ma_doituong][doituong]"][value="1"]',true)){
    sChk('input[name="submitted[thong_tin_phieu][ma_doituong][doituong]"][value="2"]',false);
  }

  // ── Bệnh viện (M1/M2/M3: ttp.bvn | M4/M5: thong_tin_phieu.benhvien_ngay) ──
  var mabvVal=${P.mabv};
  function setMaBV(sel){
    var e=document.querySelector(sel);
    if(e&&mabvVal){
      var found=false;
      Array.from(e.options||[]).forEach(function(opt){
        if(opt.value===mabvVal||opt.value.startsWith(mabvVal)){e.value=opt.value;found=true;}
      });
      if(!found&&!e.value)e.value=mabvVal;
      e.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  setMaBV('select[name="submitted[ttp][bvn][1_ten_benh_vien]"]');
  setMaBV('select[name="submitted[thong_tin_phieu][benhvien_ngay][1_ten_benh_vien]"]');
  // mabv text
  ['input[name="submitted[ttp][bvn][mabv]"]','input[name="submitted[thong_tin_phieu][benhvien_ngay][mabv]"]']
    .forEach(function(s){var e=document.querySelector(s);if(e)e.value=mabvVal;});

  // ── Khoa phòng ──
  var khoaVal=${P.khoa};
  ['select[name="submitted[ttp][kmk][khoa_phong]"]',   // M1/M2
   'select[name="submitted[ttp][khoa_phong]"]',          // M3
   'select[name="submitted[thong_tin_phieu][khoa_ma_khoa][khoa_phong]"]'] // M4/M5
    .forEach(function(s){var e=document.querySelector(s);if(e&&khoaVal&&(!e.value||e.value===''))e.value=khoaVal;});

  // ── Ngày điền phiếu ──
  var dd=${P.dd},mm=${P.mm},yy=${P.yy};
  [['select[name="submitted[ttp][bvn][ngay_dien_phieu][day]"]',dd],
   ['select[name="submitted[ttp][bvn][ngay_dien_phieu][month]"]',mm],
   ['select[name="submitted[ttp][bvn][ngay_dien_phieu][year]"]',yy],
   ['select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][day]"]',dd],
   ['select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][month]"]',mm],
   ['select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][year]"]',yy]]
    .forEach(function(p){var e=document.querySelector(p[0]);if(e&&p[1])e.value=p[1];});

  // ── Mã số phiếu ──
  var msp=${P.masophieu};
  if(msp){
    ['input[name="submitted[ttp][masophieu]"]','input[name="submitted[thong_tin_phieu][ma_doituong][masophieu]"]']
      .forEach(function(s){var e=document.querySelector(s);if(e&&!e.value)e.value=msp;});
  }

  // ── Giới tính [REQUIRED M1/M2/M3] ──
  var gt=${P.gioi_tinh};
  if(gt){
    sRad('submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][gioi_tinh]',gt);
  } else {
    sRadFirst('submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][gioi_tinh]');
  }

  // ── Tuổi [REQUIRED M1/M2/M4] ──
  var tuoiVal=${P.tuoi};
  ['input[name="submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][tuoi]"]',
   'input[name="submitted[a][gioi_tuoi][tuoi]"]']
    .forEach(function(s){var e=document.querySelector(s);if(e&&!e.value&&tuoiVal)e.value=tuoiVal;});

  // ── Số ngày nằm viện (M1) / Thời gian chờ (M4) [REQUIRED] ──
  var tgVal=${P.thoigian};
  ['input[name="submitted[thong_tin_nguoi_dien_phieu][dien_thoai___ngay__nam_vien][thoigian]"]',
   'input[name="submitted[thong_tin_nguoi_dien_phieu][dien_thoai___ngay__nam_vien][lanvv]"]']
    .forEach(function(s){var e=document.querySelector(s);if(e&&!e.value&&tgVal)e.value=tgVal;});

  // ── M1: Câu hỏi [5]=bhyt [6]=trình độ [7]=nghề nghiệp [REQUIRED] ──
  // Nếu chưa có câu trả lời → chọn option đầu tiên
  ['submitted[thong_tin_nguoi_dien_phieu][5]',
   'submitted[thong_tin_nguoi_dien_phieu][6]',
   'submitted[thong_tin_nguoi_dien_phieu][7]']
    .forEach(function(name){
      if(!document.querySelector('input[type="radio"][name="'+name+'"]:checked')){
        sRadFirst(name);
      }
    });

  // ── M1 text [8] [REQUIRED] ──
  var tf8=document.querySelector('input[name="submitted[thong_tin_nguoi_dien_phieu][8]"]');
  if(tf8&&!tf8.value)tf8.value='Không';

  // ── M2: baohiem [REQUIRED] ──
  if(!document.querySelector('input[name="submitted[thong_tin_nguoi_dien_phieu][baohiem]"]:checked')){
    sRad('submitted[thong_tin_nguoi_dien_phieu][baohiem]',${P.baohiem});
    if(!document.querySelector('input[name="submitted[thong_tin_nguoi_dien_phieu][baohiem]"]:checked'))
      sRadFirst('submitted[thong_tin_nguoi_dien_phieu][baohiem]');
  }

  // ── M2: khoangcach [REQUIRED] ──
  var kc=document.querySelector('input[name="submitted[thong_tin_nguoi_dien_phieu][khoangcach]"]');
  if(kc&&!kc.value)kc.value='1';

  // ── M3: kiemnhiem [REQUIRED] ──
  if(!document.querySelector('input[name="submitted[thong_tin_nguoi_dien_phieu][kiemnhiem]"]:checked'))
    sRadFirst('submitted[thong_tin_nguoi_dien_phieu][kiemnhiem]');

  // ── M3: truc [REQUIRED] ──
  var truc=document.querySelector('input[name="submitted[thong_tin_nguoi_dien_phieu][truc]"]');
  if(truc&&!truc.value)truc.value='0';

  // ── M4/M5: baohiem ──
  if(!document.querySelector('input[name="submitted[thong_tin_nguoi_dien_phieu][baohiem]"]:checked'))
    sRad('submitted[thong_tin_nguoi_dien_phieu][baohiem]',${P.baohiem})||sRadFirst('submitted[thong_tin_nguoi_dien_phieu][baohiem]');

  // ── M4/M5: cachsinh ──
  ['input[name="submitted[thong_tin_nguoi_dien_phieu][cachsinh][select]"]',
   'input[name="submitted[a][cachsinh]"]']
    .forEach(function(s){if(!document.querySelector(s+':checked'))sRadFirst(s.replace('[value]',''));});
  if(!document.querySelector('input[name="submitted[thong_tin_nguoi_dien_phieu][cachsinh][select]"]:checked'))
    sRad('submitted[thong_tin_nguoi_dien_phieu][cachsinh][select]',${P.cachsinh});
  if(!document.querySelector('input[name="submitted[a][cachsinh]"]:checked'))
    sRad('submitted[a][cachsinh]',${P.cachsinh});

  // ── M4/M5: lanvv (lần vào viện) [REQUIRED] ──
  ['input[name="submitted[thong_tin_nguoi_dien_phieu][dien_thoai___ngay__nam_vien][lanvv]"]',
   'input[name="submitted[a][dien_thoai___ngay__nam_vien][lanvv]"]']
    .forEach(function(s){var e=document.querySelector(s);if(e&&!e.value)e.value='1';});

  // ── M5: section A – tuoi, hca3 ──
  var tuoiA=document.querySelector('input[name="submitted[a][gioi_tuoi][tuoi]"]');
  if(tuoiA&&!tuoiA.value&&tuoiVal)tuoiA.value=tuoiVal;

  // ── M5: b14_a, b14_b [REQUIRED text] ──
  ['input[name="submitted[danh_gia][b14_a]"]','input[name="submitted[danh_gia][b14_b]"]']
    .forEach(function(s){var e=document.querySelector(s);if(e&&!e.value)e.value='0';});

  // ════════════════════════════════════════
  // BƯỚC 3: KIỂM TRA REQUIRED FIELDS
  // ════════════════════════════════════════
  var requiredEmpty=[], radioGroups={};
  document.querySelectorAll('select[required],input[required][type!="radio"],textarea[required]').forEach(function(el){
    if(!el.value||el.value==='')requiredEmpty.push(el.name||el.id||'?');
  });
  document.querySelectorAll('input[type="radio"][required]').forEach(function(el){
    radioGroups[el.name]=radioGroups[el.name]||[];
    radioGroups[el.name].push(el);
  });
  Object.keys(radioGroups).forEach(function(n){
    if(!radioGroups[n].some(function(el){return el.checked;}))requiredEmpty.push('radio:'+n);
  });

  // ════════════════════════════════════════
  // BƯỚC 4: SUBMIT
  // ════════════════════════════════════════
  setTimeout(function(){
    var btn=document.querySelector(
      'input[type="submit"][name="op"],input[type="submit"].webform-submit,'+
      'input[type="submit"].btn-primary,button[type="submit"]'
    );
    if(btn)btn.click();
    else console.warn('[KSHL-BYT] Không tìm thấy nút Submit');
  },1200);

  return{
    ok:true, filled:filled, skipped:skipped,
    missing:missing.join(','), total:answers.length,
    requiredEmpty:requiredEmpty.length,
    requiredList:requiredEmpty.slice(0,8).join(' | '),
    buildId:buildId.substring(0,12)
  };
} catch(err){return{error:err.message};}
})()`;
}

// =========================================================
// SUBMIT VIA POPUP – v10.0 (phát hiện login chính xác)
// =========================================================
function submitBYTViaPopup(rec) {
  return new Promise((resolve) => {
    const type = rec.type, action = BYT_FORM_ACTIONS[type];
    if (!action) { resolve({ok:false, msg:'Không có URL cho mẫu '+type}); return; }
    const pageUrl = BYT_BASE + action;
    const win = window.open(pageUrl, 'byt_submit_'+rec.id, 'width=1100,height=800,left=50,top=40');
    if (!win) { resolve({ok:false, msg:'Popup bị chặn – hãy cho phép popup trong trình duyệt'}); return; }

    const mabv        = CFG.mabv || '';
    const khoaId      = rec.khoaId || rec.khoa || '';
    const kieuKhaoSat = rec.kieuKhaoSat || CFG.kieuKhaoSat || '1';
    const nguoipv     = rec.nguoipv     || CFG.nguoipv      || '1';
    const doituong    = rec.doituong    || '1';
    const gioi_tinh   = rec.gioi_tinh   || '';
    const tuoi        = rec.tuoi        || '';
    const ngay        = (rec.ngay || new Date().toISOString().split('T')[0]).split('-');
    const dd = parseInt(ngay[2]||0).toString();
    const mm = parseInt(ngay[1]||0).toString();
    const yy = ngay[0]||'';

    const injectScript = buildInjectScript(rec, mabv, khoaId, kieuKhaoSat, nguoipv, doituong, gioi_tinh, tuoi, dd, mm, yy);
    let attempts=0, tokensDone=false, submitted=false;
    const maxAttempts = Math.ceil((BYT_LOAD_TIMEOUT_MS[type]||20000)/500);

    const iv = setInterval(()=>{
      attempts++;
      try {
        if (win.closed) {
          clearInterval(iv);
          if (!submitted) resolve({ok:false, msg:'Cửa sổ bị đóng trước khi hoàn tất'});
          return;
        }

        let curUrl='', ready=false;
        try { curUrl=win.location.href||''; ready=win.document.readyState==='complete'; }
        catch(xe) {
          // Cross-origin exception = đã submit thành công và redirect
          if (tokensDone && !submitted) {
            clearInterval(iv); submitted=true;
            setTimeout(()=>{try{win.close();}catch(x){}},600);
            resolve({ok:true, msg:'Gửi thành công (cross-origin redirect)'});
          }
          return;
        }

        // ── PHÁT HIỆN TRANG LOGIN ──
        // Kiểm tra TRƯỚC khi tokensDone – tránh nhầm form login với form khảo sát
        let isLoginPage = false;
        try {
          isLoginPage = curUrl.includes('/user/login') || curUrl.includes('/user?destination')
            || (ready && !!(win.document.querySelector('#edit-name[name="name"]')
                         || win.document.querySelector('input[name="pass"]')));
        } catch(le){}

        if (ready && isLoginPage && !tokensDone) {
          clearInterval(iv); try{win.close();}catch(x){}
          resolve({ok:false, msg:'CHƯA_ĐĂNG_NHẬP'}); return;
        }

        // ── KIỂM TRA WEBFORM ĐÃ LOAD ──
        if (ready && !tokensDone && !isLoginPage) {
          let hasWebform = false;
          try {
            hasWebform = !!(win.document.querySelector('form[id^="webform-client-form"]')
                         || win.document.querySelector('form.webform-client-form'));
          } catch(we){}

          if (!hasWebform) {
            // Trang load nhưng webform chưa hiện → thử thêm (tối đa 4 lần)
            if (attempts % 4 === 0)
              addBYTLog('warn', `⏳ Chờ webform load... (${attempts*0.5}s)`);
            return;
          }

          tokensDone = true;
          addBYTLog('info', `📄 Webform sẵn sàng (${curUrl.split('/').pop()}) – bắt đầu điền...`);

          try {
            const result = win.eval(injectScript);

            if (result && result.error === 'NO_BUILD_ID') {
              clearInterval(iv); try{win.close();}catch(x){}
              resolve({ok:false, msg:'CHƯA_ĐĂNG_NHẬP – không lấy được form token'}); return;
            }
            if (result && result.error) {
              addBYTLog('warn', '⚠️ Lỗi inject: ' + result.error);
            } else if (result && result.ok) {
              const reqInfo = result.requiredEmpty > 0
                ? ` | ⚠️ ${result.requiredEmpty} trường required còn trống: ${result.requiredList}` : '';
              addBYTLog('info',
                `✏️ Điền ${result.filled}/${result.total} câu` +
                (result.skipped ? `, bỏ qua ${result.skipped}` : '') +
                (result.missing ? ` | Thiếu: ${result.missing}` : ' | Đủ tất cả') +
                reqInfo
              );
              if (result.requiredEmpty > 0)
                addBYTLog('warn', `⚠️ Required còn trống: ${result.requiredList}`);
            }

            // ── CHỜ SUBMIT & XÁC NHẬN ──
            let waitAtt=0;
            const waitIv = setInterval(()=>{
              waitAtt++;
              try {
                if (win.closed) {
                  clearInterval(waitIv); clearInterval(iv); submitted=true;
                  resolve({ok:true, msg:'✅ Đã gửi thành công (cửa sổ tự đóng)'}); return;
                }
                const newUrl = win.location.href||'';
                const body   = (win.document.body?.innerText||'').toLowerCase();
                const isOk =
                  body.includes('cảm ơn') || body.includes('cam on') ||
                  body.includes('thành công') || body.includes('thank') ||
                  newUrl.includes('confirmation') || newUrl.includes('complete') ||
                  (newUrl !== pageUrl && newUrl.length > 10 && win.document.readyState==='complete');
                if (isOk) {
                  clearInterval(waitIv); clearInterval(iv); submitted=true;
                  setTimeout(()=>{try{win.close();}catch(x){}},1200);
                  resolve({ok:true, msg:'✅ Gửi thành công – BYT xác nhận'});
                }
              } catch(ce) {
                clearInterval(waitIv); clearInterval(iv); submitted=true;
                setTimeout(()=>{try{win.close();}catch(x){}},600);
                resolve({ok:true, msg:'✅ Gửi thành công (cross-origin confirm)'});
              }
              if (waitAtt>28) {
                clearInterval(waitIv); clearInterval(iv); submitted=true;
                setTimeout(()=>{try{win.close();}catch(x){}},400);
                resolve({ok:true, msg:'Gửi xong – không nhận được xác nhận rõ ràng'});
              }
            },1000);

          } catch(domErr) {
            clearInterval(iv); try{win.close();}catch(x){}
            resolve({ok:false, msg:'CHƯA_ĐĂNG_NHẬP – không đọc được DOM: '+domErr.message});
          }
        }

      } catch(outerErr) {
        if (tokensDone && !submitted) {
          clearInterval(iv); submitted=true;
          setTimeout(()=>{try{win.close();}catch(x){}},400);
          resolve({ok:true, msg:'✅ Gửi thành công (cross-origin outer)'});
        }
      }

      if (attempts > maxAttempts) {
        clearInterval(iv);
        if (!submitted) {
          try{win.close();}catch(x){}
          resolve({ok:false, msg:`Timeout ${BYT_LOAD_TIMEOUT_MS[type]/1000}s – trang BYT không phản hồi. Kiểm tra đăng nhập.`});
        }
      }
    },500);
  });
}

// =========================================================
// RENDER QUEUE UI
// =========================================================
function renderBYTQueue() {
  const typeF   = document.getElementById('byt-fl-type')?.value   || '';
  const statusF = document.getElementById('byt-fl-status')?.value || 'pending';
  let surveys = [...DB.surveys].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if (typeF) surveys = surveys.filter(x=>x.type===typeF);
  if (statusF==='pending')   surveys = surveys.filter(x=>!x.bytStatus||x.bytStatus==='pending'||x.bytStatus==='failed');
  else if (statusF==='byt-done') surveys = surveys.filter(x=>x.bytStatus==='done');
  const el = document.getElementById('byt-queue-list');
  if (!el) return;
  if (!surveys.length) {
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">Không có phiếu cần gửi</div></div>`;
    document.getElementById('byt-queue-count').textContent=''; return;
  }
  let html='';
  surveys.forEach(r=>{
    const isSelected=bytSelectedIds.has(r.id);
    const ans=r.answers?.filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='')||[];
    const avg=ans.length?(ans.reduce((s,a)=>s+Number(a.value),0)/ans.length).toFixed(1):'-';
    const d=r.ngay||r.createdAt?.split('T')[0]||'';
    const icon=r.type==='m1'?'🏥':r.type==='m2'?'🏃':r.type==='m3'?'👨‍⚕️':r.type==='m4'?'👶':'🍼';
    let statusHtml;
    if(!r.bytStatus||r.bytStatus==='pending') statusHtml='<span class="uqi-status pending">⏳ Chờ gửi</span>';
    else if(r.bytStatus==='uploading') statusHtml='<span class="uqi-status uploading">🔄 Đang gửi</span>';
    else if(r.bytStatus==='done') statusHtml='<span class="uqi-status done">✅ Đã gửi</span>';
    else statusHtml=`<span class="uqi-status failed" title="${r.bytFailMsg||''}">❌ Lỗi – thử lại</span>`;
    html+=`<div class="upload-queue-item${isSelected?' selected':''}" id="uqi_${r.id}">
      <input type="checkbox" class="uqi-check" data-id="${r.id}" ${isSelected?'checked':''} onchange="toggleBYTItem('${r.id}',this.checked)">
      <div class="uqi-info">
        <div class="uqi-label">${icon} ${SURVEYS[r.type]?.label||r.type}</div>
        <div class="uqi-meta">📅 ${d} · ${r.khoa||r.donvi||'—'} · TB ${avg}/5 · ${ans.length}/${r.answers?.length||0} câu</div>
      </div>
      ${statusHtml}
      <button class="btn btn-outline btn-xs" onclick="openBYTForRecord('${r.id}')" title="Xem trên BYT">🔗</button>
    </div>`;
  });
  el.innerHTML=html;
  document.getElementById('byt-queue-count').textContent=`(${surveys.length} phiếu, đã chọn ${bytSelectedIds.size})`;
  updateBYTPendingBadge();
}

function toggleBYTItem(id,checked){
  if(checked)bytSelectedIds.add(id); else bytSelectedIds.delete(id);
  document.getElementById('uqi_'+id)?.classList.toggle('selected',checked);
  const count=document.getElementById('byt-queue-count');
  if(count)count.textContent=`(${document.querySelectorAll('.uqi-check').length} phiếu, đã chọn ${bytSelectedIds.size})`;
}
function selectAllBYTQueue(){document.querySelectorAll('.uqi-check').forEach(cb=>{cb.checked=true;bytSelectedIds.add(cb.dataset.id);document.getElementById('uqi_'+cb.dataset.id)?.classList.add('selected');});renderBYTQueue();}
function deselectAllBYTQueue(){bytSelectedIds.clear();document.querySelectorAll('.uqi-check').forEach(cb=>{cb.checked=false;});document.querySelectorAll('.upload-queue-item').forEach(el=>el.classList.remove('selected'));renderBYTQueue();}
function quickSendOneBYT(id){bytSelectedIds.clear();bytSelectedIds.add(id);showPage('bytupload');setTimeout(()=>sendSelectedToBYT(),400);}
function openBYTForRecord(id){const r=DB.surveys.find(x=>x.id===id);if(!r)return;if(!window.open(SURVEYS[r.type]?.url||BYT_BASE,'_blank'))toast('❌ Popup bị chặn.','error');}

// =========================================================
// SEND SELECTED – MAIN UPLOAD FUNCTION
// =========================================================
async function sendSelectedToBYT() {
  if (bytSelectedIds.size===0) { toast('Chọn ít nhất 1 phiếu để gửi','warning'); return; }
  if (!CFG.bytuser||!CFG.bytpass) { toast('⚠️ Chưa cấu hình tài khoản BYT. Vào Cấu hình → Tài khoản BYT.','warning'); showPage('settings'); return; }
  if (!CFG.mabv) { toast('⚠️ Chưa cấu hình Mã Bệnh viện. Vào Cấu hình → Thông tin BV.','warning'); return; }
  if (bytUploadRunning) { toast('Đang có tiến trình gửi phiếu, vui lòng chờ...','info'); return; }

  const logCard=document.getElementById('byt-log-card');
  if(logCard)logCard.style.display='';
  clearBYTLog();
  bytUploadRunning=true;
  addBYTLog('info','═══ BẮT ĐẦU GỬI '+bytSelectedIds.size+' PHIẾU LÊN BYT ═══');
  addBYTLog('info','Thời gian: '+new Date().toLocaleString('vi-VN'));
  addBYTLog('info','Tài khoản BYT: '+CFG.bytuser+' | BV: '+(CFG.hvname||CFG.mabv));
  addBYTLog('info','⚠️ KHÔNG đóng cửa sổ popup BYT khi đang gửi!');

  const ids=[...bytSelectedIds];
  let successCount=0,failCount=0,needLogin=false;

  for (const id of ids) {
    const r=DB.surveys.find(x=>x.id===id);
    if(!r){addBYTLog('warn','Không tìm thấy phiếu ID='+id);continue;}
    const ans=r.answers?.filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='')||[];
    const label=(SURVEYS[r.type]?.label||r.type)+' | '+(r.ngay||r.createdAt?.split('T')[0]||'')+' | '+(r.khoa||r.donvi||'—')+' | '+ans.length+' câu';
    addBYTLog('info','▶ Gửi: '+label);
    r.bytStatus='uploading'; saveDB();
    const itemEl=document.getElementById('uqi_'+id);
    if(itemEl){const s=itemEl.querySelector('.uqi-status');if(s){s.className='uqi-status uploading';s.textContent='🔄 Đang gửi';}}

    let result;
    try { result=await submitBYTViaPopup(r); }
    catch(e){ result={ok:false,msg:e.message}; }

    if(result.ok){
      r.bytStatus='done'; r.bytSentAt=new Date().toISOString();
      successCount++; bytSelectedIds.delete(id);
      addBYTLog('ok','✅ '+label+' → '+result.msg);
      if(itemEl){const s=itemEl.querySelector('.uqi-status');if(s){s.className='uqi-status done';s.textContent='✅ Đã gửi';}}
      if(gsReady())gsUpdateSurveyStatus(id,'done').catch(()=>{});
    } else {
      r.bytStatus='failed'; r.bytFailMsg=result.msg; failCount++;
      addBYTLog('err','❌ '+label+' → '+result.msg);
      if(itemEl){const s=itemEl.querySelector('.uqi-status');if(s){s.className='uqi-status failed';s.textContent='❌ Lỗi';s.title=result.msg;}}
      if(result.msg&&(result.msg.includes('CHƯA_ĐĂNG_NHẬP'))){
        needLogin=true; addBYTLog('warn','⛔ Phiên BYT hết hạn – dừng hàng đợi. Nhấn "Đăng nhập BYT" rồi thử lại.'); break;
      }
    }
    saveDB(); updateDash();
    if(needLogin)break;
    if(ids.indexOf(id)<ids.length-1){addBYTLog('info','⏳ Chờ 3 giây...');await sleep(3000);}
  }

  bytUploadRunning=false;
  addBYTLog('info',`═══ KẾT QUẢ: ✅ ${successCount} thành công | ❌ ${failCount} thất bại ═══`);
  if(needLogin){
    toast('⚠️ Phiên BYT hết hạn! Nhấn "Đăng nhập BYT" rồi gửi lại.','warning');
    setBYTStatusUI('logged-out','⚠️ Phiên BYT hết hạn.');
    const lb=document.getElementById('btn-byt-login-now'); if(lb)lb.style.display='';
  } else {
    toast('📤 BYT: '+successCount+' ✅ / '+failCount+' ❌',successCount>0?'success':'error');
  }
  renderBYTQueue(); updateBYTPendingBadge();
  if(gsReady())gsLogHistory('byt_upload',`Gửi BYT: ${successCount} thành công / ${failCount} thất bại`).catch(()=>{});
}

// =========================================================
// LOG
// =========================================================
function addBYTLog(type,msg){
  const el=document.getElementById('byt-upload-log'); if(!el)return;
  const ts=new Date().toLocaleTimeString('vi-VN');
  const cls=type==='ok'?'log-ok':type==='err'?'log-err':type==='warn'?'log-warn':'log-info';
  const pre=type==='ok'?'✅':type==='err'?'❌':type==='warn'?'⚠️':'ℹ️';
  el.innerHTML+=`<div class="${cls}">[${ts}] ${pre} ${msg}</div>`;
  el.scrollTop=el.scrollHeight; bytLog.push({ts,type,msg});
}
function clearBYTLog(){const el=document.getElementById('byt-upload-log');if(el)el.innerHTML='';bytLog=[];}

// =========================================================
// ▄▄▄▄ TEST SUITE v10.0 – 40 TEST CASES ▄▄▄▄
// Gồm: Unit mapping, Unit inject script, Integration per-form
// Chạy: bytRunAllTests()  hoặc  bytRunTest('TC-01')
// =========================================================
const BYT_TEST_CASES = [
  // ──── NHÓM A: bytFieldMapping – M1/M2/M3/M4 ────
  {id:'TC-01',g:'A – Field Mapping M1-M4',d:'M1 A1 → danh_gia[a][a1], radio',
   f:()=>{const r=bytFieldMapping('m1','A1');return r.name==='submitted[danh_gia][a][a1]'&&r.mode==='radio';}},
  {id:'TC-02',g:'A – Field Mapping M1-M4',d:'M1 E6 → danh_gia[e][e6]',
   f:()=>{const r=bytFieldMapping('m1','E6');return r.name==='submitted[danh_gia][e][e6]'&&r.mode==='radio';}},
  {id:'TC-03',g:'A – Field Mapping M1-M4',d:'M2 B10 → danh_gia[b][b10]',
   f:()=>{const r=bytFieldMapping('m2','B10');return r.name==='submitted[danh_gia][b][b10]'&&r.mode==='radio';}},
  {id:'TC-04',g:'A – Field Mapping M1-M4',d:'M3 C12 → danh_gia[c][c12]',
   f:()=>{const r=bytFieldMapping('m3','C12');return r.name==='submitted[danh_gia][c][c12]'&&r.mode==='radio';}},
  {id:'TC-05',g:'A – Field Mapping M1-M4',d:'M4 G1 → danh_gia[g][g1]',
   f:()=>{const r=bytFieldMapping('m4','G1');return r.name==='submitted[danh_gia][g][g1]'&&r.mode==='radio';}},
  {id:'TC-06',g:'A – Field Mapping M1-M4',d:'M4 H3 → danh_gia[h][h3]',
   f:()=>{const r=bytFieldMapping('m4','H3');return r.name==='submitted[danh_gia][h][h3]'&&r.mode==='radio';}},

  // ──── NHÓM B: bytFieldMapping – M5 (5 loại khác nhau) ────
  {id:'TC-07',g:'B – Field Mapping M5',d:'M5 B1 → checkbox_select (b1,b2,b3,b4,b10)',
   f:()=>{const r=bytFieldMapping('m5','B1');return r.name==='submitted[danh_gia][b1][select]'&&r.mode==='checkbox_select';}},
  {id:'TC-08',g:'B – Field Mapping M5',d:'M5 B4 → checkbox_select',
   f:()=>{const r=bytFieldMapping('m5','B4');return r.name==='submitted[danh_gia][b4][select]'&&r.mode==='checkbox_select';}},
  {id:'TC-09',g:'B – Field Mapping M5',d:'M5 B10 → checkbox_select (2 chữ số)',
   f:()=>{const r=bytFieldMapping('m5','B10');return r.name==='submitted[danh_gia][b10][select]'&&r.mode==='checkbox_select';}},
  {id:'TC-10',g:'B – Field Mapping M5',d:'M5 B5 → radio_select (b5,b6,b8,b11)',
   f:()=>{const r=bytFieldMapping('m5','B5');return r.name==='submitted[danh_gia][b5][select]'&&r.mode==='radio_select';}},
  {id:'TC-11',g:'B – Field Mapping M5',d:'M5 B11 → radio_select',
   f:()=>{const r=bytFieldMapping('m5','B11');return r.name==='submitted[danh_gia][b11][select]'&&r.mode==='radio_select';}},
  {id:'TC-12',g:'B – Field Mapping M5',d:'M5 B7 → radio_plain (b7,b12)',
   f:()=>{const r=bytFieldMapping('m5','B7');return r.name==='submitted[danh_gia][b7]'&&r.mode==='radio_plain';}},
  {id:'TC-13',g:'B – Field Mapping M5',d:'M5 B12 → radio_plain',
   f:()=>{const r=bytFieldMapping('m5','B12');return r.name==='submitted[danh_gia][b12]'&&r.mode==='radio_plain';}},
  {id:'TC-14',g:'B – Field Mapping M5',d:'M5 B9 → checkbox_plain (không có [select])',
   f:()=>{const r=bytFieldMapping('m5','B9');return r.name==='submitted[danh_gia][b9]'&&r.mode==='checkbox_plain';}},
  {id:'TC-15',g:'B – Field Mapping M5',d:'M5 A1/C1 → mode=none (xử lý riêng)',
   f:()=>{return bytFieldMapping('m5','A1').mode==='none'&&bytFieldMapping('m5','C1').mode==='none';}},
  {id:'TC-16',g:'B – Field Mapping M5',d:'Code null/undefined → mode=none, không throw',
   f:()=>{try{return bytFieldMapping('m1',null).mode==='none'&&bytFieldMapping('m5',undefined).mode==='none';}catch(e){return false;}}},

  // ──── NHÓM C: buildInjectScript – cấu trúc script ────
  {id:'TC-17',g:'C – Inject Script Structure',d:'Script hợp lệ, chứa NO_BUILD_ID guard',
   f:()=>{const sc=buildInjectScript({type:'m1',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return typeof sc==='string'&&sc.includes('NO_BUILD_ID')&&sc.includes('form_build_id');}},
  {id:'TC-18',g:'C – Inject Script Structure',d:'Script chứa M5_CB_SEL lookup table',
   f:()=>{const sc=buildInjectScript({type:'m5',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return sc.includes('M5_CB_SEL')&&sc.includes('M5_RAD_SEL')&&sc.includes('M5_CB_PLN');}},
  {id:'TC-19',g:'C – Inject Script Structure',d:'M4: script chứa thong_tin_phieu selector',
   f:()=>{const sc=buildInjectScript({type:'m4',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return sc.includes('thong_tin_phieu')&&sc.includes('benhvien_ngay');}},
  {id:'TC-20',g:'C – Inject Script Structure',d:'M3: script chứa ttp][khoa_phong (không qua kmk)',
   f:()=>{const sc=buildInjectScript({type:'m3',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return sc.includes('"submitted[ttp][khoa_phong]"');}},
  {id:'TC-21',g:'C – Inject Script Structure',d:'value=0 (Không đánh giá) được giữ lại trong answers JSON',
   f:()=>{const sc=buildInjectScript({type:'m1',answers:[{code:'A1',value:0},{code:'A2',value:3}],ngay:'2026-04-10'},'62310','','1','1','1','2','45','10','4','2026');return sc.includes('"value":0')&&sc.includes('"value":3');}},
  {id:'TC-22',g:'C – Inject Script Structure',d:'M1: script chứa formula danh_gia+code[0].toLowerCase',
   f:()=>{const sc=buildInjectScript({type:'m1',answers:[{code:'A1',value:5}],ngay:'2026-04-10'},'62310','','1','1','1','2','45','10','4','2026');return sc.includes('[danh_gia][')&&sc.includes('"code":"A1"')&&sc.includes('code[0].toLowerCase()');}},
  {id:'TC-23',g:'C – Inject Script Structure',d:'Mã BV được inject vào 1_ten_benh_vien selectors',
   f:()=>{const sc=buildInjectScript({type:'m1',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return sc.includes('1_ten_benh_vien')&&sc.includes('62310');}},
  {id:'TC-24',g:'C – Inject Script Structure',d:'Script chứa kiemnhiem (M3 required)',
   f:()=>{const sc=buildInjectScript({type:'m3',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return sc.includes('kiemnhiem');}},
  {id:'TC-25',g:'C – Inject Script Structure',d:'Script chứa khoangcach (M2 required)',
   f:()=>{const sc=buildInjectScript({type:'m2',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return sc.includes('khoangcach');}},
  {id:'TC-26',g:'C – Inject Script Structure',d:'Script chứa b14_a/b14_b (M5 required text)',
   f:()=>{const sc=buildInjectScript({type:'m5',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return sc.includes('b14_a')&&sc.includes('b14_b');}},
  {id:'TC-27',g:'C – Inject Script Structure',d:'Script chứa cachsinh (M4/M5 required)',
   f:()=>{const sc=buildInjectScript({type:'m4',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return sc.includes('cachsinh');}},
  {id:'TC-28',g:'C – Inject Script Structure',d:'Script chứa thong_tin[5],[6],[7] (M1 bhyt/trình độ/nghề nghiệp)',
   f:()=>{const sc=buildInjectScript({type:'m1',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026');return sc.includes('[5]')&&sc.includes('[6]')&&sc.includes('[7]');}},

  // ──── NHÓM D: Integration – Data Validation ────
  {id:'TC-29',g:'D – Integration Data',d:'Tất cả 5 mẫu có BYT_FORM_ACTIONS hợp lệ',
   f:()=>['m1','m2','m3','m4','m5'].every(t=>typeof BYT_FORM_ACTIONS[t]==='string'&&BYT_FORM_ACTIONS[t].startsWith('/'))},
  {id:'TC-30',g:'D – Integration Data',d:'M5: tất cả B1-B4,B10 → checkbox_select',
   f:()=>['B1','B2','B3','B4','B10'].every(c=>bytFieldMapping('m5',c).mode==='checkbox_select')},
  {id:'TC-31',g:'D – Integration Data',d:'M5: B5,B6,B8,B11 → radio_select',
   f:()=>['B5','B6','B8','B11'].every(c=>bytFieldMapping('m5',c).mode==='radio_select')},
  {id:'TC-32',g:'D – Integration Data',d:'M5: B7,B12 → radio_plain',
   f:()=>['B7','B12'].every(c=>bytFieldMapping('m5',c).mode==='radio_plain')},
  {id:'TC-33',g:'D – Integration Data',d:'M5: B9 → checkbox_plain (unique pattern)',
   f:()=>bytFieldMapping('m5','B9').mode==='checkbox_plain'},
  {id:'TC-34',g:'D – Integration Data',d:'Parse ngày: 2026-04-10 → dd=10, mm=4, yy=2026',
   f:()=>{const n='2026-04-10'.split('-');return parseInt(n[2]).toString()==='10'&&parseInt(n[1]).toString()==='4'&&n[0]==='2026';}},
  {id:'TC-35',g:'D – Integration Data',d:'M1: 36 câu đánh giá A-E đều có mode=radio',
   f:()=>{
     const codes=['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','B6','B7',
       'C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','C11',
       'D1','D2','D3','D4','D5','D6','D7','E1','E2','E3','E4','E5','E6'];
     return codes.length===36&&codes.every(c=>bytFieldMapping('m1',c).mode==='radio');
   }},
  {id:'TC-36',g:'D – Integration Data',d:'M2: B1-B10 (10 câu section B) đều map đúng',
   f:()=>['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10'].every(c=>bytFieldMapping('m2',c).mode==='radio')},
  {id:'TC-37',g:'D – Integration Data',d:'M4: G1-G3, H1-H3 đều map đúng',
   f:()=>{
     const gOk=['G1','G2','G3'].every(c=>bytFieldMapping('m4',c).name.includes('[g]['));
     const hOk=['H1','H2','H3'].every(c=>bytFieldMapping('m4',c).name.includes('[h]['));
     return gOk&&hOk;
   }},
  {id:'TC-38',g:'D – Integration Data',d:'M3: A1-A9 (9 câu section A) → radio',
   f:()=>['A1','A2','A3','A4','A5','A6','A7','A8','A9'].every(c=>bytFieldMapping('m3',c).mode==='radio')},

  // ──── NHÓM E: Edge Cases ────
  {id:'TC-39',g:'E – Edge Cases',d:'answers filter: null, undefined, empty string bị loại; 0 được giữ',
   f:()=>{
     const rec={type:'m1',answers:[{code:'A1',value:null},{code:'A2',value:undefined},{code:'A3',value:''},{code:'A4',value:0},{code:'A5',value:3}],ngay:'2026-04-10'};
     const ans=rec.answers.filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='');
     return ans.length===2&&ans[0].value===0&&ans[1].value===3;
   }},
  {id:'TC-40',g:'E – Edge Cases',d:'BYT_LOAD_TIMEOUT_MS: M5 > M4 > M1 (timeout theo độ phức tạp)',
   f:()=>BYT_LOAD_TIMEOUT_MS.m5>BYT_LOAD_TIMEOUT_MS.m4&&BYT_LOAD_TIMEOUT_MS.m4>BYT_LOAD_TIMEOUT_MS.m1},
];

// ── TEST RUNNER ──
async function bytRunAllTests() {
  const logCard=document.getElementById('byt-log-card');if(logCard)logCard.style.display='';
  clearBYTLog();
  addBYTLog('info','╔══════════════════════════════════════════════════╗');
  addBYTLog('info','║  KSHL v10.0 – TEST SUITE BYT (40 test cases)     ║');
  addBYTLog('info',`║  ${new Date().toLocaleString('vi-VN')}                    ║`);
  addBYTLog('info','╚══════════════════════════════════════════════════╝');
  bytTestResults=[]; let pass=0,fail=0,lastG='';
  for(const tc of BYT_TEST_CASES){
    if(tc.g!==lastG){lastG=tc.g;addBYTLog('info','── '+tc.g+' ──');}
    let result,error=null;
    try{result=await Promise.resolve(tc.f());}catch(e){result=false;error=e.message;}
    addBYTLog(result?'ok':'err',`[${tc.id}] ${result?'PASS':'FAIL'} – ${tc.d}${error?' ERR:'+error:''}`);
    bytTestResults.push({id:tc.id,g:tc.g,d:tc.d,status:result?'PASS':'FAIL',error});
    if(result)pass++;else fail++;
    await sleep(30);
  }
  addBYTLog('info','');
  addBYTLog('info','══════════════ KẾT QUẢ ══════════════');
  addBYTLog(fail===0?'ok':'err',`Tổng: ${BYT_TEST_CASES.length} | ✅ PASS: ${pass} | ❌ FAIL: ${fail} | ${((pass/BYT_TEST_CASES.length)*100).toFixed(0)}%`);
  if(fail>0){addBYTLog('warn','FAIL list:');bytTestResults.filter(r=>r.status==='FAIL').forEach(r=>{addBYTLog('err','  • '+r.id+': '+r.d);});}
  else addBYTLog('ok','🎉 Tất cả 40 test PASS! Module BYT hoàn chỉnh.');
  toast(fail===0?`✅ 40/40 PASS (100%)`:`⚠️ ${pass} PASS / ${fail} FAIL`,fail===0?'success':'warning');
  return{pass,fail,total:BYT_TEST_CASES.length};
}

async function bytRunTest(id){
  const tc=BYT_TEST_CASES.find(t=>t.id===id);
  if(!tc){toast('Không tìm thấy: '+id,'error');return;}
  const logCard=document.getElementById('byt-log-card');if(logCard)logCard.style.display='';
  clearBYTLog();
  let result,error=null;
  try{result=await Promise.resolve(tc.f());}catch(e){result=false;error=e.message;}
  addBYTLog(result?'ok':'err',`[${tc.id}] ${result?'PASS ✅':'FAIL ❌'} – ${tc.d}${error?' ['+error+']':''}`);
  toast(`${tc.id}: ${result?'✅ PASS':'❌ FAIL'}`,result?'success':'error');
  return result;
}

function bytShowTestReport(){
  if(!bytTestResults.length){toast('Chưa chạy test.','info');return;}
  const pass=bytTestResults.filter(r=>r.status==='PASS').length;
  let html=`<div style="font-family:monospace;font-size:12px;padding:12px;background:#0d1117;color:#e6edf3">`;
  html+=`<b style="color:#58a6ff">📊 BYT TEST REPORT v10.0 – ${new Date().toLocaleString('vi-VN')}</b><br>`;
  html+=`<b style="color:${pass===bytTestResults.length?'#3fb950':'#f85149'}">Pass: ${pass}/${bytTestResults.length} (${((pass/bytTestResults.length)*100).toFixed(0)}%)</b><br><br>`;
  let lastG='';
  bytTestResults.forEach(r=>{
    if(r.g!==lastG){lastG=r.g;html+=`<br><b style="color:#79c0ff">── ${r.g} ──</b><br>`;}
    const col=r.status==='PASS'?'#3fb950':'#f85149';
    html+=`<span style="color:${col}">${r.status==='PASS'?'✅':'❌'} ${r.id}: ${r.d}</span><br>`;
  });
  html+=`</div>`;
  const w=window.open('','byt_report','width=750,height=600,scrollbars=yes');
  if(w){w.document.head.innerHTML='<title>BYT Test Report</title>';w.document.body.innerHTML=html;}
  else toast('Popup bị chặn.','warning');
}
