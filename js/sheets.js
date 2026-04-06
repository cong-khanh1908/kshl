// sheets.js – Google Sheets Service Account Integration
// KSHL v6.1 – Fixed & Complete
// ============================================================

const GS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
let _gsToken = null;
let _gsTokenExp = 0;
let _gsReady = false;

// =========================================================
// TOKEN (JWT + SA)
// =========================================================
async function gsGetToken() {
  if (_gsToken && Date.now() < _gsTokenExp - 60000) return _gsToken;

  if (!CFG.saEmail || !CFG.saKey) throw new Error('Chưa cấu hình Service Account');
  if (!CFG.sheetId) throw new Error('Chưa cấu hình Spreadsheet ID');

  try {
    const now = Math.floor(Date.now() / 1000);
    const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const payload = btoa(JSON.stringify({
      iss: CFG.saEmail,
      scope: GS_SCOPES.join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

    const sigInput = header + '.' + payload;

    // Import private key
    const keyData = CFG.saKey
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\s/g, '');
    const keyBuf = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', keyBuf.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );

    const sig = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5', cryptoKey,
      new TextEncoder().encode(sigInput)
    );
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const jwt = sigInput + '.' + sigB64;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error('Token error: ' + err.slice(0, 200));
    }
    const data = await resp.json();
    _gsToken = data.access_token;
    _gsTokenExp = Date.now() + (data.expires_in || 3600) * 1000;
    _gsReady = true;
    return _gsToken;
  } catch(e) {
    _gsReady = false;
    throw e;
  }
}

function gsReady() {
  return !!(CFG.sheetId && CFG.saEmail && CFG.saKey);
}

// =========================================================
// CORE API
// =========================================================
async function gsRead(range) {
  const token = await gsGetToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.sheetId}/values/${encodeURIComponent(range)}`;
  const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error('Sheets read error: ' + err.slice(0,200));
  }
  const data = await resp.json();
  return data.values || [];
}

async function gsWrite(range, values) {
  const token = await gsGetToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values })
  });
  if (!resp.ok) throw new Error('Sheets write error: ' + (await resp.text()).slice(0,200));
  return await resp.json();
}

async function gsAppend(range, values) {
  const token = await gsGetToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values })
  });
  if (!resp.ok) throw new Error('Sheets append error: ' + (await resp.text()).slice(0,200));
  return await resp.json();
}

async function gsBatchUpdate(requests) {
  const token = await gsGetToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.sheetId}:batchUpdate`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });
  if (!resp.ok) throw new Error('Sheets batchUpdate error: ' + (await resp.text()).slice(0,200));
  return await resp.json();
}

async function gsGetSheetMeta() {
  const token = await gsGetToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.sheetId}?fields=sheets.properties`;
  const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!resp.ok) throw new Error('Cannot get spreadsheet meta');
  return await resp.json();
}

// =========================================================
// INIT SHEETS STRUCTURE
// =========================================================
async function gsInitSheets() {
  showGsSyncStatus('🏗️ Đang tạo cấu trúc Sheets...');
  try {
    const meta = await gsGetSheetMeta();
    const existing = (meta.sheets || []).map(s => s.properties.title);
    const required = ['CONFIG', 'SURVEYS', 'USERS', 'DEPTS', 'HISTORY'];
    const toCreate = required.filter(t => !existing.includes(t));

    if (toCreate.length > 0) {
      const requests = toCreate.map(title => ({
        addSheet: { properties: { title } }
      }));
      await gsBatchUpdate(requests);
    }

    // Write headers
    const surveySheetName = CFG.sheetName || 'SURVEYS';
    const headers = [['id','type','ngay','khoa','donvi','khoaId','doituong','gioi_tinh','tuoi','nguoipv','kieuKhaoSat','baohiem','status','bytStatus','createdAt','answers_json','meta_json']];
    await gsWrite(`${surveySheetName}!A1:Q1`, headers);
    await gsWrite('CONFIG!A1:B1', [['key','value']]);
    await gsWrite('USERS!A1:F1', [['id','username','fullname','role','dept','pwHash']]);
    await gsWrite('DEPTS!A1:D1', [['id','name','code','type']]);
    await gsWrite('HISTORY!A1:E1', [['timestamp','user','action','detail','device']]);

    showGsSyncStatus('✅ Đã tạo cấu trúc Sheets thành công!');
    toast('✅ Tạo cấu trúc Sheets thành công!', 'success');
  } catch(e) {
    showGsSyncStatus('❌ Lỗi: ' + e.message);
    toast('❌ Lỗi tạo Sheets: ' + e.message, 'error');
    console.error('gsInitSheets error:', e);
  }
}

// =========================================================
// CONFIG sync
// =========================================================
async function gsSaveConfig() {
  try {
    const rows = Object.entries(CFG).map(([k,v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
    await gsWrite('CONFIG!A2', rows);
  } catch(e) {
    console.warn('gsSaveConfig error:', e);
  }
}

async function gsLoadConfig() {
  try {
    const rows = await gsRead('CONFIG!A2:B200');
    rows.forEach(([k, v]) => {
      if (k && CFG.hasOwnProperty(k)) {
        try { CFG[k] = JSON.parse(v); }
        catch(e) { CFG[k] = v; }
      }
    });
    saveCFG();
  } catch(e) {
    console.warn('gsLoadConfig error:', e);
  }
}

// =========================================================
// SURVEYS sync
// =========================================================
function surveyToRow(r) {
  const answers = r.answers || [];
  return [
    r.id, r.type,
    r.ngay || '', r.khoa || '', r.donvi || '', r.khoaId || '',
    r.doituong || '', r.gioi_tinh || '', r.tuoi || '',
    r.nguoipv || '', r.kieuKhaoSat || '',
    r.baohiem || '',
    r.status || 'pending',
    r.bytStatus || 'pending',
    r.createdAt || new Date().toISOString(),
    JSON.stringify(answers),
    JSON.stringify({ masophieu: r.masophieu || '', meta: r.meta || {} })
  ];
}

function rowToSurvey(row) {
  if (!row || !row[0]) return null;
  let answers = [];
  let meta = {};
  try { answers = JSON.parse(row[15] || '[]'); } catch(e){}
  try { meta = JSON.parse(row[16] || '{}'); } catch(e){}
  return {
    id: row[0], type: row[1],
    ngay: row[2], khoa: row[3], donvi: row[4], khoaId: row[5] || '',
    doituong: row[6] || '', gioi_tinh: row[7] || '', tuoi: row[8] || '',
    nguoipv: row[9] || '', kieuKhaoSat: row[10] || '1',
    baohiem: row[11] || '',
    status: row[12] || 'synced',
    bytStatus: row[13] || 'pending',
    createdAt: row[14] || new Date().toISOString(),
    answers,
    masophieu: meta.masophieu || '',
    meta: meta.meta || {}
  };
}

async function gsPushSurvey(record) {
  const sheetName = CFG.sheetName || 'SURVEYS';
  await gsAppend(`${sheetName}!A:Q`, [surveyToRow(record)]);
  record.status = 'synced';
  saveDB();
}

async function gsPushAllData(showMsg = false) {
  if (!gsReady()) {
    if (showMsg) toast('⚠️ Chưa cấu hình Google Sheets', 'warning');
    return;
  }
  if (showMsg) showGsSyncStatus('⬆️ Đang đẩy tất cả dữ liệu lên Sheets...');
  try {
    const sheetName = CFG.sheetName || 'SURVEYS';
    const rows = DB.surveys.map(surveyToRow);
    if (rows.length === 0) {
      if (showMsg) { showGsSyncStatus('ℹ️ Không có dữ liệu để đẩy'); toast('ℹ️ Không có dữ liệu để đẩy', 'info'); }
      return;
    }
    await gsWrite(`${sheetName}!A2`, rows);
    DB.surveys.forEach(r => r.status = 'synced');
    saveDB(); updateDash();
    if (showMsg) { showGsSyncStatus(`✅ Đã đẩy ${rows.length} phiếu lên Sheets`); toast(`✅ Đã đẩy ${rows.length} phiếu`, 'success'); }
  } catch(e) {
    if (showMsg) { showGsSyncStatus('❌ Lỗi: ' + e.message); toast('❌ ' + e.message, 'error'); }
    console.error('gsPushAllData error:', e);
  }
}

async function gsPullAllData(showMsg = false) {
  if (!gsReady()) {
    if (showMsg) toast('⚠️ Chưa cấu hình Google Sheets', 'warning');
    return;
  }
  if (showMsg) showGsSyncStatus('⬇️ Đang kéo dữ liệu từ Sheets...');
  try {
    const sheetName = CFG.sheetName || 'SURVEYS';
    const rows = await gsRead(`${sheetName}!A2:Q5000`);
    const surveys = rows.map(rowToSurvey).filter(Boolean);
    DB.surveys = surveys;
    saveDB(); updateDash(); renderList(); renderBYTQueue();
    if (showMsg) { showGsSyncStatus(`✅ Đã kéo ${surveys.length} phiếu từ Sheets`); toast(`✅ Kéo ${surveys.length} phiếu`, 'success'); }
  } catch(e) {
    if (showMsg) { showGsSyncStatus('❌ Lỗi: ' + e.message); toast('❌ ' + e.message, 'error'); }
    console.error('gsPullAllData error:', e);
  }
}

async function syncToSheets() {
  if (!gsReady()) { toast('⚠️ Chưa cấu hình Google Sheets', 'warning'); return; }
  const pending = DB.surveys.filter(r => r.status !== 'synced');
  if (pending.length === 0) { toast('ℹ️ Không có phiếu nào cần đồng bộ', 'info'); return; }

  showGsSyncStatus(`🔄 Đang đồng bộ ${pending.length} phiếu...`);
  let ok = 0, fail = 0;
  for (const r of pending) {
    try {
      await gsPushSurvey(r);
      ok++;
    } catch(e) {
      fail++;
      console.warn('Sync failed for', r.id, e);
    }
  }
  updateDash();
  showGsSyncStatus(`✅ Đồng bộ xong: ${ok} thành công, ${fail} lỗi`);
  toast(`🔄 Đồng bộ: ${ok} ✅ / ${fail} ❌`, ok > 0 ? 'success' : 'error');
  await gsLogHistory('sync', `Đồng bộ ${ok} phiếu thành công, ${fail} lỗi`);
}

async function gsUpdateSurveyStatus(id, bytStatus) {
  // Find row in sheet and update bytStatus column (column N = index 13)
  // For simplicity, we push full record update
  const record = DB.surveys.find(r => r.id === id);
  if (!record) return;
  try {
    const sheetName = CFG.sheetName || 'SURVEYS';
    const rows = await gsRead(`${sheetName}!A2:A5000`);
    const rowIdx = rows.findIndex(r => r[0] === id);
    if (rowIdx >= 0) {
      const cellRow = rowIdx + 2;
      await gsWrite(`${sheetName}!N${cellRow}`, [[bytStatus]]);
    }
  } catch(e) {
    console.warn('gsUpdateSurveyStatus error:', e);
  }
}

// =========================================================
// USERS sync
// =========================================================
async function gsLoadUsers() {
  try {
    const rows = await gsRead('USERS!A2:F500');
    return rows.map(r => ({
      id: r[0], username: r[1], fullname: r[2],
      role: r[3] || 'user', dept: r[4] || '', pwHash: r[5] || ''
    })).filter(u => u.id && u.username);
  } catch(e) {
    console.warn('gsLoadUsers error:', e);
    return [];
  }
}

async function gsSaveUsers(users) {
  const rows = users.map(u => [u.id, u.username, u.fullname, u.role || 'user', u.dept || '', u.pwHash || '']);
  await gsWrite('USERS!A2', rows);
}

// =========================================================
// DEPTS sync
// =========================================================
async function gsLoadDepts() {
  try {
    const rows = await gsRead('DEPTS!A2:D500');
    return rows.map(r => ({ id: r[0], name: r[1], code: r[2] || '', type: r[3] || 'lamsang' })).filter(d => d.id && d.name);
  } catch(e) {
    console.warn('gsLoadDepts error:', e);
    return [];
  }
}

async function gsSaveDepts(depts) {
  const rows = depts.map(d => [d.id, d.name, d.code || '', d.type || 'lamsang']);
  await gsWrite('DEPTS!A2', rows);
}

// =========================================================
// HISTORY
// =========================================================
async function gsLogHistory(action, detail) {
  if (!gsReady()) return;
  try {
    const user = CURRENT_USER?.username || 'system';
    const device = navigator.userAgent.slice(0, 80);
    await gsAppend('HISTORY!A:E', [[new Date().toISOString(), user, action, detail, device]]);
  } catch(e) {
    // Silent fail
  }
}

async function loadHistory() {
  const el = document.getElementById('history-table-wrap');
  if (!el) return;
  if (!gsReady()) { el.innerHTML = '<div class="warn-box">⚠️ Chưa cấu hình Google Sheets</div>'; return; }
  el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);">🔄 Đang tải...</div>';
  try {
    const rows = await gsRead('HISTORY!A2:E500');
    if (!rows.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">🕒</div><div class="empty-text">Chưa có lịch sử</div></div>'; return; }
    let html = '<table class="data-table"><thead><tr><th>Thời gian</th><th>Người dùng</th><th>Hành động</th><th>Chi tiết</th></tr></thead><tbody>';
    rows.reverse().slice(0, 200).forEach(r => {
      html += `<tr><td>${fmtDateTime(r[0])}</td><td>${r[1]||'—'}</td><td>${r[2]||'—'}</td><td style="font-size:12px;color:var(--text3);">${(r[3]||'').slice(0,120)}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = `<div class="warn-box">❌ Lỗi tải lịch sử: ${e.message}</div>`;
  }
}

function clearHistoryView() {
  const el = document.getElementById('history-table-wrap');
  if (el) el.innerHTML = '<div class="empty-state"><div class="empty-icon">🕒</div><div class="empty-text">Nhấn "Tải từ Sheets" để xem lịch sử</div></div>';
}

// =========================================================
// TEST CONNECTION
// =========================================================
async function testSheets() {
  const el = document.getElementById('cfg-sheets-status');
  if (el) el.textContent = '🔄 Đang kiểm tra...';
  try {
    await gsGetToken();
    const meta = await gsGetSheetMeta();
    const title = meta.sheets?.[0]?.properties?.title || 'OK';
    if (el) el.innerHTML = `<span style="color:var(--success)">✅ Kết nối thành công! Sheet đầu tiên: <b>${title}</b></span>`;
    const badge = document.getElementById('gs-conn-badge');
    if (badge) { badge.textContent = '✅ Đã kết nối'; badge.style.background = '#E8F5E9'; badge.style.color = '#2E7D32'; }
    toast('✅ Kết nối Google Sheets thành công!', 'success');
  } catch(e) {
    if (el) el.innerHTML = `<span style="color:var(--accent2)">❌ Lỗi: ${e.message}</span>`;
    toast('❌ Lỗi kết nối: ' + e.message, 'error');
  }
}

// =========================================================
// BOOTSTRAP – Load config from Sheets on first run
// =========================================================
async function bootstrapConnect() {
  const sid = document.getElementById('bs-sheetid')?.value?.trim();
  if (!sid) { document.getElementById('bs-err').textContent = '⚠️ Vui lòng nhập Spreadsheet ID'; document.getElementById('bs-err').style.display = ''; return; }

  CFG.sheetId = sid;
  // Use default built-in SA
  CFG.saEmail = CFG.saEmail || 'kshl-328@crack-descent-492209-c3.iam.gserviceaccount.com';
  saveCFG();

  const btn = document.getElementById('bs-connect-btn');
  const status = document.getElementById('bs-status');
  const bar = document.getElementById('bs-progress-bar');
  if (btn) btn.disabled = true;
  if (bar) bar.style.display = '';
  if (status) status.textContent = 'Đang kết nối...';

  try {
    setProgress(30);
    if (status) status.textContent = '🔑 Đang xác thực Service Account...';
    await gsGetToken();

    setProgress(60);
    if (status) status.textContent = '📥 Đang tải cấu hình...';
    await gsLoadConfig();

    setProgress(90);
    if (status) status.textContent = '👥 Đang tải tài khoản...';
    const users = await gsLoadUsers();
    localStorage.setItem('kshl_users', JSON.stringify(users));

    setProgress(100);
    if (status) status.textContent = '✅ Thành công! Đang khởi động...';
    document.getElementById('bs-err').style.display = 'none';

    setTimeout(() => {
      document.getElementById('bootstrap-screen').classList.add('hidden');
      initApp();
    }, 800);
  } catch(e) {
    if (btn) btn.disabled = false;
    if (bar) bar.style.display = 'none';
    const err = document.getElementById('bs-err');
    if (err) { err.textContent = '❌ ' + e.message; err.style.display = ''; }
    if (status) status.textContent = '';
  }
}

function setProgress(pct) {
  const fill = document.getElementById('bs-progress-fill') || document.getElementById('bs-loading-fill');
  if (fill) fill.style.width = pct + '%';
}

function bsValidateId(val) {
  const hint = document.getElementById('bs-id-hint');
  if (!hint) return;
  if (!val) { hint.style.display = 'none'; return; }
  const looks = /^[a-zA-Z0-9_-]{20,}$/.test(val.trim());
  hint.style.display = '';
  hint.innerHTML = looks
    ? '<span style="color:#2E7D32;">✅ ID có vẻ hợp lệ</span>'
    : '<span style="color:#E65100;">⚠️ ID không đúng định dạng – kiểm tra lại URL Google Sheets</span>';
}

function bsCopyEmail() {
  const email = 'kshl-328@crack-descent-492209-c3.iam.gserviceaccount.com';
  navigator.clipboard?.writeText(email).then(() => toast('📋 Đã copy email SA', 'success')).catch(() => {});
}

// =========================================================
// SETTINGS HELPERS
// =========================================================
function parseSAJson() {
  const raw = document.getElementById('cfg-sa-json-paste')?.value?.trim();
  if (!raw) { toast('⚠️ Chưa dán nội dung file JSON', 'warning'); return; }
  try {
    const obj = JSON.parse(raw);
    if (obj.client_email) document.getElementById('cfg-sa-email').value = obj.client_email;
    if (obj.private_key) document.getElementById('cfg-sa-key').value = obj.private_key;
    toast('✅ Đã phân tích JSON Key thành công!', 'success');
  } catch(e) {
    toast('❌ JSON không hợp lệ: ' + e.message, 'error');
  }
}

function saveCfgSheets() {
  CFG.sheetId   = document.getElementById('cfg-sheetid')?.value?.trim()   || '';
  CFG.saEmail   = document.getElementById('cfg-sa-email')?.value?.trim()  || '';
  CFG.saKey     = document.getElementById('cfg-sa-key')?.value?.trim()    || '';
  CFG.sheetName = document.getElementById('cfg-sheetname')?.value?.trim() || 'SURVEYS';
  saveCFG();
  _gsToken = null; // Force re-auth
  toast('💾 Đã lưu cấu hình Sheets', 'success');
  updateShareLink();
}

function saveCfgAll() {
  saveCfgSheets();
  CFG.hvname   = document.getElementById('cfg-hvname')?.value?.trim()   || '';
  CFG.province = document.getElementById('cfg-province')?.value?.trim() || '';
  CFG.hang     = document.getElementById('cfg-hang')?.value             || '';
  CFG.bytuser  = document.getElementById('cfg-bytuser')?.value?.trim()  || '';
  CFG.bytpass  = document.getElementById('cfg-bytpass')?.value          || '';
  // mabv không có field riêng trong settings UI – lấy từ hvname hoặc cấu hình riêng
  saveCFG();
  if (gsReady()) gsSaveConfig().catch(() => {});
  toast('💾 Đã lưu toàn bộ cấu hình!', 'success');
  loadAutoUploadCheckboxes();
}

function loadSettingsUI() {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('cfg-sheetid', CFG.sheetId);
  setVal('cfg-sa-email', CFG.saEmail);
  setVal('cfg-sa-key', CFG.saKey);
  setVal('cfg-sheetname', CFG.sheetName || 'SURVEYS');
  setVal('cfg-hvname', CFG.hvname);
  setVal('cfg-province', CFG.province);
  setVal('cfg-hang', CFG.hang);
  setVal('cfg-bytuser', CFG.bytuser);
  setVal('cfg-bytpass', CFG.bytpass);
  updateShareLink();
  updateLocalInfo();
  const badge = document.getElementById('gs-conn-badge');
  if (badge) {
    if (gsReady()) { badge.textContent = '✅ Đã cấu hình'; badge.style.background = '#E8F5E9'; badge.style.color = '#2E7D32'; }
    else { badge.textContent = '⚠️ Chưa kết nối'; badge.style.background = '#FFF3E0'; badge.style.color = '#E65100'; }
  }
}

function showGsSyncStatus(msg) {
  const el = document.getElementById('gs-sync-status');
  if (el) el.textContent = msg;
  const el2 = document.getElementById('gs-dash-status');
  if (el2) el2.textContent = msg;
}

function updateLocalInfo() {
  const el = document.getElementById('local-info');
  if (!el) return;
  el.innerHTML = `📊 <b>${DB.surveys.length}</b> phiếu · <b>${DB.surveys.filter(r=>r.status==='synced').length}</b> đã đồng bộ · <b>${DB.surveys.filter(r=>r.bytStatus==='done').length}</b> đã gửi BYT`;
}

// =========================================================
// SHARE LINK
// =========================================================
function updateShareLink() {
  const inp = document.getElementById('share-link-input');
  if (!inp) return;
  if (CFG.sheetId) {
    const base = location.href.split('?')[0];
    inp.value = `${base}?sid=${CFG.sheetId}`;
  } else {
    inp.value = '';
    inp.placeholder = 'Lưu cấu hình trước để tạo link...';
  }
}

function copyShareLink() {
  const inp = document.getElementById('share-link-input');
  if (!inp || !inp.value) { toast('⚠️ Chưa có link để copy', 'warning'); return; }
  navigator.clipboard?.writeText(inp.value).then(() => {
    toast('📋 Đã copy link chia sẻ!', 'success');
    const st = document.getElementById('share-link-status');
    if (st) st.textContent = '✅ Đã copy!';
  }).catch(() => {
    inp.select(); document.execCommand('copy');
    toast('📋 Đã copy!', 'success');
  });
}

function shareToZalo() {
  const inp = document.getElementById('share-link-input');
  if (!inp?.value) { toast('⚠️ Chưa có link', 'warning'); return; }
  window.open('https://zalo.me/share?text=' + encodeURIComponent('Mở link để dùng app khảo sát: ' + inp.value), '_blank');
}

function generateShareQR() {
  const inp = document.getElementById('share-link-input');
  if (!inp?.value) { toast('⚠️ Chưa có link', 'warning'); return; }
  const container = document.getElementById('share-qr-container');
  const canvas = document.getElementById('share-qr-canvas');
  if (!container || !canvas) return;
  // Use a QR library if available, otherwise show link
  container.style.display = '';
  const ctx = canvas.getContext('2d');
  canvas.width = 200; canvas.height = 200;
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,200,200);
  ctx.fillStyle = '#333'; ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('QR Code cho link:', 100, 80);
  ctx.fillText('(Cài thư viện qrcode.js', 100, 100);
  ctx.fillText('để tạo QR thực)', 100, 120);
  toast('💡 Thêm thư viện qrcode.js để tạo QR code', 'info');
}
