import { Router } from 'express'
import fs from 'node:fs'
import { allGroups, allNodes, getGroup } from '../db.js'
import { descendantIds } from '../tree.js'
import { groupsView } from '../views.js'
import { requireAdmin } from '../middleware/admin.js'
import { resolveContentFile } from '../paths.js'

const MAX_TITLE_LENGTH = 40

function cleanTitle(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
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

export function groupRoutes(db) {
  const router = Router()

  router.post('/api/admin/groups', requireAdmin, (req, res) => {
    const title = cleanTitle(req.body?.title)
    if (!title) return res.status(400).json({ error: 'Ten nhom khong duoc de trong.' })

    const nextOrder =
      db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM groups').get().n ?? 0
    const now = new Date().toISOString()

    const info = db
      .prepare(
        'INSERT INTO groups (title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run(title, nextOrder, now, now)

    res.status(201).json({ groupId: Number(info.lastInsertRowid), groups: groupsView(db, false) })
  })

  router.patch('/api/admin/groups/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id)
    if (!getGroup(db, id)) return res.status(404).json({ error: 'Khong tim thay nhom.' })

    const title = cleanTitle(req.body?.title)
    if (!title) return res.status(400).json({ error: 'Ten nhom khong duoc de trong.' })

    db.prepare('UPDATE groups SET title = ?, updated_at = ? WHERE id = ?').run(
      title,
      new Date().toISOString(),
      id,
    )

    res.json({ groups: groupsView(db, false) })
  })

  /**
   * Doi thu tu cac nhom. Body: { order: [id, id, ...] }
   */
  router.put('/api/admin/groups/order', requireAdmin, (req, res) => {
    const order = req.body?.order
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Du lieu sap xep phai la mot mang.' })
    }

    const existing = allGroups(db).map((g) => g.id)
    const unique = new Set(order)
    if (unique.size !== order.length || order.some((id) => !existing.includes(id))) {
      return res.status(400).json({ error: 'Danh sach nhom khong hop le.' })
    }
    if (order.length !== existing.length) {
      return res.status(400).json({ error: 'Phai gui day du danh sach nhom.' })
    }

    const now = new Date().toISOString()
    const stmt = db.prepare('UPDATE groups SET sort_order = ?, updated_at = ? WHERE id = ?')
    db.transaction((list) => list.forEach((id, i) => stmt.run(i, now, id)))(order)

    res.json({ groups: groupsView(db, false) })
  })

  router.delete('/api/admin/groups/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id)
    if (!getGroup(db, id)) return res.status(404).json({ error: 'Khong tim thay nhom.' })

    // Node phai thuoc ve mot nhom nao do. Xoa nhom cuoi cung la khong con cho nao
    // de tao muc moi, nen chan tu day.
    if (allGroups(db).length <= 1) {
      return res.status(400).json({ error: 'Phai con it nhat mot nhom.' })
    }

    const rows = allNodes(db)
    const roots = rows.filter((r) => r.group_id === id && r.parent_id == null)
    const doomed = new Set()
    for (const root of roots) {
      doomed.add(root.id)
      for (const child of descendantIds(rows, root.id)) doomed.add(child)
    }

    // Xoa file truoc, vi sau khi row bien mat thi khong con biet ten file nua.
    const byId = new Map(rows.map((r) => [r.id, r]))
    for (const nodeId of doomed) {
      const file = byId.get(nodeId)?.content_file
      if (file) removeContentFile(file)
    }

    // ON DELETE CASCADE lo phan node, mien la PRAGMA foreign_keys dang bat.
    db.prepare('DELETE FROM groups WHERE id = ?').run(id)

    res.json({ deleted: doomed.size, groups: groupsView(db, false) })
  })

  return router
}
