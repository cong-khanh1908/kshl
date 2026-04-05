// surveys.js – Định nghĩa phiếu khảo sát, build forms, quick select, lưu phiếu
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// ============================================================

// =========================================================
// SURVEY DEFINITIONS
// =========================================================
const SURVEYS = {
  m1:{label:'Mẫu 1 – NB Nội trú',qd:'QĐ 56/2024',url:'https://hailong.chatluongbenhvien.vn/nguoi-benh-noi-tru-v2',sections:[
    {id:'A',title:'A. Khả năng tiếp cận',questions:['Các sơ đồ, biển báo chỉ dẫn đường đến các khoa, phòng và thông báo giờ khám, chữa bệnh, giờ vào thăm rõ ràng, dễ hiểu.','Các tòa nhà, cầu thang bộ, thang máy, buồng bệnh được đánh số và hướng dẫn rõ ràng, dễ tìm.','Các lối đi trong bệnh viện, hành lang bằng phẳng, an toàn, dễ đi.','Thời gian chờ đợi thang máy, làm thủ tục và chờ đợi trong quá trình khám, chữa bệnh chấp nhận được.','Người bệnh hỏi và gọi được nhân viên y tế khi cần thiết.']},
    {id:'B',title:'B. Sự minh bạch thông tin và thủ tục',questions:['Quy trình, thủ tục hành chính (nhập, xuất viện, chuyển viện, chuyển khoa...) rõ ràng, công khai, thuận tiện.','Giá dịch vụ y tế được niêm yết, thông báo công khai ở vị trí dễ quan sát, dễ đọc, dễ hiểu và được tư vấn, giải thích các chi phí cao nếu có.','Quy trình, thời gian làm thủ tục thanh toán viện phí khi ra viện rõ ràng, công khai, thuận tiện.','Được phổ biến về nội quy và những thông tin cần thiết khi nằm viện rõ ràng, đầy đủ.','Được giải thích về tình trạng bệnh, phương pháp và thời gian dự kiến điều trị rõ ràng, đầy đủ.','Được giải thích, tư vấn trước khi yêu cầu làm các xét nghiệm, thăm dò, kỹ thuật cao rõ ràng, đầy đủ.','Được công khai và cập nhật thông tin về dùng thuốc và chi phí điều trị.']},
    {id:'C',title:'C. Cơ sở vật chất và phương tiện phục vụ',questions:['Buồng bệnh khang trang, sạch sẽ, có đầy đủ các thiết bị điều chỉnh nhiệt độ phù hợp như quạt, máy sưởi, hoặc điều hòa.','Buồng bệnh yên tĩnh, bảo đảm an toàn, an ninh, trật tự, phòng ngừa trộm cắp, yên tâm khi nằm viện.','Giường bệnh, ga, gối đầy đủ cho mỗi người một giường, chắc chắn, sử dụng tốt.','Được cung cấp quần áo đầy đủ, sạch sẽ.','Nhà vệ sinh, nhà tắm thuận tiện, sạch sẽ, sử dụng tốt.','Được cung cấp đầy đủ nước uống nóng, lạnh ngay tại khoa điều trị.','Người bệnh và người nhà người bệnh truy cập được mạng internet không dây (wifi) ngay tại buồng bệnh.','Được bảo đảm sự riêng tư khi nằm viện như thay quần áo, khám bệnh; có rèm che, vách ngăn hoặc nằm riêng.','Căng-tin bệnh viện phục vụ ăn uống và nhu cầu sinh hoạt thiết yếu đầy đủ và chất lượng.','Môi trường trong khuôn viên bệnh viện xanh, sạch, đẹp.','Được cung cấp phương tiện vận chuyển nội viện (xe lăn, cáng, xe điện) đầy đủ, kịp thời khi có nhu cầu.']},
    {id:'D',title:'D. Thái độ ứng xử, năng lực chuyên môn NVYT',questions:['Bác sỹ, điều dưỡng có lời nói, thái độ, giao tiếp đúng mực.','Nhân viên phục vụ (hộ lý, bảo vệ, kế toán...) có lời nói, thái độ, giao tiếp đúng mực.','Được nhân viên y tế tôn trọng, đối xử công bằng, quan tâm, giúp đỡ.','Bác sỹ, điều dưỡng hợp tác tốt và xử lý công việc thành thạo, kịp thời.','Được bác sỹ thăm khám, động viên tại phòng điều trị.','Được tư vấn chế độ ăn, vận động, theo dõi và phòng ngừa biến chứng.','Không bị nhân viên y tế gợi ý bồi dưỡng.']},
    {id:'E',title:'E. Kết quả cung cấp dịch vụ',questions:['Thời gian chờ đợi khi khám, chữa bệnh tại bệnh viện.','Được cấp phát và dùng thuốc đúng giờ, hướng dẫn sử dụng thuốc đầy đủ và các tác dụng phụ nếu có.','Được nhắc lịch tái khám và hướng dẫn thực hành ăn uống, luyện tập, chăm sóc tại nhà trước khi ra viện.','Trang thiết bị, vật tư y tế đầy đủ, hiện đại, đáp ứng nhu cầu khám chữa bệnh.','Kết quả điều trị đáp ứng được nguyện vọng.','Đánh giá mức độ tin tưởng về chất lượng dịch vụ y tế.']},
  ]},
  m2:{label:'Mẫu 2 – NB Ngoại trú',qd:'QĐ 56/2024',url:'https://hailong.chatluongbenhvien.vn/nguoi-benh-ngoai-tru-v2',sections:[
    {id:'A',title:'A. Khả năng tiếp cận',questions:['Các biển báo, chỉ dẫn đường đến bệnh viện rõ ràng, dễ nhìn, dễ tìm.','Các sơ đồ, biển báo chỉ dẫn đường đến các khoa, phòng trong bệnh viện rõ ràng, dễ hiểu, dễ tìm.','Các khối nhà, cầu thang được đánh số rõ ràng, dễ tìm.','Các lối đi trong bệnh viện, hành lang bằng phẳng, dễ đi.','Có thể tìm hiểu các thông tin và đăng ký khám qua điện thoại, trang tin điện tử của bệnh viện thuận tiện.']},
    {id:'B',title:'B. Sự minh bạch thông tin và thủ tục',questions:['Quy trình khám bệnh được niêm yết rõ ràng, công khai, dễ hiểu.','Các quy trình, thủ tục khám bệnh đơn giản, thuận tiện.','Giá dịch vụ y tế niêm yết rõ ràng, công khai.','Nhân viên y tế tiếp đón, hướng dẫn người bệnh làm các thủ tục niềm nở, tận tình.','Được xếp hàng theo thứ tự trước sau khi làm các thủ tục đăng ký, nộp tiền, khám bệnh, xét nghiệm, chiếu chụp.','Đánh giá thời gian chờ đợi làm thủ tục đăng ký khám.','Đánh giá thời gian chờ tới lượt bác sỹ khám.','Đánh giá thời gian được bác sỹ khám và tư vấn.','Đánh giá thời gian chờ làm xét nghiệm, chiếu chụp.','Đánh giá thời gian chờ nhận kết quả xét nghiệm, chiếu chụp.']},
    {id:'C',title:'C. Cơ sở vật chất và phương tiện phục vụ',questions:['Có phòng/sảnh chờ khám sạch sẽ, thoáng mát vào mùa hè; kín gió và ấm áp vào mùa đông.','Phòng chờ có đủ ghế ngồi cho người bệnh và sử dụng tốt.','Phòng chờ có quạt (điều hòa) đầy đủ, hoạt động thường xuyên.','Phòng chờ có các phương tiện giúp người bệnh có tâm lý thoải mái như ti-vi, tranh ảnh, tờ rơi, nước uống...','Được bảo đảm sự riêng tư khi khám bệnh, chiếu chụp, làm thủ thuật.','Nhà vệ sinh thuận tiện, sử dụng tốt, sạch sẽ.','Môi trường trong khuôn viên bệnh viện xanh, sạch, đẹp.','Khu khám bệnh bảo đảm an ninh, trật tự, phòng ngừa trộm cắp cho người dân.']},
    {id:'D',title:'D. Thái độ ứng xử, năng lực chuyên môn NVYT',questions:['Nhân viên y tế (bác sỹ, điều dưỡng) có lời nói, thái độ, giao tiếp đúng mực.','Nhân viên phục vụ (hộ lý, bảo vệ, kế toán...) có lời nói, thái độ, giao tiếp đúng mực.','Được nhân viên y tế tôn trọng, đối xử công bằng, quan tâm, giúp đỡ.','Năng lực chuyên môn của bác sỹ, điều dưỡng đáp ứng mong đợi.']},
    {id:'E',title:'E. Kết quả cung cấp dịch vụ',questions:['Kết quả khám bệnh đã đáp ứng được nguyện vọng của Ông/Bà.','Các hóa đơn, phiếu thu, đơn thuốc và kết quả khám bệnh được cung cấp đầy đủ, rõ ràng, minh bạch và được giải thích nếu có thắc mắc.','Đánh giá mức độ tin tưởng về chất lượng dịch vụ y tế.','Đánh giá mức độ hài lòng về giá cả dịch vụ y tế.']},
  ]},
  m3:{label:'Mẫu 3 – Nhân viên YT',qd:'QĐ 3869/2019',url:'https://hailong.chatluongbenhvien.vn/content/3-khao-sat-y-kien-nhan-vien-y-te',staffOnly:true,sections:[
    {id:'A',title:'A. Điều kiện làm việc và phúc lợi',questions:['Hài lòng với điều kiện làm việc hiện tại (trang thiết bị, dụng cụ đầy đủ, an toàn).','Hài lòng về thu nhập, phụ cấp hiện tại.','Hài lòng về chính sách khen thưởng, phúc lợi của đơn vị.','Được tạo điều kiện học tập, nâng cao trình độ chuyên môn.','Được tham gia các khóa đào tạo, tập huấn đầy đủ theo nhu cầu.','Công việc được đánh giá công bằng, khách quan.']},
    {id:'B',title:'B. Tổ chức và quản lý',questions:['Phân công công việc rõ ràng, hợp lý và phù hợp với năng lực chuyên môn.','Lãnh đạo đơn vị lắng nghe, tiếp thu ý kiến của nhân viên.','Quan hệ đồng nghiệp trong đơn vị tốt, hỗ trợ nhau trong công việc.','Quy trình, quy định chuyên môn rõ ràng, được triển khai và giám sát tốt.','Công tác họp giao ban, hội ý được tổ chức có hiệu quả.','Hài lòng với cơ chế giải quyết khiếu nại, vướng mắc trong công việc.','Lãnh đạo đơn vị thực hành dân chủ, minh bạch trong quản lý.']},
    {id:'C',title:'C. Môi trường làm việc & An toàn',questions:['Môi trường làm việc an toàn, không có nguy cơ tai nạn nghề nghiệp cao.','Đơn vị triển khai tốt các biện pháp bảo hộ lao động, phòng chống dịch.','Được cung cấp đủ phương tiện phòng hộ cá nhân khi cần.','Đơn vị có giải pháp hữu hiệu phòng chống bạo hành nhân viên y tế.','Văn hóa an toàn người bệnh được thực hành tốt trong đơn vị.']},
    {id:'D',title:'D. Hài lòng và gắn bó',questions:['Hài lòng với công việc hiện tại.','Tự hào khi làm việc tại đơn vị này.','Sẽ giới thiệu đơn vị là nơi làm việc tốt cho bạn bè, người thân.','Nếu được lựa chọn lại, vẫn muốn làm việc tại đây.','Có kế hoạch gắn bó lâu dài với đơn vị.']},
  ]},
  m4:{label:'Mẫu 4 – Người mẹ sinh con',qd:'QĐ 3869/2019',url:'https://hailong.chatluongbenhvien.vn/content/4-phieu-khao-sat-y-kien-nguoi-me-sinh-con-tai-benh-vien',sections:[
    {id:'A',title:'A. Tiếp đón và thủ tục nhập viện',questions:['Thủ tục nhập viện/vào phòng sinh đơn giản, thuận tiện.','Được nhân viên y tế tiếp đón niềm nở, hướng dẫn chu đáo.','Thời gian chờ đợi khi nhập viện/vào phòng sinh chấp nhận được.','Được phổ biến về nội quy và những điều cần biết khi nhập viện rõ ràng, đầy đủ.']},
    {id:'B',title:'B. Chăm sóc trong quá trình chuyển dạ và sinh',questions:['Nhân viên y tế theo dõi, chăm sóc liên tục, kịp thời trong quá trình chuyển dạ và sinh.','Được giải thích rõ ràng về tình trạng sức khỏe và các bước chuyển dạ, sinh nở.','Được tôn trọng và đối xử nhân ái trong suốt quá trình sinh.','Được hỗ trợ và tư vấn về các biện pháp giảm đau trong khi sinh.','Nhân viên y tế có lời nói, thái độ ân cần, lịch sự trong quá trình chăm sóc.','Được nhân viên y tế hỏi thăm và động viên trong quá trình chuyển dạ.','Không bị nhân viên y tế gợi ý bồi dưỡng.']},
    {id:'C',title:'C. Chăm sóc sau sinh',questions:['Được nhân viên y tế chăm sóc, theo dõi đầy đủ sau sinh.','Con được tiếp xúc da kề da và bú mẹ sớm ngay sau sinh (trong vòng 1 giờ).','Được hỗ trợ và hướng dẫn kỹ thuật cho con bú đúng cách.','Được tư vấn đầy đủ về chăm sóc trẻ sơ sinh.','Được hướng dẫn đầy đủ về dinh dưỡng và chăm sóc sức khỏe sau sinh.','Được nhắc lịch tiêm chủng và tái khám cho mẹ và bé trước khi ra viện.']},
    {id:'D',title:'D. Cơ sở vật chất phòng sinh và hậu sản',questions:['Phòng sinh/phòng hậu sản sạch sẽ, thoáng mát, đủ tiện nghi.','Giường bệnh đủ cho mỗi người một giường, chắc chắn, sạch sẽ.','Nhà vệ sinh, nhà tắm thuận tiện, sạch sẽ.','Trang thiết bị y tế phục vụ sinh sản đầy đủ, hiện đại.','Môi trường trong khuôn viên bệnh viện xanh, sạch, đẹp, yên tĩnh.']},
    {id:'E',title:'E. Kết quả và hài lòng chung',questions:['Kết quả sinh nở đáp ứng được mong đợi.','Đánh giá mức độ an toàn trong quá trình sinh và sau sinh.','Hài lòng chung về chất lượng dịch vụ sinh sản tại bệnh viện.','Sẽ giới thiệu người thân/bạn bè đến sinh tại bệnh viện này.']},
  ]},
  m5:{label:'Mẫu 5 – Nuôi con sữa mẹ',qd:'QĐ 3869/2019',url:'https://hailong.chatluongbenhvien.vn/content/5-phieu-khao-sat-thuc-hien-nuoi-con-bang-sua-me-tai-benh-vien-va-sau-ra-vien',sections:[
    {id:'A',title:'A. Tư vấn, giáo dục sức khỏe',questions:['Được tư vấn về lợi ích của nuôi con bằng sữa mẹ trong thời gian nằm viện.','Được hướng dẫn kỹ thuật cho con bú đúng tư thế và cách ngậm bắt vú đúng.','Được tư vấn về cách duy trì và tăng nguồn sữa mẹ.','Được cung cấp tài liệu/tờ rơi hướng dẫn về nuôi con bằng sữa mẹ rõ ràng, dễ hiểu.','Nhân viên y tế giải đáp đầy đủ các thắc mắc về nuôi con bằng sữa mẹ.','Được tư vấn về chế độ dinh dưỡng cho bà mẹ nuôi con bằng sữa mẹ.']},
    {id:'B',title:'B. Hỗ trợ thực hành tại bệnh viện',questions:['Con được bú mẹ sớm trong vòng 1 giờ sau sinh (da kề da).','Nhân viên y tế hỗ trợ thực hành cho con bú đúng cách khi gặp khó khăn.','Bệnh viện thực hiện tốt nguyên tắc không cho trẻ bú bình, núm vú giả khi không cần thiết.','Được ở cùng phòng với bé (rooming-in) suốt 24/24 giờ.','Được hỗ trợ vắt sữa tay/bảo quản sữa khi cần thiết.','Được hướng dẫn cách xử lý các vấn đề thường gặp (đau rát núm vú, căng sữa, tắc tia sữa...).']},
    {id:'C',title:'C. Thực hành sau ra viện',questions:['Hiện đang cho con bú hoàn toàn bằng sữa mẹ (không cho ăn/uống thêm gì khác).','Tự tin trong việc nuôi con hoàn toàn bằng sữa mẹ sau khi ra viện.','Có thể tự xử lý các vấn đề thường gặp khi nuôi con bằng sữa mẹ.','Đã được cung cấp số điện thoại đường dây hỗ trợ nuôi con bằng sữa mẹ (nếu có).','Hài lòng với sự hỗ trợ của bệnh viện về nuôi con bằng sữa mẹ.']},
  ]},
};

const LIKERT_OPTS=[{v:1,e:'😞'},{v:2,e:'😕'},{v:3,e:'😐'},{v:4,e:'😊'},{v:5,e:'😄'}];

// =========================================================
// BUILD SURVEY FORMS DYNAMICALLY
// =========================================================
function buildAllForms() {
  Object.keys(SURVEYS).forEach(k => buildForm(k));
}

function buildForm(type) {
  const def = SURVEYS[type];
  const container = document.getElementById(`page-${type}`);
  if (!container) return;
  const role = currentUser?.role||'guest';
  const isStaffOnly = def.staffOnly;
  const canAccess = !isStaffOnly || role==='admin' || role==='user';

  if (!canAccess) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Phiếu này dành riêng cho Nhân viên Y tế</div><div class="empty-sub">Vui lòng <a href="#" onclick="doLogout();return false">đăng nhập</a> bằng tài khoản NVYT</div></div>`;
    return;
  }

  const deptOpts = buildDeptOptions();
  const today = new Date().toISOString().split('T')[0];
  const hvname = CFG.hvname||'';
  const roleChip = def.staffOnly ? `<span class="chip chip-orange">${def.qd}</span><span class="chip chip-purple">Nội bộ</span>` : `<span class="chip chip-blue">${def.qd}</span>`;

  // Info fields by type
  const infoHtml = {
    m1: `<div class="form-grid-4">
      <div class="form-group"><label class="form-label">Ngày điền phiếu <span class="req">*</span></label><input type="date" class="form-input" id="${type}_ngay" value="${today}"/></div>
      <div class="form-group"><label class="form-label">Tên/Mã bệnh viện</label><input type="text" class="form-input" id="${type}_benhvien" value="${hvname}" placeholder="Tên BV..."/></div>
      <div class="form-group"><label class="form-label">Khoa nằm điều trị</label><select class="form-select" id="${type}_khoa">${deptOpts}</select></div>
      <div class="form-group"><label class="form-label">Người trả lời</label><select class="form-select" id="${type}_nguoitl"><option value="">--Chọn--</option><option>Người bệnh</option><option>Người nhà</option></select></div>
    </div>
    <div class="form-grid-4 mt-8">
      <div class="form-group"><label class="form-label">A1. Giới tính</label><select class="form-select" id="${type}_gt"><option value="">--</option><option>1. Nam</option><option>2. Nữ</option><option>3. Khác</option></select></div>
      <div class="form-group"><label class="form-label">A2. Tuổi / Năm sinh</label><input type="text" class="form-input" id="${type}_tuoi" placeholder="VD: 45 hoặc 1979"/></div>
      <div class="form-group"><label class="form-label">A4. Số ngày nằm viện</label><input type="number" class="form-input" id="${type}_songay" min="1" placeholder="VD: 5"/></div>
      <div class="form-group"><label class="form-label">A5. Sử dụng thẻ BHYT?</label><select class="form-select" id="${type}_bhyt"><option value="">--</option><option>1. Có</option><option>2. Không</option></select></div>
    </div>
    <div class="form-grid-4 mt-8">
      <div class="form-group"><label class="form-label">A6. Nơi sinh sống</label><select class="form-select" id="${type}_noiss"><option value="">--</option><option>1. Thành thị</option><option>2. Nông thôn</option><option>3. Vùng sâu, xa</option></select></div>
      <div class="form-group"><label class="form-label">A7. Mức sống gia đình</label><select class="form-select" id="${type}_mucsong"><option value="">--</option><option>1. Nghèo</option><option>2. Cận nghèo</option><option>3. Khác</option></select></div>
      <div class="form-group"><label class="form-label">A8. Lần điều trị thứ mấy?</label><input type="number" class="form-input" id="${type}_lanthu" min="1" placeholder="Lần thứ..."/></div>
      <div class="form-group"><label class="form-label">A3. SĐT liên hệ</label><input type="text" class="form-input" id="${type}_sdt" placeholder="Số điện thoại"/></div>
    </div>`,
    m2: `<div class="form-grid-4">
      <div class="form-group"><label class="form-label">Ngày điền phiếu <span class="req">*</span></label><input type="date" class="form-input" id="${type}_ngay" value="${today}"/></div>
      <div class="form-group"><label class="form-label">Tên/Mã bệnh viện</label><input type="text" class="form-input" id="${type}_benhvien" value="${hvname}"/></div>
      <div class="form-group"><label class="form-label">Người trả lời</label><select class="form-select" id="${type}_nguoitl"><option value="">--Chọn--</option><option>Người bệnh</option><option>Người nhà</option></select></div>
      <div class="form-group"><label class="form-label">A1. Giới tính</label><select class="form-select" id="${type}_gt"><option value="">--</option><option>1. Nam</option><option>2. Nữ</option><option>3. Khác</option></select></div>
    </div>
    <div class="form-grid-4 mt-8">
      <div class="form-group"><label class="form-label">A2. Tuổi / Năm sinh</label><input type="text" class="form-input" id="${type}_tuoi" placeholder="VD: 45"/></div>
      <div class="form-group"><label class="form-label">A4. Khoảng cách đến BV (km)</label><input type="number" class="form-input" id="${type}_kc" min="0" placeholder="VD: 5"/></div>
      <div class="form-group"><label class="form-label">A5. Sử dụng thẻ BHYT?</label><select class="form-select" id="${type}_bhyt"><option value="">--</option><option>1. Có</option><option>2. Không</option></select></div>
      <div class="form-group"><label class="form-label">A6. Nơi sinh sống</label><select class="form-select" id="${type}_noiss"><option value="">--</option><option>1. Thành thị</option><option>2. Nông thôn</option><option>3. Vùng sâu, xa</option></select></div>
    </div>`,
    m3: `<div class="form-grid-4">
      <div class="form-group"><label class="form-label">Ngày điền phiếu <span class="req">*</span></label><input type="date" class="form-input" id="${type}_ngay" value="${today}"/></div>
      <div class="form-group"><label class="form-label">Tên/Mã đơn vị</label><input type="text" class="form-input" id="${type}_donvi" value="${hvname}"/></div>
      <div class="form-group"><label class="form-label">Khoa/Phòng công tác</label><select class="form-select" id="${type}_khoa">${deptOpts}</select></div>
      <div class="form-group"><label class="form-label">A1. Giới tính</label><select class="form-select" id="${type}_gt"><option value="">--</option><option>1. Nam</option><option>2. Nữ</option></select></div>
    </div>
    <div class="form-grid-4 mt-8">
      <div class="form-group"><label class="form-label">A3. Chức danh</label><select class="form-select" id="${type}_chucdanh"><option value="">--</option><option>Bác sĩ</option><option>Điều dưỡng</option><option>Hộ sinh</option><option>Kỹ thuật viên</option><option>Dược sĩ</option><option>Hộ lý</option><option>Cán bộ hành chính</option><option>Khác</option></select></div>
      <div class="form-group"><label class="form-label">A4. Thâm niên</label><select class="form-select" id="${type}_thamnie"><option value="">--</option><option>Dưới 1 năm</option><option>1–5 năm</option><option>5–10 năm</option><option>10–20 năm</option><option>Trên 20 năm</option></select></div>
      <div class="form-group"><label class="form-label">A5. Trình độ chuyên môn</label><select class="form-select" id="${type}_trinhdo"><option value="">--</option><option>Trên đại học</option><option>Đại học</option><option>Cao đẳng</option><option>Trung cấp</option><option>Khác</option></select></div>
      <div class="form-group"><label class="form-label">A6. Loại hợp đồng</label><select class="form-select" id="${type}_hopdong"><option value="">--</option><option>Viên chức/Biên chế</option><option>HĐ dài hạn (>12 tháng)</option><option>HĐ ngắn hạn (≤12 tháng)</option></select></div>
    </div>`,
    m4: `<div class="form-grid-4">
      <div class="form-group"><label class="form-label">Ngày điền phiếu <span class="req">*</span></label><input type="date" class="form-input" id="${type}_ngay" value="${today}"/></div>
      <div class="form-group"><label class="form-label">Tên/Mã bệnh viện</label><input type="text" class="form-input" id="${type}_benhvien" value="${hvname}"/></div>
      <div class="form-group"><label class="form-label">Khoa Sản</label><select class="form-select" id="${type}_khoa">${deptOpts}</select></div>
      <div class="form-group"><label class="form-label">Người trả lời</label><select class="form-select" id="${type}_nguoitl"><option value="">--</option><option>Sản phụ tự điền</option><option>Người nhà đại diện</option></select></div>
    </div>
    <div class="form-grid-4 mt-8">
      <div class="form-group"><label class="form-label">A1. Tuổi sản phụ</label><input type="number" class="form-input" id="${type}_tuoi" min="13" max="60" placeholder="Tuổi..."/></div>
      <div class="form-group"><label class="form-label">A5. Lần sinh thứ mấy?</label><select class="form-select" id="${type}_lansinh"><option value="">--</option><option>Lần 1</option><option>Lần 2</option><option>Lần 3+</option></select></div>
      <div class="form-group"><label class="form-label">A6. Hình thức sinh</label><select class="form-select" id="${type}_hinhthuc"><option value="">--</option><option>Sinh thường</option><option>Sinh mổ</option></select></div>
      <div class="form-group"><label class="form-label">A7. Sử dụng BHYT?</label><select class="form-select" id="${type}_bhyt"><option value="">--</option><option>1. Có</option><option>2. Không</option></select></div>
    </div>`,
    m5: `<div class="form-grid-4">
      <div class="form-group"><label class="form-label">Ngày điền phiếu <span class="req">*</span></label><input type="date" class="form-input" id="${type}_ngay" value="${today}"/></div>
      <div class="form-group"><label class="form-label">Tên/Mã bệnh viện</label><input type="text" class="form-input" id="${type}_benhvien" value="${hvname}"/></div>
      <div class="form-group"><label class="form-label">Thời điểm khảo sát</label><select class="form-select" id="${type}_thoidiemks"><option value="">--</option><option>Tại bệnh viện (trước ra viện)</option><option>Sau khi ra viện</option></select></div>
      <div class="form-group"><label class="form-label">A4. Lần sinh thứ mấy?</label><select class="form-select" id="${type}_lansinh"><option value="">--</option><option>Lần 1</option><option>Lần 2</option><option>Lần 3+</option></select></div>
    </div>`,
  };

  // Extra notes fields
  const notesHtml = {
    m1:`<div class="form-grid mt-8">
      <div class="form-group"><label class="form-label">G1. BV đáp ứng bao nhiêu % so với mong đợi? (0–200%)</label><input type="number" class="form-input" id="${type}_g1" min="0" max="200" placeholder="VD: 85"/></div>
      <div class="form-group"><label class="form-label">G2. Ông/Bà có quay lại hoặc giới thiệu người khác?</label><select class="form-select" id="${type}_g2"><option value="">--Chọn--</option><option>1. Chắc chắn không bao giờ quay lại</option><option>2. Không muốn quay lại nhưng ít lựa chọn</option><option>3. Muốn chuyển sang bệnh viện khác</option><option>4. Có thể sẽ quay lại</option><option>5. Chắc chắn sẽ quay lại hoặc giới thiệu</option><option>6. Khác</option></select></div>
    </div>
    <div class="form-group mt-8"><label class="form-label">E7. Chi phí có tương xứng chất lượng?</label><select class="form-select" id="${type}_e7"><option value="">--Chọn--</option><option>1. Rất đắt so với CL</option><option>2. Đắt hơn so với CL</option><option>3. Tương xứng với CL</option><option>4. Rẻ hơn so với CL</option><option>5. Không tự chi trả (BHYT)</option><option>6. Ý kiến khác</option></select></div>
    <div class="form-group mt-8"><label class="form-label">G3. Lý do chưa hài lòng (nếu có)</label><textarea class="form-textarea" id="${type}_g3" placeholder="Ghi rõ lý do..."></textarea></div>
    <div class="form-group mt-8"><label class="form-label">G4. Ý kiến/Nhận xét khác</label><textarea class="form-textarea" id="${type}_g4" placeholder="Ý kiến bổ sung..."></textarea></div>`,
    m2:`<div class="form-grid mt-8">
      <div class="form-group"><label class="form-label">G1. BV đáp ứng bao nhiêu % so với mong đợi?</label><input type="number" class="form-input" id="${type}_g1" min="0" max="200" placeholder="VD: 85"/></div>
      <div class="form-group"><label class="form-label">G2. Ông/Bà có quay lại hoặc giới thiệu người khác?</label><select class="form-select" id="${type}_g2"><option value="">--Chọn--</option><option>1. Chắc chắn không bao giờ quay lại</option><option>2. Không muốn quay lại nhưng ít lựa chọn</option><option>3. Muốn chuyển sang bệnh viện khác</option><option>4. Có thể sẽ quay lại</option><option>5. Chắc chắn sẽ quay lại hoặc giới thiệu</option><option>6. Khác</option></select></div>
    </div>
    <div class="form-group mt-8"><label class="form-label">E5. Chi phí có tương xứng chất lượng?</label><select class="form-select" id="${type}_e5"><option value="">--Chọn--</option><option>1. Rất đắt so với CL</option><option>2. Đắt hơn so với CL</option><option>3. Tương xứng với CL</option><option>4. Rẻ hơn so với CL</option><option>5. Không tự chi trả (BHYT)</option><option>6. Ý kiến khác</option></select></div>
    <div class="form-group mt-8"><label class="form-label">G3. Lý do chưa hài lòng</label><textarea class="form-textarea" id="${type}_g3" placeholder="Ghi rõ..."></textarea></div>
    <div class="form-group mt-8"><label class="form-label">G4. Ý kiến khác</label><textarea class="form-textarea" id="${type}_g4" placeholder="Ý kiến bổ sung..."></textarea></div>`,
    m3:`<div class="form-group mt-8"><label class="form-label">Đề xuất, kiến nghị để nâng cao chất lượng và cải thiện môi trường làm việc</label><textarea class="form-textarea" id="${type}_kiennghi" placeholder="Nhập kiến nghị..." style="min-height:80px;"></textarea></div>`,
    m4:`<div class="form-group mt-8"><label class="form-label">Ghi rõ những điều chưa hài lòng và mong muốn cải thiện</label><textarea class="form-textarea" id="${type}_ykien" placeholder="Nhập ý kiến..." style="min-height:80px;"></textarea></div>`,
    m5:`<div class="form-group mt-8"><label class="form-label">Những khó khăn và đề xuất để bệnh viện hỗ trợ tốt hơn về nuôi con bằng sữa mẹ</label><textarea class="form-textarea" id="${type}_ykien" placeholder="Nhập ý kiến..." style="min-height:80px;"></textarea></div>`,
  };

  // Build question sections with quick-select
  const CIRCLE_NUMS = ['①','②','③','④','⑤'];
  const LEVEL_LABELS = ['RKH','KHL','BT','HL','RHL'];
  const LEVEL_FULL = ['Rất không hài lòng','Không hài lòng','Bình thường','Hài lòng','Rất hài lòng'];
  let qHtml = '';

  // Global quick-select bar — FIX: use v===1 (number) not v==='1' (string)
  const globalQsBtns = [1,2,3,4,5,0].map(v => {
    if (v === 0) return `<button class="qs-btn qs-0" onclick="quickSelectAll('${type}',0)" title="Không sử dụng/Không có ý kiến"><span class="qb-num">⓪</span><span class="qb-emoji" style="font-size:9px;font-weight:700;">KSD</span></button>`;
    return `<button class="qs-btn qs-${v}" onclick="quickSelectAll('${type}',${v})" title="Tất cả: ${v} – ${LEVEL_FULL[v-1]}"><span class="qb-num">All ${CIRCLE_NUMS[v-1]}</span><span class="qb-emoji">${LIKERT_OPTS[v-1].e}</span></button>`;
  }).join('');

  qHtml += `<div class="global-qs-bar">
    <span class="global-qs-label">⚡ Chọn nhanh TẤT CẢ nhóm:</span>
    ${globalQsBtns}
  </div>`;

  def.sections.forEach(sec => {
    // Mobile card list for each question
    let mobileQItems = '';
    sec.questions.forEach((q, qi) => {
      const name = `${type}_${sec.id}_${qi}`;
      mobileQItems += `<div class="mobile-q-item" id="mob_row_${name}">
        <div class="mobile-q-text"><span class="mobile-q-num">${sec.id}${qi+1}.</span>${q}</div>
        <div class="mobile-likert-row">
          ${[1,2,3,4,5].map(v=>`<div class="mobile-likert-option">
            <input type="radio" class="likert-radio" name="${name}" value="${v}" id="mob_${name}_${v}" onchange="markRow('${name}');markMobRow('${name}')">
            <label for="mob_${name}_${v}">
              <div class="mob-circle mob-v${v}"><span class="lc-num">${CIRCLE_NUMS[v-1]}</span><span class="lc-emoji">${LIKERT_OPTS[v-1].e}</span></div>
              <span style="font-size:9px;color:var(--text3);font-weight:700;margin-top:1px;">${LEVEL_LABELS[v-1]}</span>
            </label>
          </div>`).join('')}
          <div class="mobile-likert-option">
            <input type="radio" class="na-radio" name="${name}" value="0" id="mob_${name}_0" onchange="markRow('${name}');markMobRow('${name}')">
            <label for="mob_${name}_0">
              <div class="mob-circle mob-v0"><span class="lc-num">⓪</span><span class="lc-emoji" style="font-size:9px;font-weight:700;">KSD</span></div>
              <span style="font-size:9px;color:var(--text3);font-weight:700;margin-top:1px;">KSD</span>
            </label>
          </div>
        </div>
      </div>`;
    });

    qHtml += `<div class="survey-section">
      <div class="survey-section-header">
        <div class="survey-section-title">${sec.title}</div>
        <div class="quick-select-wrap">
          <span class="qs-label">Chọn:</span>
          ${[1,2,3,4,5,0].map(v => {
            if (v===0) return `<button class="qs-btn qs-0" onclick="quickSelectSection('${type}','${sec.id}',0)" title="Không sử dụng"><span class="qb-num">⓪</span><span class="qb-emoji" style="font-size:9px;font-weight:700;">KSD</span></button>`;
            return `<button class="qs-btn qs-${v}" onclick="quickSelectSection('${type}','${sec.id}',${v})" title="${v} – ${LEVEL_FULL[v-1]}"><span class="qb-num">${CIRCLE_NUMS[v-1]}</span><span class="qb-emoji">${LIKERT_OPTS[v-1].e}</span></button>`;
          }).join('')}
        </div>
      </div>
      <table class="likert-table">
        <thead><tr>
          <th style="width:50%">Câu hỏi</th>
          <th class="lth-v1"><span class="th-num">①</span><span class="th-emoji">😞</span><span class="th-label">RKH</span></th>
          <th class="lth-v2"><span class="th-num">②</span><span class="th-emoji">😕</span><span class="th-label">KHL</span></th>
          <th class="lth-v3"><span class="th-num">③</span><span class="th-emoji">😐</span><span class="th-label">BT</span></th>
          <th class="lth-v4"><span class="th-num">④</span><span class="th-emoji">😊</span><span class="th-label">HL</span></th>
          <th class="lth-v5"><span class="th-num">⑤</span><span class="th-emoji">😄</span><span class="th-label">RHL</span></th>
          <th class="lth-v0"><span class="th-num">⓪</span><span class="th-emoji">—</span><span class="th-label">KSD</span></th>
        </tr></thead>
        <tbody>`;
    sec.questions.forEach((q, qi) => {
      const name = `${type}_${sec.id}_${qi}`;
      qHtml += `<tr id="row_${name}"><td><span class="q-num">${sec.id}${qi+1}.</span>${q}</td>`;
      for (let v=1;v<=5;v++) {
        qHtml += `<td><label><input type="radio" class="likert-radio" name="${name}" value="${v}" onchange="markRow('${name}')"><div class="likert-circle lc-v${v}"><span class="lc-num">${CIRCLE_NUMS[v-1]}</span><span class="lc-emoji">${LIKERT_OPTS[v-1].e}</span></div></label></td>`;
      }
      qHtml += `<td><label><input type="radio" class="na-radio" name="${name}" value="0" onchange="markRow('${name}')"><div class="na-circle"><span class="lc-num">⓪</span><span class="lc-emoji" style="font-size:9px;">KSD</span></div></label></td></tr>`;
    });
    qHtml += `</tbody></table>
      <div class="mobile-q-list">${mobileQItems}</div>
    </div>`;
  });

  container.innerHTML = `<div class="card">
    <div class="card-header">
      <div class="card-title">${type==='m1'?'🏥':type==='m2'?'🏃':type==='m3'?'👨‍⚕️':type==='m4'?'👶':'🍼'} ${def.label}</div>
      <div class="flex-gap">${roleChip}<button class="btn btn-success btn-sm" onclick="saveForm('${type}')">💾 Lưu phiếu</button></div>
    </div>
    <div class="card-body">
      <div class="info-box mb-14" style="font-size:12.5px;">📋 <b>${def.qd}</b> | ①Rất không hài lòng → ⑤Rất hài lòng | ⓪Không sử dụng/Không có ý kiến</div>
      <div class="card mb-14" style="border:1.5px solid #BBDEFB;">
        <div class="card-header" style="background:#E3F2FD;"><div class="card-title" style="color:#0D47A1;font-size:12.5px;">📌 Thông tin người trả lời</div></div>
        <div class="card-body">${infoHtml[type]||''}</div>
      </div>
      ${qHtml}
      <div class="card mt-14" style="border:1.5px solid #C8E6C9;">
        <div class="card-header" style="background:#F1F8E9;"><div class="card-title" style="color:#2E7D32;font-size:12.5px;">💬 Thông tin bổ sung</div></div>
        <div class="card-body">${notesHtml[type]||''}</div>
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="btn btn-outline" onclick="clearFormFields('${type}')">🗑️ Xóa form</button>
        <button class="btn btn-success" onclick="saveForm('${type}')">💾 Lưu phiếu</button>
      </div>
    </div>
  </div>`;
}

function buildDeptOptions() {
  let opts = '<option value="">-- Chọn khoa/phòng --</option>';
  DEPTS.forEach(d => { opts += `<option value="${d.name}">${d.name}${d.code?' ('+d.code+')':''}</option>`; });
  if (!DEPTS.length) opts += '<option disabled>-- Chưa có danh mục (vào Cấu hình → Khoa Phòng) --</option>';
  return opts;
}

// Rebuild dept dropdowns in all open forms
function refreshDeptDropdowns() {
  const opts = buildDeptOptions();
  document.querySelectorAll('[id$="_khoa"]').forEach(el => {
    if (el.tagName === 'SELECT') { const val = el.value; el.innerHTML = opts; el.value = val; }
  });
  // Also update user modal dept select
  const muDept = document.getElementById('mu-dept');
  if (muDept) {
    const val = muDept.value;
    muDept.innerHTML = '<option value="">--Chọn khoa--</option>';
    DEPTS.forEach(d => muDept.innerHTML += `<option value="${d.name}">${d.name}</option>`);
    muDept.value = val;
  }
}

// =========================================================
// QUICK SELECT
// =========================================================
function quickSelectSection(type, secId, value) {
  const def = SURVEYS[type];
  const sec = def.sections.find(s=>s.id===secId);
  if (!sec) return;
  sec.questions.forEach((q,qi)=>{
    const name = `${type}_${secId}_${qi}`;
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) { radio.checked=true; markRow(name); }
  });
  const label = value===0?'⓪ KSD':`${['①','②','③','④','⑤'][value-1]} ${LIKERT_OPTS[value-1].e}`;
  toast(`✅ Nhóm "${sec.title.replace(/^[A-Z]\.\s*/,'')}" → ${label}`,'success');
}

function quickSelectAll(type, value) {
  const def = SURVEYS[type];
  def.sections.forEach(sec => {
    sec.questions.forEach((q,qi)=>{
      const name = `${type}_${sec.id}_${qi}`;
      const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
      if (radio) { radio.checked=true; markRow(name); }
    });
  });
  const label = value===0?'⓪ KSD':`${['①','②','③','④','⑤'][value-1]} ${LIKERT_OPTS[value-1].e}`;
  const total = def.sections.reduce((s,sec)=>s+sec.questions.length,0);
  toast(`⚡ Đã chọn ${label} cho toàn bộ ${total} câu hỏi`,'info');
}

function markRow(name) {
  const row = document.getElementById(`row_${name}`);
  if (row) row.classList.add('answered');
}
function markMobRow(name) {
  const row = document.getElementById(`mob_row_${name}`);
  if (row) row.classList.add('answered');
}

// =========================================================
// COLLECT + SAVE FORM
// =========================================================
function collectForm(type) {
  const def = SURVEYS[type];
  const rec = {type, id: Date.now().toString(36)+Math.random().toString(36).slice(2,5), createdAt: new Date().toISOString(), status:'pending', submittedBy: currentUser?.username||'guest'};
  // Common fields
  const fmap = {
    m1:['ngay','benhvien','khoa','nguoitl','gt','tuoi','sdt','songay','bhyt','noiss','mucsong','lanthu','g1','g2','e7','g3','g4'],
    m2:['ngay','benhvien','nguoitl','gt','tuoi','sdt','kc','bhyt','noiss','mucsong','lanthu','g1','g2','e5','g3','g4'],
    m3:['ngay','donvi','khoa','gt','tuoi','chucdanh','thamnie','trinhdo','hopdong','kiennghi'],
    m4:['ngay','benhvien','khoa','nguoitl','tuoi','lansinh','hinhthuc','bhyt','ykien'],
    m5:['ngay','benhvien','thoidiemks','lansinh','ykien'],
  };
  (fmap[type]||[]).forEach(f=>{const el=document.getElementById(`${type}_${f}`);if(el)rec[f]=el.value;});
  rec.answers=[];
  def.sections.forEach(sec=>{
    sec.questions.forEach((q,qi)=>{
      const name=`${type}_${sec.id}_${qi}`;
      const sel=document.querySelector(`input[name="${name}"]:checked`);
      rec.answers.push({section:sec.title,code:`${sec.id}${qi+1}`,question:q,value:sel?parseInt(sel.value):null});
    });
  });
  return rec;
}

function saveForm(type) {
  const rec = collectForm(type);
  if (!rec.ngay){toast('Vui lòng chọn ngày điền phiếu!','error');return;}
  const unanswered = rec.answers.filter(a=>a.value===null).length;
  DB.surveys.push(rec);
  saveDB(); updateDash();
  const msg = unanswered>0?`⚠️ Đã lưu (còn ${unanswered} câu chưa trả lời)`:`✅ Đã lưu đầy đủ ${rec.answers.length} câu`;
  toast(msg, unanswered>0?'warning':'success');
  clearFormFields(type);
  updateBYTPendingBadge();

  // Push to Google Sheets immediately (bắt buộc)
  if (navigator.onLine && gsReady()) {
    setTimeout(async () => {
      const ok = await gsPushOneSurvey(rec);
      if (ok) {
        toast('☁️ Đã đồng bộ lên Sheets', 'success');
        updateDash();
      } else {
        toast('⚠️ Lưu Sheets thất bại – sẽ thử lại sau', 'warning');
      }
    }, 800);
  } else if (!gsReady()) {
    toast('⚠️ Chưa cấu hình Sheets – dữ liệu chỉ lưu cục bộ!', 'warning');
  }

  // Auto upload to BYT if enabled
  if (CFG.autoUploadBYT && navigator.onLine && CFG.bytuser && CFG.bytpass) {
    setTimeout(()=>{
      bytSelectedIds.add(rec.id);
      sendSelectedToBYT();
    }, 2000);
  }
}

function clearFormFields(type) {
  const def = SURVEYS[type];
  def.sections.forEach(sec=>{
    sec.questions.forEach((q,qi)=>{
      const name=`${type}_${sec.id}_${qi}`;
      document.querySelectorAll(`input[name="${name}"]`).forEach(r=>r.checked=false);
      const row=document.getElementById(`row_${name}`);if(row)row.classList.remove('answered');
    });
  });
  document.querySelectorAll(`[id^="${type}_"]`).forEach(el=>{
    if(el.tagName==='SELECT')el.value='';
    else if(el.tagName==='TEXTAREA')el.value='';
    else if(el.tagName==='INPUT'&&el.type!=='date')el.value='';
  });
  const today=new Date().toISOString().split('T')[0];
  const dte=document.getElementById(`${type}_ngay`);if(dte)dte.value=today;
  if(CFG.hvname){['benhvien','donvi'].forEach(f=>{const el=document.getElementById(`${type}_${f}`);if(el)el.value=CFG.hvname;});}
}

