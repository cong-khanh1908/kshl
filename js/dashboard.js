// dashboard.js – Dashboard stats and charts
// KSHL v6.1
// ============================================================

function updateDash() {
  const surveys = DB.surveys;
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const total   = surveys.length;
  const pending = surveys.filter(r => r.status !== 'synced').length;
  const synced  = surveys.filter(r => r.status === 'synced').length;
  const month   = surveys.filter(r => (r.ngay||'').startsWith(thisMonth)).length;

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setVal('st-total', total);
  setVal('st-pending', pending);
  setVal('st-synced', synced);
  setVal('st-month', month);

  // BYT stats
  setVal('st-byt-pending', surveys.filter(r => !r.bytStatus || r.bytStatus === 'pending').length);
  setVal('st-byt-done',    surveys.filter(r => r.bytStatus === 'done').length);
  setVal('st-byt-failed',  surveys.filter(r => r.bytStatus === 'failed').length);

  // Chart
  renderDashChart();
  renderDashRecent();

  // Sheets status
  const shStat = document.getElementById('sheets-status');
  if (shStat) {
    if (gsReady()) {
      shStat.innerHTML = `✅ Kết nối Google Sheets · <b>${synced}</b> phiếu đã đồng bộ · <b>${pending}</b> chờ đồng bộ`;
    } else {
      shStat.innerHTML = '⚠️ Chưa cấu hình Google Sheets. Vào <b>Cấu hình</b> để thiết lập.';
    }
  }

  // Auto-upload status
  const autoCfg = document.getElementById('dash-byt-autocfg');
  if (autoCfg) {
    autoCfg.textContent = CFG.autoUploadBYT
      ? '🤖 Tự động gửi BYT đang BẬT'
      : '⚙️ Tự động gửi BYT đang TẮT';
  }
}

function renderDashChart() {
  const el = document.getElementById('dash-chart');
  if (!el) return;

  const counts = {};
  Object.keys(SURVEYS).forEach(k => counts[k] = 0);
  DB.surveys.forEach(r => { if (counts[r.type] !== undefined) counts[r.type]++; });

  const total = DB.surveys.length || 1;
  let html = '<div style="display:flex;flex-direction:column;gap:10px;">';
  Object.entries(SURVEYS).forEach(([key, s]) => {
    const n = counts[key];
    const pct = Math.round(n / total * 100);
    const colors = { m1: '#0D47A1', m2: '#00ACC1', m3: '#6A1B9A', m4: '#E65100', m5: '#2E7D32' };
    html += `<div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
        <span>${s.icon} ${s.label}</span>
        <span style="font-weight:700;">${n}</span>
      </div>
      <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${colors[key]};border-radius:4px;transition:width .6s;"></div>
      </div>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function renderDashRecent() {
  const el = document.getElementById('dash-recent');
  if (!el) return;
  const recent = DB.surveys.slice(0, 6);
  if (!recent.length) { el.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-icon" style="font-size:28px;">📋</div><div class="empty-text" style="font-size:12px;">Chưa có phiếu nào</div></div>'; return; }
  let html = '';
  recent.forEach(r => {
    const s = SURVEYS[r.type];
    const ans = (r.answers || []).filter(a => a.value > 0);
    const avg = ans.length ? (ans.reduce((t, a) => t + a.value, 0) / ans.length).toFixed(1) : '—';
    html += `<div onclick="showRecordDetail('${r.id}')" style="padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:10px;transition:background .15s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <span style="font-size:18px;">${s?.icon||'📋'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s?.label||r.type}</div>
        <div style="font-size:11px;color:var(--text3);">${r.ngay||'—'} · ${r.khoa||r.donvi||'—'}</div>
      </div>
      <span style="font-weight:700;font-size:13px;color:${avg >= 4 ? 'var(--success)' : avg >= 3 ? 'var(--warning)' : 'var(--accent2)'};">${avg}/5</span>
    </div>`;
  });
  el.innerHTML = html;
}
