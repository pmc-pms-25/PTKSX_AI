import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import multer from 'multer'
import { getSettings, setSetting } from '../db.js'
import { requireAdmin } from '../middleware/admin.js'
import {
  MIN_PASSWORD_LENGTH,
  authEnabled,
  checkPassword,
  hashPassword,
  setAdminHash,
} from '../auth.js'
import { BRANDING_DIR, resolveBrandingFile } from '../paths.js'

// Logo chi la mot hinh nho canh ten portal, khong can file lon.
const MAX_LOGO_BYTES = 512 * 1024
const MAX_TITLE_LENGTH = 40
const MAX_SUBTITLE_LENGTH = 60

// Cho phep ca SVG vi logo cong ty thuong o dang vector va hien net o moi co.
const ALLOWED_LOGO = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_LOGO[file.mimetype]) {
      const err = new Error('Chi nhan file anh PNG, JPG, WEBP, SVG hoac ICO.')
      err.status = 400
      return cb(err)
    }
    cb(null, true)
  },
})

/** Tra ve dang client dung duoc: logoFile thanh mot duong dan tai duoc. */
export function publicSettings(db) {
  const s = getSettings(db)
  return {
    siteTitle: s.siteTitle,
    siteSubtitle: s.siteSubtitle,
    logoUrl: s.logoFile ? `/branding/${encodeURIComponent(s.logoFile)}` : null,
    showRecent: s.showRecent === '1',
  }
}

function removeLogoFile(fileName) {
  const full = resolveBrandingFile(fileName)
  if (!full) return
  try {
    fs.unlinkSync(full)
  } catch (err) {
    // File da bi xoa tay tu truoc -- khong phai loi, cu di tiep.
    if (err.code !== 'ENOENT') throw err
  }
}

function cleanText(value, max) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function settingsRoutes(db) {
  const router = Router()

  router.get('/api/settings', (req, res) => {
    res.json(publicSettings(db))
  })

  router.get('/branding/:file', (req, res) => {
    const full = resolveBrandingFile(req.params.file)
    if (!full || !fs.existsSync(full)) {
      return res.status(404).json({ error: 'Khong tim thay file logo.' })
    }
    // Ten file da mang ma bam noi dung, doi logo la doi ten -- cache lau duoc.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.sendFile(full)
  })

  router.put('/api/admin/settings', requireAdmin, (req, res) => {
    const title = cleanText(req.body?.siteTitle, MAX_TITLE_LENGTH)
    if (!title) {
      return res.status(400).json({ error: 'Ten portal khong duoc de trong.' })
    }
    setSetting(db, 'siteTitle', title)
    setSetting(db, 'siteSubtitle', cleanText(req.body?.siteSubtitle, MAX_SUBTITLE_LENGTH))
    if ('showRecent' in (req.body ?? {})) {
      setSetting(db, 'showRecent', req.body.showRecent ? '1' : '0')
    }
    res.json(publicSettings(db))
  })

  router.post('/api/admin/settings/logo', requireAdmin, upload.single('logo'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Chua chon file logo.' })
    }

    const ext = ALLOWED_LOGO[req.file.mimetype]
    const fileName = `${crypto.randomUUID()}${ext}`
    fs.writeFileSync(path.join(BRANDING_DIR, fileName), req.file.buffer)

    // Xoa file cu SAU khi file moi da ghi xong, de loi ghi khong lam mat ca hai.
    const previous = getSettings(db).logoFile
    setSetting(db, 'logoFile', fileName)
    if (previous && previous !== fileName) removeLogoFile(previous)

    res.json(publicSettings(db))
  })

  router.delete('/api/admin/settings/logo', requireAdmin, (req, res) => {
    const previous = getSettings(db).logoFile
    setSetting(db, 'logoFile', null)
    if (previous) removeLogoFile(previous)
    res.json(publicSettings(db))
  })

  /**
   * Dat hoac doi mat khau quan tri.
   * Body: { currentPassword, newPassword }
   *
   * Dang khoa thi phai nhap dung mat khau cu -- requireAdmin da kiem header roi,
   * nhung doi them mat khau cu de mot tab bo quen dang mo khong doi duoc mat khau.
   */
  router.put('/api/admin/password', requireAdmin, (req, res) => {
    const next = req.body?.newPassword

    if (typeof next !== 'string' || next.length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Mat khau phai dai it nhat ${MIN_PASSWORD_LENGTH} ky tu.` })
    }

    if (authEnabled(db) && !checkPassword(db, req.body?.currentPassword)) {
      return res.status(400).json({ error: 'Mat khau hien tai khong dung.' })
    }

    setAdminHash(db, hashPassword(next))
    res.json({ authRequired: true })
  })

  /**
   * Bo mat khau, tra portal ve trang thai mo.
   * Body: { currentPassword }
   */
  router.delete('/api/admin/password', requireAdmin, (req, res) => {
    if (!authEnabled(db)) {
      return res.status(400).json({ error: 'Portal dang khong dat mat khau.' })
    }
    if (!checkPassword(db, req.body?.currentPassword)) {
      return res.status(400).json({ error: 'Mat khau hien tai khong dung.' })
    }

    setAdminHash(db, null)
    // ADMIN_PASSWORD trong .env van co the dang bat -- bao lai trang thai that.
    res.json({ authRequired: authEnabled(db) })
  })

  return router
}
