# PKTSX AI Portal

Portal nội bộ đọc tài liệu: mục lục dạng cây bên trái, nội dung HTML ở giữa, mục lục
trong trang bên phải, kèm trang quản trị để tạo mục, kéo-thả sắp xếp, bật/tắt và tải
file nội dung lên.

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

Vite tự chuyển tiếp `/api`, `/content` và `/branding` sang cổng 8080.

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

### Sau khi nâng cấp Node.js

`better-sqlite3` là thư viện biên dịch sẵn, gắn chặt với phiên bản Node. Nâng Node lên
là gặp một trong hai kiểu hỏng:

**Không nạp được** (`NODE_MODULE_VERSION ... requires ...`) — build cũ, biên dịch lại:

```powershell
npm rebuild better-sqlite3
Restart-Service PKTSXPortal
```

**Nạp được nhưng dịch vụ tự sập** kèm dòng `Assertion failed: (env) != nullptr` trong
`logs\portal.err.log` — bản `better-sqlite3` quá cũ so với Node đang chạy. Biên dịch lại
không cứu được, phải nâng thư viện:

```powershell
npm install better-sqlite3@latest
npm rebuild better-sqlite3
Restart-Service PKTSXPortal
```

Kiểm tra nhanh xem tầng DB có ổn không (chỉ đọc, không ghi gì):

```powershell
node scripts/stress-db.js
```

In ra `db.close() xong, thoat binh thuong` là sạch.

---

## Mật khẩu quản trị

**Chỗ đổi mật khẩu: `/#/admin` → nút "Cài đặt" ở góc phải trên → mục "Mật khẩu quản trị".**

Ở đó có ba việc:

| Trạng thái | Nút | Cần nhập |
|---|---|---|
| Chưa đặt | **Đặt mật khẩu** | Mật khẩu mới + nhập lại |
| Đã đặt | **Đổi mật khẩu** | Mật khẩu hiện tại + mật khẩu mới + nhập lại |
| Đã đặt | **Bỏ mật khẩu** | Mật khẩu hiện tại |

Đặt xong là có hiệu lực ngay, không phải khởi động lại dịch vụ. Tab đang mở vẫn dùng
được bình thường; các tab khác sẽ hiện màn đăng nhập ở lần thao tác kế tiếp.

Khóa chỉ áp cho trang quản trị. **Phần xem của người dùng vẫn mở** — ai vào portal cũng
đọc tài liệu được như cũ.

### Mặc định là KHÔNG có mật khẩu

Portal mới cài để mở, đúng như yêu cầu ban đầu. Nghĩa là bất kỳ ai truy cập được tới
máy chủ đều sửa/xóa được menu, tải HTML tùy ý lên, **và đặt mật khẩu đầu tiên**. Nếu
portal nằm trên mạng nhiều người dùng chung thì nên đặt mật khẩu ngay.

### Quên mật khẩu

Chạy trên máy chủ:

```powershell
node scripts/reset-password.js
Restart-Service PKTSXPortal
```

Lệnh này gỡ mật khẩu khỏi `data\portal.db`, portal mở lại và bạn vào Cài đặt đặt mật
khẩu mới. Chạy được lệnh này nghĩa là đã có quyền trên máy chủ — tức là đã đọc/sửa được
file DB rồi, nên nó không mở thêm đường nào cho người ngoài.

`ADMIN_PASSWORD` trong `.env` chỉ còn là cách đặt mật khẩu ban đầu lúc mới triển khai.
Đã đặt mật khẩu trong trang quản trị thì dòng đó hết tác dụng.

### Mật khẩu được giữ thế nào

Máy chủ băm bằng **scrypt** kèm muối ngẫu nhiên rồi mới lưu; file `portal.db` không chứa
mật khẩu dạng đọc được. Trình duyệt giữ bản bạn gõ vào trong `sessionStorage` và gửi kèm
mỗi request, mất khi đóng tab.

**Một điểm cần biết:** portal chạy trên HTTP trong mạng nội bộ, nên mật khẩu đi qua mạng
ở dạng chưa mã hóa. Ai bắt được gói tin trong mạng LAN là đọc được. Với mạng nội bộ có
kiểm soát thì thường chấp nhận được; muốn chặt hơn thì phải dựng HTTPS cho portal.

### Nội dung tải lên

Nội dung luôn chạy trong `<iframe sandbox>` không có `allow-same-origin`, nên script
trong file không đụng được vào portal.

---

## Cách hoạt động

```
Browser ──► Express (server/server.js) :8080
              ├─ GET  /*              → client/dist  (React SPA)
              ├─ GET  /api/*          → JSON, đọc/ghi SQLite
              ├─ GET  /content/:slug  → HTML thô của file, nạp vào <iframe>
              └─ GET  /branding/:file → logo do admin tải lên

            data/portal.db    SQLite, một file
            content/*.html    tài liệu đã tải lên, đặt tên theo uuid
            branding/*        logo, đặt tên theo uuid
```

Một bảng `nodes` tự tham chiếu, folder và item chung bảng, phân biệt bằng cột `type`.
Cây lồng nhau không giới hạn độ sâu. Bảng `groups` giữ các nhóm mục lục; **chỉ node gốc
mang `group_id`**, node con suy ra nhóm từ gốc của nhánh mình — giữ ở cả hai nơi thì sớm
muộn cũng lệch nhau. Bảng `settings` giữ tên portal, dòng phụ và logo.

**Sao lưu** = chép `data\portal.db`, thư mục `content\` và thư mục `branding\`.

---

## Thư mục

| Đường dẫn | Nội dung |
|---|---|
| `server/` | Express, SQLite, các route |
| `server/__tests__/` | Test tầng server (`npm test`) |
| `client/src/` | Giao diện người dùng |
| `client/src/admin/` | Trang quản trị |
| `client/public/fonts/` | Font Inter + JetBrains Mono, nhúng sẵn để chạy offline |
| `scripts/` | Tiện ích: dữ liệu mẫu, xem bảng nodes, tải font, gỡ mật khẩu, ép tải DB |
| `deploy/` | Script cài Windows Service |
| `docs/` | Tài liệu thiết kế và bản mẫu giao diện |

---

## Dùng portal

- **Bấm một mục là hiện đúng nội dung file HTML của mục đó** — không tiêu đề, không
  đường dẫn, không nút phụ. Muốn biết đang ở đâu thì nhìn mục đang sáng ở cột trái,
  hoặc tiêu đề tab trình duyệt.
- **Ctrl K** mở bảng tìm kiếm. Gõ không dấu vẫn ra kết quả có dấu (`bao tri` khớp
  `bảo trì`). Mũi tên chọn, Enter mở.
- **Cột phải "Trong trang này"** tự dựng từ các thẻ `h1`/`h2`/`h3` trong file bạn tải
  lên, và tô sáng mục đang đọc. Chỉ có ở trang kiểu "Tài liệu"; file không có tiêu đề
  nào thì cột này ẩn đi.
- **Nút mặt trời / mặt trăng** đổi giao diện sáng ↔ tối. Chưa bấm lần nào thì portal đi
  theo cài đặt của Windows.

## Dùng trang quản trị

- **Nhóm mục lục.** Cột trái chia thành các nhóm, mỗi nhóm có tên riêng và cây thư mục
  riêng. Rê chuột lên tên nhóm để hiện các nút: bút chì đổi tên, mũi tên đổi thứ tự,
  thùng rác xóa. Nút **Thêm nhóm** ở cuối cột tạo nhóm mới. Bấm vào tên nhóm để chọn nó
  làm nơi nhận mục mới.
- **Chuyển mục sang nhóm khác:** chọn mục đó rồi đổi ở ô “Nhóm”. Cả nhánh bên trong đi
  theo, và mục sẽ nằm ở ngoài cùng của nhóm mới.
- **Xóa nhóm là xóa cả cây bên trong** kèm file nội dung. Portal luôn giữ ít nhất một
  nhóm nên nút xóa của nhóm cuối cùng bị khóa.
- Nhóm rỗng chỉ hiện trong trang quản trị; người đọc không thấy.
- **Cài đặt** (góc phải trên) đổi tên portal, dòng phụ, và tải logo lên. Logo nhận PNG,
  JPG, WEBP, SVG hoặc ICO, tối đa 512KB — nó thay luôn icon trên tab trình duyệt.
- **Công tắc “Hiện mục Mở gần đây”** trong Cài đặt. Mặc định tắt. Bật lên thì cuối cột
  mục lục và trang chủ hiện các trang mỗi người vừa mở — danh sách này nằm trên máy từng
  người, không dùng chung.
- **Đổi tên hiển thị không đổi đường dẫn.** Cố ý như vậy để link đã chia sẻ không hỏng.
  Muốn đổi đường dẫn thì sửa riêng ô "Đường dẫn".
- **Tắt một mục sẽ chặn cả link trực tiếp**, không chỉ ẩn khỏi menu. Tắt thư mục thì
  chặn luôn mọi trang bên trong.
- **Xóa thư mục là xóa cả nhánh** và các file nội dung kèm theo. Không khôi phục được.
- File xuất từ Word dùng bảng mã `windows-1252` vẫn hiển thị đúng: server để cho thẻ
  `<meta charset>` của file tự quyết định.

### Hai kiểu hiển thị

Mỗi trang chọn được một trong hai kiểu, ở form chỉnh sửa trong trang quản trị:

**Tài liệu** (mặc định) — đóng khung như tờ giấy giữa màn hình, tự kéo cao theo nội
dung. Server chèn sẵn một bộ CSS: tiêu đề, đoạn văn, danh sách, bảng biểu, khối trích
dẫn và khối mã đều có kiểu dáng tử tế, nên file xuất từ Word vốn trơ trụi tự đẹp lên.
Bộ CSS đó chỉ dùng selector mức thẻ nên **style riêng trong file luôn đè lên được**.
Kiểu này cũng là kiểu duy nhất có cột "Trong trang này".

**Toàn khung** — trang chiếm trọn vùng bên phải và tự cuộn bên trong. Server trả file
**nguyên vẹn**, không chèn một dòng nào. Dùng cho trang tự lo bố cục: bảng điều khiển,
biểu đồ Gantt, công cụ có thanh bên riêng.

Vì sao phải tách hai kiểu: trang đặt `height:100vh` hoặc `html,body{height:100%}` tự đo
mình theo khung nhìn, mà khung lại đo theo trang — vòng luẩn quẩn, kết quả là khung kẹt
ở chiều cao tối thiểu và nội dung bị cắt. Lúc tải file lên server tự đoán kiểu dựa vào
đúng hai dấu hiệu đó; đoán sai thì đổi lại trong form, và **lựa chọn của bạn không bị
ghi đè** ở những lần tải lại sau.

Trang tải lên từ trước khi có tính năng này thì chạy một lần:

```powershell
node scripts/detect-display-mode.js          # chỉ xem
node scripts/detect-display-mode.js --apply  # ghi xuống
```

---

## Ghi chú kỹ thuật

Font được nhúng thẳng vào bản build (`client/public/fonts/`), không gọi Google Fonts lúc
chạy, để máy trạm trong mạng nội bộ không có internet vẫn hiển thị đúng. Muốn đổi bộ chữ
thì sửa `scripts/fetch-fonts.js` rồi chạy `node scripts/fetch-fonts.js`.

```bash
npm test    # 73 test cho tầng server
```
