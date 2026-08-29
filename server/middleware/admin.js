/**
 * Cong chan cho moi route /api/admin/*.
 *
 * ADMIN_PASSWORD de trong  -> cho qua thang (thiet lap hien tai, portal mo).
 * ADMIN_PASSWORD co gia tri -> doi header 'x-admin-password' khop moi cho qua.
 *
 * Nho vay bat xac thuc chi la viec dien mot bien moi truong, khong phai sua code.
 */
export function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return next()

  const given = req.get('x-admin-password')
  if (given && given === expected) return next()

  res.status(401).json({ error: 'Can dang nhap quan tri.' })
}

export function adminAuthEnabled() {
  return Boolean(process.env.ADMIN_PASSWORD)
}
