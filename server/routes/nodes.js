import { Router } from 'express'
import fs from 'node:fs'
import crypto from 'node:crypto'
import multer from 'multer'
import { allNodes, getNode } from '../db.js'
import { slugify, uniqueSlug, takenSlugs, descendantIds, buildTree } from '../tree.js'
import { requireAdmin } from '../middleware/admin.js'
import { loadContentHtml } from './content.js'
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
    tree: buildTree(rows, { activeOnly: false }),
  }
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
    }

    const slug = uniqueSlug(slugify(title), takenSlugs(db))
    const nextOrder =
      db
        .prepare(
          'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM nodes WHERE parent_id IS ?',
        )
        .get(parentId).n ?? 0
    const now = new Date().toISOString()

    const info = db
      .prepare(
        `INSERT INTO nodes (parent_id, type, title, slug, icon, sort_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(parentId, type, title.trim(), slug, icon ?? null, nextOrder, now, now)

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
    if ('isActive' in (req.body ?? {})) patch.is_active = req.body.isActive ? 1 : 0

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

    res.json({
      deleted: doomed.length,
      tree: buildTree(allNodes(db), { activeOnly: false }),
    })
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

      db.prepare('UPDATE nodes SET content_file = ?, updated_at = ? WHERE id = ?').run(
        fileName,
        new Date().toISOString(),
        id,
      )

      // Chi xoa file cu sau khi file moi da ghi thanh cong.
      if (node.content_file) removeContentFile(node.content_file)

      res.json({ ...nodeResponse(db, id), originalName: req.file.originalname })
    },
  )

  return router
}
