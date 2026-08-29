import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const CONTENT_DIR = path.join(ROOT, 'content')
export const DATA_DIR = path.join(ROOT, 'data')
// Logo do admin tai len. Tach khoi content/ vi day la anh, khong phai trang tai lieu.
export const BRANDING_DIR = path.join(ROOT, 'branding')
export const CLIENT_DIST = path.join(ROOT, 'client', 'dist')

export function ensureDirs() {
  for (const dir of [CONTENT_DIR, DATA_DIR, BRANDING_DIR]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Ghep ten file content thanh duong dan tuyet doi, chan path traversal.
 * Tra ve null neu ten file tim cach thoat ra khoi CONTENT_DIR.
 */
export function resolveContentFile(fileName) {
  if (!fileName || typeof fileName !== 'string') return null

  // Ten hop le luon la '<uuid>.html' -- khong bao gio co dau phan cach duong dan hay o dia.
  // Co nghia la du lieu da hong hoac bi sua tay, tu choi thang thay vi cat gon roi doan y.
  if (/[/\\:]/.test(fileName)) return null

  const base = path.basename(fileName)
  if (!base || base === '.' || base === '..') return null
  const full = path.resolve(CONTENT_DIR, base)
  // Kiem tra lan hai: ket qua phai nam trong CONTENT_DIR.
  const rel = path.relative(CONTENT_DIR, full)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return full
}

/** Cung mot cach chan path traversal, ap cho thu muc logo. */
export function resolveBrandingFile(fileName) {
  if (!fileName || typeof fileName !== 'string') return null
  if (/[/\\:]/.test(fileName)) return null

  const base = path.basename(fileName)
  if (!base || base === '.' || base === '..') return null
  const full = path.resolve(BRANDING_DIR, base)
  const rel = path.relative(BRANDING_DIR, full)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return full
}
