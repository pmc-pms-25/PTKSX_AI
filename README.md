# PKTSX AI Portal

Portal nội bộ: sidebar dạng cây bên trái, nội dung HTML hiện bên phải, kèm trang quản trị
để tạo mục, kéo-thả sắp xếp, bật/tắt và tải file nội dung lên.

Chạy bằng Node.js trên Windows Server, **không dùng IIS**.

---

## Chạy thử trên máy

```bash
npm install
npm run build
npm start
```

Mở http://localhost:8080 — trang quản trị ở http://localhost:8080/#/admin

Muốn có sẵn vài mục để xem thử:

```bash
node scripts/seed-demo.js
```

### Vừa sửa code vừa xem kết quả

Hai cửa sổ terminal:

```bash
npm run dev:server    # Express, cổng 8080, tự khởi động lại khi sửa file server
npm run dev:client    # Vite, cổng 5173, hot reload — mở http://localhost:5173
```

Vite tự chuyển tiếp `/api` và `/content` sang cổng 8080.

---

## Triển khai lên Windows Server

1. Chép cả thư mục lên server (hoặc `git clone`).
2. Tải [NSSM](https://nssm.cc/download), lấy `win64\nssm.exe`, đặt vào thư mục `deploy\`.
3. Tạo file `.env` từ `.env.example`, sửa `PORT` nếu cần.
4. Mở PowerShell **quyền Administrator**:

```powershell
npm install
npm run build
.\deploy\install-service.ps1
```

Script sẽ đăng ký Windows Service `PKTSXPortal`, đặt tự khởi động cùng Windows, ghi log
ra `logs\`, mở cổng trên Windows Firewall, rồi khởi động.

### Lệnh hay dùng

```powershell
Restart-Service PKTSXPortal
Stop-Service PKTSXPortal
Get-Content .\logs\portal.err.log -Tail 40
```

Đổi cổng: sửa `PORT` trong `.env` rồi chạy lại `.\deploy\install-service.ps1`.
Muốn chạy thẳng cổng 80 thì đặt `PORT=80` — vẫn không cần IIS.

---

## Bảo mật

Mặc định **trang quản trị mở cho mọi người**, đúng như yêu cầu ban đầu. Điều đó có nghĩa
là bất kỳ ai truy cập được tới server đều sửa/xóa được menu và tải HTML tùy ý lên.

Bật đăng nhập bất cứ lúc nào mà không phải sửa code: đặt giá trị cho `ADMIN_PASSWORD`
trong `.env` rồi `Restart-Service PKTSXPortal`. Trang `/#/admin` sẽ hiện màn đăng nhập,
còn phần xem của người dùng vẫn mở bình thường.

Nội dung tải lên luôn chạy trong `<iframe sandbox>` không có `allow-same-origin`, nên
script trong file không đụng được vào portal.

---

## Cách hoạt động

```
Browser ──► Express (server/server.js) :8080
              ├─ GET  /*             → client/dist  (React SPA)
              ├─ GET  /api/*         → JSON, đọc/ghi SQLite
              └─ GET  /content/:slug → HTML thô của file, nạp vào <iframe>

            data/portal.db    SQLite, một file
            content/*.html    file đã tải lên, đặt tên theo uuid
```

Một bảng `nodes` tự tham chiếu, folder và item chung bảng, phân biệt bằng cột `type`.
Cây lồng nhau không giới hạn độ sâu.

**Sao lưu** = chép `data\portal.db` và thư mục `content\`. Hai thứ đó là toàn bộ dữ liệu.

---

## Thư mục

| Đường dẫn | Nội dung |
|---|---|
| `server/` | Express, SQLite, các route |
| `server/__tests__/` | Test tầng server (`npm test`) |
| `client/src/` | Giao diện người dùng |
| `client/src/admin/` | Trang quản trị |
| `scripts/` | Tiện ích: tạo dữ liệu mẫu, xem bảng nodes |
| `deploy/` | Script cài Windows Service |
| `docs/superpowers/specs/` | Tài liệu thiết kế |

---

## Ghi chú khi dùng

- **Đổi tên hiển thị không đổi đường dẫn.** Cố ý như vậy để link đã chia sẻ không hỏng.
  Muốn đổi đường dẫn thì sửa riêng ô "Đường dẫn" trong trang quản trị.
- **Tắt một mục sẽ chặn cả link trực tiếp**, không chỉ ẩn khỏi menu. Tắt thư mục thì
  chặn luôn mọi trang bên trong.
- **Xóa thư mục là xóa cả nhánh** và các file nội dung kèm theo. Không khôi phục được.
- File nội dung tự lo giao diện của nó. Portal chỉ đóng khung như một tờ giấy trắng và
  thêm một ít CSS nền — style riêng của file luôn đè lên được.
- File xuất từ Word dùng bảng mã `windows-1252` vẫn hiển thị đúng: server để cho thẻ
  `<meta charset>` của file tự quyết định.

```bash
npm test    # 27 test cho tầng server
```
