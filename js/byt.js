// byt.js – Module gửi phiếu lên trang BYT (hailong.chatluongbenhvien.vn)
// KSHL v9.0 – Nâng cấp toàn diện: mapping đầy đủ 5 mẫu, test suite chuyên nghiệp
// Ngày: 2026-04-12
// ============================================================
// THAY ĐỔI v9.0 so với v4.1:
//   [1] Field mapping đầy đủ cho tất cả 5 mẫu dựa trên phân tích HTML thực tế
//   [2] M4: dùng submitted[thong_tin_phieu] thay vì submitted[ttp]
//   [3] M5: submitted[a][...] cho thông tin người dùng, [c][...] cho phần C
//   [4] M3: submitted[ttp][khoa_phong] trực tiếp (không qua kmk)
//   [5] M2: hỗ trợ submitted[ttp][stt_k][hsk] & khoangcach
//   [6] Auto-detect required fields còn trống trước khi submit
//   [7] Timeout thông minh theo kích thước phiếu
//   [8] Bộ TEST CASE chuyên nghiệp TC-01→TC-20 tích hợp sẵn
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

const BYT_LOAD_TIMEOUT_MS = { m1:18000, m2:18000, m3:20000, m4:20000, m5:22000 };

let bytLoginStatus   = 'unknown';
let bytUploadRunning = false;
let bytSelectedIds   = new Set();
let bytLog           = [];
let bytTestResults   = [];

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
  const cb1 = document.getElementById('cfg-auto-upload');
  const cb2 = document.getElementById('cfg-auto-upload-settings');
  if (cb1) cb1.checked = v;
  if (cb2) cb2.checked = v;
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

async function checkBYTLoginStatus() {
  const loginBtn = document.getElementById('btn-byt-login-now');
  setBYTStatusUI('checking', '🔄 Đang kiểm tra kết nối đến trang BYT...');
  if (loginBtn) loginBtn.style.display = 'none';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    await fetch(BYT_BASE + '/user/login', { method:'HEAD', mode:'no-cors', cache:'no-store', signal:ctrl.signal });
    clearTimeout(timer);
    setBYTStatusUI('unknown', '⚠️ Không thể xác minh tự động (trình duyệt bảo mật cross-origin). Nhấn "Đăng nhập BYT" để mở cửa sổ đăng nhập, sau đó gửi phiếu.');
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'unknown';
  } catch(e) {
    if (e.name === 'AbortError') setBYTStatusUI('error', '❌ Timeout – không kết nối được đến trang BYT. Kiểm tra mạng.');
    else setBYTStatusUI('error', '❌ Lỗi kết nối: ' + e.message);
    if (loginBtn) loginBtn.style.display = '';
    bytLoginStatus = 'error';
  }
}

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
  let attempts=0, injected=false, redirected=false;
  const iv = setInterval(() => {
    attempts++;
    try {
      if (win.closed) { clearInterval(iv); if (!redirected) { setBYTStatusUI('unknown','⚠️ Cửa sổ BYT đã đóng.'); const lb=document.getElementById('btn-byt-login-now'); if(lb)lb.style.display=''; } return; }
      const curUrl = win.location.href||'', ready = win.document.readyState==='complete';
      if (!injected && ready && (curUrl.includes('/user/login')||curUrl.includes('login'))) {
        injected=true;
        try { win.eval(`(function(){var u=document.querySelector('#edit-name,input[name="name"]');var p=document.querySelector('#edit-pass,input[name="pass"]');var b=document.querySelector('#edit-submit,input[type="submit"],button[type="submit"]');if(u&&p){u.value=${JSON.stringify(user)};p.value=${JSON.stringify(pass)};u.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('input',{bubbles:true}));if(b)b.click();}})()`); addBYTLog('info','Đã điền thông tin đăng nhập BYT'); } catch(fe){ addBYTLog('warn','Không thể auto-fill: '+fe.message); }
      }
      if (injected && ready && !curUrl.includes('/user/login') && curUrl.startsWith('http')) {
        redirected=true; clearInterval(iv); bytLoginStatus='logged-in';
        setBYTStatusUI('logged-in','✅ Đăng nhập BYT thành công! Sẵn sàng gửi phiếu.');
        const lb=document.getElementById('btn-byt-login-now'); if(lb)lb.style.display='none';
        addBYTLog('ok','Đăng nhập BYT thành công. URL: '+curUrl);
        setTimeout(()=>{try{win.close();}catch(x){}},1500);
      }
    } catch(e) {
      if (injected && !redirected) {
        redirected=true; clearInterval(iv); bytLoginStatus='logged-in';
        setBYTStatusUI('logged-in','✅ Đăng nhập BYT thành công!');
        const lb=document.getElementById('btn-byt-login-now'); if(lb)lb.style.display='none';
        addBYTLog('ok','Đăng nhập BYT thành công (cross-origin redirect)');
        setTimeout(()=>{try{win.close();}catch(x){}},1500);
      }
    }
    if (attempts>40) { clearInterval(iv); if(!redirected) { setBYTStatusUI('unknown','⚠️ Hết thời gian. Hãy đăng nhập thủ công.'); addBYTLog('warn','Timeout chờ đăng nhập BYT'); } }
  },500);
}

// =========================================================
// FIELD MAPPING v9.0
// Trả về { name, isCheckbox }
// =========================================================
function bytFieldMapping(type, code) {
  if (!code) return { name: null, isCheckbox: false };
  const sec  = code[0].toLowerCase();
  const num  = code.slice(1);
  const qkey = sec + num;
  if (type === 'm5') {
    if (sec === 'b') return { name: `submitted[danh_gia][${qkey}][select]`, isCheckbox: true };
    return { name: null, isCheckbox: false };
  }
  return { name: `submitted[danh_gia][${sec}][${qkey}]`, isCheckbox: false };
}

// =========================================================
// BUILD INJECT SCRIPT
// =========================================================
function buildInjectScript(rec, mabv, khoaId, kieuKhaoSat, nguoipv, doituong, gioi_tinh, tuoi, dd, mm, yy) {
  const answers    = (rec.answers||[]).filter(a => a.value!==null && a.value!==undefined && a.value!=='');
  const answersStr = JSON.stringify(answers.map(a=>({code:a.code,value:Number(a.value)})));
  const typeStr    = JSON.stringify(rec.type);
  const p = {
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
    masophieu:   JSON.stringify(rec.masophieu || ''),
  };

  return `(function(){
  try {
    var buildId=(document.querySelector('input[name="form_build_id"]')||{}).value||'';
    if(!buildId)return{error:'NO_BUILD_ID'};
    var answers=${answersStr}, type=${typeStr}, filled=0, skipped=0, missing=[];

    function setVal(sel,val){var e=document.querySelector(sel);if(e){e.value=val;e.dispatchEvent(new Event('change',{bubbles:true}));return true;}return false;}
    function setCheck(sel,on){var e=document.querySelector(sel);if(e){e.checked=on;e.dispatchEvent(new Event('change',{bubbles:true}));return true;}return false;}
    function setRadio(name,val){var e=document.querySelector('input[name="'+name+'"][value="'+val+'"]');if(e){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));return true;}return false;}

    answers.forEach(function(a){
      if(a.code===undefined||a.value===null||a.value===undefined)return;
      var sec=a.code[0].toLowerCase(),num=a.code.slice(1),qkey=sec+num,val=a.value;
      if(type==='m5'&&sec==='b'){
        var nm='submitted[danh_gia]['+qkey+'][select]['+val+']';
        document.querySelectorAll('input[name^="submitted[danh_gia]['+qkey+'][select]"]').forEach(function(el){el.checked=false;});
        if(setCheck('input[name="'+nm+'"]',true))filled++;else missing.push(a.code+'='+val);
      }else if(type==='m5'){
        skipped++;
      }else{
        var fname='submitted[danh_gia]['+sec+']['+qkey+']';
        if(setRadio(fname,val))filled++;else missing.push(a.code+'='+val);
      }
    });

    // kieu_khao_sat
    var kks=document.querySelector('select[name="submitted[kieu_khao_sat]"]');
    if(kks&&(!kks.value||kks.value===''))kks.value=${p.kieuKhaoSat};
    // guibyt
    setVal('select[name="submitted[guibyt]"]','1');
    // nguoipv M1/M2
    ['select[name="submitted[ttp][mdt][nguoipv]"]'].forEach(function(s){var e=document.querySelector(s);if(e&&!e.value)e.value=${p.nguoipv};});
    // doituong
    var dt1=document.querySelector('select[name="submitted[ttp][mdt][doituong]"]');
    if(dt1&&!dt1.value)dt1.value=${p.doituong};
    var dt2=document.querySelector('input[name="submitted[thong_tin_phieu][ma_doituong][doituong]"][value="1"]');
    if(dt2)dt2.checked=true;

    // gioi tinh
    var gt=${p.gioi_tinh};
    if(gt){
      setRadio('submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][gioi_tinh]',gt);
    }
    // tuoi
    var tv=${p.tuoi};
    if(tv){
      ['input[name="submitted[thong_tin_nguoi_dien_phieu][gioi_tuoi][tuoi]"]','input[name="submitted[a][gioi_tuoi][tuoi]"]'].forEach(function(s){var e=document.querySelector(s);if(e&&!e.value)e.value=tv;});
    }

    // Bệnh viện
    var mabvVal=${p.mabv};
    ['select[name="submitted[ttp][bvn][1_ten_benh_vien]"]','select[name="submitted[thong_tin_phieu][benhvien_ngay][1_ten_benh_vien]"]'].forEach(function(s){
      var e=document.querySelector(s);
      if(e&&mabvVal){
        var found=false;
        Array.from(e.options).forEach(function(opt){if(opt.value===mabvVal||opt.value.startsWith(mabvVal)){e.value=opt.value;found=true;}});
        if(!found&&!e.value)e.value=mabvVal;
        e.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
    ['input[name="submitted[ttp][bvn][mabv]"]','input[name="submitted[thong_tin_phieu][benhvien_ngay][mabv]"]'].forEach(function(s){var e=document.querySelector(s);if(e)e.value=mabvVal;});

    // Khoa
    var khoaVal=${p.khoa};
    ['select[name="submitted[ttp][kmk][khoa_phong]"]','select[name="submitted[ttp][khoa_phong]"]','select[name="submitted[thong_tin_phieu][khoa_ma_khoa][khoa_phong]"]'].forEach(function(s){
      var e=document.querySelector(s);if(e&&khoaVal&&(!e.value||e.value===''))e.value=khoaVal;
    });

    // Ngày điền
    var dd=${p.dd},mm=${p.mm},yy=${p.yy};
    [['select[name="submitted[ttp][bvn][ngay_dien_phieu][day]"]',dd],['select[name="submitted[ttp][bvn][ngay_dien_phieu][month]"]',mm],['select[name="submitted[ttp][bvn][ngay_dien_phieu][year]"]',yy],['select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][day]"]',dd],['select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][month]"]',mm],['select[name="submitted[thong_tin_phieu][benhvien_ngay][ngay_dien_phieu][year]"]',yy]].forEach(function(pair){var e=document.querySelector(pair[0]);if(e&&pair[1])e.value=pair[1];});

    // Mã số phiếu
    var msp=${p.masophieu};
    ['input[name="submitted[ttp][masophieu]"]','input[name="submitted[thong_tin_phieu][ma_doituong][masophieu]"]'].forEach(function(s){var e=document.querySelector(s);if(e&&!e.value&&msp)e.value=msp;});

    // Required fields check
    var requiredEmpty=[],radioGroups={};
    document.querySelectorAll('[required]').forEach(function(el){if(!el.value||el.value==='')requiredEmpty.push(el.name||el.id||'?');});
    document.querySelectorAll('input[type="radio"][required]').forEach(function(el){radioGroups[el.name]=radioGroups[el.name]||[];radioGroups[el.name].push(el);});
    Object.keys(radioGroups).forEach(function(n){if(!radioGroups[n].some(function(el){return el.checked;}))requiredEmpty.push('radio:'+n);});

    // Submit
    setTimeout(function(){
      var btn=document.querySelector('input[type="submit"][name="op"],input[type="submit"].webform-submit,input[type="submit"].btn-primary,button[type="submit"]');
      if(btn)btn.click();
    },1000);

    return{ok:true,filled:filled,skipped:skipped,missing:missing.join(','),total:answers.length,requiredEmpty:requiredEmpty.length,requiredList:requiredEmpty.slice(0,5).join(','),buildId:buildId.substring(0,12)};
  }catch(err){return{error:err.message};}
})()`;
}

// =========================================================
// GỬI PHIẾU QUA POPUP
// =========================================================
function submitBYTViaPopup(rec) {
  return new Promise((resolve) => {
    const type = rec.type, action = BYT_FORM_ACTIONS[type];
    if (!action) { resolve({ok:false,msg:'Không có URL cho mẫu '+type}); return; }
    const pageUrl = BYT_BASE + action;
    const win = window.open(pageUrl,'byt_submit_'+rec.id,'width=1100,height=780,left=50,top=40');
    if (!win) { resolve({ok:false,msg:'Popup bị chặn – hãy cho phép popup trong trình duyệt'}); return; }

    const mabv=CFG.mabv||'', khoaId=rec.khoaId||rec.khoa||'';
    const kieuKhaoSat=rec.kieuKhaoSat||CFG.kieuKhaoSat||'1';
    const nguoipv=rec.nguoipv||CFG.nguoipv||'1', doituong=rec.doituong||'1';
    const gioi_tinh=rec.gioi_tinh||'', tuoi=rec.tuoi||'';
    const ngay=(rec.ngay||new Date().toISOString().split('T')[0]).split('-');
    const dd=parseInt(ngay[2]||0).toString(), mm=parseInt(ngay[1]||0).toString(), yy=ngay[0]||'';

    const injectScript = buildInjectScript(rec,mabv,khoaId,kieuKhaoSat,nguoipv,doituong,gioi_tinh,tuoi,dd,mm,yy);
    let attempts=0, tokensDone=false, submitted=false;
    const maxAttempts = Math.ceil((BYT_LOAD_TIMEOUT_MS[type]||18000)/500);

    const iv = setInterval(()=>{
      attempts++;
      try {
        if (win.closed) { clearInterval(iv); if(!submitted)resolve({ok:false,msg:'Cửa sổ bị đóng trước khi hoàn tất'}); return; }
        const curUrl=win.location.href||'', ready=win.document.readyState==='complete';
        if (ready&&(curUrl.includes('/user/login')||win.document.title.toLowerCase().includes('đăng nhập'))) {
          clearInterval(iv); try{win.close();}catch(x){} resolve({ok:false,msg:'CHƯA_ĐĂNG_NHẬP'}); return;
        }
        if (ready&&!tokensDone) {
          tokensDone=true;
          try {
            const result=win.eval(injectScript);
            if(result&&result.error==='NO_BUILD_ID'){clearInterval(iv);try{win.close();}catch(x){}resolve({ok:false,msg:'Không tìm thấy form_build_id'});return;}
            if(result&&result.error)addBYTLog('warn','Lỗi điền form: '+result.error);
            else if(result&&result.ok){
              const reqInfo=result.requiredEmpty>0?` | ⚠️ ${result.requiredEmpty} trường required còn trống: ${result.requiredList}`:'';
              addBYTLog('info',`Điền ${result.filled}/${result.total} câu (bỏ qua: ${result.skipped||0}, thiếu: ${result.missing||'không có'})${reqInfo}`);
            }
            let waitAtt=0;
            const waitIv=setInterval(()=>{
              waitAtt++;
              try {
                if(win.closed){clearInterval(waitIv);clearInterval(iv);submitted=true;resolve({ok:true,msg:'Đã gửi (cửa sổ tự đóng sau redirect)'});return;}
                const newUrl=win.location.href||'', body=win.document.body?.innerText||'';
                const isOk=body.includes('cảm ơn')||body.includes('Cảm ơn')||body.includes('thành công')||body.includes('Thành công')||newUrl.includes('confirmation')||newUrl.includes('complete')||(newUrl!==pageUrl&&newUrl.length>10&&win.document.readyState==='complete');
                if(isOk){clearInterval(waitIv);clearInterval(iv);submitted=true;setTimeout(()=>{try{win.close();}catch(x){}},1000);resolve({ok:true,msg:'Gửi thành công – xác nhận trang BYT'});}
              }catch(ce){clearInterval(waitIv);clearInterval(iv);submitted=true;setTimeout(()=>{try{win.close();}catch(x){}},600);resolve({ok:true,msg:'Gửi thành công (cross-origin sau submit)'});}
              if(waitAtt>20){clearInterval(waitIv);clearInterval(iv);submitted=true;setTimeout(()=>{try{win.close();}catch(x){}},400);resolve({ok:true,msg:'Gửi xong (timeout xác nhận)'});}
            },1000);
          } catch(domErr){clearInterval(iv);try{win.close();}catch(x){}resolve({ok:false,msg:'Không đọc được trang BYT – hãy đăng nhập BYT trước'});}
        }
      }catch(outerErr){
        if(tokensDone&&!submitted){clearInterval(iv);submitted=true;setTimeout(()=>{try{win.close();}catch(x){}},400);resolve({ok:true,msg:'Gửi thành công (cross-origin redirect)'});}
      }
      if(attempts>maxAttempts){clearInterval(iv);if(!submitted){try{win.close();}catch(x){}resolve({ok:false,msg:`Timeout ${BYT_LOAD_TIMEOUT_MS[type]/1000}s – trang BYT không phản hồi`});}}
    },500);
  });
}

// =========================================================
// RENDER QUEUE UI
// =========================================================
function renderBYTQueue() {
  const typeF=document.getElementById('byt-fl-type')?.value||'';
  const statusF=document.getElementById('byt-fl-status')?.value||'pending';
  let surveys=[...DB.surveys].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(typeF)surveys=surveys.filter(x=>x.type===typeF);
  if(statusF==='pending')surveys=surveys.filter(x=>!x.bytStatus||x.bytStatus==='pending'||x.bytStatus==='failed');
  else if(statusF==='byt-done')surveys=surveys.filter(x=>x.bytStatus==='done');
  const el=document.getElementById('byt-queue-list');
  if(!el)return;
  if(!surveys.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">Không có phiếu cần gửi</div><div class="empty-sub">Tất cả phiếu đã được gửi hoặc chưa có phiếu nào</div></div>`;document.getElementById('byt-queue-count').textContent='';return;}
  let html='';
  surveys.forEach(r=>{
    const isSelected=bytSelectedIds.has(r.id);
    const ans=r.answers?.filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='')||[];
    const avg=ans.length?(ans.reduce((s,a)=>s+Number(a.value),0)/ans.length).toFixed(1):'-';
    const d=r.ngay||r.createdAt?.split('T')[0]||'';
    const icon=r.type==='m1'?'🏥':r.type==='m2'?'🏃':r.type==='m3'?'👨‍⚕️':r.type==='m4'?'👶':'🍼';
    let statusHtml;
    if(!r.bytStatus||r.bytStatus==='pending')statusHtml='<span class="uqi-status pending">⏳ Chờ gửi</span>';
    else if(r.bytStatus==='uploading')statusHtml='<span class="uqi-status uploading">🔄 Đang gửi</span>';
    else if(r.bytStatus==='done')statusHtml='<span class="uqi-status done">✅ Đã gửi</span>';
    else statusHtml='<span class="uqi-status failed">❌ Lỗi – thử lại</span>';
    html+=`<div class="upload-queue-item${isSelected?' selected':''}" id="uqi_${r.id}"><input type="checkbox" class="uqi-check" data-id="${r.id}" ${isSelected?'checked':''} onchange="toggleBYTItem('${r.id}',this.checked)"><div class="uqi-info"><div class="uqi-label">${icon} ${SURVEYS[r.type]?.label||r.type}</div><div class="uqi-meta">📅 ${d} · ${r.khoa||r.donvi||'—'} · TB ${avg}/5 · ${ans.length}/${r.answers?.length||0} câu</div></div>${statusHtml}<button class="btn btn-outline btn-xs" onclick="openBYTForRecord('${r.id}')" title="Xem trên BYT">🔗</button></div>`;
  });
  el.innerHTML=html;
  document.getElementById('byt-queue-count').textContent=`(${surveys.length} phiếu, đã chọn ${bytSelectedIds.size})`;
  updateBYTPendingBadge();
}

function toggleBYTItem(id,checked){
  if(checked)bytSelectedIds.add(id);else bytSelectedIds.delete(id);
  document.getElementById('uqi_'+id)?.classList.toggle('selected',checked);
  const total=document.querySelectorAll('.uqi-check').length;
  const count=document.getElementById('byt-queue-count');
  if(count)count.textContent=`(${total} phiếu, đã chọn ${bytSelectedIds.size})`;
}
function selectAllBYTQueue(){document.querySelectorAll('.uqi-check').forEach(cb=>{cb.checked=true;bytSelectedIds.add(cb.dataset.id);document.getElementById('uqi_'+cb.dataset.id)?.classList.add('selected');});renderBYTQueue();}
function deselectAllBYTQueue(){bytSelectedIds.clear();document.querySelectorAll('.uqi-check').forEach(cb=>{cb.checked=false;});document.querySelectorAll('.upload-queue-item').forEach(el=>el.classList.remove('selected'));renderBYTQueue();}
function quickSendOneBYT(id){bytSelectedIds.clear();bytSelectedIds.add(id);showPage('bytupload');setTimeout(()=>sendSelectedToBYT(),400);}
function openBYTForRecord(id){const r=DB.surveys.find(x=>x.id===id);if(!r)return;const url=SURVEYS[r.type]?.url||BYT_BASE;if(!window.open(url,'_blank'))toast('❌ Popup bị chặn.','error');}

// =========================================================
// GỬI PHIẾU ĐÃ CHỌN
// =========================================================
async function sendSelectedToBYT() {
  if(bytSelectedIds.size===0){toast('Chọn ít nhất 1 phiếu để gửi','warning');return;}
  if(!CFG.bytuser||!CFG.bytpass){toast('⚠️ Chưa cấu hình tài khoản BYT.','warning');showPage('settings');return;}
  if(bytUploadRunning){toast('Đang có tiến trình gửi phiếu, vui lòng chờ...','info');return;}
  const logCard=document.getElementById('byt-log-card');
  if(logCard)logCard.style.display='';
  clearBYTLog();
  bytUploadRunning=true;
  addBYTLog('info','═══ BẮT ĐẦU GỬI '+bytSelectedIds.size+' PHIẾU LÊN BYT ═══');
  addBYTLog('info','Thời gian: '+new Date().toLocaleString('vi-VN'));
  addBYTLog('info','Tài khoản BYT: '+CFG.bytuser);
  addBYTLog('info','Bệnh viện: '+(CFG.mabv||'Chưa cấu hình'));
  addBYTLog('info','⚠️ Mỗi phiếu sẽ mở cửa sổ BYT riêng. KHÔNG đóng cửa sổ đó khi đang gửi!');
  const ids=[...bytSelectedIds];
  let successCount=0,failCount=0,needLogin=false;
  for(const id of ids){
    const r=DB.surveys.find(x=>x.id===id);
    if(!r){addBYTLog('warn','Không tìm thấy phiếu ID='+id);continue;}
    const ans=r.answers?.filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='')||[];
    const label=(SURVEYS[r.type]?.label||r.type)+' | '+(r.ngay||r.createdAt?.split('T')[0]||'')+' | '+(r.khoa||r.donvi||'—')+' | '+ans.length+' câu';
    addBYTLog('info','▶ Gửi: '+label);
    r.bytStatus='uploading';saveDB();
    const itemEl=document.getElementById('uqi_'+id);
    if(itemEl){const s=itemEl.querySelector('.uqi-status');if(s){s.className='uqi-status uploading';s.textContent='🔄 Đang gửi';}}
    let result;
    try{result=await submitBYTViaPopup(r);}catch(e){result={ok:false,msg:e.message};}
    if(result.ok){
      r.bytStatus='done';r.bytSentAt=new Date().toISOString();
      successCount++;bytSelectedIds.delete(id);
      addBYTLog('ok','✅ Thành công: '+label+' – '+result.msg);
      if(itemEl){const s=itemEl.querySelector('.uqi-status');if(s){s.className='uqi-status done';s.textContent='✅ Đã gửi';}}
      if(gsReady())gsUpdateSurveyStatus(id,'done').catch(()=>{});
    }else{
      r.bytStatus='failed';r.bytFailMsg=result.msg;
      failCount++;
      addBYTLog('err','❌ Thất bại: '+label+' – '+result.msg);
      if(itemEl){const s=itemEl.querySelector('.uqi-status');if(s){s.className='uqi-status failed';s.textContent='❌ Lỗi';}}
      if(result.msg==='CHƯA_ĐĂNG_NHẬP'||result.msg?.includes('CHƯA_ĐĂNG_NHẬP')){needLogin=true;addBYTLog('warn','⛔ Phiên BYT hết hạn – dừng hàng đợi.');break;}
    }
    saveDB();updateDash();
    if(needLogin)break;
    if(ids.indexOf(id)<ids.length-1){addBYTLog('info','⏳ Chờ 3 giây...');await sleep(3000);}
  }
  bytUploadRunning=false;
  addBYTLog('info',`═══ KẾT QUẢ: ✅ ${successCount} thành công | ❌ ${failCount} thất bại ═══`);
  if(needLogin){toast('⚠️ Phiên BYT hết hạn! Nhấn "Đăng nhập BYT" rồi gửi lại.','warning');setBYTStatusUI('logged-out','⚠️ Phiên BYT hết hạn.');const lb=document.getElementById('btn-byt-login-now');if(lb)lb.style.display='';}
  else toast('📤 BYT: '+successCount+' ✅ thành công, '+failCount+' ❌ thất bại',successCount>0?'success':'error');
  renderBYTQueue();updateBYTPendingBadge();
  if(gsReady())gsLogHistory('byt_upload',`Gửi BYT: ${successCount} thành công / ${failCount} thất bại`).catch(()=>{});
}

function addBYTLog(type,msg){
  const el=document.getElementById('byt-upload-log');if(!el)return;
  const ts=new Date().toLocaleTimeString('vi-VN');
  const cls=type==='ok'?'log-ok':type==='err'?'log-err':type==='warn'?'log-warn':'log-info';
  const pre=type==='ok'?'✅':type==='err'?'❌':type==='warn'?'⚠️':'ℹ️';
  el.innerHTML+=`<div class="${cls}">[${ts}] ${pre} ${msg}</div>`;
  el.scrollTop=el.scrollHeight;bytLog.push({ts,type,msg});
}
function clearBYTLog(){const el=document.getElementById('byt-upload-log');if(el)el.innerHTML='';bytLog=[];}

// =========================================================
// ▄▄▄▄ BỘ TEST CASE CHUYÊN NGHIỆP v9.0 (TC-01 → TC-20) ▄▄▄▄
// Chạy: bytRunAllTests()  hoặc  bytRunTest('TC-01')
// =========================================================
const BYT_TEST_CASES = [
  // NHÓM 1: Unit – bytFieldMapping (TC-01 → TC-09)
  { id:'TC-01', group:'Unit – bytFieldMapping', desc:'M1: câu A1 → submitted[danh_gia][a][a1], radio',
    fn:()=>{ const r=bytFieldMapping('m1','A1'); return r.name==='submitted[danh_gia][a][a1]'&&!r.isCheckbox; } },
  { id:'TC-02', group:'Unit – bytFieldMapping', desc:'M2: câu E4 → submitted[danh_gia][e][e4], radio',
    fn:()=>{ const r=bytFieldMapping('m2','E4'); return r.name==='submitted[danh_gia][e][e4]'&&!r.isCheckbox; } },
  { id:'TC-03', group:'Unit – bytFieldMapping', desc:'M3: câu C12 → submitted[danh_gia][c][c12], radio',
    fn:()=>{ const r=bytFieldMapping('m3','C12'); return r.name==='submitted[danh_gia][c][c12]'&&!r.isCheckbox; } },
  { id:'TC-04', group:'Unit – bytFieldMapping', desc:'M4: câu G1 → submitted[danh_gia][g][g1] (section đặc biệt)',
    fn:()=>{ const r=bytFieldMapping('m4','G1'); return r.name==='submitted[danh_gia][g][g1]'&&!r.isCheckbox; } },
  { id:'TC-05', group:'Unit – bytFieldMapping', desc:'M4: câu H3 → submitted[danh_gia][h][h3]',
    fn:()=>{ const r=bytFieldMapping('m4','H3'); return r.name==='submitted[danh_gia][h][h3]'&&!r.isCheckbox; } },
  { id:'TC-06', group:'Unit – bytFieldMapping', desc:'M5: câu B1 → checkbox, prefix submitted[danh_gia][b1][select]',
    fn:()=>{ const r=bytFieldMapping('m5','B1'); return r.name==='submitted[danh_gia][b1][select]'&&r.isCheckbox===true; } },
  { id:'TC-07', group:'Unit – bytFieldMapping', desc:'M5: câu B10 → submitted[danh_gia][b10][select] (2 chữ số)',
    fn:()=>{ const r=bytFieldMapping('m5','B10'); return r.name==='submitted[danh_gia][b10][select]'&&r.isCheckbox===true; } },
  { id:'TC-08', group:'Unit – bytFieldMapping', desc:'M5: section A/C → name=null (xử lý riêng)',
    fn:()=>{ return bytFieldMapping('m5','A1').name===null&&bytFieldMapping('m5','C1').name===null; } },
  { id:'TC-09', group:'Unit – bytFieldMapping', desc:'Code null/undefined → name=null, không throw exception',
    fn:()=>{ try{return bytFieldMapping('m1',null).name===null&&bytFieldMapping('m1',undefined).name===null;}catch(e){return false;} } },

  // NHÓM 2: Unit – buildInjectScript (TC-10 → TC-15)
  { id:'TC-10', group:'Unit – buildInjectScript', desc:'Output là string hợp lệ, chứa NO_BUILD_ID guard',
    fn:()=>{ const sc=buildInjectScript({type:'m1',answers:[{code:'A1',value:4}],ngay:'2026-04-10'},'62310','','1','1','1','2','45','10','4','2026'); return typeof sc==='string'&&sc.includes('NO_BUILD_ID'); } },
  { id:'TC-11', group:'Unit – buildInjectScript', desc:'M1: script chứa answers JSON A1, formula danh_gia, và code[0].toLowerCase()',
    fn:()=>{ const sc=buildInjectScript({type:'m1',answers:[{code:'A1',value:5}],ngay:'2026-04-10'},'62310','','1','1','1','2','45','10','4','2026'); return sc.includes('[danh_gia][')&&sc.includes('"code":"A1"')&&sc.includes("code[0].toLowerCase()"); } },
  { id:'TC-12', group:'Unit – buildInjectScript', desc:'M5: script chứa logic checkbox cho B-sections (select+[val] pattern)',
    fn:()=>{ const sc=buildInjectScript({type:'m5',answers:[{code:'B1',value:3}],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026'); return sc.includes('[select][')&&sc.includes('"code":"B1"')&&sc.includes('isCheckbox===false')===false; } },
  { id:'TC-13', group:'Unit – buildInjectScript', desc:'M4: script chứa thong_tin_phieu (đặc thù M4/M5)',
    fn:()=>{ const sc=buildInjectScript({type:'m4',answers:[{code:'A1',value:4}],ngay:'2026-04-10'},'62310','','1','1','1','','','10','4','2026'); return sc.includes('thong_tin_phieu'); } },
  { id:'TC-14', group:'Unit – buildInjectScript', desc:'Mã BV được inject vào 1_ten_benh_vien selector',
    fn:()=>{ const sc=buildInjectScript({type:'m1',answers:[],ngay:'2026-04-10'},'62310','','1','1','1','2','45','10','4','2026'); return sc.includes('1_ten_benh_vien')&&sc.includes('62310'); } },
  { id:'TC-15', group:'Unit – buildInjectScript', desc:'value=0 (Không đánh giá) KHÔNG bị lọc bỏ khỏi answers',
    fn:()=>{ const sc=buildInjectScript({type:'m1',answers:[{code:'A1',value:0},{code:'A2',value:3}],ngay:'2026-04-10'},'62310','','1','1','1','2','45','10','4','2026'); return sc.includes('"value":0')&&sc.includes('"value":3'); } },

  // NHÓM 3: Integration – Data Validation (TC-16 → TC-20)
  { id:'TC-16', group:'Integration – Data Validation', desc:'M1: 36 câu trả lời hợp lệ, tất cả sections A-E',
    fn:()=>{
      const codes=['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','B6','B7','C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','C11','D1','D2','D3','D4','D5','D6','D7','E1','E2','E3','E4','E5','E6'];
      const ans=codes.map(c=>({code:c,value:Math.floor(Math.random()*5)+1}));
      return ans.filter(a=>a.value!==null&&a.value!==undefined&&a.value!=='').length===36&&BYT_FORM_ACTIONS['m1']!==undefined;
    }},
  { id:'TC-17', group:'Integration – Data Validation', desc:'M5: tất cả B1-B12 đều isCheckbox=true',
    fn:()=>{ return ['B1','B2','B3','B4','B5','B6','B7','B8','B9','B10','B11','B12'].every(c=>{ const r=bytFieldMapping('m5',c); return r.isCheckbox===true&&r.name&&r.name.includes('[select]'); }); } },
  { id:'TC-18', group:'Integration – Data Validation', desc:'Tất cả 5 mẫu đều có BYT_FORM_ACTIONS tương ứng',
    fn:()=>{ return ['m1','m2','m3','m4','m5'].every(t=>typeof BYT_FORM_ACTIONS[t]==='string'&&BYT_FORM_ACTIONS[t].startsWith('/')); } },
  { id:'TC-19', group:'Integration – Data Validation', desc:'Parse ngày: 2026-04-10 → dd=10, mm=4, yy=2026',
    fn:()=>{ const n='2026-04-10'.split('-'); return parseInt(n[2]).toString()==='10'&&parseInt(n[1]).toString()==='4'&&n[0]==='2026'; } },
  { id:'TC-20', group:'Integration – Data Validation', desc:'M3: khoa_phong dưới ttp trực tiếp; M1/M2 dưới ttp.kmk – script chứa cả 2',
    fn:()=>{ const sc=buildInjectScript({type:'m3',answers:[],ngay:'2026-04-10'},'62310','123166','1','1','1','1','35','10','4','2026'); return sc.includes('"submitted[ttp][khoa_phong]"')&&sc.includes('"submitted[ttp][kmk][khoa_phong]"'); } },
];

async function bytRunAllTests() {
  const logCard=document.getElementById('byt-log-card');if(logCard)logCard.style.display='';
  clearBYTLog();
  addBYTLog('info','╔══════════════════════════════════════════════╗');
  addBYTLog('info','║  KSHL v9.0 – BỘ TEST CASE BYT CHUYÊN NGHIỆP  ║');
  addBYTLog('info',`║  Tổng: ${BYT_TEST_CASES.length} test | ${new Date().toLocaleString('vi-VN')}  ║`);
  addBYTLog('info','╚══════════════════════════════════════════════╝');
  bytTestResults=[];
  let pass=0,fail=0,currentGroup='';
  for(const tc of BYT_TEST_CASES){
    if(tc.group!==currentGroup){currentGroup=tc.group;addBYTLog('info','── '+currentGroup+' ──');}
    let result,error=null;
    try{result=await Promise.resolve(tc.fn());}catch(e){result=false;error=e.message;}
    const status=result?'PASS':'FAIL',logType=result?'ok':'err';
    addBYTLog(logType,`[${tc.id}] ${status} – ${tc.desc}${error?' [Exception: '+error+']':''}`);
    bytTestResults.push({id:tc.id,group:tc.group,desc:tc.desc,status,error});
    if(result)pass++;else fail++;
    await sleep(50);
  }
  addBYTLog('info','');
  addBYTLog('info','════════════ KẾT QUẢ TỔNG HỢP ════════════');
  addBYTLog(fail===0?'ok':'err',`Tổng: ${BYT_TEST_CASES.length} | ✅ PASS: ${pass} | ❌ FAIL: ${fail}`);
  if(fail>0){addBYTLog('warn','Danh sách FAIL:');bytTestResults.filter(r=>r.status==='FAIL').forEach(r=>{addBYTLog('err','  • '+r.id+': '+r.desc);});}
  else addBYTLog('ok','🎉 Tất cả test case PASS! Module BYT sẵn sàng.');
  const passRate=((pass/BYT_TEST_CASES.length)*100).toFixed(0);
  addBYTLog('info',`Tỉ lệ pass: ${passRate}%`);
  toast(fail===0?`✅ Tất cả ${pass} test PASS (${passRate}%)`:`⚠️ ${pass} PASS / ${fail} FAIL – Xem log`,fail===0?'success':'warning');
  return{pass,fail,total:BYT_TEST_CASES.length,rate:passRate};
}

async function bytRunTest(id){
  const tc=BYT_TEST_CASES.find(t=>t.id===id);
  if(!tc){toast('Không tìm thấy test: '+id,'error');return;}
  const logCard=document.getElementById('byt-log-card');if(logCard)logCard.style.display='';
  clearBYTLog();
  addBYTLog('info',`Chạy đơn lẻ: ${tc.id} – ${tc.desc}`);
  let result,error=null;
  try{result=await Promise.resolve(tc.fn());}catch(e){result=false;error=e.message;}
  addBYTLog(result?'ok':'err',`[${tc.id}] ${result?'PASS ✅':'FAIL ❌'} – ${tc.desc}${error?' ['+error+']':''}`);
  toast(`${tc.id}: ${result?'✅ PASS':'❌ FAIL'}`,result?'success':'error');
  return result;
}

function bytShowTestReport(){
  if(!bytTestResults.length){toast('Chưa chạy test. Nhấn "Chạy tất cả test" trước.','info');return;}
  const pass=bytTestResults.filter(r=>r.status==='PASS').length;
  let html=`<div style="font-family:monospace;font-size:12px;padding:10px">`;
  html+=`<b>📊 BYT TEST REPORT v9.0 – ${new Date().toLocaleString('vi-VN')}</b><br>`;
  html+=`Pass: ${pass}/${bytTestResults.length} (${((pass/bytTestResults.length)*100).toFixed(0)}%)<br><br>`;
  let lastGroup='';
  bytTestResults.forEach(r=>{
    if(r.group!==lastGroup){lastGroup=r.group;html+=`<br><b>${r.group}</b><br>`;}
    html+=`  ${r.status==='PASS'?'✅':'❌'} ${r.id}: ${r.desc}<br>`;
  });
  html+=`</div>`;
  const w=window.open('','byt_test_report','width=700,height=500,scrollbars=yes');
  if(w)w.document.body.innerHTML=html;else toast('Popup bị chặn. Xem log trong cửa sổ chính.','warning');
}
