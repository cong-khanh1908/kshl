// config.js – Cấu hình Service Account, State toàn cục, khởi tạo dữ liệu
// Thuộc dự án Khảo sát Hài lòng – QĐ 56/2024 & QĐ 3869/2019
// ============================================================

// =========================================================
// BUILT-IN SERVICE ACCOUNT (tích hợp sẵn – chỉ cần nhập Spreadsheet ID)
// =========================================================
const SA_DEFAULT = {
  sa_email: 'kshl-328@crack-descent-492209-c3.iam.gserviceaccount.com',
  sa_key:   '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGfdzJFtlub60g\nTC13L66yFcuhXs/Sux5LSS55qWC9bdjiLZVUHwJa+pCPRPnJu3ij5XZAW/SG510j\nQ2LVTaSGqTKwgiELlJhCb41s5BNA8pPpRz0pS2drLnZ2gklMUjWmjkxv0VUT2UCT\n5MyA3wyYn9fMOY9r/evLeQ7FWSTgdN5/+l0Qlt5+AwyKt7Rd+W9k3L36QiNP+nNV\nsVuAosZnMYPJuN0VMu9v23jJMNHfkKpH2lRAFnkLAkcCveiRkoWHgqs8hT7YLYfJ\nHW8RAAJ2RsnqZOLgJ+0ybykV9dhPqfnQrVHLaijGg7K+r457SIY5mSr0nLYkaHnd\nR7F+qPv/AgMBAAECggEADq1T3BKydTYQySiY3A1Mj6KI8h++okhvzwVUSG671oX+\n2YqhVh0M4YlRkyZ4ifAw1X2sJsol5KvK+UaMUlVxavur4d1dcCvGrnLtNDYRLmZB\nhahc32bR+NzwqYaswNX7XZt8D3CdJ+CSo9zxOj5EAi0fmdxPvJ6EBwGmk/UpgudA\nCv8B5RZBF7zsHhTxz6IAIXRG/cLXxjldo/5lhnpebK5YFA10dAJwzjPgHSBX1TOl\n+P+zB1kHou0V/8zL3Ub36Au4RTxItUBXlDZQvNJiNP5bESdXs97KzW2lGg5LlpDI\nqeslgTvwRZU/sJa8ps1j1+e/n8OjOSVYHvsAS8Qa0QKBgQDn2OlDW2jYDqe7r6B6\n6ex9HdTJpZ5O3w4S2ZDdK5HJqSvgXwj50rBvWVgpki6jI+TxKqL390X19ehncbBj\nFX5pfogkZsFCtuiM83jceQC9lKb2hIw5FkemkhcCYVOgDmTjuxc7vRWiOd0cxnU2\nfZbJU+UpCo9OFGSOsA0Mbc+mawKBgQDbK2VdiF/iaEbupms5olZIahYxtrIeIZ9c\ntxR5bQ4xTXWygRxDHczxhsmNf3aQEInaC0W6XfE2fEl5dTlHrFGJpodY0zNY6zmG\neuQ7XnZJdRZ44M5emrpqiX/ZYfA2GK3Uiqk9ceLDHVELXCd4xKOLzinxPySZJn1a\nn+kDKcMdvQKBgD+BI4uGmzYq9XisR3nDXzp6FFHTYoRaBoHVRB/AkmM5SkJf5ZaA\nRkGJqGNinhGjgE8qjY78FRak76597oGFXqXIucO2vZLnhNUuz1kcb7593CnD7qCo\nYKHYfCLzw7MgnjPeiCOdzDIuRUlfdrWhOs8Ugr12HgCWB2EqCbjwzyLXAoGAY9Wv\ntdxyOPLhJMKf40AEZ7YTaA/dsQYFzrkC1ZEMvv6W13oigpwnh/mrBA6E1nkCIlWy\nLIOwZe5VlcMFFZX0CmzWCGskX6O+r3h5UGXmIe35D5TvzH5U3kTF/SK0xh+Vx1Rm\nZTvkXJaVHUScIlIIYZ3G00K9DBpRTZ+8B5nVbE0CgYEAhSjrQLrn9N3svYh4mHgd\ndznfQKpOrpE3PdwsjKp+hSO5ZiWMAm4bEgNZLgkYFkDdXpxycha7URnJe4FILHS4\nAbeY6kpoynLTR2sZF0y85/RaDR7v6Ugwh0T0JxsknaOiHgBHvQVJH8IBUzRBKdPK\nNtiIWNq83stH3TamtixKAVo=\n-----END PRIVATE KEY-----\n',
  sheetname: 'SURVEYS'
};

// =========================================================
// SPREADSHEET ID MẶC ĐỊNH
// ★ ADMIN: Điền ID Spreadsheet của bệnh viện vào đây (1 lần duy nhất)
// → Tất cả thiết bị mới mở app sẽ tự kết nối mà KHÔNG cần nhập lại
// Ví dụ: const SHEETID_DEFAULT = '1lDISGhLVAkUussZMtU9HqFYVYp4H...';
// =========================================================
const SHEETID_DEFAULT = ''; // ← ADMIN ĐIỀN VÀO ĐÂY

// ★ FIX MOBILE: Đọc ?sid= từ URL TRƯỚC KHI đọc localStorage
// → Khi admin gửi link có ?sid=..., mobile tự kết nối ngay lần đầu
(function readUrlSid() {
  try {
    const p = new URLSearchParams(location.search);
    const urlSid = (p.get('sid') || p.get('sheetid') || '').trim();
    if (urlSid) {
      // Ghi vào localStorage ngay để các module sau dùng được
      const stored = JSON.parse(localStorage.getItem('kshl_v4_cfg') || '{}');
      if (!stored.sheetid) {
        stored.sheetid = urlSid;
        localStorage.setItem('kshl_v4_cfg', JSON.stringify(stored));
      }
      // Dọn URL (xóa ?sid= để gọn)
      history.replaceState({}, document.title, location.pathname + location.hash);
    }
  } catch(e) { /* silent */ }
})();

// =========================================================
// STATE
// =========================================================
let DB    = JSON.parse(localStorage.getItem('kshl_v4_db')  || '{"surveys":[]}');
let CFG   = JSON.parse(localStorage.getItem('kshl_v4_cfg') || '{}');
let USERS = JSON.parse(localStorage.getItem('kshl_v4_users')|| 'null');
let DEPTS = JSON.parse(localStorage.getItem('kshl_v4_depts')|| '[]');
let currentUser = null;
let confirmCb   = null;

// Apply SA defaults if not yet configured
if (!CFG.sa_email) CFG.sa_email = SA_DEFAULT.sa_email;
if (!CFG.sa_key)   CFG.sa_key   = SA_DEFAULT.sa_key;
if (!CFG.sheetname) CFG.sheetname = SA_DEFAULT.sheetname;

// ★ TỰ ĐỘNG ĐIỀN SHEETID MẶC ĐỊNH nếu chưa có
// → Thiết bị mới sẽ tự kết nối Cloud mà không cần nhập lại
if (!CFG.sheetid && SHEETID_DEFAULT) {
  CFG.sheetid = SHEETID_DEFAULT;
  try { localStorage.setItem('kshl_v4_cfg', JSON.stringify(CFG)); } catch(e) {}
}

// Init default users if first run
if (!USERS) {
  USERS = [
    {id:'1',username:'admin', password:'admin@2024',fullname:'Quản trị viên',  role:'admin',dept:''},
    {id:'2',username:'nvyt',  password:'nvyt@2024', fullname:'Nhân viên Y tế', role:'user', dept:''},
    {id:'3',username:'bsxuat',password:'bs@2024',   fullname:'Bác sĩ xuất viện',role:'user',dept:''},
  ];
  try { localStorage.setItem('kshl_v4_users', JSON.stringify(USERS)); } catch(e) {}
}

// Migrate data from old v3 localStorage keys
(function migrateLegacy() {
  try {
    const oldDB  = localStorage.getItem('kshl_v3_db');
    const oldCFG = localStorage.getItem('kshl_v3_cfg');
    if (oldDB  && !localStorage.getItem('kshl_v4_db'))  { const d=JSON.parse(oldDB);  if(d.surveys?.length){DB=d;saveDB();} }
    if (oldCFG && !localStorage.getItem('kshl_v4_cfg')) { const cf=JSON.parse(oldCFG); Object.assign(CFG,cf); if(!CFG.sa_email)CFG.sa_email=SA_DEFAULT.sa_email; if(!CFG.sa_key)CFG.sa_key=SA_DEFAULT.sa_key; saveCFG(); }
  } catch(e) { /* silent */ }
})();

// =========================================================
// AUTH
// =========================================================
function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach((t,i)=>t.classList.toggle('active',(tab==='staff'&&i===0)||(tab==='guest'&&i===1)));
  document.getElementById('login-staff-form').style.display = tab==='staff'?'':'none';
  document.getElementById('login-guest-form').style.display = tab==='guest'?'':'none';
}
