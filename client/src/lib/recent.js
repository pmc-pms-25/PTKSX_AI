const KEY = 'pktsx-recent'
const LIMIT = 6

/**
 * Danh sach trang vua mo, luu ngay tren may nguoi dung.
 * Co tinh khong day len may chu: day la thoi quen ca nhan, khong phai du lieu chung,
 * va portal khong co dang nhap nen cung khong biet ai voi ai.
 */
export function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((r) => r && typeof r.slug === 'string' && typeof r.title === 'string')
  } catch {
    return []
  }
}

export function pushRecent(node) {
  if (!node?.slug) return readRecent()
  const next = [
    { slug: node.slug, title: node.title, icon: node.icon ?? null, at: Date.now() },
    ...readRecent().filter((r) => r.slug !== node.slug),
  ].slice(0, LIMIT)

  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Het dung luong hoac bi chan -- bo qua, day chi la tien ich phu.
  }
  return next
}
