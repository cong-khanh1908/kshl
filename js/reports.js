// reports.js – Tạo báo cáo tổng hợp, xuất Word/HTML
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// ============================================================

// =========================================================
// BÁO CÁO TỔNG HỢP MODULE
// =========================================================

const SECTION_NAMES = {
  m1: { A:'Khả năng tiếp cận', B:'Sự minh bạch TT & thủ tục', C:'Cơ sở vật chất & phương tiện', D:'Thái độ ứng xử & năng lực NVYT', E:'Kết quả cung cấp dịch vụ' },
  m2: { A:'Khả năng tiếp cận', B:'Sự minh bạch TT & thủ tục', C:'Cơ sở vật chất & phương tiện', D:'Thái độ ứng xử & năng lực NVYT', E:'Kết quả cung cấp dịch vụ' },
  m3: { A:'Điều kiện làm việc & phúc lợi', B:'Tổ chức và quản lý', C:'Môi trường làm việc & an toàn', D:'Hài lòng và gắn bó' },
  m4: { A:'Tiếp đón & thủ tục nhập viện', B:'Chăm sóc trong chuyển dạ & sinh', C:'Chăm sóc sau sinh', D:'Cơ sở vật chất', E:'Kết quả & hài lòng chung' },
  m5: { A:'Tư vấn, giáo dục sức khỏe', B:'Hỗ trợ thực hành tại BV', C:'Thực hành sau ra viện' }
};

function onBCPeriodTypeChange() {
  const pt = document.getElementById('bc-period-type').value;
  document.getElementById('bc-month-group').style.display = pt === 'thang' ? '' : 'none';
  document.getElementById('bc-qui-group').style.display = pt === 'qui' ? '' : 'none';
  document.getElementById('bc-giai-doan-group').style.display = pt === 'giai-doan' ? '' : 'none';
}

function getBCDateRange() {
  const pt = document.getElementById('bc-period-type').value;
  const year = parseInt(document.getElementById('bc-year').value) || 2025;
  let from, to, label;
  if (pt === 'thang') {
    const m = parseInt(document.getElementById('bc-month').value);
    from = new Date(year, m-1, 1);
    to = new Date(year, m, 0);
    label = `Tháng ${String(m).padStart(2,'0')} năm ${year}`;
  } else if (pt === 'qui') {
    const q = parseInt(document.getElementById('bc-qui').value);
    const startM = (q-1)*3;
    from = new Date(year, startM, 1);
    to = new Date(year, startM+3, 0);
    label = `Quý ${q} năm ${year}`;
  } else if (pt === 'nam') {
    from = new Date(year, 0, 1);
    to = new Date(year, 11, 31);
    label = `Năm ${year}`;
  } else {
    const fd = document.getElementById('bc-from-date').value;
    const td = document.getElementById('bc-to-date').value;
    from = fd ? new Date(fd) : new Date(year, 0, 1);
    to = td ? new Date(td) : new Date();
    label = `Giai đoạn ${fd||'?'} đến ${td||'?'}`;
  }
  return { from, to, label };
}

function filterSurveysByPeriod() {
  const { from, to } = getBCDateRange();
  return DB.surveys.filter(r => {
    const d = new Date(r.ngay || r.createdAt?.split('T')[0]);
    return d >= from && d <= to;
  });
}

// Calculate stats for a group of surveys of same type
function calcStats(surveys, type) {
  if (!surveys.length) return null;
  const def = SURVEYS[type];
  if (!def) return null;

  const result = {
    n: surveys.length,
    overallAvg: 0,
    overallPct: 0,
    bySection: {},
    byDept: {},
    bhytPct: 0,
    genderM: 0, genderF: 0,
    noissUrban: 0, noissRural: 0,
    answers: {} // { sectionId+qIdx: [values] }
  };

  // Per-section averages
  def.sections.forEach(sec => {
    const secAnswers = [];
    sec.questions.forEach((q, qi) => {
      const code = `${sec.id}${qi}`;
      result.answers[code] = [];
      surveys.forEach(r => {
        const a = r.answers?.find(x => x.code === `${sec.id}${qi+1}`);
        if (a && a.value > 0) {
          result.answers[code].push(a.value);
          secAnswers.push(a.value);
        }
      });
    });
    const avg = secAnswers.length ? secAnswers.reduce((s,v)=>s+v,0)/secAnswers.length : 0;
    result.bySection[sec.id] = { title: sec.title, avg: +avg.toFixed(2), pct: +(avg/5*100).toFixed(2), n: secAnswers.length };
  });

  // Overall average across all answered questions
  const allVals = [];
  surveys.forEach(r => { (r.answers||[]).forEach(a => { if(a.value>0) allVals.push(a.value); }); });
  result.overallAvg = allVals.length ? +(allVals.reduce((s,v)=>s+v,0)/allVals.length).toFixed(2) : 0;
  result.overallPct = +(result.overallAvg/5*100).toFixed(2);

  // By dept
  const depts = {};
  surveys.forEach(r => {
    const d = r.khoa || r.donvi || 'Toàn viện';
    if (!depts[d]) depts[d] = [];
    depts[d].push(r);
  });
  Object.entries(depts).forEach(([dept, rs]) => {
    const vals = [];
    rs.forEach(r => { (r.answers||[]).forEach(a => { if(a.value>0) vals.push(a.value); }); });
    const avg = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : 0;
    result.byDept[dept] = { n: rs.length, avg, pct: +(avg/5*100).toFixed(2) };
  });

  // BHYT
  const bhytYes = surveys.filter(r => r.bhyt && r.bhyt.startsWith('1')).length;
  result.bhytPct = surveys.length ? Math.round(bhytYes/surveys.length*100) : 0;

  // Gender
  result.genderM = surveys.filter(r => r.gt && r.gt.startsWith('1')).length;
  result.genderF = surveys.filter(r => r.gt && r.gt.startsWith('2')).length;

  // Noi sinh song
  result.noissUrban = surveys.filter(r => r.noiss && r.noiss.startsWith('1')).length;
  result.noissRural = surveys.filter(r => r.noiss && r.noiss.startsWith('2')).length;

  return result;
}

function getQuestionAvg(surveys, type, secId, qIdx) {
  const vals = [];
  surveys.forEach(r => {
    const a = r.answers?.find(x => x.code === `${secId}${qIdx+1}`);
    if (a && a.value > 0) vals.push(a.value);
  });
  return vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : 0;
}

// Generate preview + data model
function buildReportData() {
  const surveys = filterSurveysByPeriod();
  const { label } = getBCDateRange();
  const hvname = document.getElementById('bc-hvname').value || CFG.hvname || 'Bệnh viện';
  const syt = document.getElementById('bc-syt').value || 'Sở Y tế';
  const target = parseFloat(document.getElementById('bc-target').value) || 90;
  const soCv = document.getElementById('bc-so-cv').value || '___/BC-BV';

  const m1s = surveys.filter(x => x.type === 'm1');
  const m2s = surveys.filter(x => x.type === 'm2');
  const m3s = surveys.filter(x => x.type === 'm3');
  const m4s = surveys.filter(x => x.type === 'm4');
  const m5s = surveys.filter(x => x.type === 'm5');

  return {
    label, hvname, syt, target, soCv, surveys,
    m1: { surveys: m1s, stats: calcStats(m1s, 'm1') },
    m2: { surveys: m2s, stats: calcStats(m2s, 'm2') },
    m3: { surveys: m3s, stats: calcStats(m3s, 'm3') },
    m4: { surveys: m4s, stats: calcStats(m4s, 'm4') },
    m5: { surveys: m5s, stats: calcStats(m5s, 'm5') },
  };
}

function renderBaoCaoPreview() {
  // Load hospital name from config
  const hvEl = document.getElementById('bc-hvname');
  if (hvEl && !hvEl.value && CFG.hvname) hvEl.value = CFG.hvname;

  const data = buildReportData();
  const { label, hvname, syt, target, soCv } = data;
  const today = new Date();
  const todayStr = `ngày ${today.getDate()} tháng ${today.getMonth()+1} năm ${today.getFullYear()}`;

  // Update quick stats
  document.getElementById('bc-stats-row').style.display = '';
  document.getElementById('bc-st-total').textContent = data.surveys.length;
  document.getElementById('bc-st-m1').textContent = data.m1.surveys.length;
  document.getElementById('bc-st-m2').textContent = data.m2.surveys.length;
  document.getElementById('bc-st-m3').textContent = data.m3.surveys.length;

  if (data.surveys.length === 0) {
    document.getElementById('bc-preview-card').style.display = '';
    document.getElementById('bc-preview-body').innerHTML = `
      <div style="text-align:center;padding:40px;color:#999;">
        <div style="font-size:40px;margin-bottom:12px;">📭</div>
        <b>Không có dữ liệu khảo sát trong kỳ này.</b><br>
        <span style="font-size:13px;">Hãy nhập phiếu khảo sát hoặc chọn kỳ báo cáo khác.</span>
      </div>`;
    return;
  }

  let html = buildHTMLReport(data, todayStr);
  document.getElementById('bc-preview-card').style.display = '';
  document.getElementById('bc-preview-body').innerHTML = html;
  toast('✅ Xem trước báo cáo xong', 'success');
}

function buildHTMLReport(data, todayStr) {
  const { label, hvname, syt, target, soCv } = data;
  const province = CFG.province || '';

  let h = `
  <style>
    .bc-wrap{font-family:'Times New Roman',Times,serif;font-size:14pt;line-height:1.8;color:#000;}
    .bc-header-table{width:100%;border-collapse:collapse;margin-bottom:8px;}
    .bc-header-table td{vertical-align:top;padding:2px 4px;}
    .bc-center{text-align:center;}
    .bc-bold{font-weight:bold;}
    .bc-title{text-align:center;font-size:16pt;font-weight:bold;text-transform:uppercase;margin:10px 0 4px;}
    .bc-subtitle{text-align:center;font-size:14pt;font-weight:bold;margin-bottom:16px;}
    .bc-kinhgui{margin:8px 0 16px;}
    .bc-h1{font-size:14pt;font-weight:bold;margin:16px 0 6px;}
    .bc-h2{font-size:13pt;font-weight:bold;font-style:italic;margin:12px 0 4px;}
    .bc-h3{font-size:13pt;font-weight:bold;margin:10px 0 4px;}
    .bc-table{width:100%;border-collapse:collapse;margin:8px 0 6px;font-size:12pt;}
    .bc-table th,.bc-table td{border:1px solid #000;padding:5px 8px;text-align:center;}
    .bc-table th{background:#dce6f1;font-weight:bold;}
    .bc-table td:first-child{text-align:left;}
    .bc-table .bc-total{font-weight:bold;background:#f2f7fb;}
    .bc-note{font-size:11pt;font-style:italic;color:#444;margin:4px 0 10px;}
    .bc-sign{width:100%;margin-top:32px;}
    .bc-sign td{vertical-align:top;width:50%;text-align:center;padding:0 8px;}
    .bc-dash{border-bottom:1px solid #555;margin:2px 0;}
    .bc-indent{margin-left:28px;}
    .bc-nodata{color:#888;font-style:italic;padding:6px 0;}
  </style>
  <div class="bc-wrap">

  <!-- HEADER -->
  <table class="bc-header-table">
    <tr>
      <td style="width:45%;font-size:12pt;text-align:center;">
        <div class="bc-bold">${syt.toUpperCase()}</div>
        <div class="bc-bold" style="font-size:14pt;">${hvname.toUpperCase()}</div>
        <div style="font-size:11pt;">Số: ${soCv}</div>
      </td>
      <td style="width:10%"></td>
      <td style="width:45%;text-align:center;">
        <div class="bc-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="bc-bold">Độc lập – Tự do – Hạnh phúc</div>
        <div style="text-align:center;border-top:2px solid #000;width:80%;margin:3px auto;"></div>
        <div style="font-style:italic;">${province ? province+', ' : ''}${todayStr}</div>
      </td>
    </tr>
  </table>

  <div class="bc-title">BÁO CÁO</div>
  <div class="bc-subtitle">Kết quả khảo sát hài lòng ${label}</div>
  <div class="bc-kinhgui"><b>Kính gửi:</b> Các khoa, phòng.</div>

  <!-- PHẦN 1: THÔNG TIN CHUNG -->
  <div class="bc-h1">1. Thông tin chung</div>
  <div class="bc-h2">a) Thời điểm tiến hành khảo sát</div>
  <div class="bc-indent">Kỳ khảo sát: <b>${label}</b></div>

  <div class="bc-h2">b) Số lượng mẫu phỏng vấn</div>`;

  if (data.m1.surveys.length) h += `<div class="bc-indent">– Nội trú: <b>${data.m1.surveys.length}</b> bệnh nhân.</div>`;
  if (data.m2.surveys.length) h += `<div class="bc-indent">– Ngoại trú: <b>${data.m2.surveys.length}</b> bệnh nhân.</div>`;
  if (data.m3.surveys.length) h += `<div class="bc-indent">– Nhân viên y tế: <b>${data.m3.surveys.length}</b> viên chức, người lao động.</div>`;
  if (data.m4.surveys.length) h += `<div class="bc-indent">– Người mẹ sinh con: <b>${data.m4.surveys.length}</b> sản phụ.</div>`;
  if (data.m5.surveys.length) h += `<div class="bc-indent">– Nuôi con bằng sữa mẹ: <b>${data.m5.surveys.length}</b> bà mẹ.</div>`;

  // Cơ cấu mẫu theo khoa
  const allDepts = {};
  ['m1','m2'].forEach(t => {
    data[t].surveys.forEach(r => {
      const d = r.khoa || r.donvi || 'Không xác định';
      if (!allDepts[d]) allDepts[d] = {m1:0,m2:0};
      allDepts[d][t]++;
    });
  });
  if (Object.keys(allDepts).length > 0) {
    h += `<div class="bc-h2">c) Cơ cấu mẫu khảo sát theo khoa/phòng</div>`;
    Object.entries(allDepts).forEach(([dept, counts]) => {
      const parts = [];
      if(counts.m1) parts.push(`nội trú: ${counts.m1}`);
      if(counts.m2) parts.push(`ngoại trú: ${counts.m2}`);
      h += `<div class="bc-indent">– ${dept}: ${parts.join(', ')} bệnh nhân.</div>`;
    });
  }

  // ========== PHẦN 2: KẾT QUẢ BỆNH NHÂN NỘI TRÚ, NGOẠI TRÚ ==========
  if (data.m1.stats || data.m2.stats) {
    h += `<div class="bc-h1">2. Kết quả khảo sát bệnh nhân nội trú, ngoại trú</div>`;
    h += `<div class="bc-h2">2.1. Các chỉ số hài lòng</div>`;

    // M1 - Nội trú
    if (data.m1.stats) {
      const s = data.m1.stats;
      h += `<div class="bc-h3">a) Chỉ số hài lòng người bệnh nội trú</div>`;
      h += `<b>Bảng 1. Chỉ số hài lòng chung nội trú</b>`;
      h += buildDeptTable(data.m1.surveys, 'Khoa/ phòng', true);
      const achieved = s.overallPct >= target;
      h += `<div class="bc-note">Tỷ lệ hài lòng chung nội trú đạt <b>${s.overallPct}%</b> (điểm TB: ${s.overallAvg}/5), ${achieved ? '<b style="color:green">ĐẠT</b>' : '<b style="color:red">CHƯA ĐẠT</b>'} so với kế hoạch ${target}%.</div>`;

      // BHYT
      if (s.bhytPct > 0) h += `<div class="bc-indent">– Tỷ lệ bệnh nhân nội trú sử dụng BHYT: <b>${s.bhytPct}%</b>.</div>`;

      // 5 tiêu chí
      h += `<div class="bc-h3">Chỉ số hài lòng theo 5 tiêu chí (nội trú)</div>`;
      h += buildSectionTable(s, 'm1', data.m1.surveys);
    }

    // M2 - Ngoại trú
    if (data.m2.stats) {
      const s = data.m2.stats;
      h += `<div class="bc-h3">b) Chỉ số hài lòng người bệnh ngoại trú</div>`;
      h += `<b>Bảng. Chỉ số hài lòng chung ngoại trú</b>`;
      h += buildDeptTable(data.m2.surveys, 'Đơn vị', false);
      const achieved = s.overallPct >= target;
      h += `<div class="bc-note">Tỷ lệ hài lòng chung ngoại trú đạt <b>${s.overallPct}%</b> (điểm TB: ${s.overallAvg}/5), ${achieved ? '<b style="color:green">ĐẠT</b>' : '<b style="color:red">CHƯA ĐẠT</b>'} so với kế hoạch ${target}%.</div>`;

      if (s.bhytPct > 0) h += `<div class="bc-indent">– Tỷ lệ bệnh nhân ngoại trú sử dụng BHYT: <b>${s.bhytPct}%</b>.</div>`;

      h += `<div class="bc-h3">Chỉ số hài lòng theo 5 tiêu chí (ngoại trú)</div>`;
      h += buildSectionTable(s, 'm2', data.m2.surveys);
    }

    // Phân tích ngoại trú + nội trú
    h += `<div class="bc-h2">2.2. Phân tích</div>`;
    h += `<div class="bc-h3">a) Những điểm mạnh ghi nhận được</div>`;
    const allHL = [];
    ['m1','m2'].forEach(t => { if(data[t].stats) allHL.push(`${t==='m1'?'nội trú':'ngoại trú'}: ${data[t].stats.overallPct}%`); });
    h += `<div class="bc-indent">Tỷ lệ hài lòng: ${allHL.join('; ')}. Các tiêu chí đánh giá đều đạt mức cao.</div>`;
    h += `<div class="bc-h3">b) Phân tích yếu tố ảnh hưởng</div>`;
    if (data.m1.stats) {
      const achieved1 = data.m1.stats.overallPct >= target;
      h += `<div class="bc-indent">– Tỷ lệ hài lòng nội trú ${label} <b style="color:${achieved1?'green':'red'}">${achieved1?'ĐẠT':'CHƯA ĐẠT'}</b> (${data.m1.stats.overallPct}%) so với kế hoạch ${target}%.</div>`;
    }
    if (data.m2.stats) {
      const achieved2 = data.m2.stats.overallPct >= target;
      h += `<div class="bc-indent">– Tỷ lệ hài lòng ngoại trú ${label} <b style="color:${achieved2?'green':'red'}">${achieved2?'ĐẠT':'CHƯA ĐẠT'}</b> (${data.m2.stats.overallPct}%) so với kế hoạch ${target}%.</div>`;
    }
  }

  // ========== PHẦN 3: NHÂN VIÊN Y TẾ ==========
  if (data.m3.stats) {
    const s = data.m3.stats;
    h += `<div class="bc-h1">3. Kết quả khảo sát nhân viên y tế</div>`;
    h += `<div class="bc-h2">3.1. Chỉ số hài lòng chung</div>`;
    h += `<b>Bảng. Chỉ số hài lòng chung toàn bệnh viện (NVYT)</b>`;
    h += `<table class="bc-table">
      <thead><tr><th>Đơn vị</th><th>N</th><th>Điểm trung bình</th><th>Tỷ lệ %</th></tr></thead>
      <tbody>
        <tr class="bc-total"><td>${hvname}</td><td>${s.n}</td><td>${s.overallAvg}</td><td>${s.overallPct}%</td></tr>
      </tbody>
    </table>`;
    const achieved3 = s.overallPct >= target;
    h += `<div class="bc-note">Kết quả khảo sát hài lòng NVYT ${label} đạt <b>${s.overallPct}%</b>, ${achieved3 ? '<b style="color:green">ĐẠT</b>' : '<b style="color:red">CHƯA ĐẠT</b>'} so với kế hoạch ${target}%.</div>`;

    h += `<b>Bảng. Chỉ số hài lòng NVYT theo từng tiêu chí</b>`;
    h += buildSectionTable(s, 'm3', data.m3.surveys);

    // By dept
    const depts = Object.entries(s.byDept);
    if (depts.length > 1) {
      h += `<div class="bc-h2">3.2. Hài lòng theo khoa/phòng</div>`;
      h += `<table class="bc-table"><thead><tr><th>Khoa/Phòng</th><th>N</th><th>Điểm TB</th><th>Tỷ lệ %</th></tr></thead><tbody>`;
      depts.sort((a,b)=>b[1].pct-a[1].pct).forEach(([d,v]) => {
        h += `<tr><td>${d}</td><td>${v.n}</td><td>${v.avg}</td><td>${v.pct}%</td></tr>`;
      });
      h += `<tr class="bc-total"><td>Toàn viện</td><td>${s.n}</td><td>${s.overallAvg}</td><td>${s.overallPct}%</td></tr>`;
      h += `</tbody></table>`;
      const sorted = depts.sort((a,b)=>a[1].pct-b[1].pct);
      if(sorted.length>1) h += `<div class="bc-note">Khoa có tỷ lệ hài lòng thấp nhất: <b>${sorted[0][0]}</b> (${sorted[0][1].pct}%). Khoa có tỷ lệ cao nhất: <b>${sorted[sorted.length-1][0]}</b> (${sorted[sorted.length-1][1].pct}%).</div>`;
    }
  }

  // ========== PHẦN 4+5: M4, M5 ==========
  let partNum = 4;
  ['m4','m5'].forEach(t => {
    if (!data[t].stats) return;
    const s = data[t].stats;
    const tLabel = t === 'm4' ? 'người mẹ sinh con' : 'nuôi con bằng sữa mẹ';
    h += `<div class="bc-h1">${partNum}. Kết quả khảo sát ${tLabel}</div>`;
    h += `<table class="bc-table"><thead><tr><th>Đơn vị</th><th>N</th><th>Điểm TB</th><th>Tỷ lệ %</th></tr></thead>`;
    h += `<tbody><tr class="bc-total"><td>${hvname}</td><td>${s.n}</td><td>${s.overallAvg}</td><td>${s.overallPct}%</td></tr></tbody></table>`;
    h += buildSectionTable(s, t, data[t].surveys);
    partNum++;
  });

  // ========== ĐỀ XUẤT ==========
  h += `<div class="bc-h1">${partNum}. Đề xuất giải pháp và kiến nghị</div>`;
  h += `<div class="bc-indent">Hiện tại, kết quả khảo sát hài lòng ${label} tại ${hvname}:</div>`;
  ['m1','m2','m3'].forEach(t => {
    if(!data[t].stats) return;
    const s = data[t].stats;
    const lb = t==='m1'?'nội trú':t==='m2'?'ngoại trú':'nhân viên y tế';
    const achieved = s.overallPct >= data.target;
    h += `<div class="bc-indent">– ${lb.charAt(0).toUpperCase()+lb.slice(1)}: <b>${s.overallPct}%</b> (<b style="color:${achieved?'green':'red'}">${achieved?'ĐẠT':'CHƯA ĐẠT'}</b> kế hoạch ${data.target}%).</div>`;
  });
  h += `<div class="bc-indent" style="margin-top:8px;">Đề nghị các khoa, phòng tiếp tục nâng cao tinh thần thái độ phục vụ, năng lực chuyên môn và giao tiếp ứng xử đối với người bệnh và đồng nghiệp, nhằm duy trì và cải thiện chỉ số hài lòng.</div>`;

  h += `<div style="margin-top:12px;font-style:italic;">Trên đây là kết quả khảo sát và đánh giá sự hài lòng ${label} tại ${hvname}./.`;

  // Ký tên
  h += `<table class="bc-sign"><tr>
    <td><div><i>Nơi nhận:</i></div><div class="bc-indent">- Các khoa, phòng;</div><div class="bc-indent">- Lưu: VT.</div></td>
    <td><div class="bc-bold">GIÁM ĐỐC</div><div style="height:60px;"></div><div style="font-style:italic;">(Ký tên, đóng dấu)</div></td>
  </tr></table>`;

  h += `</div>`;
  return h;
}

function buildDeptTable(surveys, labelCol, byDept) {
  const depts = {};
  surveys.forEach(r => {
    const d = r.khoa || r.donvi || 'Toàn viện';
    if (!depts[d]) depts[d] = [];
    depts[d].push(r);
  });
  let h = `<table class="bc-table"><thead><tr><th>${labelCol}</th><th>N</th><th>TB điểm các TC</th><th>Tỷ lệ % các TC</th></tr></thead><tbody>`;
  Object.entries(depts).forEach(([dept, rs]) => {
    const vals = [];
    rs.forEach(r => { (r.answers||[]).forEach(a => { if(a.value>0) vals.push(a.value); }); });
    const avg = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : 0;
    const pct = +(avg/5*100).toFixed(2);
    h += `<tr><td>${dept}</td><td>${rs.length}</td><td>${avg}</td><td>${pct}%</td></tr>`;
  });
  // Total row
  const allVals = [];
  surveys.forEach(r => { (r.answers||[]).forEach(a => { if(a.value>0) allVals.push(a.value); }); });
  const totalAvg = allVals.length ? +(allVals.reduce((s,v)=>s+v,0)/allVals.length).toFixed(2) : 0;
  const totalPct = +(totalAvg/5*100).toFixed(2);
  h += `<tr class="bc-total"><td>Bệnh viện</td><td>${surveys.length}</td><td>${totalAvg}</td><td>${totalPct}%</td></tr>`;
  h += `</tbody></table>`;
  return h;
}

function buildSectionTable(stats, type, surveys) {
  const secNames = SECTION_NAMES[type] || {};
  let h = `<table class="bc-table"><thead><tr><th>Tiêu chí</th><th>Nội dung</th><th>Điểm TB</th><th>Tỷ lệ %</th></tr></thead><tbody>`;
  Object.entries(stats.bySection).forEach(([sid, sv]) => {
    const shortName = secNames[sid] || sv.title;
    h += `<tr><td>Tiêu chí ${sid}</td><td style="text-align:left">${shortName}</td><td>${sv.avg}</td><td>${sv.pct}%</td></tr>`;
  });
  h += `<tr class="bc-total"><td colspan="2">Tổng hợp chung</td><td>${stats.overallAvg}</td><td>${stats.overallPct}%</td></tr>`;
  h += `</tbody></table>`;

  // Question-level detail for each section
  const def = SURVEYS[type];
  if (def) {
    def.sections.forEach(sec => {
      if (!surveys.length) return;
      h += `<div style="font-size:12pt;font-weight:bold;margin:8px 0 3px;">Chi tiết tiêu chí ${sec.id}: ${sec.title}</div>`;
      h += `<table class="bc-table"><thead><tr><th style="width:5%">Mã</th><th>Nội dung câu hỏi</th><th>Điểm TB</th></tr></thead><tbody>`;
      sec.questions.forEach((q, qi) => {
        const avg = getQuestionAvg(surveys, type, sec.id, qi);
        h += `<tr><td>${sec.id}${qi+1}</td><td style="text-align:left;font-size:11pt;">${q}</td><td>${avg || '—'}</td></tr>`;
      });
      h += `</tbody></table>`;
    });
  }
  return h;
}

// Export to HTML file for printing
function exportBaoCaoHTML() {
  const data = buildReportData();
  const today = new Date();
  const todayStr = `ngày ${today.getDate()} tháng ${today.getMonth()+1} năm ${today.getFullYear()}`;
  const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
    <title>Báo cáo ${data.label}</title>
    <style>body{margin:20mm 25mm;font-family:'Times New Roman',serif;}@media print{body{margin:20mm;}}</style>
  </head><body>${buildHTMLReport(data, todayStr)}</body></html>`;
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `BaoCao_HaiLong_${data.label.replace(/\s+/g,'_')}.html`;
  a.click();
  toast('✅ Xuất HTML xong! Mở file → Ctrl+P để in.', 'success');
}

// Export DOCX using docx.js CDN via script injection
async function exportBaoCaoDocx() {
  toast('⏳ Đang tạo file Word...', 'info');
  const data = buildReportData();

  // Load docx.js from CDN if not loaded
  if (typeof docx === 'undefined') {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  try {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
            AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
            VerticalAlign, PageNumber, Header, Footer, UnderlineType } = docx;

    const today = new Date();
    const todayStr = `ngày ${today.getDate()} tháng ${today.getMonth()+1} năm ${today.getFullYear()}`;
    const { label, hvname, syt, target, soCv } = data;
    const province = CFG.province || '';

    // Helper functions
    const W = (text, opts={}) => new TextRun({text, font:'Times New Roman', size:28, ...opts});
    const BORDER = {style: BorderStyle.SINGLE, size:1, color:'000000'};
    const BORDERS = {top:BORDER, bottom:BORDER, left:BORDER, right:BORDER};
    const CELL_MARGINS = {top:80, bottom:80, left:120, right:120};
    const TW = 9360; // Total width DXA (A4 with 2.5cm margins)

    const makeCell = (text, opts={}) => new TableCell({
      borders: BORDERS,
      margins: CELL_MARGINS,
      verticalAlign: VerticalAlign.CENTER,
      shading: opts.shading || undefined,
      columnSpan: opts.colspan,
      width: opts.width ? {size: opts.width, type: WidthType.DXA} : undefined,
      children: [new Paragraph({
        alignment: opts.align || AlignmentType.CENTER,
        children: [W(text, {bold: opts.bold, size: opts.size||28})]
      })]
    });

    const P = (runs, opts={}) => new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { before: opts.before||0, after: opts.after||120 },
      indent: opts.indent ? {left: 720} : undefined,
      children: Array.isArray(runs) ? runs : [runs]
    });

    const H1 = (text) => new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: {before:240, after:120},
      children: [W(text, {bold:true, size:32})]
    });

    const H2 = (text) => new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: {before:200, after:80},
      children: [W(text, {bold:true, italics:true, size:28})]
    });

    const H3 = (text) => new Paragraph({
      spacing: {before:160, after:80},
      children: [W(text, {bold:true, size:28})]
    });

    // Build dept table rows
    const makeDeptTableRows = (surveys) => {
      const depts = {};
      surveys.forEach(r => {
        const d = r.khoa || r.donvi || 'Toàn viện';
        if(!depts[d]) depts[d] = [];
        depts[d].push(r);
      });
      const rows = [];
      // Header
      rows.push(new TableRow({ tableHeader:true, children: [
        makeCell('Khoa/ phòng', {bold:true, shading:{fill:'DCE6F1',type:ShadingType.CLEAR}, align:AlignmentType.LEFT, width:3600}),
        makeCell('N', {bold:true, shading:{fill:'DCE6F1',type:ShadingType.CLEAR}, width:800}),
        makeCell('TB điểm các TC', {bold:true, shading:{fill:'DCE6F1',type:ShadingType.CLEAR}, width:2480}),
        makeCell('Tỷ lệ % các TC', {bold:true, shading:{fill:'DCE6F1',type:ShadingType.CLEAR}, width:2480}),
      ]}));
      Object.entries(depts).forEach(([dept, rs]) => {
        const vals = [];
        rs.forEach(r => { (r.answers||[]).forEach(a => { if(a.value>0) vals.push(a.value); }); });
        const avg = vals.length ? +(vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : 0;
        const pct = +(avg/5*100).toFixed(2);
        rows.push(new TableRow({ children: [
          makeCell(dept, {align:AlignmentType.LEFT, width:3600}),
          makeCell(String(rs.length), {width:800}),
          makeCell(String(avg), {width:2480}),
          makeCell(pct+'%', {width:2480}),
        ]}));
      });
      const allVals = [];
      surveys.forEach(r => { (r.answers||[]).forEach(a => { if(a.value>0) allVals.push(a.value); }); });
      const tAvg = allVals.length ? +(allVals.reduce((s,v)=>s+v,0)/allVals.length).toFixed(2) : 0;
      const tPct = +(tAvg/5*100).toFixed(2);
      rows.push(new TableRow({ children: [
        makeCell('Bệnh viện', {bold:true, align:AlignmentType.LEFT, shading:{fill:'F2F7FB',type:ShadingType.CLEAR}, width:3600}),
        makeCell(String(surveys.length), {bold:true, shading:{fill:'F2F7FB',type:ShadingType.CLEAR}, width:800}),
        makeCell(String(tAvg), {bold:true, shading:{fill:'F2F7FB',type:ShadingType.CLEAR}, width:2480}),
        makeCell(tPct+'%', {bold:true, shading:{fill:'F2F7FB',type:ShadingType.CLEAR}, width:2480}),
      ]}));
      return rows;
    };

    const makeSectionTableRows = (stats, type) => {
      const secNames = SECTION_NAMES[type] || {};
      const rows = [];
      rows.push(new TableRow({ tableHeader:true, children:[
        makeCell('Tiêu chí', {bold:true, shading:{fill:'DCE6F1',type:ShadingType.CLEAR}, width:800}),
        makeCell('Nội dung', {bold:true, shading:{fill:'DCE6F1',type:ShadingType.CLEAR}, align:AlignmentType.LEFT, width:5760}),
        makeCell('Điểm TB', {bold:true, shading:{fill:'DCE6F1',type:ShadingType.CLEAR}, width:1400}),
        makeCell('Tỷ lệ %', {bold:true, shading:{fill:'DCE6F1',type:ShadingType.CLEAR}, width:1400}),
      ]}));
      Object.entries(stats.bySection).forEach(([sid, sv]) => {
        const shortName = secNames[sid] || sv.title;
        rows.push(new TableRow({children:[
          makeCell('TC '+sid, {width:800}),
          makeCell(shortName, {align:AlignmentType.LEFT, width:5760}),
          makeCell(String(sv.avg), {width:1400}),
          makeCell(sv.pct+'%', {width:1400}),
        ]}));
      });
      rows.push(new TableRow({children:[
        makeCell('Tổng', {bold:true, shading:{fill:'F2F7FB',type:ShadingType.CLEAR}, colspan:2, width:6560}),
        makeCell(String(stats.overallAvg), {bold:true, shading:{fill:'F2F7FB',type:ShadingType.CLEAR}, width:1400}),
        makeCell(stats.overallPct+'%', {bold:true, shading:{fill:'F2F7FB',type:ShadingType.CLEAR}, width:1400}),
      ]}));
      return rows;
    };

    // Build document children
    const children = [];

    // Header table
    children.push(new Table({
      width:{size:TW, type:WidthType.DXA},
      columnWidths:[TW/2-200, 400, TW/2-200],
      borders: {top:{style:BorderStyle.NONE}, bottom:{style:BorderStyle.NONE}, left:{style:BorderStyle.NONE}, right:{style:BorderStyle.NONE}, insideH:{style:BorderStyle.NONE}, insideV:{style:BorderStyle.NONE}},
      rows:[new TableRow({children:[
        new TableCell({borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, children:[
          P([W(syt, {bold:true, size:26})], {align:AlignmentType.CENTER}),
          P([W(hvname, {bold:true, size:30})], {align:AlignmentType.CENTER}),
          P([W('Số: '+soCv, {size:24})], {align:AlignmentType.CENTER}),
        ]}),
        new TableCell({borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, children:[P([W('')])]}),
        new TableCell({borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, children:[
          P([W('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', {bold:true, size:26})], {align:AlignmentType.CENTER}),
          P([W('Độc lập – Tự do – Hạnh phúc', {bold:true, size:26})], {align:AlignmentType.CENTER}),
          P([W((province?province+', ':'')+todayStr, {italics:true, size:24})], {align:AlignmentType.CENTER}),
        ]}),
      ]})]
    }));

    // Title
    children.push(P([W('BÁO CÁO', {bold:true, size:36})], {align:AlignmentType.CENTER, before:200, after:60}));
    children.push(P([W(`Kết quả khảo sát hài lòng ${label}`, {bold:true, size:32})], {align:AlignmentType.CENTER, after:200}));
    children.push(P([W('Kính gửi: ', {bold:true}), W('Các khoa, phòng.')], {after:160}));

    // Section 1
    children.push(H1('1. Thông tin chung'));
    children.push(H2('a) Thời điểm tiến hành khảo sát'));
    children.push(P([W(`Kỳ khảo sát: `, {}), W(label, {bold:true})], {indent:true}));
    children.push(H2('b) Số lượng mẫu phỏng vấn'));
    if(data.m1.surveys.length) children.push(P([W(`– Nội trú: `), W(String(data.m1.surveys.length), {bold:true}), W(' bệnh nhân.')], {indent:true}));
    if(data.m2.surveys.length) children.push(P([W(`– Ngoại trú: `), W(String(data.m2.surveys.length), {bold:true}), W(' bệnh nhân.')], {indent:true}));
    if(data.m3.surveys.length) children.push(P([W(`– Nhân viên y tế: `), W(String(data.m3.surveys.length), {bold:true}), W(' viên chức, người lao động.')], {indent:true}));
    if(data.m4.surveys.length) children.push(P([W(`– Người mẹ sinh con: `), W(String(data.m4.surveys.length), {bold:true}), W(' sản phụ.')], {indent:true}));
    if(data.m5.surveys.length) children.push(P([W(`– Nuôi con bằng sữa mẹ: `), W(String(data.m5.surveys.length), {bold:true}), W(' bà mẹ.')], {indent:true}));

    // Section 2 - NB
    if (data.m1.stats || data.m2.stats) {
      children.push(H1('2. Kết quả khảo sát bệnh nhân nội trú, ngoại trú'));
      children.push(H2('2.1. Các chỉ số hài lòng'));

      if (data.m1.stats) {
        const s = data.m1.stats;
        children.push(H3('a) Chỉ số hài lòng người bệnh nội trú'));
        children.push(P([W('Bảng 1. Chỉ số hài lòng chung nội trú', {bold:true})], {align:AlignmentType.CENTER}));
        children.push(new Table({width:{size:TW,type:WidthType.DXA}, columnWidths:[3600,800,2480,2480], rows:makeDeptTableRows(data.m1.surveys)}));
        const ach = s.overallPct >= target;
        children.push(P([W(`Tỷ lệ hài lòng chung nội trú đạt `), W(s.overallPct+'%', {bold:true}), W(` (TB: ${s.overallAvg}/5), `), W(ach?'ĐẠT':'CHƯA ĐẠT', {bold:true}), W(` so với kế hoạch ${target}%.`)], {after:160}));
        if(s.bhytPct>0) children.push(P([W(`– Tỷ lệ bệnh nhân nội trú sử dụng BHYT: `), W(s.bhytPct+'%', {bold:true}), W('.')], {indent:true}));
        children.push(H3('Chỉ số hài lòng theo tiêu chí (nội trú)'));
        children.push(new Table({width:{size:TW,type:WidthType.DXA}, columnWidths:[800,5760,1400,1400], rows:makeSectionTableRows(s, 'm1')}));
      }

      if (data.m2.stats) {
        const s = data.m2.stats;
        children.push(H3('b) Chỉ số hài lòng người bệnh ngoại trú'));
        children.push(P([W('Bảng 2. Chỉ số hài lòng chung ngoại trú', {bold:true})], {align:AlignmentType.CENTER}));
        children.push(new Table({width:{size:TW,type:WidthType.DXA}, columnWidths:[3600,800,2480,2480], rows:makeDeptTableRows(data.m2.surveys)}));
        const ach = s.overallPct >= target;
        children.push(P([W('Tỷ lệ hài lòng chung ngoại trú đạt '), W(s.overallPct+'%', {bold:true}), W(` (TB: ${s.overallAvg}/5), `), W(ach?'ĐẠT':'CHƯA ĐẠT', {bold:true}), W(` so với kế hoạch ${target}%.`)], {after:160}));
        children.push(H3('Chỉ số hài lòng theo tiêu chí (ngoại trú)'));
        children.push(new Table({width:{size:TW,type:WidthType.DXA}, columnWidths:[800,5760,1400,1400], rows:makeSectionTableRows(s, 'm2')}));
      }

      children.push(H2('2.2. Phân tích'));
      children.push(H3('a) Những điểm mạnh ghi nhận được'));
      children.push(P([W(`Nhìn chung, người bệnh đánh giá chất lượng dịch vụ tốt, các tiêu chí hài lòng đều đạt mức cao.`)], {indent:true}));
      children.push(H3('b) Phân tích yếu tố ảnh hưởng'));
      ['m1','m2'].forEach((t,i) => {
        if(!data[t].stats) return;
        const s = data[t].stats; const lb = t==='m1'?'nội trú':'ngoại trú'; const ach = s.overallPct>=target;
        children.push(P([W(`– Tỷ lệ hài lòng ${lb} ${label} `), W(ach?'ĐẠT':'CHƯA ĐẠT', {bold:true}), W(` (${s.overallPct}%) so với kế hoạch ${target}%.`)], {indent:true}));
      });
    }

    // Section 3 - NVYT
    if (data.m3.stats) {
      const s = data.m3.stats;
      children.push(H1('3. Kết quả khảo sát nhân viên y tế'));
      children.push(H2('3.1. Chỉ số hài lòng chung'));
      children.push(P([W('Bảng 3. Chỉ số hài lòng chung toàn bệnh viện (NVYT)', {bold:true})], {align:AlignmentType.CENTER}));
      children.push(new Table({width:{size:TW,type:WidthType.DXA}, columnWidths:[4360,1200,1900,1900], rows:[
        new TableRow({tableHeader:true, children:[makeCell('Đơn vị',{bold:true,align:AlignmentType.LEFT,shading:{fill:'DCE6F1',type:ShadingType.CLEAR},width:4360}),makeCell('N',{bold:true,shading:{fill:'DCE6F1',type:ShadingType.CLEAR},width:1200}),makeCell('Điểm TB',{bold:true,shading:{fill:'DCE6F1',type:ShadingType.CLEAR},width:1900}),makeCell('Tỷ lệ %',{bold:true,shading:{fill:'DCE6F1',type:ShadingType.CLEAR},width:1900})]}),
        new TableRow({children:[makeCell(hvname,{align:AlignmentType.LEFT,bold:true,shading:{fill:'F2F7FB',type:ShadingType.CLEAR},width:4360}),makeCell(String(s.n),{bold:true,shading:{fill:'F2F7FB',type:ShadingType.CLEAR},width:1200}),makeCell(String(s.overallAvg),{bold:true,shading:{fill:'F2F7FB',type:ShadingType.CLEAR},width:1900}),makeCell(s.overallPct+'%',{bold:true,shading:{fill:'F2F7FB',type:ShadingType.CLEAR},width:1900})]})
      ]}));
      const ach3 = s.overallPct >= target;
      children.push(P([W(`Kết quả khảo sát NVYT ${label} đạt `), W(s.overallPct+'%', {bold:true}), W(', '), W(ach3?'ĐẠT':'CHƯA ĐẠT', {bold:true}), W(` so với kế hoạch ${target}%.`)], {after:120}));
      children.push(H2('3.2. Chỉ số hài lòng theo tiêu chí'));
      children.push(new Table({width:{size:TW,type:WidthType.DXA}, columnWidths:[800,5760,1400,1400], rows:makeSectionTableRows(s,'m3')}));
    }

    // Conclusion
    let partN = 4;
    if(data.m4.stats||data.m5.stats) partN++;
    children.push(H1(`${partN}. Đề xuất giải pháp và kiến nghị`));
    children.push(P([W(`Căn cứ kết quả khảo sát ${label}:`)], {after:80}));
    ['m1','m2','m3'].forEach(t => {
      if(!data[t].stats) return;
      const s=data[t].stats; const lb=t==='m1'?'Nội trú':t==='m2'?'Ngoại trú':'Nhân viên y tế'; const ach=s.overallPct>=target;
      children.push(P([W(`– ${lb}: `), W(s.overallPct+'%', {bold:true}), W(' ('), W(ach?'ĐẠT':'CHƯA ĐẠT', {bold:true}), W(` kế hoạch ${target}%).`)], {indent:true}));
    });
    children.push(P([W(`Đề nghị các khoa, phòng tiếp tục nâng cao tinh thần thái độ phục vụ, năng lực chuyên môn và giao tiếp ứng xử, nhằm duy trì và cải thiện chỉ số hài lòng.`)], {indent:true, before:120}));
    children.push(P([W(`Trên đây là kết quả khảo sát và đánh giá sự hài lòng ${label} tại ${hvname}./`, {italics:true})], {before:200, after:0}));

    // Signature block
    children.push(new Table({
      width:{size:TW, type:WidthType.DXA},
      columnWidths:[TW/2, TW/2],
      borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE},insideH:{style:BorderStyle.NONE},insideV:{style:BorderStyle.NONE}},
      rows:[new TableRow({children:[
        new TableCell({borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, children:[
          P([W('Nơi nhận:', {italics:true, bold:true})]),
          P([W('– Các khoa, phòng;')], {indent:true}),
          P([W('– Lưu: VT.')], {indent:true}),
        ]}),
        new TableCell({borders:{top:{style:BorderStyle.NONE},bottom:{style:BorderStyle.NONE},left:{style:BorderStyle.NONE},right:{style:BorderStyle.NONE}}, children:[
          P([W('GIÁM ĐỐC', {bold:true})], {align:AlignmentType.CENTER}),
          P([W('')], {before:800}),
          P([W('(Ký tên, đóng dấu)', {italics:true})], {align:AlignmentType.CENTER}),
        ]}),
      ]})]
    }));

    const doc = new Document({
      styles: {
        default: { document: { run: { font:'Times New Roman', size:28 } } },
        paragraphStyles:[
          {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',
           run:{size:32,bold:true,font:'Times New Roman',color:'000000'},
           paragraph:{spacing:{before:240,after:120},outlineLevel:0}},
          {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',
           run:{size:28,bold:true,italics:true,font:'Times New Roman',color:'000000'},
           paragraph:{spacing:{before:200,after:80},outlineLevel:1}},
        ]
      },
      sections:[{
        properties:{
          page:{
            size:{width:11906, height:16838},
            margin:{top:1134, right:850, bottom:1134, left:1701}
          }
        },
        children
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `BaoCao_HaiLong_${data.label.replace(/\s+/g,'_')}.docx`;
    a.click();
    toast('✅ Xuất file Word thành công!', 'success');
  } catch(e) {
    console.error(e);
    toast('❌ Lỗi tạo Word: '+e.message+'. Thử xuất HTML thay thế.', 'error');
  }
}

