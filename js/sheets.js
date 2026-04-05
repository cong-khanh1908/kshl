// sheets.js – Google Sheets engine, đồng bộ dữ liệu, cấu hình, lịch sử
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// ============================================================

// =========================================================
// GOOGLE SHEETS
// =========================================================
async function syncToSheets(showMsg=true){
  if(!gsReady()){if(showMsg)toast('Chưa cấu hình Google Sheets','warning');return;}
  const pending=DB.surveys.filter(x=>x.status==='pending');
  if(!pending.length){if(showMsg)toast('Không có phiếu cần đồng bộ','info');return;}
  if(showMsg)toast(`Đang đồng bộ ${pending.length} phiếu...`,'info');
  let ok=0;
  for(const r of pending){
    const success=await gsPushOneSurvey(r);
    if(success){r.status='synced';ok++;}
  }
  saveDB();updateDash();
  if(showMsg)toast(`✅ Đồng bộ ${ok}/${pending.length} phiếu`,ok===pending.length?'success':'warning');
}
async function autoSync(){if(navigator.onLine&&gsReady()&&DB.surveys.some(x=>x.status==='pending'))await syncToSheets(false);}

// =========================================================
// AUTOFILL
// =========================================================
function loadAFList(){
  const type=document.getElementById('af-type').value,sel=document.getElementById('af-record');
  sel.innerHTML='<option value="">--Chọn phiếu--</option>';
  if(!type)return;
  DB.surveys.filter(x=>x.type===type).slice().reverse().forEach(r=>{
    const d=r.ngay||r.createdAt?.split('T')[0]||'',ans=r.answers?.filter(a=>a.value!==null).length||0;
    sel.innerHTML+=`<option value="${r.id}">${d} – ${r.khoa||r.donvi||''} (${ans}/${r.answers?.length||0})</option>`;
  });
}
function genScript(){
  const id=document.getElementById('af-record').value;if(!id){toast('Chọn phiếu trước','warning');return;}
  const r=DB.surveys.find(x=>x.id===id);if(!r)return;
  const script=`// Auto-fill: ${SURVEYS[r.type]?.label} | ${r.ngay||r.createdAt?.split('T')[0]} | CHỈ dùng trên hailong.chatluongbenhvien.vn
(function(){
  const answers=${JSON.stringify((r.answers||[]).map(a=>({code:a.code,q:a.question.substring(0,35),v:a.value})))};
  function fill(idx,val){if(!val||val===0)return;const gs=document.querySelectorAll('.webform-component-radios,.form-type-radios,[class*="question-group"]');const g=gs[idx];if(!g)return;g.querySelectorAll('input[type="radio"]').forEach(r=>{if(parseInt(r.value)===val){r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));}});}
  let n=0;answers.forEach((a,i)=>{if(a.v&&a.v>0){fill(i,a.v);n++;}});
  console.group('📋 ${SURVEYS[r.type]?.label}');answers.forEach(a=>console.log(a.code+':',a.v||'—','|',a.q));console.groupEnd();
  alert('✅ Điền '+n+'/'+answers.length+' câu.\\n⚠️ Kiểm tra trước khi nhấn Gửi!');
})();`;
  const out=document.getElementById('script-out');
  out.innerHTML=`<button class="code-copy-btn" onclick="copyScript()">📋 Copy</button><pre style="white-space:pre-wrap;margin-top:5px;font-size:10.5px;">${script.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`;
  out.dataset.raw=script;document.getElementById('script-section').style.display='';toast('Script tạo xong!','success');
}
function copyScript(){navigator.clipboard.writeText(document.getElementById('script-out').dataset.raw).then(()=>toast('✅ Đã copy!','success'));}
function openBYT(){const type=document.getElementById('af-type').value;window.open(type?SURVEYS[type]?.url:'https://hailong.chatluongbenhvien.vn/user/login','_blank');}
function renderBYTLinks(){
  const links=Object.entries(SURVEYS).map(([k,v])=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--surface2);"><span style="font-size:12.5px;font-weight:500;flex:1">${v.label}</span><a href="${v.url}" target="_blank" class="btn btn-outline btn-xs">Mở →</a></div>`).join('');
  const el=document.getElementById('byt-links');if(el)el.innerHTML=links;
}

// =========================================================
// SETTINGS
// =========================================================
function saveCfgSheets(){
  CFG.sheetid   = document.getElementById('cfg-sheetid').value.trim();
  const saEmail = (document.getElementById('cfg-sa-email')?.value||'').trim();
  const saKey   = (document.getElementById('cfg-sa-key')?.value||'').trim();
  if (saEmail) CFG.sa_email = saEmail;
  if (saKey)   CFG.sa_key   = saKey;
  if (!CFG.sa_email) CFG.sa_email = SA_DEFAULT.sa_email;
  if (!CFG.sa_key)   CFG.sa_key   = SA_DEFAULT.sa_key;
  CFG.sheetname = document.getElementById('cfg-sheetname').value.trim() || 'SURVEYS';
  _gsToken = null; _gsTokenExp = 0;
  saveCFG();
  if (!CFG.sheetid) { toast('⚠️ Vui lòng nhập Spreadsheet ID', 'warning'); return; }
  loadCfgToUI();
  refreshShareLink();
  toast('✅ Đã lưu – đang kiểm tra kết nối...', 'success');
  setTimeout(() => testSheets(), 400);
}

function parseSAJson() {
  const raw = document.getElementById('cfg-sa-json-paste').value.trim();
  if (!raw) { toast('Dán nội dung JSON key vào ô trước', 'warning'); return; }
  try {
    const j = JSON.parse(raw);
    if (j.type !== 'service_account') { toast('❌ File JSON không phải Service Account', 'error'); return; }
    if (!j.client_email || !j.private_key) { toast('❌ JSON thiếu client_email hoặc private_key', 'error'); return; }
    document.getElementById('cfg-sa-email').value = j.client_email;
    document.getElementById('cfg-sa-key').value = j.private_key.replace(/\\n/g, '\n');
    document.getElementById('cfg-sa-json-paste').value = '';
    toast(`✅ Đã điền email và Private Key. Nhấn "Lưu" để áp dụng.`, 'success');
  } catch(e) { toast('❌ JSON không hợp lệ: ' + e.message, 'error'); }
}

async function testSheets(){
  const el = document.getElementById('cfg-sheets-status');
  el.textContent = '🔄 Đang kiểm tra kết nối...';
  // Save current values first
  const sheetid  = document.getElementById('cfg-sheetid').value.trim();
  const sa_email = (document.getElementById('cfg-sa-email')?.value||'').trim();
  const sa_key   = (document.getElementById('cfg-sa-key')?.value||'').trim();
  if (!sheetid || !sa_email || !sa_key) {
    el.innerHTML = '<span style="color:var(--accent2)">❌ Vui lòng điền đủ thông tin trước khi kiểm tra</span>';
    return;
  }
  // Temporarily set to test
  const prev = { sheetid:CFG.sheetid, sa_email:CFG.sa_email, sa_key:CFG.sa_key };
  CFG.sheetid = sheetid; CFG.sa_email = sa_email; CFG.sa_key = sa_key;
  _gsToken = null; _gsTokenExp = 0;
  try {
    const token = await gsGetToken();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetid}?fields=properties.title,sheets.properties.title`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const d = await res.json();
    if (d.properties) {
      const tabs = (d.sheets||[]).map(s=>s.properties.title);
      const needed = ['CONFIG','SURVEYS','USERS','DEPTS','HISTORY','REQUESTS'];
      const missing = needed.filter(t=>!tabs.includes(t));
      el.innerHTML = `<span style="color:var(--success)">✅ Kết nối thành công: <b>${d.properties.title}</b><br>Tabs hiện có: ${tabs.join(', ')||'(trống)'}${missing.length?`<br><span style="color:var(--warning)">⚠️ Thiếu tabs: ${missing.join(', ')} → Nhấn "Tạo cấu trúc Sheets"</span>`:'<br>✅ Đủ cấu trúc 5 tabs'}</span>`;
      updateGSConnBadge(true);
      saveCFG();
    } else {
      el.innerHTML = `<span style="color:var(--accent2)">❌ ${d.error?.message||'Không đọc được Spreadsheet'}</span>`;
      Object.assign(CFG, prev);
    }
  } catch(e) {
    el.innerHTML = `<span style="color:var(--accent2)">❌ ${e.message}</span>`;
    Object.assign(CFG, prev);
    updateGSConnBadge(false);
  }
}
function saveCfgAll(){
  CFG.hvname   = document.getElementById('cfg-hvname').value.trim();
  CFG.province = document.getElementById('cfg-province').value.trim();
  CFG.hang     = document.getElementById('cfg-hang').value;
  CFG.bytuser  = document.getElementById('cfg-bytuser').value.trim();
  CFG.bytpass  = document.getElementById('cfg-bytpass').value;
  const cbAuto = document.getElementById('cfg-auto-upload-settings');
  if(cbAuto) CFG.autoUploadBYT = cbAuto.checked;
  loadAutoUploadCheckboxes();
  saveCFG();
  if(CFG.hvname){
    document.getElementById('sb-hospital-name').textContent=CFG.hvname;
    ['m1','m2','m3','m4','m5'].forEach(k=>{['benhvien','donvi'].forEach(f=>{const el=document.getElementById(`${k}_${f}`);if(el&&!el.value)el.value=CFG.hvname;});});
  }
  toast('✅ Đã lưu – đang đồng bộ lên Cloud cho tất cả thiết bị...','success');
  if(navigator.onLine && gsReady()){
    gsPushConfig()
      .then(()=>gsPushUsers())
      .then(()=>gsPushDepts())
      .then(()=>{ toast('☁️ Cấu hình đã đồng bộ Cloud – các thiết bị sẽ nhận khi đăng nhập lần sau','success'); gsLogHistory('save_config','Admin lưu cấu hình'); })
      .catch(e=>toast('⚠️ Đồng bộ Cloud thất bại: '+e.message,'warning'));
  } else if(!gsReady()){
    toast('⚠️ Chưa kết nối Cloud – cấu hình chỉ lưu cục bộ','warning');
  }
}
function loadCfgToUI(){
  const map={'cfg-sheetid':'sheetid','cfg-sa-email':'sa_email','cfg-sheetname':'sheetname','cfg-hvname':'hvname','cfg-province':'province','cfg-hang':'hang','cfg-bytuser':'bytuser','cfg-bytpass':'bytpass'};
  Object.entries(map).forEach(([elId,key])=>{const e=document.getElementById(elId);if(e&&CFG[key])e.value=CFG[key];});
  const keyEl=document.getElementById('cfg-sa-key');
  if(keyEl&&CFG.sa_key) keyEl.value=CFG.sa_key;
  const saInfo=document.getElementById('sa-default-info');
  if(saInfo){
    const activeEmail=CFG.sa_email||SA_DEFAULT.sa_email;
    if(activeEmail===SA_DEFAULT.sa_email){
      saInfo.innerHTML='<span style="color:#2E7D32;font-size:11px;">✅ SA <b>kshl-328</b> tích hợp sẵn – chỉ cần nhập Spreadsheet ID</span>';
    } else {
      saInfo.innerHTML='<span style="color:#0D47A1;font-size:11px;">🔑 SA tùy chỉnh: <b>'+activeEmail.split('@')[0]+'</b></span>';
    }
  }
  loadAutoUploadCheckboxes();
  if(gsReady()) updateGSConnBadge(true);
  const li=document.getElementById('local-info');
  if(li) li.innerHTML='Tổng <b>'+DB.surveys.length+'</b> phiếu · <b>'+(JSON.stringify(DB).length/1024).toFixed(1)+' KB</b> · '+DEPTS.length+' khoa · '+USERS.length+' TK';
}

// =========================================================
// HISTORY MODULE
// =========================================================
let historyCache = [];

async function loadHistory() {
  if (!gsReady()) { toast('Chưa cấu hình Sheets', 'warning'); return; }
  toast('⏳ Đang tải lịch sử...', 'info');
  try {
    const rows = await gsReadRange(`${GS_TABS.HISTORY}!A1:E10000`);
    historyCache = rows.slice(1); // skip header
    renderHistoryTable(historyCache);
    toast(`✅ Đã tải ${historyCache.length} bản ghi lịch sử`, 'success');
  } catch(e) {
    toast('❌ Lỗi tải lịch sử: '+e.message, 'error');
  }
}

function loadHistoryPreview() {
  if (historyCache.length) { renderHistoryTable(historyCache); return; }
  if (gsReady()) loadHistory();
}

function renderHistoryTable(rows) {
  const el = document.getElementById('history-table-wrap');
  if (!el) return;
  if (!rows.length) { el.innerHTML='<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Chưa có lịch sử</div></div>'; return; }
  const ACTION_ICONS = {login:'🔑',save_survey:'📝',push_all:'⬆️',pull_all:'⬇️',save_config:'⚙️',init_sheets:'🏗️',save_user:'👤',auto_sync:'🔄',default:'📋'};
  let html = `<div class="table-wrap"><table class="data-table"><thead><tr>
    <th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Chi tiết</th><th>Thiết bị</th>
  </tr></thead><tbody>`;
  [...rows].reverse().forEach(r => {
    const ts = r[0]||''; const user=r[1]||''; const action=r[2]||''; const detail=r[3]||''; const device=r[4]||'';
    const icon = ACTION_ICONS[action] || ACTION_ICONS.default;
    const dt = ts ? new Date(ts).toLocaleString('vi-VN') : '';
    html += `<tr>
      <td style="font-size:11.5px;white-space:nowrap;font-family:var(--mono)">${dt}</td>
      <td><b>${user}</b></td>
      <td>${icon} <span style="font-size:11.5px">${action}</span></td>
      <td style="font-size:12px;color:var(--text2)">${detail}</td>
      <td style="font-size:10px;color:var(--text3)">${device}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function clearHistoryView() {
  historyCache = [];
  const el = document.getElementById('history-table-wrap');
  if (el) el.innerHTML = '<div class="empty-state"><div class="empty-icon">🕒</div><div class="empty-text">Nhấn "Tải từ Sheets" để xem lịch sử</div></div>';
}

// Update dashboard GS status
function updateGSDashStatus() {
  const el = document.getElementById('gs-dash-status');
  if (!el) return;
  if (!CFG.sheetid) { el.innerHTML = '⚠️ Chưa cấu hình Sheets – dữ liệu chỉ lưu cục bộ'; return; }
  const synced = DB.surveys.filter(x=>x.status==='synced').length;
  const pending = DB.surveys.filter(x=>x.status==='pending').length;
  const pct = DB.surveys.length ? Math.round(synced/DB.surveys.length*100) : 100;
  el.innerHTML = `☁️ Sheets: <b>${synced}</b> đã sync · <b style="color:var(--warning)">${pending}</b> pending · ${pct}% hoàn tất`;
  const bar = document.getElementById('sync-progress');
  if (bar) bar.style.width = pct+'%';
  if (CFG.sheetid) document.getElementById('sheets-status').innerHTML = `✅ Đã cấu hình: <b>${CFG.sheetid.substring(0,20)}...</b>`;
}

// =========================================================
// PERSISTENCE – LOCAL (cache layer)
// =========================================================
function saveDB()    { localStorage.setItem('kshl_v4_db',    JSON.stringify(DB));    }
function saveCFG()   { localStorage.setItem('kshl_v4_cfg',   JSON.stringify(CFG));   }
function saveUsers() { localStorage.setItem('kshl_v4_users', JSON.stringify(USERS)); }
function saveDepts() { localStorage.setItem('kshl_v4_depts', JSON.stringify(DEPTS)); }

// =========================================================
// GOOGLE SHEETS ENGINE  — Multi-tab Database
// Tabs: CONFIG | SURVEYS | USERS | DEPTS | HISTORY
// =========================================================
// GOOGLE SHEETS ENGINE — Service Account JWT Auth
// Tabs: CONFIG | SURVEYS | USERS | DEPTS | HISTORY
// =========================================================
const GS_TABS = { CONFIG:'CONFIG', SURVEYS:'SURVEYS', USERS:'USERS', DEPTS:'DEPTS', HISTORY:'HISTORY' };

// ---- JWT / OAuth2 token management ----
let _gsToken = null;
let _gsTokenExp = 0;

function gsReady() {
  return !!(CFG.sheetid && (CFG.sa_email || SA_DEFAULT.sa_email) && (CFG.sa_key || SA_DEFAULT.sa_key));
}

// Build JWT and exchange for access token via Google OAuth2
async function gsGetToken() {
  if (_gsToken && Date.now() < _gsTokenExp - 60000) return _gsToken;

  const email  = CFG.sa_email || SA_DEFAULT.sa_email;
  const rawKey = CFG.sa_key   || SA_DEFAULT.sa_key;

  // 1. Build JWT header + payload
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const b64u = s => btoa(unescape(encodeURIComponent(JSON.stringify(s))))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const sigInput = b64u(header) + '.' + b64u(payload);

  // 2. Sign with RS256 using Web Crypto API
  const pemBody = rawKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(sigInput)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const jwt = sigInput + '.' + sig;

  // 3. Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const d = await res.json();
  if (!d.access_token) throw new Error('Không lấy được token: ' + (d.error_description || d.error || JSON.stringify(d)));

  _gsToken = d.access_token;
  _gsTokenExp = Date.now() + (d.expires_in || 3600) * 1000;
  return _gsToken;
}

// ---- Core HTTP wrapper ----
async function gsRequest(path, method='GET', body=null) {
  if (!gsReady()) throw new Error('Chưa cấu hình Service Account');
  const token = await gsGetToken();
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.sheetid}`;
  const url = base + path;
  const opts = {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ---- Tab management ----
async function gsGetSheetsList() {
  const d = await gsRequest('?fields=sheets.properties');
  return (d.sheets||[]).map(s => s.properties.title);
}

async function gsEnsureTab(tabName, headers=[]) {
  try {
    const tabs = await gsGetSheetsList();
    if (!tabs.includes(tabName)) {
      await gsRequest(':batchUpdate', 'POST', {
        requests: [{ addSheet: { properties: { title: tabName, gridProperties: { frozenRowCount: 1 } } } }]
      });
      if (headers.length) await gsWriteRange(`${tabName}!A1`, [headers]);
      return true;
    }
    return false;
  } catch(e) { console.warn('ensureTab error:', e); return false; }
}

async function gsWriteRange(range, values) {
  return gsRequest(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, 'PUT', { values });
}

async function gsAppendRange(tabName, values) {
  return gsRequest(
    `/values/${encodeURIComponent(tabName + '!A1')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    'POST', { values }
  );
}

async function gsReadRange(range) {
  const d = await gsRequest(`/values/${encodeURIComponent(range)}`);
  return d.values || [];
}

async function gsClearRange(tabName) {
  return gsRequest(`/values/${encodeURIComponent(tabName + '!A2:ZZZ')}:clear`, 'POST', {});
}

// ---- Initialize Sheets structure ----
async function gsInitSheets() {
  if (!gsReady()) { toast('Nhập đầy đủ thông tin Service Account trước', 'warning'); return; }
  const el = document.getElementById('gs-sync-status');
  if (el) el.innerHTML = '🏗️ Đang tạo cấu trúc Sheets...';
  try {
    const cfgHdr  = ['key','value','updated_at'];
    const survHdr = ['id','createdAt','type','type_label','qd','ngay','khoa','gt','tuoi','sdt','bhyt','noiss','mucsong','lanthu','nguoitl','submittedBy','status','bytStatus','avg_score','answered_count','total_questions','notes','answers_json'];
    const usrHdr  = ['id','username','fullname','role','dept','password_hash'];
    const deptHdr = ['id','name','code','type'];
    const histHdr = ['timestamp','user','action','detail','device'];
    const reqHdr  = ['ID','Loại','Họ tên','Tên đăng nhập','Liên hệ','Khoa/Phòng','Lý do','Ưu tiên','Trạng thái','Thời gian tạo','Thời gian xử lý'];
    await gsEnsureTab(GS_TABS.CONFIG,  cfgHdr);
    await gsEnsureTab(GS_TABS.SURVEYS, survHdr);
    await gsEnsureTab(GS_TABS.USERS,   usrHdr);
    await gsEnsureTab(GS_TABS.DEPTS,   deptHdr);
    await gsEnsureTab(GS_TABS.HISTORY, histHdr);
    await gsEnsureTab('REQUESTS',      reqHdr);
    if (el) el.innerHTML = '✅ Tạo cấu trúc thành công! Sẵn sàng đồng bộ.';
    toast('✅ Đã tạo cấu trúc Sheets (6 tabs)', 'success');
    gsLogHistory('init_sheets', 'Tạo cấu trúc Sheets thành công (6 tabs: CONFIG, SURVEYS, USERS, DEPTS, HISTORY, REQUESTS)');
    updateGSConnBadge(true);
  } catch(e) {
    if (el) el.innerHTML = `❌ Lỗi: ${e.message}`;
    toast('❌ Lỗi tạo Sheets: ' + e.message, 'error');
  }
}

// ---- PUSH: Local → Sheets ----
async function gsPushAllData(showMsg=true) {
  if (!gsReady()) { if(showMsg) toast('Chưa cấu hình Service Account', 'warning'); return false; }
  if (showMsg) toast('⬆️ Đang đẩy toàn bộ dữ liệu lên Sheets...', 'info');
  const el = document.getElementById('gs-sync-status');
  if (el) el.innerHTML = '⬆️ Đang đẩy dữ liệu...';
  try {
    await gsPushConfig();
    await gsPushSurveys();
    await gsPushUsers();
    await gsPushDepts();
    const now = new Date().toLocaleString('vi-VN');
    CFG.lastPushed = now; saveCFG();
    if (el) el.innerHTML = `✅ Đẩy thành công lúc ${now}`;
    if (showMsg) toast('✅ Đã đẩy toàn bộ lên Sheets', 'success');
    gsLogHistory('push_all', `Push ${DB.surveys.length} phiếu, ${DEPTS.length} khoa, ${USERS.length} users`);
    updateGSConnBadge(true);
    return true;
  } catch(e) {
    if (el) el.innerHTML = `❌ Lỗi đẩy dữ liệu: ${e.message}`;
    if (showMsg) toast('❌ Lỗi: ' + e.message, 'error');
    return false;
  }
}

async function gsPushConfig() {
  const now = new Date().toISOString();
  const cfgData = Object.entries({
    hvname:        CFG.hvname||'',
    province:      CFG.province||'',
    hang:          CFG.hang||'',
    bytuser:       CFG.bytuser||'',
    bytpass:       btoa(unescape(encodeURIComponent(CFG.bytpass||''))),
    sheetid:       CFG.sheetid||'',
    sa_email:      CFG.sa_email||'',
    sa_key:        btoa(unescape(encodeURIComponent(CFG.sa_key||''))),
    sheetname:     CFG.sheetname||'SURVEYS',
    autoUploadBYT: String(CFG.autoUploadBYT||false),
    users_json:    JSON.stringify(USERS),
    depts_json:    JSON.stringify(DEPTS),
  }).map(([k,v]) => [k, v, now]);
  await gsClearRange(GS_TABS.CONFIG);
  if (cfgData.length) await gsAppendRange(GS_TABS.CONFIG, cfgData);
}

async function gsPushSurveys() {
  const rows = DB.surveys.map(surveyToRow);
  await gsClearRange(GS_TABS.SURVEYS);
  if (rows.length) await gsAppendRange(GS_TABS.SURVEYS, rows);
}

async function gsPushUsers() {
  await gsClearRange(GS_TABS.USERS);
  if (USERS.length) await gsAppendRange(GS_TABS.USERS,
    USERS.map(u => [u.id, u.username, u.fullname, u.role, u.dept||'', btoa(unescape(encodeURIComponent(u.password||'')))]));
}

async function gsPushDepts() {
  await gsClearRange(GS_TABS.DEPTS);
  if (DEPTS.length) await gsAppendRange(GS_TABS.DEPTS,
    DEPTS.map(d => [d.id, d.name, d.code||'', d.type||'lamsang']));
}

// ---- PULL: Sheets → Local ----
async function gsPullAllData(showMsg=true) {
  if (!gsReady()) { if(showMsg) toast('Chưa cấu hình Service Account', 'warning'); return false; }
  if (showMsg) toast('⬇️ Đang kéo dữ liệu từ Sheets...', 'info');
  const el = document.getElementById('gs-sync-status');
  if (el) el.innerHTML = '⬇️ Đang kéo dữ liệu...';
  try {
    await gsPullConfig();
    await gsPullSurveys();
    await gsPullUsers();
    await gsPullDepts();
    saveDB(); saveCFG(); saveUsers(); saveDepts();
    buildAllForms(); loadCfgToUI(); updateDash(); renderList(); refreshDeptDropdowns(); loadAutoUploadCheckboxes();
    const now = new Date().toLocaleString('vi-VN');
    if (el) el.innerHTML = `✅ Đồng bộ thành công lúc ${now}`;
    if (showMsg) toast(`✅ Kéo xong: ${DB.surveys.length} phiếu, ${DEPTS.length} khoa`, 'success');
    updateGSConnBadge(true);
    return true;
  } catch(e) {
    if (el) el.innerHTML = `❌ Lỗi kéo dữ liệu: ${e.message}`;
    if (showMsg) toast('❌ Lỗi: ' + e.message, 'error');
    return false;
  }
}

function safeDecode(s) {
  try { return decodeURIComponent(escape(atob(s))); } catch(e) { return s; }
}

async function gsPullConfig() {
  const rows = await gsReadRange(`${GS_TABS.CONFIG}!A2:C1000`);
  if (!rows.length) return;
  const map = {};
  rows.forEach(r => { if(r[0]) map[r[0]] = r[1]||''; });
  if (map.hvname)        CFG.hvname        = map.hvname;
  if (map.province)      CFG.province      = map.province;
  if (map.hang)          CFG.hang          = map.hang;
  if (map.bytuser)       CFG.bytuser       = map.bytuser;
  if (map.bytpass)       CFG.bytpass       = safeDecode(map.bytpass);
  if (map.sheetid)       CFG.sheetid       = map.sheetid;
  if (map.sa_email)      CFG.sa_email      = map.sa_email;
  if (map.sa_key)        CFG.sa_key        = safeDecode(map.sa_key);
  if (map.sheetname)     CFG.sheetname     = map.sheetname;
  if (map.autoUploadBYT) CFG.autoUploadBYT = map.autoUploadBYT === 'true';
  if (map.users_json) {
    try { const pu = JSON.parse(map.users_json); if(Array.isArray(pu)&&pu.length) USERS = pu; } catch(e){}
  }
  if (map.depts_json) {
    try { const pd = JSON.parse(map.depts_json); if(Array.isArray(pd)&&pd.length) DEPTS = pd; } catch(e){}
  }
}

async function gsPullSurveys() {
  const rows = await gsReadRange(`${GS_TABS.SURVEYS}!A2:W100000`);
  if (!rows.length) { DB.surveys = []; return; }
  DB.surveys = rows.filter(r=>r[0]).map(rowToSurvey);
}

async function gsPullUsers() {
  const rows = await gsReadRange(`${GS_TABS.USERS}!A2:F1000`);
  if (!rows.length) return;
  const pulled = rows.filter(r=>r[0]).map(r => ({
    id: r[0], username: r[1]||'', fullname: r[2]||'', role: r[3]||'user', dept: r[4]||'',
    password: safeDecode(r[5]||'')
  }));
  if (pulled.length) USERS = pulled;
}

async function gsPullDepts() {
  const rows = await gsReadRange(`${GS_TABS.DEPTS}!A2:D1000`);
  if (!rows.length) return;
  DEPTS = rows.filter(r=>r[0]).map(r => ({ id:r[0], name:r[1]||'', code:r[2]||'', type:r[3]||'lamsang' }));
}

// ---- Survey Row serialization ----
function surveyToRow(r) {
  const ans = r.answers?.filter(a=>a.value!==null&&a.value>0)||[];
  const avg = ans.length ? (ans.reduce((s,a)=>s+a.value,0)/ans.length).toFixed(2) : '';
  return [
    r.id, r.createdAt, r.type, SURVEYS[r.type]?.label||r.type, SURVEYS[r.type]?.qd||'',
    r.ngay||'', r.khoa||r.donvi||'', r.gt||'', r.tuoi||'', r.sdt||'',
    r.bhyt||'', r.noiss||'', r.mucsong||'', r.lanthu||'', r.nguoitl||'',
    r.submittedBy||'', r.status||'pending', r.bytStatus||'pending',
    avg, ans.length, r.answers?.length||0,
    r.notes||r.kiennghi||r.ykien||'',
    JSON.stringify(r.answers||[])
  ];
}

function rowToSurvey(r) {
  let answers = [];
  try { answers = JSON.parse(r[22]||'[]'); } catch(e){}
  return {
    id:r[0], createdAt:r[1], type:r[2],
    ngay:r[5], khoa:r[6], donvi:r[6], gt:r[7], tuoi:r[8], sdt:r[9],
    bhyt:r[10], noiss:r[11], mucsong:r[12], lanthu:r[13], nguoitl:r[14],
    submittedBy:r[15], status:r[16]||'pending', bytStatus:r[17]||'pending',
    notes:r[21], answers
  };
}

// ---- Single survey push (called after saveForm) ----
async function gsPushOneSurvey(rec) {
  if (!gsReady()) return false;
  try {
    await gsAppendRange(GS_TABS.SURVEYS, [surveyToRow(rec)]);
    rec.status = 'synced';
    saveDB(); updateDash();
    gsLogHistory('save_survey', `Lưu phiếu ${rec.type} - ${rec.ngay||''} - ${rec.khoa||rec.donvi||''}`);
    return true;
  } catch(e) {
    console.error('gsPushOneSurvey error:', e);
    return false;
  }
}

// ---- Update survey status in Sheets ----
async function gsUpdateSurveyStatus(id, status) {
  if (!gsReady()) return;
  try {
    const rows = await gsReadRange(`${GS_TABS.SURVEYS}!A2:A100000`);
    const idx = rows.findIndex(r=>r[0]===id);
    if (idx < 0) return;
    const rowNum = idx + 2;
    await gsWriteRange(`${GS_TABS.SURVEYS}!Q${rowNum}`, [[status]]);
  } catch(e) { console.error('gsUpdateSurveyStatus:', e); }
}

// ---- Connection badge ----
function updateGSConnBadge(connected) {
  const b = document.getElementById('gs-conn-badge');
  if (!b) return;
  if (connected) { b.style.background='#E8F5E9'; b.style.color='#2E7D32'; b.textContent='✅ Đã kết nối'; }
  else { b.style.background='#FFF3E0'; b.style.color='#E65100'; b.textContent='⚠️ Chưa kết nối'; }
}

// ---- gsAutoStartSync (kept for manual trigger + backward compat) ----
async function gsAutoStartSync() {
  if (!gsReady()) { updateGSConnBadge(false); return; }
  await gsFullSyncOnLogin().catch(()=>{});
}

// ---- Log history ----
async function gsLogHistory(action, detail) {
  if (!gsReady()) return;
  try {
    const ts = new Date().toISOString();
    const user = currentUser?.username || 'system';
    const device = navigator.userAgent.substring(0, 80);
    await gsAppendRange(GS_TABS.HISTORY, [[ts, user, action, detail, device]]);
  } catch(e) { /* silent */ }
}


// =========================================================
// MOBILE SHARE LINK & QR CODE
// =========================================================

/** Tạo link chia sẻ có kèm ?sid= để mobile tự động cấu hình */
function getShareLink() {
  const sid = CFG.sheetid || '';
  if (!sid) return '';
  const base = location.origin + location.pathname;
  return `${base}?sid=${encodeURIComponent(sid)}`;
}

/** Cập nhật ô link chia sẻ khi mở trang Cấu hình */
function refreshShareLink() {
  const inp = document.getElementById('share-link-input');
  if (!inp) return;
  const link = getShareLink();
  inp.value = link || '';
  inp.placeholder = link ? '' : 'Chưa có Spreadsheet ID — lưu cấu hình trước';
  const status = document.getElementById('share-link-status');
  if (status) {
    if (link) {
      status.textContent = '✅ Gửi link này cho nhân viên, mở link là tự động kết nối';
      status.style.color = '#2E7D32';
    } else {
      status.textContent = '⚠️ Nhập Spreadsheet ID và nhấn Lưu trước';
      status.style.color = '#E65100';
    }
  }
}

/** Copy link chia sẻ vào clipboard */
async function copyShareLink() {
  const link = getShareLink();
  if (!link) { toast('⚠️ Chưa có Spreadsheet ID – lưu cấu hình trước', 'warning'); return; }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
    } else {
      const el = document.getElementById('share-link-input');
      el.select(); document.execCommand('copy');
    }
    toast('📋 Đã copy link chia sẻ!', 'success');
    const status = document.getElementById('share-link-status');
    if (status) { status.textContent = '✅ Đã copy! Dán vào Zalo/Email gửi cho nhân viên'; status.style.color = '#2E7D32'; }
  } catch(e) {
    toast('⚠️ Không copy được – thử chọn và copy thủ công', 'warning');
  }
}

/** Gửi link qua Zalo (mở Zalo share) */
function shareToZalo() {
  const link = getShareLink();
  if (!link) { toast('⚠️ Chưa có Spreadsheet ID – lưu cấu hình trước', 'warning'); return; }
  const text = encodeURIComponent(`📱 Mở link này để dùng ứng dụng Khảo sát Hài lòng (tự động kết nối, không cần cấu hình):\n${link}`);
  // Zalo share URL
  window.open(`https://zalo.me/share?text=${text}`, '_blank');
}

/** Tạo QR code bằng canvas thuần (không cần thư viện ngoài) */
async function generateShareQR() {
  const link = getShareLink();
  if (!link) { toast('⚠️ Chưa có Spreadsheet ID – lưu cấu hình trước', 'warning'); return; }

  const container = document.getElementById('share-qr-container');
  const canvas = document.getElementById('share-qr-canvas');
  if (!container || !canvas) return;

  // Dùng QR code API miễn phí (không cần key)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}&format=svg&qzone=2`;
  
  // Hiển thị bằng <img> thay vì canvas để đơn giản hơn
  container.style.display = '';
  container.innerHTML = `
    <div style="font-size:11px;color:var(--text2);margin-bottom:8px;">📷 Quét bằng camera điện thoại để mở ứng dụng đã cấu hình sẵn:</div>
    <img src="${qrUrl}" alt="QR Code" style="width:200px;height:200px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.12);border:3px solid #fff;" 
         onerror="this.parentElement.innerHTML='<div style=color:#E53935;font-size:12px;>❌ Không tải được QR — kiểm tra internet</div>'" />
    <div style="font-size:10px;color:var(--text3);margin-top:6px;">Nhấn giữ ảnh → Lưu để in QR code</div>
    <div style="font-size:10px;color:#0D47A1;margin-top:4px;word-break:break-all;background:#E8F0FE;padding:5px 8px;border-radius:6px;">${link}</div>
  `;
  toast('📷 QR Code đã tạo!', 'success');
}
