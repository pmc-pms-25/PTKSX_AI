import { Router } from 'express'
import fs from 'node:fs'
import crypto from 'node:crypto'
import multer from 'multer'
import { allNodes, getNode, getGroup, firstGroupId } from '../db.js'
import { slugify, uniqueSlug, takenSlugs, descendantIds, buildTree } from '../tree.js'
import { groupsView } from '../views.js'
import { requireAdmin } from '../middleware/admin.js'
import { loadContentHtml, looksLikeApp } from './content.js'
import { CONTENT_DIR, resolveContentFile } from '../paths.js'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = /\.html?$/i

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_EXT.test(file.originalname)) {
      const err = new Error('Chi nhan file .html hoac .htm.')
      err.status = 400
      return cb(err)
    }
    cb(null, true)
  },
})

function nodeResponse(db, id) {
  const rows = allNodes(db)
  return {
    node: buildTree(rows.filter((r) => r.id === id))[0] ?? null,
    groups: groupsView(db, false),
  }
}

/** Vi tri cuoi cung trong danh sach anh em, de muc moi rot xuong duoi cung. */
function nextSortOrder(db, parentId, groupId) {
  return (
    db
      .prepare(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM nodes WHERE parent_id IS ? AND group_id IS ?',
      )
      .get(parentId, groupId).n ?? 0
  )
}

function removeContentFile(fileName) {
  const full = resolveContentFile(fileName)
  if (!full) return
  try {
    fs.unlinkSync(full)
  } catch (err) {
    // File da bi xoa tay tu truoc -- khong phai loi, cu di tiep.
    if (err.code !== 'ENOENT') throw err
  }
}

export function nodeRoutes(db) {
  const router = Router()

  router.post('/api/admin/nodes', requireAdmin, (req, res) => {
    const { type, title, icon } = req.body ?? {}
    const parentId = req.body?.parentId ?? null
    // Chi node goc mang nhom; node nam trong thu muc suy nhom tu goc cua nhanh minh.
    let groupId = null

    if (type !== 'folder' && type !== 'item') {
      return res.status(400).json({ error: "Loai muc phai la 'folder' hoac 'item'." })
    }
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Ten muc khong duoc de trong.' })
    }
    if (parentId !== null) {
      const parent = getNode(db, parentId)
      if (!parent) return res.status(400).json({ error: 'Thu muc cha khong ton tai.' })
      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Chi thu muc moi chua duoc muc con.' })
      }
    } else {
      groupId = req.body?.groupId ?? firstGroupId(db)
      if (!getGroup(db, groupId)) {
        return res.status(400).json({ error: 'Nhom khong ton tai.' })
      }
    }

    const slug = uniqueSlug(slugify(title), takenSlugs(db))
    const nextOrder = nextSortOrder(db, parentId, groupId)
    const now = new Date().toISOString()

    const info = db
      .prepare(
        `INSERT INTO nodes (parent_id, group_id, type, title, slug, icon, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(parentId, groupId, type, title.trim(), slug, icon ?? null, nextOrder, now, now)

    res.status(201).json(nodeResponse(db, info.lastInsertRowid))
  })

  router.patch('/api/admin/nodes/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id)
    const node = getNode(db, id)
    if (!node) return res.status(404).json({ error: 'Khong tim thay muc.' })

    const patch = {}
    if ('title' in (req.body ?? {})) {
      const title = req.body.title
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Ten muc khong duoc de trong.' })
      }
      patch.title = title.trim()
    }
    if ('icon' in (req.body ?? {})) patch.icon = req.body.icon || null

    if ('displayMode' in (req.body ?? {})) {
      const mode = req.body.displayMode
      if (mode !== 'document' && mode !== 'app') {
        return res.status(400).json({ error: "Kieu hien thi phai la 'document' hoac 'app'." })
      }
      patch.display_mode = mode
    }
    if ('isActive' in (req.body ?? {})) patch.is_active = req.body.isActive ? 1 : 0

    // Chuyen sang nhom khac se dua ca nhanh ra ngoai cung cua nhom do -- mot muc
    // khong the vua nam trong thu muc cu vua thuoc nhom moi.
    if ('groupId' in (req.body ?? {})) {
      const groupId = Number(req.body.groupId)
      if (!getGroup(db, groupId)) {
        return res.status(400).json({ error: 'Nhom khong ton tai.' })
      }
      if (groupId !== node.group_id || node.parent_id != null) {
        patch.group_id = groupId
        patch.parent_id = null
        patch.sort_order = nextSortOrder(db, null, groupId)
      }
    }

    // Slug khong tu doi theo title: doi slug la gay hong moi duong dan da chia se.
    // Muon doi thi admin phai sua co y, va van duoc kiem tra trung.
    if ('slug' in (req.body ?? {})) {
      const base = slugify(req.body.slug)
      const taken = takenSlugs(db)
      taken.delete(node.slug)
      patch.slug = uniqueSlug(base, taken)
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Khong co truong nao de cap nhat.' })
    }

    const cols = Object.keys(patch)
      .map((c) => `${c} = ?`)
      .join(', ')
    db.prepare(`UPDATE nodes SET ${cols}, updated_at = ? WHERE id = ?`).run(
      ...Object.values(patch),
      new Date().toISOString(),
      id,
    )

    res.json(nodeResponse(db, id))
  })

  router.delete('/api/admin/nodes/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id)
    const node = getNode(db, id)
    if (!node) return res.status(404).json({ error: 'Khong tim thay muc.' })

    const rows = allNodes(db)
    const doomed = [id, ...descendantIds(rows, id)]
    const byId = new Map(rows.map((r) => [r.id, r]))

    // Xoa file trước, vi sau khi row bien mat thi khong con biet ten file nua.
    for (const nid of doomed) {
      const file = byId.get(nid)?.content_file
      if (file) removeContentFile(file)
    }

    // ON DELETE CASCADE lo phan con, mien la PRAGMA foreign_keys dang bat.
    db.prepare('DELETE FROM nodes WHERE id = ?').run(id)

    res.json({ deleted: doomed.length, groups: groupsView(db, false) })
  })

  /**
   * Noi dung tho cho khung xem truoc trong admin.
   * Duong cong khai /content/:slug chan muc dang tat, nhung admin thi phai xem duoc
   * truoc khi bat len. Iframe khong gui duoc header xac thuc, nen tra qua JSON de
   * trang admin tu do vao srcdoc.
   */
  router.get('/api/admin/nodes/:id/content', requireAdmin, (req, res) => {
    const node = getNode(db, Number(req.params.id))
    if (!node) return res.status(404).json({ error: 'Khong tim thay muc.' })
    if (node.type !== 'item') {
      return res.status(400).json({ error: 'Chi trang moi co noi dung.' })
    }

    const result = loadContentHtml(node)
    res.json({ ok: result.status === 200, html: result.html })
  })

  router.post(
    '/api/admin/nodes/:id/content',
    requireAdmin,
    upload.single('file'),
    (req, res) => {
      const id = Number(req.params.id)
      const node = getNode(db, id)
      if (!node) return res.status(404).json({ error: 'Khong tim thay muc.' })
      if (node.type !== 'item') {
        return res.status(400).json({ error: 'Chi trang moi gan duoc noi dung.' })
      }
      if (!req.file) return res.status(400).json({ error: 'Chua chon file de tai len.' })

      const fileName = `${crypto.randomUUID()}.html`
      fs.mkdirSync(CONTENT_DIR, { recursive: true })
      fs.writeFileSync(resolveContentFile(fileName), req.file.buffer)

      // Doan kieu hien thi ngay tu file, chi o lan tai len DAU TIEN cua muc nay.
      // Admin da tu chon roi thi ton trong lua chon do, khong ghi de moi lan tai lai.
      const mode = node.content_file
        ? node.display_mode || 'document'
        : looksLikeApp(req.file.buffer.toString('utf8'))
          ? 'app'
          : 'document'

      db.prepare(
        'UPDATE nodes SET content_file = ?, display_mode = ?, updated_at = ? WHERE id = ?',
      ).run(fileName, mode, new Date().toISOString(), id)

      // Chi xoa file cu sau khi file moi da ghi thanh cong.
      if (node.content_file) removeContentFile(node.content_file)

      res.json({ ...nodeResponse(db, id), originalName: req.file.originalname })
    },
  )

  return router
}
