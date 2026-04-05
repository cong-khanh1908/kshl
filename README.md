# 🏥 Hệ thống Khảo sát Hài lòng Người bệnh

**QĐ 56/QĐ-BYT 2024 & QĐ 3869/QĐ-BYT 2019 – Bộ Y tế**

---

## 📁 Cấu trúc thư mục

```
kshl/
├── index.html          # Trang chính (HTML shell – ~980 dòng)
├── css/
│   └── app.css         # Tất cả styles (layout, components, responsive)
├── js/
│   ├── config.js       # Cấu hình SA, State toàn cục, khởi tạo
│   ├── ui.js           # Giao diện: nav, modal, toast, connectivity, startup
│   ├── sheets.js       # Google Sheets engine, đồng bộ, cài đặt, lịch sử
│   ├── users.js        # Xác thực, quản lý TK, khoa phòng, profile, yêu cầu TK
│   ├── surveys.js      # Định nghĩa phiếu, build forms, quick select, lưu phiếu
│   ├── dashboard.js    # Dashboard thống kê, chi tiết phiếu
│   ├── byt.js          # Module gửi phiếu lên BYT
│   └── reports.js      # Báo cáo tổng hợp, xuất Word/HTML
└── README.md           # Tài liệu này
```

---

## 🚀 Hướng dẫn triển khai trên GitHub

### Bước 1: Tạo GitHub Repository

1. Đăng nhập [github.com](https://github.com)
2. Nhấn **New repository**
3. Đặt tên repo (ví dụ: `kshl` hoặc `khaosat-hailong`)
4. Chọn **Public** (bắt buộc để dùng jsDelivr CDN miễn phí)
5. Nhấn **Create repository**

### Bước 2: Upload file lên GitHub

Cách nhanh nhất qua giao diện web:
1. Vào repo vừa tạo → **Add file** → **Upload files**
2. Upload toàn bộ: `index.html`, thư mục `css/`, thư mục `js/`
3. Commit: *"Initial release v1.0"*

Hoặc dùng Git CLI:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cp -r kshl/* YOUR_REPO/
cd YOUR_REPO
git add .
git commit -m "Initial release v1.0"
git push
```

### Bước 3: Cập nhật URL trong index.html

Mở `index.html`, tìm và thay `YOUR_GITHUB_USERNAME/YOUR_REPO_NAME` bằng thông tin thực tế:

```html
<!-- Trước: -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME@main/css/app.css">

<!-- Sau (ví dụ): -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/bvdongna/kshl@main/css/app.css">
```

Làm tương tự với 8 thẻ `<script src="...">`.

### Bước 4: Kích hoạt GitHub Pages (tuỳ chọn)

1. Vào repo → **Settings** → **Pages**
2. Source: **Deploy from a branch** → branch `main` → folder `/root`
3. URL truy cập: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## ⚡ Cách sử dụng jsDelivr CDN

jsDelivr phân phối file GitHub miễn phí, tốc độ cao, hỗ trợ toàn cầu:

```
https://cdn.jsdelivr.net/gh/USERNAME/REPO@BRANCH/PATH
```

**Ví dụ:**
```
https://cdn.jsdelivr.net/gh/bvdongna/kshl@main/js/surveys.js
```

**Lưu ý về cache:** jsDelivr cache 12–24h. Sau khi push code mới, dùng `@main` sẽ tự cập nhật sau ~1 ngày. Để force update tức thì, dùng commit hash:
```
https://cdn.jsdelivr.net/gh/bvdongna/kshl@abc1234/js/surveys.js
```

---

## 🔄 Quy trình nâng cấp code

### Nâng cấp thông thường (bất kỳ file JS/CSS)

1. Mở file cần sửa (ví dụ `js/surveys.js`) trực tiếp trên GitHub
2. Click **Edit** (bút chì ✏️)
3. Sửa code → **Commit changes**
4. Sau 24h jsDelivr tự cập nhật

### Nâng cấp tức thì (không chờ CDN cache)

**Cách 1:** Thêm `?v=2` vào URL trong index.html:
```html
<script src=".../js/surveys.js?v=2"></script>
```

**Cách 2:** Dùng commit hash thay vì `@main`:
```html
<script src="https://cdn.jsdelivr.net/gh/bvdongna/kshl@abc1234/js/surveys.js"></script>
```

### Test local (không cần GitHub)

Mở `index.html` bằng Live Server (VS Code) với các file JS/CSS ở local:
1. Thay URL CDN bằng đường dẫn local trong index.html:
```html
<link rel="stylesheet" href="./css/app.css">
<script src="./js/config.js"></script>
<!-- ... -->
```
2. Sau khi test xong → push lên GitHub → đổi lại URL CDN

---

## 🗂️ Mô tả từng file JS

| File | Chức năng | Khi nào sửa |
|------|-----------|-------------|
| `config.js` | Service Account key, biến STATE, switchLoginTab | Đổi SA, thêm biến mới |
| `ui.js` | Navigation, modal, toast, sidebar, startup | Sửa UX/UI, thêm trang mới |
| `sheets.js` | Đọc/ghi Google Sheets, cài đặt, lịch sử | Đổi cấu trúc Sheets, tối ưu sync |
| `users.js` | Login, quản lý TK, khoa phòng, profile, yêu cầu TK | Thêm phân quyền, tính năng TK |
| `surveys.js` | 5 mẫu phiếu, build form, quick select, lưu | Thêm câu hỏi, sửa mẫu phiếu |
| `dashboard.js` | Thống kê, biểu đồ, xem chi tiết phiếu | Thêm chỉ số, sửa dashboard |
| `byt.js` | Tự động gửi phiếu lên hailong.chatluongbenhvien.vn | Sửa logic tự động điền BYT |
| `reports.js` | Báo cáo tổng hợp, xuất Word (.docx), HTML | Sửa mẫu báo cáo, thêm biểu mẫu |

---

## 🔐 Bảo mật

- **Service Account key** được nhúng sẵn trong `config.js`. Repo nên để **Private** hoặc dùng GitHub Secrets nếu cần bảo mật cao hơn.
- Mật khẩu người dùng được hash base64 khi lưu lên Sheets.
- Tài khoản admin mặc định: `admin` / `admin@2024` — **đổi ngay sau khi triển khai!**

---

## 📞 Hỗ trợ

Liên hệ quản trị hệ thống hoặc đơn vị cung cấp phần mềm để được hỗ trợ.
