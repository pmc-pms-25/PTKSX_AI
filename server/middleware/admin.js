import { authEnabled, checkPassword } from '../auth.js'

/**
 * Cong chan cho moi route /api/admin/*.
 *
 * Chua dat mat khau  -> cho qua thang (portal mo, dung nhu thiet lap ban dau).
 * Da dat mat khau    -> doi header 'x-admin-password' khop moi cho qua.
 *
 * `req.db` do createApp gan vao; middleware can doc mat khau da bam trong DB
 * nen khong the chi nhin moi truong nhu truoc.
 */
export function requireAdmin(req, res, next) {
  const db = req.db
  if (!db || !authEnabled(db)) return next()

  if (checkPassword(db, req.get('x-admin-password'))) return next()

  res.status(401).json({ error: 'Can dang nhap quan tri.' })
}

export function adminAuthEnabled(db) {
  return authEnabled(db)
}
