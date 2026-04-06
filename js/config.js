// config.js – Cấu hình trung tâm + DB + SURVEYS definition
// KSHL v6.1 – Fixed & Complete
// ============================================================

// =========================================================
// SURVEYS DEFINITION – Toàn bộ 5 mẫu phiếu
// =========================================================
const SURVEYS = {
  m1: {
    label: 'Mẫu 1 – NB Nội trú',
    icon: '🏥',
    url: 'https://hailong.chatluongbenhvien.vn/nguoi-benh-noi-tru-v2',
    nodeId: 206847,
    action: '/nguoi-benh-noi-tru-v2',
    sections: [
      { key: 'a', label: 'A. Tiếp cận & Khả năng đến BV', questions: ['a1','a2','a3','a4','a5'] },
      { key: 'b', label: 'B. Thủ tục hành chính & Thông tin', questions: ['b1','b2','b3','b4','b5','b6','b7'] },
      { key: 'c', label: 'C. Cơ sở vật chất & Điều kiện phục vụ', questions: ['c1','c2','c3','c4','c5','c6','c7','c8','c9','c10','c11'] },
      { key: 'd', label: 'D. Thái độ & Ứng xử NVYT', questions: ['d1','d2','d3','d4','d5','d6','d7'] },
      { key: 'e', label: 'E. Năng lực chuyên môn & Kết quả', questions: ['e1','e2','e3','e4','e5','e6'] },
    ],
    questions: {
      a1:'A1. Sơ đồ, biển báo chỉ dẫn đường đến khoa phòng, thông báo giờ khám rõ ràng, dễ hiểu',
      a2:'A2. Tòa nhà, cầu thang, thang máy, buồng bệnh được đánh số và hướng dẫn rõ ràng, dễ tìm',
      a3:'A3. Lối đi, hành lang bằng phẳng, an toàn, dễ đi',
      a4:'A4. Thời gian chờ đợi thang máy, làm thủ tục và chờ trong quá trình khám chấp nhận được',
      a5:'A5. Người bệnh hỏi và gọi được NVYT khi cần',
      b1:'B1. Quy trình thủ tục hành chính (nhập/xuất viện, chuyển viện) rõ ràng, công khai, thuận tiện',
      b2:'B2. Giá dịch vụ niêm yết công khai, được tư vấn chi phí cao',
      b3:'B3. Thủ tục thanh toán viện phí rõ ràng, thuận tiện',
      b4:'B4. Được phổ biến nội quy và thông tin cần thiết khi nằm viện',
      b5:'B5. Được giải thích tình trạng bệnh, phương pháp và thời gian điều trị',
      b6:'B6. Được giải thích trước khi làm xét nghiệm, thăm dò, kỹ thuật cao',
      b7:'B7. Được công khai và cập nhật thông tin dùng thuốc, chi phí điều trị',
      c1:'C1. Buồng bệnh khang trang, sạch sẽ, có thiết bị điều chỉnh nhiệt độ',
      c2:'C2. Buồng bệnh yên tĩnh, bảo đảm an toàn, an ninh',
      c3:'C3. Giường bệnh, ga, gối đầy đủ, chắc chắn, sử dụng tốt',
      c4:'C4. Được cung cấp quần áo đầy đủ, sạch sẽ',
      c5:'C5. Nhà vệ sinh, nhà tắm thuận tiện, sạch sẽ',
      c6:'C6. Được cung cấp đủ nước uống nóng, lạnh tại khoa',
      c7:'C7. Có thể truy cập wifi tại buồng bệnh',
      c8:'C8. Được bảo đảm sự riêng tư khi thay đồ, khám bệnh, đi vệ sinh',
      c9:'C9. Căng-tin phục vụ ăn uống đầy đủ, chất lượng',
      c10:'C10. Môi trường khuôn viên bệnh viện xanh, sạch, đẹp',
      c11:'C11. Được cung cấp phương tiện vận chuyển nội viện kịp thời',
      d1:'D1. Bác sỹ, điều dưỡng có lời nói, thái độ, giao tiếp đúng mực',
      d2:'D2. Nhân viên phục vụ có lời nói, thái độ đúng mực',
      d3:'D3. Được NVYT tôn trọng, đối xử công bằng, quan tâm',
      d4:'D4. Bác sỹ, điều dưỡng hợp tác tốt và xử lý công việc thành thạo, kịp thời',
      d5:'D5. Được bác sỹ thăm khám, động viên tại phòng điều trị',
      d6:'D6. Được tư vấn chế độ ăn, vận động, phòng ngừa biến chứng',
      d7:'D7. Không bị NVYT gợi ý bồi dưỡng',
      e1:'E1. Thời gian chờ đợi khi khám, chữa bệnh tại bệnh viện',
      e2:'E2. Được cấp phát thuốc đúng giờ, hướng dẫn đầy đủ',
      e3:'E3. Được nhắc lịch tái khám và hướng dẫn chăm sóc tại nhà',
      e4:'E4. Trang thiết bị, vật tư y tế đầy đủ, hiện đại',
      e5:'E5. Kết quả điều trị đáp ứng nguyện vọng',
      e6:'E6. Mức độ tin tưởng về chất lượng dịch vụ y tế',
    }
  },

  m2: {
    label: 'Mẫu 2 – NB Ngoại trú',
    icon: '🏃',
    url: 'https://hailong.chatluongbenhvien.vn/nguoi-benh-ngoai-tru-v2',
    nodeId: 206848,
    action: '/nguoi-benh-ngoai-tru-v2',
    sections: [
      { key: 'a', label: 'A. Tiếp cận & Khả năng đến BV', questions: ['a1','a2','a3','a4','a5'] },
      { key: 'b', label: 'B. Thủ tục hành chính & Thời gian chờ', questions: ['b1','b2','b3','b4','b5','b6','b7','b8','b9','b10'] },
      { key: 'c', label: 'C. Cơ sở vật chất', questions: ['c1','c2','c3','c4','c5','c6','c7','c8'] },
      { key: 'd', label: 'D. Thái độ & Ứng xử NVYT', questions: ['d1','d2','d3','d4'] },
      { key: 'e', label: 'E. Kết quả khám bệnh', questions: ['e1','e2','e3','e4'] },
    ],
    questions: {
      a1:'A1. Biển báo, chỉ dẫn đường đến bệnh viện rõ ràng, dễ tìm',
      a2:'A2. Sơ đồ, biển báo chỉ dẫn đến khoa phòng rõ ràng, dễ hiểu',
      a3:'A3. Khối nhà, cầu thang được đánh số rõ ràng, dễ tìm',
      a4:'A4. Lối đi, hành lang bằng phẳng, dễ đi',
      a5:'A5. Có thể đăng ký khám qua điện thoại, website thuận tiện',
      b1:'B1. Quy trình khám bệnh được niêm yết rõ ràng, dễ hiểu',
      b2:'B2. Thủ tục khám bệnh được cải cách đơn giản, thuận tiện',
      b3:'B3. Giá dịch vụ niêm yết rõ ràng, công khai',
      b4:'B4. NVYT tiếp đón, hướng dẫn người bệnh niềm nở, tận tình',
      b5:'B5. Được xếp hàng theo thứ tự khi làm thủ tục',
      b6:'B6. Thời gian chờ làm thủ tục đăng ký khám',
      b7:'B7. Thời gian chờ tới lượt bác sỹ khám',
      b8:'B8. Thời gian được bác sỹ khám và tư vấn',
      b9:'B9. Thời gian chờ làm xét nghiệm, chiếu chụp',
      b10:'B10. Thời gian chờ nhận kết quả xét nghiệm',
      c1:'C1. Phòng/sảnh chờ sạch sẽ, thoáng mát',
      c2:'C2. Phòng chờ đủ ghế ngồi, sử dụng tốt',
      c3:'C3. Phòng chờ có quạt/điều hòa đầy đủ',
      c4:'C4. Phòng chờ có phương tiện giúp người bệnh thoải mái (tivi, nước uống...)',
      c5:'C5. Được bảo đảm riêng tư khi khám, chiếu chụp',
      c6:'C6. Nhà vệ sinh thuận tiện, sạch sẽ',
      c7:'C7. Môi trường khuôn viên xanh, sạch, đẹp',
      c8:'C8. Khu khám bảo đảm an ninh, trật tự',
      d1:'D1. Bác sỹ, điều dưỡng có lời nói, thái độ đúng mực',
      d2:'D2. Nhân viên phục vụ có lời nói, thái độ đúng mực',
      d3:'D3. Được NVYT tôn trọng, đối xử công bằng',
      d4:'D4. Năng lực chuyên môn bác sỹ, điều dưỡng đáp ứng mong đợi',
      e1:'E1. Kết quả khám bệnh đáp ứng nguyện vọng',
      e2:'E2. Hóa đơn, đơn thuốc, kết quả khám cung cấp đầy đủ, minh bạch',
      e3:'E3. Mức độ tin tưởng về chất lượng dịch vụ y tế',
      e4:'E4. Mức độ hài lòng về giá cả dịch vụ y tế',
    }
  },

  m3: {
    label: 'Mẫu 3 – Nhân viên Y tế',
    icon: '👨‍⚕️',
    url: 'https://hailong.chatluongbenhvien.vn/content/3-khao-sat-y-kien-nhan-vien-y-te',
    nodeId: 1468,
    action: '/content/3-khao-sat-y-kien-nhan-vien-y-te',
    sections: [
      { key: 'a', label: 'A. Điều kiện làm việc', questions: ['a1','a2','a3','a4','a5','a6','a7','a8','a9'] },
      { key: 'b', label: 'B. Lãnh đạo & Đồng nghiệp', questions: ['b1','b2','b3','b4','b5','b6','b7','b8','b9'] },
      { key: 'c', label: 'C. Thu nhập & Phúc lợi', questions: ['c1','c2','c3','c4','c5','c6','c7','c8','c9','c10','c11','c12'] },
      { key: 'd', label: 'D. Công việc & Cơ hội phát triển', questions: ['d1','d2','d3','d4','d5','d6','d7'] },
      { key: 'e', label: 'E. Gắn kết & Hài lòng chung', questions: ['e1','e2','e3','e4','e5','e6','e7'] },
    ],
    questions: {
      a1:'A1. Phòng làm việc khang trang, sạch sẽ, thoáng mát',
      a2:'A2. Trang thiết bị văn phòng, bàn ghế làm việc đầy đủ',
      a3:'A3. Có bố trí phòng trực cho NVYT',
      a4:'A4. Phân chia thời gian trực và làm việc ngoài giờ hợp lý',
      a5:'A5. Trang bị bảo hộ (quần áo, khẩu trang, găng tay) đầy đủ',
      a6:'A6. Môi trường học tập, nâng cao kiến thức thuận tiện',
      a7:'A7. Môi trường làm việc bảo đảm an toàn cho NVYT',
      a8:'A8. Bệnh viện bảo đảm an ninh, trật tự cho NVYT',
      a9:'A9. Người bệnh và người nhà tôn trọng, hợp tác với NVYT',
      b1:'B1. Lãnh đạo có năng lực xử lý, điều hành',
      b2:'B2. Lãnh đạo phân công công việc phù hợp chuyên môn',
      b3:'B3. Lãnh đạo quan tâm, tôn trọng, đối xử bình đẳng',
      b4:'B4. Lãnh đạo lắng nghe và tiếp thu ý kiến NVYT',
      b5:'B5. Lãnh đạo động viên, khích lệ khi hoàn thành tốt nhiệm vụ',
      b6:'B6. Đồng nghiệp có ý thức hợp tác hoàn thành nhiệm vụ chung',
      b7:'B7. Môi trường làm việc thân thiện, đoàn kết',
      b8:'B8. Đồng nghiệp chia sẻ kinh nghiệm, giúp đỡ nhau trong công việc',
      b9:'B9. Đồng nghiệp quan tâm, giúp đỡ nhau trong cuộc sống',
      c1:'C1. Quy định, quy chế làm việc nội bộ rõ ràng, thực tế, công khai',
      c2:'C2. Môi trường làm việc dân chủ',
      c3:'C3. Quy chế chi tiêu nội bộ công bằng, hợp lý, công khai',
      c4:'C4. Phân phối quỹ phúc lợi công bằng, công khai',
      c5:'C5. Mức lương tương xứng năng lực và cống hiến',
      c6:'C6. Chế độ phụ cấp nghề và độc hại xứng đáng',
      c7:'C7. Thưởng và thu nhập tăng thêm ABC xứng đáng',
      c8:'C8. Cách phân chia thu nhập tăng thêm công bằng, khuyến khích làm việc',
      c9:'C9. Bảo đảm đóng BHXH, BHYT, khám sức khỏe định kỳ đầy đủ',
      c10:'C10. Tổ chức tham quan, nghỉ dưỡng đầy đủ',
      c11:'C11. Có phong trào thể thao, văn nghệ tích cực',
      c12:'C12. Công đoàn bệnh viện hoạt động tích cực',
      d1:'D1. Khối lượng công việc được giao phù hợp',
      d2:'D2. Công việc chuyên môn đáp ứng nguyện vọng bản thân',
      d3:'D3. Bệnh viện tạo điều kiện nâng cao trình độ chuyên môn',
      d4:'D4. Bệnh viện tạo điều kiện học tiếp các bậc cao hơn',
      d5:'D5. Công khai tiêu chuẩn cho các chức danh lãnh đạo',
      d6:'D6. Bổ nhiệm chức danh lãnh đạo dân chủ, công bằng',
      d7:'D7. Có cơ hội thăng tiến khi nỗ lực làm việc',
      e1:'E1. Cảm thấy tự hào khi được làm việc tại bệnh viện',
      e2:'E2. Đạt được thành công cá nhân khi làm việc tại bệnh viện',
      e3:'E3. Tin tưởng vào sự phát triển của bệnh viện',
      e4:'E4. Sẽ gắn bó làm việc tại khoa/phòng hiện tại lâu dài',
      e5:'E5. Sẽ gắn bó làm việc tại bệnh viện lâu dài',
      e6:'E6. Mức độ hài lòng nói chung về lãnh đạo bệnh viện',
      e7:'E7. Tự đánh giá mức độ hoàn thành công việc',
    }
  },

  m4: {
    label: 'Mẫu 4 – Người mẹ sinh con',
    icon: '👶',
    url: 'https://hailong.chatluongbenhvien.vn/content/4-phieu-khao-sat-y-kien-nguoi-me-sinh-con-tai-benh-vien',
    nodeId: 22799,
    action: '/content/4-phieu-khao-sat-y-kien-nguoi-me-sinh-con-tai-benh-vien',
    sections: [
      { key: 'a', label: 'A. Tiếp cận', questions: ['a1','a2'] },
      { key: 'b', label: 'B. Thủ tục hành chính', questions: ['b1','b2'] },
      { key: 'c', label: 'C. Thông tin & Tư vấn', questions: ['c1','c2','c3'] },
      { key: 'd', label: 'D. Cơ sở vật chất', questions: ['d1','d2','d3','d4','d5','d6'] },
      { key: 'e', label: 'E. Thái độ NVYT', questions: ['e1','e2','e3','e4'] },
      { key: 'g', label: 'G. Năng lực chuyên môn', questions: ['g1','g2','g3'] },
      { key: 'h', label: 'H. Kết quả', questions: ['h1','h2','h3'] },
    ],
    questions: {
      a1:'A1. Được chỉ dẫn đến khoa phòng rõ ràng, dễ hiểu',
      a2:'A2. Có thể gọi và hỏi được NVYT khi cần (kể cả ngoài giờ hành chính)',
      b1:'B1. Quy trình, thủ tục nhập viện rõ ràng, công khai, thuận tiện',
      b2:'B2. Thời gian chờ đợi làm thủ tục, dịch vụ chấp nhận được',
      c1:'C1. Được cung cấp thông tin xét nghiệm, siêu âm trước sinh',
      c2:'C2. Được thông tin, tư vấn về quá trình sinh con và nguy cơ',
      c3:'C3. Được truyền thông, tư vấn chăm sóc và nuôi con bằng sữa mẹ',
      d1:'D1. Giường đệm cho mẹ và con an toàn, không nằm ghép',
      d2:'D2. Được cung cấp chăn, ga, gối, tã đầy đủ, sạch sẽ',
      d3:'D3. Nhà vệ sinh, nhà tắm sạch sẽ, đủ giấy, xà phòng, nước',
      d4:'D4. Buồng bệnh thông thoáng, sạch sẽ, có quạt/điều hòa',
      d5:'D5. Được bảo đảm riêng tư khi thay đồ, thăm khám, vệ sinh',
      d6:'D6. Có dịch vụ tiện ích khác cho bà mẹ, em bé chất lượng tốt',
      e1:'E1. Bác sỹ có lời nói, thái độ, giao tiếp đúng mực',
      e2:'E2. Điều dưỡng, hộ sinh có lời nói, thái độ đúng mực',
      e3:'E3. Nhân viên phục vụ có lời nói, thái độ đúng mực',
      e4:'E4. NVYT không gợi ý bồi dưỡng (1=có gợi ý, 5=không gợi ý)',
      g1:'G1. Bác sỹ có trình độ chuyên môn, kỹ năng thăm khám tốt',
      g2:'G2. Điều dưỡng, hộ sinh có trình độ tốt, chăm sóc chu đáo',
      g3:'G3. Bác sỹ, điều dưỡng phối hợp tốt, xử lý thành thạo, kịp thời',
      h1:'H1. Sinh đẻ an toàn, điều trị và chăm sóc tốt',
      h2:'H2. Cấp phát thuốc và hướng dẫn sử dụng đầy đủ',
      h3:'H3. Giá cả dịch vụ phù hợp, tương xứng với số tiền bỏ ra',
    }
  },

  m5: {
    label: 'Mẫu 5 – Nuôi con bằng sữa mẹ',
    icon: '🍼',
    url: 'https://hailong.chatluongbenhvien.vn/content/5-phieu-khao-sat-thuc-hien-nuoi-con-bang-sua-me-tai-benh-vien-va-sau-ra-vien',
    nodeId: 22800,
    action: '/content/5-phieu-khao-sat-thuc-hien-nuoi-con-bang-sua-me-tai-benh-vien-va-sau-ra-vien',
    sections: [
      { key: 'b', label: 'B. Nuôi con bằng sữa mẹ', questions: ['b1','b2','b3','b5','b7','b8','b12','b13','b15'] },
    ],
    questions: {
      b1: 'B1. Có nhìn thấy "Quy định thực hiện nuôi con bằng sữa mẹ" tại bệnh viện?',
      b2: 'B2. Có nhìn thấy tranh ảnh, tờ rơi tuyên truyền về nuôi con bằng sữa mẹ?',
      b3: 'B3. Có được bệnh viện tư vấn nuôi con bằng sữa mẹ?',
      b5: 'B5. Mức độ hiểu nội dung tư vấn về nuôi con bằng sữa mẹ',
      b7: 'B7. Sau sinh, mẹ và con có được thực hiện "da kề da"?',
      b8: 'B8. Con được bú mẹ sau bao nhiêu phút kể từ khi sinh',
      b12:'B12. NVYT có gợi ý mua sữa bột cho con?',
      b13:'B13. Lợi ích của việc nuôi con bằng sữa mẹ',
      b15:'B15. Kiến nghị với bệnh viện về nuôi con bằng sữa mẹ',
    }
  }
};

// =========================================================
// DB – Local Database (localStorage)
// =========================================================
let DB = {
  surveys: [],
  version: 1
};

function loadDB() {
  try {
    const raw = localStorage.getItem('kshl_db');
    if (raw) {
      const parsed = JSON.parse(raw);
      DB.surveys = Array.isArray(parsed.surveys) ? parsed.surveys : [];
    }
  } catch(e) {
    console.warn('loadDB error:', e);
    DB.surveys = [];
  }
}

function saveDB() {
  try {
    localStorage.setItem('kshl_db', JSON.stringify({ surveys: DB.surveys, version: DB.version, savedAt: new Date().toISOString() }));
  } catch(e) {
    console.warn('saveDB error:', e);
  }
}

// =========================================================
// CFG – Configuration (loaded from Sheets CONFIG tab)
// =========================================================
let CFG = {
  // Google Sheets
  sheetId: '',
  saEmail: '',
  saKey: '',
  sheetName: 'SURVEYS',

  // Hospital info
  hvname: '',
  province: '',
  hang: '',
  mabv: '',           // Mã BV trên BYT (VD: "62310") – QUAN TRỌNG

  // BYT credentials
  bytuser: '',
  bytpass: '',
  autoUploadBYT: false,

  // BYT survey defaults
  kieuKhaoSat: '1',   // 1 = BV tự đánh giá hàng tháng/quý
  nguoipv: '1',       // 1 = Người bệnh tự điền
};

function loadCFG() {
  try {
    const raw = localStorage.getItem('kshl_cfg');
    if (raw) {
      const saved = JSON.parse(raw);
      CFG = Object.assign({}, CFG, saved);
    }
  } catch(e) {
    console.warn('loadCFG error:', e);
  }
}

function saveCFG() {
  try {
    localStorage.setItem('kshl_cfg', JSON.stringify(CFG));
  } catch(e) {
    console.warn('saveCFG error:', e);
  }
}

// =========================================================
// USERS – Auth
// =========================================================
let CURRENT_USER = null;

function getCurrentUser() { return CURRENT_USER; }
function setCurrentUser(u) { CURRENT_USER = u; }
function isAdmin() { return CURRENT_USER?.role === 'admin'; }
function isStaff() { return CURRENT_USER && (CURRENT_USER.role === 'admin' || CURRENT_USER.role === 'user'); }

// =========================================================
// UTILITIES
// =========================================================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('vi-VN');
  } catch(e) { return s; }
}

function fmtDateTime(s) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString('vi-VN');
  } catch(e) { return s; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Hash đơn giản cho mật khẩu (trong môi trường production cần dùng bcrypt phía server)
async function hashPw(pw) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw + 'kshl_salt_2024'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// =========================================================
// INIT
// =========================================================
loadCFG();
loadDB();
