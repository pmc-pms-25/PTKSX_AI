# PKTSX AI Portal — Thiết kế

Ngày: 2026-08-29
Trạng thái: chờ duyệt

## 1. Mục tiêu

Một portal nội bộ gồm hai mặt:

- **UI người dùng** — sidebar trái dạng cây (folder → subfolder → item). Click vào item thì
  nội dung HTML tương ứng hiện ra ở panel bên phải. Giao diện và chuyển động hiện đại.
- **Admin CMS** — tạo/sửa/xóa mục menu, kéo-thả sắp xếp thứ tự, bật/tắt từng mục, upload
  file HTML làm nội dung cho mục.

Ràng buộc: chạy trên Windows Server sẵn có, **không dùng IIS**. Ưu tiên ra sản phẩm nhanh.

## 2. Quyết định đã chốt

| Vấn đề | Lựa chọn | Lý do |
|---|---|---|
| Nguồn nội dung | Admin upload file `.html` | Người dùng tự soạn HTML bên ngoài rồi đưa lên; không cần xây editor |
| Xác thực | Không bắt đăng nhập | Portal chạy trong mạng nội bộ đã kiểm soát truy cập |
| Runtime | Node.js + Express | Node v22.15.1 đã có sẵn trên máy |
| Lưu trữ | SQLite (`better-sqlite3`) | Một file `.db`, không phải cài DB server |
| Frontend | Vite + React + Tailwind | Component hóa, dễ mở rộng; animation dùng Framer Motion |
| Chạy trên server | NSSM → Windows Service | Tự khởi động cùng Windows, nghe port trực tiếp, không cần IIS |
| Độ sâu cây | Không giới hạn | Cùng lượng code với việc cứng 3 tầng, nhưng thêm tầng sau này không phải sửa gì |
| Render nội dung | `<iframe sandbox>` | File upload không phá được layout/CSS/JS của portal |

### Rủi ro đã ghi nhận

Admin không có xác thực nghĩa là bất kỳ ai chạm được tới server đều sửa/xóa được menu và
bơm được script vào trang. Đây là lựa chọn có chủ đích của chủ dự án, dựa trên giả định
server nằm trong mạng nội bộ được kiểm soát.

Để giữ đường lùi mà không tốn thêm thời gian: toàn bộ `/api/admin/*` đi qua middleware
`requireAdmin`. Khi biến môi trường `ADMIN_PASSWORD` rỗng, middleware cho qua thẳng — đúng
hành vi hiện tại. Đặt giá trị cho biến đó là bật ngay màn đăng nhập, không phải sửa code.

## 3. Kiến trúc

Một process Node duy nhất. Không reverse proxy, không DB server, không IIS.

```
Browser ──► Express (server/server.js) :8080
              ├─ GET  /*             → client/dist  (React SPA đã build)
              ├─ GET  /api/*         → JSON, đọc/ghi SQLite
              └─ GET  /content/:slug → HTML thô của file, nạp vào <iframe>

            data/portal.db    SQLite, một file
            content/*.html    file đã upload, đặt tên theo uuid
```

`/content/:slug` tách riêng khỏi API JSON vì nội dung được nạp bằng `<iframe>`, không phải
`dangerouslySetInnerHTML`. File upload có thể chứa `<script>`, CSS global, `<style>*{}` —
nhét thẳng vào DOM là phá vỡ layout portal ngay lập tức.

## 4. Mô hình dữ liệu

Một bảng tự tham chiếu. Folder và item dùng chung bảng, phân biệt bằng cột `type`.

```sql
CREATE TABLE nodes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id    INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
  type         TEXT    NOT NULL CHECK (type IN ('folder','item')),
  title        TEXT    NOT NULL,
  slug         TEXT    NOT NULL UNIQUE,
  icon         TEXT,
  content_file TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX idx_nodes_parent ON nodes(parent_id, sort_order);
```

- `parent_id = NULL` là node gốc.
- `icon` giữ tên icon của bộ `lucide-react`, ví dụ `file-text`.
- `content_file` giữ tên file dạng `<uuid>.html` trong thư mục `content/`, chỉ có giá trị
  khi `type = 'item'`.
- `sort_order` là số nguyên trong phạm vi cùng `parent_id`. Thao tác kéo-thả ghi lại toàn
  bộ cây phẳng trong một transaction, không cố cập nhật từng phần.
- `slug` unique toàn cục để deep-link: `/#/quy-trinh-bao-tri` mở đúng item và tự bung các
  folder cha. Trùng slug thì tự thêm hậu tố `-2`, `-3`.
- Xóa folder thì `ON DELETE CASCADE` xóa toàn bộ con. Cần bật `PRAGMA foreign_keys = ON`
  ở mỗi kết nối, nếu không SQLite bỏ qua ràng buộc này.

## 5. API

| Method | Route | Việc |
|---|---|---|
| GET | `/api/tree` | Cây chỉ gồm node `is_active = 1`, cho UI người dùng |
| GET | `/api/admin/tree` | Cây đầy đủ, kể cả node đã tắt |
| POST | `/api/admin/nodes` | Tạo folder hoặc item |
| PATCH | `/api/admin/nodes/:id` | Sửa `title` / `icon` / `is_active` |
| DELETE | `/api/admin/nodes/:id` | Xóa node, cascade con, xóa file content kèm theo |
| PUT | `/api/admin/tree/order` | Nhận cả cây phẳng `[{id, parent_id, sort_order}]`, ghi trong một transaction |
| POST | `/api/admin/nodes/:id/content` | Upload `.html` (multipart), thay file cũ |
| GET | `/content/:slug` | Trả HTML thô, có chèn thêm script đo chiều cao |

Cây được dựng ở tầng server: truy vấn phẳng toàn bộ bảng rồi lồng bằng map trong bộ nhớ.
Ở quy mô vài trăm node thì cách này nhanh hơn và đơn giản hơn recursive CTE.

## 6. UI người dùng

Layout hai cột: sidebar trái 280px, vùng nội dung bên phải.

**Sidebar**
- Folder có mũi tên xoay 180° khi mở; phần con bung ra bằng animate height của Framer Motion.
- Item đang chọn có thanh chỉ báo trượt sang vị trí mới bằng `layoutId` của Framer Motion,
  thay vì nhảy giật.
- Ô search lọc cây theo tên, gõ tới đâu lọc tới đó, tự bung folder chứa kết quả khớp.

**Vùng nội dung**
- Đổi item thì nội dung cũ fade-out kèm trượt lên nhẹ, nội dung mới fade-in.
  Dùng `AnimatePresence mode="wait"`.
- Trong lúc tải hiện skeleton shimmer, không dùng spinner trên nền trắng.

**Iframe tự co giãn**
- Khi serve `/content/:slug`, server chèn một đoạn script ngắn vào cuối tài liệu. Script này
  `postMessage` chiều cao thật của nội dung lên trang cha; trang cha đặt lại `height` của
  iframe theo đó. Nhờ vậy trang không có thanh cuộn lồng nhau.
- Thuộc tính sandbox: `allow-scripts allow-popups allow-forms`. Cố tình **không** có
  `allow-same-origin` — có cả hai cùng lúc thì nội dung thoát được sandbox.
- Server cũng chèn một CSS reset tối thiểu để nội dung không bị nền trắng lóa khi portal
  đang ở dark mode.

**Khác**
- Dưới 768px, sidebar chuyển thành drawer trượt từ trái kèm backdrop mờ.
- Dark mode theo `prefers-color-scheme`.

## 7. Admin CMS

Route `/#/admin`, nằm trong cùng SPA.

- **Cây kéo-thả** dùng `@dnd-kit` theo pattern flatten + projection: kéo lên/xuống để đổi
  thứ tự, kéo sang phải để thụt vào thành con của folder phía trên. Thả xong gọi
  `PUT /api/admin/tree/order` một lần duy nhất.
- Mỗi dòng có: toggle bật/tắt (node đã tắt hiện mờ và gạch chân đứt), nút sửa, nút xóa.
- **Panel phải**: form sửa title, chọn icon, upload file HTML (kéo-thả file vào cũng được),
  và nút xem trước ngay trong panel.
- Nút "＋ Thư mục" và "＋ Trang" tạo node mới ở cấp đang chọn.
- Mọi thao tác gọi API ngay, không có nút "Save all". Kết quả báo bằng toast.
- Xóa folder thì hộp thoại xác nhận nói rõ sẽ xóa kèm bao nhiêu mục con.

## 8. Xử lý lỗi

| Tình huống | Xử lý |
|---|---|
| Upload sai định dạng | Chỉ nhận `.html` / `.htm`, tối đa 5MB; sai thì trả 400 kèm lý do tiếng Việt, hiện lên toast |
| Item chưa gắn file | Vùng nội dung hiện empty state "Trang này chưa có nội dung" |
| File có trong DB nhưng mất trên đĩa | Trả 404 kèm empty state riêng, server không sập |
| Kéo folder vào chính con của nó | Chặn ở cả client và server (duyệt ngược chuỗi cha) |
| Slug trùng | Tự thêm hậu tố `-2`, `-3` |
| Path traversal qua tên file | `path.basename` cộng với kiểm tra file nằm trong thư mục `content/` đã resolve |

## 9. Kiểm thử

Vitest cộng supertest cho tầng server, chạy trên SQLite in-memory. Tập trung vào những chỗ
sai một cách thầm lặng:

- Reorder chạy trọn vẹn trong một transaction, hỏng giữa chừng thì rollback sạch.
- Cascade delete có xóa file content kèm theo trên đĩa.
- Sinh slug khi trùng tên.
- Chặn path traversal ở `/content/:slug`.
- Chặn kéo folder vào con của chính nó.
- `PRAGMA foreign_keys` thực sự bật trên kết nối đang dùng.

Phần UI không viết test tự động — ở quy mô này kiểm tay nhanh hơn.

## 10. Cấu trúc thư mục

```
D:\AI\PKTSX_AI_Portal\
  server/
    server.js            khởi tạo Express, mount route, serve dist
    db.js                mở SQLite, chạy schema, hàm truy vấn
    routes/tree.js       GET /api/tree, /api/admin/tree, PUT order
    routes/nodes.js      CRUD node, upload content
    routes/content.js    GET /content/:slug, chèn script + CSS reset
    middleware/admin.js  requireAdmin
  client/
    src/App.jsx  Sidebar.jsx  TreeNode.jsx  Viewer.jsx  SearchBox.jsx
    src/admin/AdminApp.jsx  AdminTree.jsx  NodeForm.jsx  ContentUpload.jsx
    src/lib/api.js
    vite.config.js
  content/               file .html đã upload
  data/portal.db
  deploy/install-service.ps1
  docs/superpowers/specs/
  .env.example
```

## 11. Triển khai

```
npm install
npm run build                       # vite build → client/dist
.\deploy\install-service.ps1        # chạy với quyền Administrator
```

`install-service.ps1` sẽ:
1. Kiểm tra có `nssm.exe` trong `deploy/` không, chưa có thì báo đường dẫn tải.
2. Đăng ký Windows Service tên `PKTSXPortal`, trỏ tới `node.exe server/server.js`.
3. Đặt chế độ tự khởi động cùng Windows, ghi stdout/stderr ra `logs/`.
4. Mở port trên Windows Firewall.
5. Start service và in ra URL truy cập.

Cấu hình qua `.env`: `PORT` (mặc định 8080) và `ADMIN_PASSWORD` (mặc định rỗng). Muốn chạy
thẳng port 80 thì đổi `PORT=80` rồi restart service — vẫn không cần IIS.

## 12. Ngoài phạm vi

Những thứ cố ý không làm ở phiên bản này: nhiều tài khoản người dùng và phân quyền, lịch sử
phiên bản nội dung, tìm kiếm toàn văn trong nội dung file, đa ngôn ngữ, editor WYSIWYG,
export PDF, thống kê lượt xem.
