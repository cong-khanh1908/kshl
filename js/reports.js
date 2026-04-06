// reports.js – Báo cáo tổng hợp
// KSHL v6.1
// ============================================================

function getBCDateRange() {
  const type = document.getElementById('bc-period-type')?.value || 'qui';
  const year = parseInt(document.getElementById('bc-year')?.value) || new Date().getFullYear();

  if (type === 'thang') {
    const month = parseInt(document.getElementById('bc-month')?.value) || 1;
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const to   = new Date(year, month, 0).toISOString().split('T')[0];
    return { from, to, label: `Tháng ${month}/${year}` };
  }
  if (type === 'qui') {
    const qui = parseInt(document.getElementById('bc-qui')?.value) || 1;
    const monthStart = (qui - 1) * 3 + 1;
    const monthEnd   = qui * 3;
    const from = `${year}-${String(monthStart).padStart(2,'0')}-01`;
    const to   = new Date(year, monthEnd, 0).toISOString().split('T')[0];
    return { from, to, label: `Quý ${qui}/${year}` };
  }
  if (type === 'nam') {
    return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Năm ${year}` };
  }
  if (type === 'giai-doan') {
    const from = document.getElementById('bc-from-date')?.value || `${year}-01-01`;
    const to   = document.getElementById('bc-to-date')?.value   || `${year}-12-31`;
    return { from, to, label: `Giai đoạn ${from} đến ${to}` };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Năm ${year}` };
}

function getSurveysInRange(from, to, type = null) {
  return DB.surveys.filter(r => {
    const d = r.ngay || r.createdAt?.split('T')[0] || '';
    if (d < from || d > to) return false;
    if (type && r.type !== type) return false;
    return true;
  });
}

function calcStats(surveys) {
  if (!surveys.length) return { count: 0, avg: 0, pctHL: 0, bySec: {} };
  let total = 0, count = 0, hlCount = 0;
  surveys.forEach(r => {
    const ans = (r.answers || []).filter(a => a.value > 0);
    ans.forEach(a => { total += a.value; count++; if (a.value >= 4) hlCount++; });
  });
  const avg = count > 0 ? total / count : 0;
  const pctHL = count > 0 ? hlCount / count * 100 : 0;
  return { count: surveys.length, avg, pctHL, totalAns: count };
}

function renderBaoCaoPreview() {
  const range = getBCDateRange();
  const hvname = document.getElementById('bc-hvname')?.value || CFG.hvname || 'Bệnh viện';
  const syt    = document.getElementById('bc-syt')?.value || '';
  const soCV   = document.getElementById('bc-so-cv')?.value || '';
  const target = parseFloat(document.getElementById('bc-target')?.value) || 90;

  const all = getSurveysInRange(range.from, range.to);
  const byType = {};
  Object.keys(SURVEYS).forEach(k => { byType[k] = getSurveysInRange(range.from, range.to, k); });

  // Update quick stats
  document.getElementById('bc-stats-row').style.display = '';
  document.getElementById('bc-st-total').textContent = all.length;
  document.getElementById('bc-st-m1').textContent = byType.m1.length;
  document.getElementById('bc-st-m2').textContent = byType.m2.length;
  document.getElementById('bc-st-m3').textContent = byType.m3.length;

  const overallStats = calcStats(all);
  const today = new Date().toLocaleDateString('vi-VN');

  let html = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#666;">${syt.toUpperCase()}</div>
      <div style="font-size:14px;font-weight:700;margin:4px 0;">${hvname.toUpperCase()}</div>
      <div style="font-size:10px;color:#999;">──────────────────────────────────────</div>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:18px;font-weight:700;line-height:1.4;">BÁO CÁO KẾT QUẢ KHẢO SÁT HÀI LÒNG</div>
      <div style="font-size:15px;font-weight:700;">NGƯỜI BỆNH VÀ NHÂN VIÊN Y TẾ</div>
      <div style="font-size:13px;margin-top:6px;">${range.label}</div>
      ${soCV ? `<div style="font-size:12px;color:#666;">Số: ${soCV}</div>` : ''}
    </div>

    <p><b>I. MỤC ĐÍCH – CĂN CỨ</b></p>
    <p>Căn cứ Quyết định số 56/QĐ-BYT ngày 13/01/2024 và QĐ 3869/QĐ-BYT ngày 28/8/2019 của Bộ Y tế về đo lường sự hài lòng của người bệnh và NVYT, ${hvname} tiến hành khảo sát trong ${range.label}.</p>

    <p><b>II. KẾT QUẢ KHẢO SÁT</b></p>
    <p><b>2.1. Tổng quan</b></p>
    <p>Tổng số phiếu thu thập được trong kỳ: <b>${all.length} phiếu</b></p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
      <thead>
        <tr style="background:#E3F2FD;">
          <th style="border:1px solid #ccc;padding:8px;text-align:left;">Loại phiếu</th>
          <th style="border:1px solid #ccc;padding:8px;text-align:center;">Số phiếu</th>
          <th style="border:1px solid #ccc;padding:8px;text-align:center;">Điểm TB</th>
          <th style="border:1px solid #ccc;padding:8px;text-align:center;">Tỷ lệ hài lòng</th>
          <th style="border:1px solid #ccc;padding:8px;text-align:center;">Đạt chỉ tiêu (${target}%)</th>
        </tr>
      </thead>
      <tbody>`;

  Object.entries(SURVEYS).forEach(([key, s]) => {
    const surveys = byType[key];
    const stats = calcStats(surveys);
    const pctHL = stats.pctHL.toFixed(1);
    const dat = stats.pctHL >= target;
    html += `<tr>
      <td style="border:1px solid #ccc;padding:7px;">${s.icon} ${s.label}</td>
      <td style="border:1px solid #ccc;padding:7px;text-align:center;">${surveys.length}</td>
      <td style="border:1px solid #ccc;padding:7px;text-align:center;">${stats.avg.toFixed(2)}/5</td>
      <td style="border:1px solid #ccc;padding:7px;text-align:center;font-weight:700;color:${stats.pctHL >= target ? '#2E7D32' : '#C62828'}">${pctHL}%</td>
      <td style="border:1px solid #ccc;padding:7px;text-align:center;">${dat ? '✅ Đạt' : '❌ Chưa đạt'}</td>
    </tr>`;
  });

  html += `<tr style="background:#F5F5F5;font-weight:700;">
    <td style="border:1px solid #ccc;padding:7px;">TỔNG CỘNG</td>
    <td style="border:1px solid #ccc;padding:7px;text-align:center;">${all.length}</td>
    <td style="border:1px solid #ccc;padding:7px;text-align:center;">${overallStats.avg.toFixed(2)}/5</td>
    <td style="border:1px solid #ccc;padding:7px;text-align:center;color:${overallStats.pctHL >= target ? '#2E7D32' : '#C62828'}">${overallStats.pctHL.toFixed(1)}%</td>
    <td style="border:1px solid #ccc;padding:7px;text-align:center;">${overallStats.pctHL >= target ? '✅ Đạt' : '❌ Chưa đạt'}</td>
  </tr></tbody></table>

  <p><b>2.2. Nhận xét</b></p>
  <p>${all.length === 0
    ? 'Không có dữ liệu phiếu khảo sát trong kỳ báo cáo này.'
    : `Trong ${range.label}, ${hvname} thu thập được <b>${all.length} phiếu</b> khảo sát. Tỷ lệ hài lòng chung đạt <b>${overallStats.pctHL.toFixed(1)}%</b> ${overallStats.pctHL >= target ? '– <span style="color:#2E7D32"><b>ĐẠT</b></span>' : '– <span style="color:#C62828"><b>CHƯA ĐẠT</b></span>'} chỉ tiêu kế hoạch ${target}%.`
  }</p>

  <p><b>III. KẾT LUẬN VÀ KIẾN NGHỊ</b></p>
  <p>Căn cứ kết quả khảo sát trên, bệnh viện tiếp tục:</p>
  <ul style="margin-left:20px;margin-top:6px;line-height:2;">
    <li>Duy trì và nâng cao chất lượng dịch vụ tại các khoa phòng đạt chỉ tiêu.</li>
    <li>Tập trung cải thiện các lĩnh vực chưa đạt chỉ tiêu hài lòng.</li>
    <li>Tăng cường công tác truyền thông, giáo dục sức khỏe cho người bệnh và người nhà.</li>
    <li>Tiếp tục thu thập phiếu khảo sát đều đặn theo quy định.</li>
  </ul>

  <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:13px;text-align:center;">
    <div>
      <div style="color:#666;margin-bottom:40px;">Người lập báo cáo</div>
      <div style="border-top:1px solid #333;padding-top:6px;">Chữ ký, họ tên</div>
    </div>
    <div>
      <div style="color:#666;margin-bottom:4px;">${hvname}, ngày ${today}</div>
      <div style="font-weight:700;margin-bottom:36px;">GIÁM ĐỐC</div>
      <div style="border-top:1px solid #333;padding-top:6px;">Chữ ký, họ tên, đóng dấu</div>
    </div>
  </div>`;

  const preview = document.getElementById('bc-preview-card');
  const body = document.getElementById('bc-preview-body');
  if (body) body.innerHTML = html;
  if (preview) preview.style.display = '';
  toast('✅ Đã tạo xem trước báo cáo', 'success');
}

function exportBaoCaoHTML() {
  const body = document.getElementById('bc-preview-body')?.innerHTML;
  if (!body) { toast('⚠️ Xem trước báo cáo trước', 'warning'); return; }
  const hvname = document.getElementById('bc-hvname')?.value || 'BC';
  const range = getBCDateRange();
  const fullHtml = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Báo cáo KSHL – ${hvname} – ${range.label}</title>
    <style>body{font-family:'Times New Roman',serif;font-size:14px;line-height:1.8;color:#1a1a1a;max-width:800px;margin:0 auto;padding:40px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:7px;}</style>
  </head><body>${body}</body></html>`;
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `baocao_kshl_${today()}.html`; a.click();
  URL.revokeObjectURL(url);
  toast('🌐 Đã xuất HTML để in', 'success');
}

function exportBaoCaoDocx() {
  // If docx library available (future integration), generate Word file
  // For now, fall back to HTML export with instructions
  exportBaoCaoHTML();
  toast('💡 Mở file HTML → Ctrl+A → Copy → Dán vào Word để tạo .docx', 'info', 6000);
}
