import crypto from 'node:crypto'
import { getSettings, setSetting } from './db.js'

/*
  Mat khau quan tri duoc bam bang scrypt roi moi luu vao bang settings.
  Luu nguyen van thi ai doc duoc file portal.db la biet mat khau -- ma file do
  nam ngay trong thu muc du an va duoc chep di chep lai moi lan sao luu.

  scrypt co tinh cham (~100ms mot lan kiem tra), nen ban than no da chan bot
  viec do mat khau hang loat, khong can them co che khoa tai khoan.
*/
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 }
export const MIN_PASSWORD_LENGTH = 6

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16)
  const key = crypto.scryptSync(plain, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  })
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${key.toString('hex')}`
}

export function verifyPassword(plain, stored) {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false

  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, n, r, p, saltHex, keyHex] = parts
  let expected
  try {
    expected = Buffer.from(keyHex, 'hex')
    const actual = crypto.scryptSync(plain, Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    })
    // So sanh trong thoi gian co dinh: so sanh thuong lo ra do dai phan khop dau.
    return crypto.timingSafeEqual(expected, actual)
  } catch {
    // Chuoi bam hong (sua tay, du lieu cu) -- coi nhu khong khop.
    return false
  }
}

/** Mat khau dat trong trang quan tri. Null nghia la chua dat. */
export function getAdminHash(db) {
  return getSettings(db).adminPasswordHash || null
}

export function setAdminHash(db, hash) {
  setSetting(db, 'adminPasswordHash', hash)
}

/**
 * Portal co dang khoa khong.
 * Mat khau dat trong trang quan tri duoc uu tien; ADMIN_PASSWORD trong .env chi
 * con la duong du phong cho truong hop quen mat khau (xem README).
 */
export function authEnabled(db) {
  return Boolean(getAdminHash(db)) || Boolean(process.env.ADMIN_PASSWORD)
}

export function checkPassword(db, given) {
  if (typeof given !== 'string' || given === '') return false

  const hash = getAdminHash(db)
  if (hash) return verifyPassword(given, hash)

  const fromEnv = process.env.ADMIN_PASSWORD
  if (!fromEnv) return false
  const a = Buffer.from(given)
  const b = Buffer.from(fromEnv)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
