/**
 * Tao du lieu mau de xem thu portal. Chay khi server dang bat:
 *     node scripts/seed-demo.js
 * Script chi them moi, khong dong toi du lieu dang co.
 */
const BASE = process.env.PORTAL_URL || 'http://localhost:8080'
const password = process.env.ADMIN_PASSWORD || ''

async function call(path, options = {}) {
  const headers = { ...options.headers }
  if (password) headers['x-admin-password'] = password
  const res = await fetch(BASE + path, { ...options, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${options.method ?? 'GET'} ${path} -> ${res.status}: ${text}`)
  }
  return res.json()
}

const create = (payload) =>
  call('/api/admin/nodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((r) => r.node)

async function upload(id, html, name) {
  const form = new FormData()
  form.append('file', new Blob([html], { type: 'text/html' }), name)
  return call(`/api/admin/nodes/${id}/content`, { method: 'POST', body: form })
}

function page(title, body) {
  return `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><title>${title}</title>
<style>
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .lead { color: #71717a; margin: 0 0 28px; }
  h2 { font-size: 17px; margin: 32px 0 10px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border: 1px solid #e4e4e7; padding: 8px 11px; text-align: left; }
  th { background: #fafafa; font-weight: 600; }
  .note { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; }
</style></head>
<body>${body}</body></html>`
}

const main = async () => {
  const vanHanh = await create({ type: 'folder', title: 'Quy trình vận hành', icon: 'clipboard-list' })
  const baoTri = await create({ type: 'folder', title: 'Bảo trì thiết bị', parentId: vanHanh.id, icon: 'wrench' })
  const antoan = await create({ type: 'folder', title: 'An toàn lao động', icon: 'shield' })

  const gioiThieu = await create({ type: 'item', title: 'Giới thiệu chung', icon: 'book-open' })
  const bom = await create({ type: 'item', title: 'Hướng dẫn bảo trì bơm', parentId: baoTri.id })
  const vanBan = await create({ type: 'item', title: 'Lịch bảo dưỡng định kỳ', parentId: baoTri.id })
  const quyDinh = await create({ type: 'item', title: 'Quy định trang bị BHLĐ', parentId: antoan.id })
  // Muc nay de tat, chi admin thay -- de kiem tra tinh nang an/hien.
  const nhap = await create({ type: 'item', title: 'Bản nháp chưa duyệt', parentId: antoan.id })

  await upload(
    gioiThieu.id,
    page(
      'Giới thiệu chung',
      `<h1>Cổng thông tin nội bộ PKTSX</h1>
<p class="lead">Nơi tra cứu quy trình, hướng dẫn và biểu mẫu của phòng Kỹ thuật Sản xuất.</p>
<div class="note">Menu bên trái được sắp xếp theo thư mục. Bấm vào một mục để mở nội dung.</div>
<h2>Nội dung đang có</h2>
<ul>
  <li>Quy trình vận hành và bảo trì thiết bị</li>
  <li>Lịch bảo dưỡng định kỳ theo quý</li>
  <li>Quy định về an toàn lao động</li>
</ul>
<h2>Liên hệ</h2>
<p>Cần bổ sung tài liệu, liên hệ quản trị viên của phòng.</p>`,
    ),
    'gioi-thieu.html',
  )

  await upload(
    bom.id,
    page(
      'Hướng dẫn bảo trì bơm',
      `<h1>Hướng dẫn bảo trì bơm ly tâm</h1>
<p class="lead">Áp dụng cho bơm ly tâm một cấp, chu kỳ 3 tháng một lần.</p>
<h2>Chuẩn bị</h2>
<ol>
  <li>Cắt điện và treo biển cảnh báo tại tủ điều khiển.</li>
  <li>Khóa van hút và van đẩy, xả áp đường ống.</li>
  <li>Chuẩn bị dụng cụ: cờ lê lực, đồng hồ so, mỡ bôi trơn.</li>
</ol>
<h2>Các bước kiểm tra</h2>
<table>
  <tr><th>Hạng mục</th><th>Tiêu chuẩn</th><th>Xử lý khi lệch</th></tr>
  <tr><td>Độ rung vỏ bơm</td><td>≤ 4.5 mm/s</td><td>Cân bằng lại rotor</td></tr>
  <tr><td>Nhiệt độ ổ đỡ</td><td>≤ 70°C</td><td>Bổ sung mỡ, kiểm tra khe hở</td></tr>
  <tr><td>Rò rỉ phớt cơ khí</td><td>Không rò</td><td>Thay phớt</td></tr>
  <tr><td>Đồng tâm trục</td><td>≤ 0.05 mm</td><td>Căn chỉnh lại khớp nối</td></tr>
</table>
<div class="note">Ghi kết quả vào sổ theo dõi và chụp ảnh hiện trạng trước khi lắp lại.</div>`,
    ),
    'bao-tri-bom.html',
  )

  await upload(
    vanBan.id,
    page(
      'Lịch bảo dưỡng định kỳ',
      `<h1>Lịch bảo dưỡng định kỳ 2026</h1>
<p class="lead">Cập nhật lần cuối: tháng 8/2026.</p>
<table>
  <tr><th>Quý</th><th>Thiết bị</th><th>Nội dung</th><th>Phụ trách</th></tr>
  <tr><td>Q1</td><td>Bơm ly tâm P-101</td><td>Bảo dưỡng toàn bộ</td><td>Tổ cơ khí</td></tr>
  <tr><td>Q2</td><td>Máy nén khí C-201</td><td>Thay dầu, lọc gió</td><td>Tổ cơ khí</td></tr>
  <tr><td>Q3</td><td>Tủ điện MCC-1</td><td>Vệ sinh, siết lại đầu cốt</td><td>Tổ điện</td></tr>
  <tr><td>Q4</td><td>Toàn bộ</td><td>Kiểm tra tổng thể cuối năm</td><td>Phòng KTSX</td></tr>
</table>`,
    ),
    'lich-bao-duong.html',
  )

  await upload(
    quyDinh.id,
    page(
      'Quy định trang bị BHLĐ',
      `<h1>Quy định trang bị bảo hộ lao động</h1>
<p class="lead">Bắt buộc với mọi cá nhân khi vào khu vực sản xuất.</p>
<h2>Trang bị tối thiểu</h2>
<ul>
  <li>Mũ bảo hộ đạt chuẩn, cài quai đúng cách</li>
  <li>Giày mũi thép</li>
  <li>Kính bảo hộ khi làm việc với máy mài, máy cắt</li>
  <li>Nút tai chống ồn tại khu vực có mức ồn trên 85 dB</li>
</ul>
<div class="note">Không đủ trang bị sẽ bị từ chối vào khu vực sản xuất.</div>`,
    ),
    'bhld.html',
  )

  // Tat mot muc de thay ro tac dung cua nut an/hien.
  await call(`/api/admin/nodes/${nhap.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false }),
  })

  const publicTree = await call('/api/tree')
  console.log('Da tao xong du lieu mau.')
  console.log('Cay hien thi cho nguoi dung:')
  const show = (nodes, depth = 0) => {
    for (const n of nodes) {
      console.log(`${'  '.repeat(depth + 1)}${n.type === 'folder' ? '[+]' : ' - '} ${n.title}  (/${n.slug})`)
      show(n.children, depth + 1)
    }
  }
  show(publicTree.tree)
}

main().catch((err) => {
  console.error('That bai:', err.message)
  process.exit(1)
})
