// surveys.js – Nhập phiếu khảo sát (Render + Save)
// KSHL v6.1 – Fixed & Complete
// ============================================================

// =========================================================
// RENDER SURVEY FORM
// =========================================================
function renderSurveyPage(type) {
  const s = SURVEYS[type];
  if (!s) return;
  const el = document.getElementById(`page-${type}`);
  if (!el) return;

  const depts = DEPTS.length
    ? DEPTS.map(d => `<option value="${d.id}">${escHtml(d.name)}</option>`).join('')
    : '';

  // Header info
  let headerHtml = `
    <div class="survey-header card mb-14">
      <div class="card-header">
        <div class="card-title">${s.icon} ${s.label}</div>
        <button class="btn btn-outline btn-sm" onclick="clearSurveyForm('${type}')">🔄 Làm mới</button>
      </div>
      <div class="card-body">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Ngày điền phiếu <span class="req">*</span></label>
            <input type="date" class="form-input" id="${type}-ngay" value="${today()}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Khoa/Phòng</label>
            <select class="form-select" id="${type}-khoa">
              <option value="">--Chọn khoa--</option>
              ${depts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Kiểu khảo sát <span class="req">*</span></label>
            <select class="form-select" id="${type}-kieukhaossat">
              <option value="1">1. BV tự đánh giá hàng tháng/quý</option>
              <option value="2">2. BV tự đánh giá cuối năm</option>
              <option value="3">3. Đoàn BYT/Sở YT thực hiện</option>
              <option value="4">4. Đoàn phúc tra của BYT</option>
              <option value="5">5. Đoàn kiểm tra chéo</option>
              <option value="6">6. Hình thức khác</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Người phỏng vấn</label>
            <select class="form-select" id="${type}-nguoipv">
              <option value="1">a. Người bệnh tự điền</option>
              <option value="2">b. NV bệnh viện phỏng vấn</option>
              <option value="3">c. BYT/Sở YT/đoàn giám sát</option>
              <option value="4">d. Tổ chức độc lập</option>
              <option value="5">e. Đối tượng khác</option>
            </select>
          </div>
          ${(type === 'm1' || type === 'm2') ? `
          <div class="form-group">
            <label class="form-label">Đối tượng</label>
            <select class="form-select" id="${type}-doituong">
              <option value="1">Người bệnh</option>
              <option value="2">Người nhà người bệnh</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Giới tính</label>
            <select class="form-select" id="${type}-gioitinh">
              <option value="">--Chọn--</option>
              <option value="1">Nam</option>
              <option value="2">Nữ</option>
              <option value="3">Khác</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tuổi</label>
            <input type="number" class="form-input" id="${type}-tuoi" min="1" max="120" placeholder="VD: 45"/>
          </div>
          <div class="form-group">
            <label class="form-label">Bảo hiểm y tế</label>
            <select class="form-select" id="${type}-baohiem">
              <option value="1">Có</option>
              <option value="2">Không</option>
            </select>
          </div>
          ` : ''}
          ${type === 'm3' ? `
          <div class="form-group">
            <label class="form-label">Giới tính</label>
            <select class="form-select" id="${type}-gioitinh">
              <option value="">--Chọn--</option>
              <option value="1">Nam</option>
              <option value="2">Nữ</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tuổi</label>
            <input type="number" class="form-input" id="${type}-tuoi" min="18" max="70" placeholder="VD: 35"/>
          </div>
          ` : ''}
          <div class="form-group">
            <label class="form-label">Mã số phiếu (tuỳ chọn)</label>
            <input type="text" class="form-input" id="${type}-masophieu" placeholder="VD: NT001"/>
          </div>
        </div>
      </div>
    </div>`;

  // Quick-select global bar
  const emojis = ['😡','😞','😐','🙂','😄'];
  const colors = ['qs-1','qs-2','qs-3','qs-4','qs-5'];

  // Questions
  let questionsHtml = `<div class="global-qs-bar mb-14">
    <span class="global-qs-label">⚡ Chọn nhanh tất cả câu:</span>
    ${[1,2,3,4,5].map(v => `<button class="qs-btn qs-${v}" onclick="setAllAnswers('${type}',${v})">
      <span class="qb-num">${v}</span><span class="qb-emoji">${emojis[v-1]}</span>
    </button>`).join('')}
    <button class="qs-btn qs-0" onclick="setAllAnswers('${type}',0)"><span class="qb-num">O</span><span class="qb-emoji">—</span></button>
  </div>`;

  s.sections.forEach(sec => {
    questionsHtml += `<div class="survey-section mb-14">
      <div class="survey-section-header">
        <span class="survey-section-title">
          <span style="background:var(--primary);color:#fff;padding:2px 8px;border-radius:5px;font-size:11px;margin-right:8px;">${sec.key.toUpperCase()}</span>
          ${sec.label}
        </span>
        <div class="quick-select-wrap">
          <span class="qs-label">Chọn nhanh:</span>
          ${[1,2,3,4,5].map(v => `<button class="qs-btn qs-${v}" onclick="setSectionAnswers('${type}','${sec.key}',${v})" title="${v}">
            <span class="qb-num">${v}</span>
          </button>`).join('')}
        </div>
      </div>
      <div style="padding:0;">
        <!-- Desktop table -->
        <div class="table-wrap" style="display:block;">
        <table class="likert-table">
          <thead>
            <tr>
              <th style="width:55%;text-align:left;padding-left:14px;font-size:11px;color:var(--text2);">Câu hỏi đánh giá</th>
              <th class="lth-v1"><span class="th-num">1</span><span class="th-emoji">😡</span><span class="th-label">Rất KHL</span></th>
              <th class="lth-v2"><span class="th-num">2</span><span class="th-emoji">😞</span><span class="th-label">Không HL</span></th>
              <th class="lth-v3"><span class="th-num">3</span><span class="th-emoji">😐</span><span class="th-label">Bình thường</span></th>
              <th class="lth-v4"><span class="th-num">4</span><span class="th-emoji">🙂</span><span class="th-label">Hài lòng</span></th>
              <th class="lth-v5"><span class="th-num">5</span><span class="th-emoji">😄</span><span class="th-label">Rất HL</span></th>
              <th class="lth-v0"><span class="th-num">O</span><span class="th-emoji">—</span><span class="th-label">Không ĐG</span></th>
            </tr>
          </thead>
          <tbody>`;

    sec.questions.forEach(qKey => {
      const qLabel = s.questions[qKey] || qKey;
      const inputName = `${type}_${sec.key}_${qKey}`;
      const codeDisplay = (sec.key + qKey.replace(sec.key,'')).toUpperCase();
      questionsHtml += `<tr id="qrow_${type}_${qKey}">
        <td><span class="q-num">${codeDisplay}.</span>${qLabel}</td>`;
      // 1-5 likert
      const lcClass = ['lc-v1','lc-v2','lc-v3','lc-v4','lc-v5'];
      for (let v = 1; v <= 5; v++) {
        questionsHtml += `<td>
          <input type="radio" name="${inputName}" value="${v}" id="${inputName}_${v}" class="likert-radio" onchange="markAnswered('${type}','${qKey}',${v})">
          <label for="${inputName}_${v}" class="likert-circle ${lcClass[v-1]}">
            <span class="lc-num">${v}</span>
            <span class="lc-emoji">${emojis[v-1]}</span>
          </label>
        </td>`;
      }
      // O = 0
      questionsHtml += `<td>
        <input type="radio" name="${inputName}" value="0" id="${inputName}_0" class="na-radio" onchange="markAnswered('${type}','${qKey}',0)">
        <label for="${inputName}_0" class="na-circle">
          <span class="lc-num">O</span>
          <span class="lc-emoji">—</span>
        </label>
      </td></tr>`;
    });

    questionsHtml += `</tbody></table></div></div></div>`;
  });

  // Action buttons
  const actionHtml = `
    <div class="survey-actions card mb-14">
      <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-primary" onclick="saveSurvey('${type}')">💾 Lưu phiếu</button>
        <button class="btn btn-outline" onclick="clearSurveyForm('${type}')">🔄 Làm mới</button>
        <span id="${type}-save-status" style="font-size:12px;color:var(--text3);"></span>
      </div>
      <div class="card-body" style="padding-top:0;">
        <div id="${type}-progress-bar" style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:6px;">
          <div id="${type}-progress-fill" style="height:100%;background:var(--success);border-radius:3px;width:0%;transition:width .3s;"></div>
        </div>
        <div id="${type}-progress-label" style="font-size:11px;color:var(--text3);">0 / ${Object.keys(s.questions).length} câu đã trả lời</div>
      </div>
    </div>`;

  el.innerHTML = headerHtml + questionsHtml + actionHtml;
}

function setAllAnswers(type, value) {
  const s = SURVEYS[type];
  if (!s) return;
  s.sections.forEach(sec => {
    sec.questions.forEach(qKey => {
      const inputName = `${type}_${sec.key}_${qKey}`;
      const radio = document.querySelector(`input[name="${inputName}"][value="${value}"]`);
      if (radio) { radio.checked = true; markAnswered(type, qKey, value); }
    });
  });
  toast(`✅ Đã chọn ${value === 0 ? 'O (Không đánh giá)' : value + '⭐'} cho tất cả câu`, 'info', 1500);
}

function setSectionAnswers(type, section, value) {
  const s = SURVEYS[type];
  if (!s) return;
  const sec = s.sections.find(sc => sc.key === section);
  if (!sec) return;
  sec.questions.forEach(qKey => {
    const inputName = `${type}_${sec.key}_${qKey}`;
    const radio = document.querySelector(`input[name="${inputName}"][value="${value}"]`);
    if (radio) { radio.checked = true; markAnswered(type, qKey, value); }
  });
}

function markAnswered(type, qKey, value) {
  const row = document.getElementById(`qrow_${type}_${qKey}`);
  if (row) row.classList.add('answered');
  updateSurveyProgress(type);
}

function updateSurveyProgress(type) {
  const s = SURVEYS[type];
  if (!s) return;
  const totalQ = Object.keys(s.questions).length;
  const answered = countAnswered(type, s);
  const pct = totalQ > 0 ? Math.round(answered / totalQ * 100) : 0;
  const fill = document.getElementById(`${type}-progress-fill`);
  const label = document.getElementById(`${type}-progress-label`);
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = `${answered} / ${totalQ} câu đã trả lời (${pct}%)`;
}

function countAnswered(type, s) {
  let n = 0;
  s.sections.forEach(sec => {
    sec.questions.forEach(qKey => {
      const inputName = `${type}_${sec.key}_${qKey}`;
      const checked = document.querySelector(`input[name="${inputName}"]:checked`);
      if (checked) n++;
    });
  });
  return n;
}

// =========================================================
// COLLECT ANSWERS
// =========================================================
function collectAnswers(type) {
  const s = SURVEYS[type];
  if (!s) return [];
  const answers = [];
  s.sections.forEach(sec => {
    sec.questions.forEach(qKey => {
      const inputName = `${type}_${sec.key}_${qKey}`;
      const checked = document.querySelector(`input[name="${inputName}"]:checked`);
      answers.push({
        code: (sec.key + qKey.replace(sec.key, '')).toUpperCase(), // e.g. "A1"
        key: qKey,
        section: sec.key,
        value: checked ? parseInt(checked.value) : null,
        label: s.questions[qKey] || qKey
      });
    });
  });
  return answers;
}

// =========================================================
// SAVE SURVEY
// =========================================================
async function saveSurvey(type) {
  const s = SURVEYS[type];
  if (!s) return;

  const ngay = document.getElementById(`${type}-ngay`)?.value || today();
  const khoaId = document.getElementById(`${type}-khoa`)?.value || '';
  const khoa = DEPTS.find(d => d.id === khoaId)?.name || khoaId;
  const kieuKhaoSat = document.getElementById(`${type}-kieukhaossat`)?.value || '1';
  const nguoipv = document.getElementById(`${type}-nguoipv`)?.value || '1';
  const doituong = document.getElementById(`${type}-doituong`)?.value || '1';
  const gioi_tinh = document.getElementById(`${type}-gioitinh`)?.value || '';
  const tuoi = document.getElementById(`${type}-tuoi`)?.value || '';
  const baohiem = document.getElementById(`${type}-baohiem`)?.value || '';
  const masophieu = document.getElementById(`${type}-masophieu`)?.value?.trim() || '';

  const answers = collectAnswers(type);
  const answered = answers.filter(a => a.value !== null).length;

  if (answered === 0) {
    toast('⚠️ Vui lòng trả lời ít nhất 1 câu', 'warning');
    return;
  }

  const record = {
    id: genId(),
    type,
    ngay,
    khoa,
    khoaId,
    donvi: khoa,
    doituong,
    gioi_tinh,
    tuoi,
    baohiem,
    nguoipv,
    kieuKhaoSat: kieuKhaoSat || CFG.kieuKhaoSat || '1',
    masophieu,
    benhvien: CFG.hvname || '',
    mabv: CFG.mabv || '',
    answers,
    status: 'pending',
    bytStatus: 'pending',
    createdAt: new Date().toISOString(),
    savedBy: CURRENT_USER?.username || 'unknown'
  };

  DB.surveys.unshift(record);
  saveDB();

  const statusEl = document.getElementById(`${type}-save-status`);
  if (statusEl) statusEl.textContent = '✅ Đã lưu vào thiết bị!';

  toast(`✅ Đã lưu phiếu ${s.label}!`, 'success');
  updateDash();
  updateBYTPendingBadge();

  // Auto sync to Sheets
  if (gsReady()) {
    try {
      await gsPushSurvey(record);
      if (statusEl) statusEl.textContent = '✅ Đã lưu & đồng bộ Sheets!';
    } catch(e) {
      if (statusEl) statusEl.textContent = '⚠️ Lưu cục bộ OK, Sheets thất bại';
    }
  }

  // Auto upload BYT
  if (CFG.autoUploadBYT) {
    bytSelectedIds.clear();
    bytSelectedIds.add(record.id);
    toast('🤖 Tự động gửi BYT...', 'info');
    setTimeout(() => sendSelectedToBYT(), 1000);
  }

  await gsLogHistory('save_survey', `Lưu phiếu ${type} | Khoa: ${khoa} | ${answered}/${answers.length} câu`);
}

function clearSurveyForm(type) {
  // Reset all radios
  const el = document.getElementById(`page-${type}`);
  if (!el) return;
  el.querySelectorAll('input[type="radio"]').forEach(r => { r.checked = false; });
  el.querySelectorAll('tr[id^="qrow_"]').forEach(r => r.classList.remove('answered'));
  // Reset date
  const ngay = document.getElementById(`${type}-ngay`);
  if (ngay) ngay.value = today();
  // Reset status
  const st = document.getElementById(`${type}-save-status`);
  if (st) st.textContent = '';
  updateSurveyProgress(type);
  toast('🔄 Đã làm mới form', 'info');
}

// =========================================================
// DATA LIST
// =========================================================
function renderList() {
  const el = document.getElementById('list-table');
  if (!el) return;

  const typeF   = document.getElementById('fl-type')?.value   || '';
  const statusF = document.getElementById('fl-status')?.value || '';
  const dateF   = document.getElementById('fl-date')?.value   || '';

  let surveys = [...DB.surveys].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (typeF)   surveys = surveys.filter(r => r.type === typeF);
  if (statusF) surveys = surveys.filter(r => r.status === statusF);
  if (dateF)   surveys = surveys.filter(r => r.ngay === dateF);

  if (!surveys.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Không có phiếu nào</div><div class="empty-sub">Thử thay đổi bộ lọc hoặc nhập phiếu mới</div></div>';
    return;
  }

  let html = '<table class="data-table"><thead><tr><th>Loại</th><th>Ngày</th><th>Khoa/Phòng</th><th>Câu TL</th><th>TB</th><th>Sheets</th><th>BYT</th><th></th></tr></thead><tbody>';
  surveys.forEach(r => {
    const s = SURVEYS[r.type];
    const ans = (r.answers || []).filter(a => a.value !== null && a.value !== undefined);
    const scored = ans.filter(a => a.value > 0);
    const avg = scored.length ? (scored.reduce((s, a) => s + a.value, 0) / scored.length).toFixed(1) : '—';
    const syncBadge = r.status === 'synced'
      ? '<span class="chip chip-green" style="font-size:10px;">✅ Đã sync</span>'
      : '<span class="chip chip-orange" style="font-size:10px;">⏳ Chờ</span>';
    const bytBadge = r.bytStatus === 'done'
      ? '<span class="chip chip-green" style="font-size:10px;">✅ Đã gửi</span>'
      : r.bytStatus === 'failed'
      ? '<span class="chip chip-red" style="font-size:10px;">❌ Lỗi</span>'
      : '<span class="chip chip-orange" style="font-size:10px;">⏳ Chờ</span>';

    html += `<tr onclick="showRecordDetail('${r.id}')" style="cursor:pointer;">
      <td>${s?.icon || ''} <span style="font-size:11.5px;">${s?.label || r.type}</span></td>
      <td style="white-space:nowrap;">${r.ngay || '—'}</td>
      <td style="font-size:12px;">${escHtml(r.khoa || r.donvi || '—')}</td>
      <td style="font-size:12px;">${ans.length}/${(r.answers||[]).length}</td>
      <td style="font-weight:700;color:${avg >= 4 ? 'var(--success)' : avg >= 3 ? 'var(--warning)' : 'var(--accent2)'};">${avg}</td>
      <td>${syncBadge}</td>
      <td>${bytBadge}</td>
      <td onclick="event.stopPropagation()">
        <div class="flex-gap" style="gap:4px;">
          <button class="btn btn-outline btn-sm" onclick="quickSendOneBYT('${r.id}')" style="padding:3px 7px;min-height:30px;font-size:11px;" title="Gửi BYT">📤</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSurvey('${r.id}')" style="padding:3px 7px;min-height:30px;" title="Xóa">🗑️</button>
        </div>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function clearFilters() {
  const ids = ['fl-type','fl-status','fl-date'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderList();
}

function showRecordDetail(id) {
  const r = DB.surveys.find(x => x.id === id);
  if (!r) return;
  const s = SURVEYS[r.type];
  const ans = r.answers || [];
  const scored = ans.filter(a => a.value > 0);
  const avg = scored.length ? (scored.reduce((s, a) => s + a.value, 0) / scored.length).toFixed(2) : '—';

  let html = `<div style="font-size:12.5px;color:var(--text2);line-height:2;margin-bottom:16px;">
    <b>Loại:</b> ${s?.label || r.type} &nbsp;·&nbsp;
    <b>Ngày:</b> ${r.ngay || '—'} &nbsp;·&nbsp;
    <b>Khoa:</b> ${r.khoa || '—'} &nbsp;·&nbsp;
    <b>TB:</b> <span style="font-weight:700;color:var(--success);">${avg}/5</span>
  </div>`;

  // Group answers by section
  const bySec = {};
  ans.forEach(a => {
    const sec = a.section || a.code?.[0]?.toLowerCase() || 'x';
    if (!bySec[sec]) bySec[sec] = [];
    bySec[sec].push(a);
  });

  html += '<table class="data-table" style="font-size:12px;"><thead><tr><th>Câu</th><th>Nội dung</th><th>Điểm</th></tr></thead><tbody>';
  Object.entries(bySec).forEach(([sec, qs]) => {
    html += `<tr><td colspan="3" style="background:var(--surface2);font-weight:700;color:var(--primary);font-size:11px;padding:6px 10px;letter-spacing:.5px;">${sec.toUpperCase()}</td></tr>`;
    qs.forEach(a => {
      const v = a.value;
      const color = v === null ? '#ccc' : v === 0 ? '#999' : v >= 4 ? 'var(--success)' : v >= 3 ? 'var(--warning)' : 'var(--accent2)';
      const badge = v === null ? '—' : v === 0 ? 'O' : `${v}⭐`;
      html += `<tr>
        <td style="font-family:var(--mono);font-size:11px;font-weight:700;">${a.code || a.key}</td>
        <td style="font-size:11.5px;">${escHtml(a.label || a.key)}</td>
        <td style="font-weight:700;color:${color};text-align:center;">${badge}</td>
      </tr>`;
    });
  });
  html += '</tbody></table>';

  document.getElementById('modal-detail-title').textContent = `${s?.icon || ''} ${s?.label || r.type} – ${r.ngay || ''}`;
  document.getElementById('modal-detail-body').innerHTML = html;
  document.getElementById('btn-del-record').onclick = () => { closeModal('modal-detail'); deleteSurvey(id); };
  document.getElementById('btn-af-record').onclick  = () => { closeModal('modal-detail'); genScriptForRecord(id); };
  document.getElementById('btn-byt-record').onclick = () => { closeModal('modal-detail'); quickSendOneBYT(id); };
  openModal('modal-detail');
}

function deleteSurvey(id) {
  showConfirm('Xóa phiếu này?', () => {
    DB.surveys = DB.surveys.filter(r => r.id !== id);
    saveDB(); updateDash(); renderList(); renderBYTQueue();
    toast('✅ Đã xóa phiếu', 'success');
  });
}

// =========================================================
// EXPORT
// =========================================================
function exportCSV() {
  if (!DB.surveys.length) { toast('⚠️ Không có dữ liệu', 'warning'); return; }
  const headers = ['id','type','ngay','khoa','doituong','gioi_tinh','tuoi','status','bytStatus','createdAt','avg_score'];
  const rows = DB.surveys.map(r => {
    const ans = (r.answers || []).filter(a => a.value > 0);
    const avg = ans.length ? (ans.reduce((s,a) => s+a.value, 0) / ans.length).toFixed(2) : '';
    return [r.id,r.type,r.ngay,r.khoa||r.donvi,r.doituong,r.gioi_tinh,r.tuoi,r.status,r.bytStatus,r.createdAt,avg];
  });
  downloadCSV([headers, ...rows], `kshl_${today()}.csv`);
}

function exportJSON() {
  if (!DB.surveys.length) { toast('⚠️ Không có dữ liệu', 'warning'); return; }
  const blob = new Blob([JSON.stringify({ surveys: DB.surveys, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `kshl_${today()}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('📥 Đã xuất JSON', 'success');
}

function importJSON(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      const surveys = Array.isArray(data.surveys) ? data.surveys : (Array.isArray(data) ? data : []);
      if (!surveys.length) { toast('⚠️ Không tìm thấy dữ liệu phiếu trong file', 'warning'); return; }
      const existing = new Set(DB.surveys.map(r => r.id));
      const added = surveys.filter(r => !existing.has(r.id));
      DB.surveys.push(...added);
      saveDB(); updateDash(); renderList();
      toast(`✅ Đã import ${added.length} phiếu mới`, 'success');
    } catch(e) { toast('❌ File JSON không hợp lệ', 'error'); }
  };
  reader.readAsText(file);
}

function downloadCSV(rows, filename) {
  const csv = rows.map(row => row.map(v => `"${(v || '').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast('📥 Đã xuất CSV', 'success');
}

// =========================================================
// AUTOFILL (Script generator)
// =========================================================
function loadAFList() {
  const type = document.getElementById('af-type')?.value;
  const sel = document.getElementById('af-record');
  if (!sel) return;
  sel.innerHTML = '<option value="">--Chọn phiếu--</option>';
  if (!type) return;
  DB.surveys.filter(r => r.type === type).slice(0, 50).forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.ngay || '—'} · ${r.khoa || r.donvi || '—'}`;
    sel.appendChild(opt);
  });
}

function genScript() {
  const id = document.getElementById('af-record')?.value;
  if (!id) { toast('⚠️ Chọn phiếu trước', 'warning'); return; }
  genScriptForRecord(id);
}

function genScriptForRecord(id) {
  const r = DB.surveys.find(x => x.id === id);
  if (!r) return;
  const s = SURVEYS[r.type];
  const lines = [];
  lines.push(`// Script tự động điền – ${s?.label} – ${r.ngay}`);
  lines.push(`// Dán vào Console (F12) trên trang BYT`);
  lines.push('(function(){');

  // Form info
  lines.push(`  document.querySelector('select[name="submitted[kieu_khao_sat]"]')?.value && (document.querySelector('select[name="submitted[kieu_khao_sat]"]').value = "${r.kieuKhaoSat || '1'}");`);

  // BV select
  lines.push(`  var bvSels = ['select[name="submitted[ttp][bvn][1_ten_benh_vien]"]','select[name="submitted[thong_tin_phieu][benhvien_ngay][1_ten_benh_vien]"]'];`);
  lines.push(`  bvSels.forEach(function(s){var e=document.querySelector(s);if(e&&!e.value)e.value="${r.mabv || CFG.mabv || ''}";});`);

  // Answers
  (r.answers || []).forEach(a => {
    if (a.value === null || a.value === undefined) return;
    const sec = a.section || a.code?.[0]?.toLowerCase() || 'a';
    const num = a.code?.slice(1) || a.key?.replace(sec, '') || '';
    const qkey = sec + num;
    let name;
    if (r.type === 'm5' && sec === 'b') {
      name = `submitted[danh_gia][${qkey}][select][${a.value}]`;
      lines.push(`  (function(){var el=document.querySelector('input[name="${name}"]');if(el)el.checked=true;})();`);
    } else {
      name = `submitted[danh_gia][${sec}][${qkey}]`;
      lines.push(`  (function(){var el=document.querySelector('input[name="${name}"][value="${a.value}"]');if(el){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));}})();`);
    }
  });

  lines.push('  console.log("✅ Đã điền xong!");');
  lines.push('})();');

  const out = document.getElementById('script-out');
  const section = document.getElementById('script-section');
  if (out) {
    out.innerHTML = `<button class="code-copy-btn" onclick="copyScript()">📋 Copy</button><pre>${escHtml(lines.join('\n'))}</pre>`;
  }
  if (section) section.style.display = '';
  // Also render BYT links
  renderBYTLinks();
}

function copyScript() {
  const pre = document.querySelector('#script-out pre');
  if (!pre) return;
  navigator.clipboard?.writeText(pre.textContent).then(() => toast('📋 Đã copy script!', 'success')).catch(() => {
    const ta = document.createElement('textarea'); ta.value = pre.textContent;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); toast('📋 Đã copy!', 'success');
  });
}

function openBYT() {
  const type = document.getElementById('af-type')?.value;
  const url = type ? SURVEYS[type]?.url : 'https://hailong.chatluongbenhvien.vn';
  window.open(url || 'https://hailong.chatluongbenhvien.vn', '_blank');
}

function renderBYTLinks() {
  const el = document.getElementById('byt-links');
  if (!el) return;
  let html = '<div class="flex-gap" style="flex-wrap:wrap;">';
  Object.entries(SURVEYS).forEach(([key, s]) => {
    html += `<a href="${s.url}" target="_blank" class="btn btn-outline btn-sm">${s.icon} ${s.label}</a>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

// =========================================================
// CLEAR LOCAL DATA
// =========================================================
function confirmClear() {
  showConfirm('⚠️ Xóa toàn bộ dữ liệu phiếu trên thiết bị này? (Không thể khôi phục)', () => {
    DB.surveys = [];
    saveDB(); updateDash(); renderList();
    toast('✅ Đã xóa dữ liệu cục bộ', 'success');
  });
}
