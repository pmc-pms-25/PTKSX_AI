import { Router } from 'express'
import { allNodes, allGroups } from '../db.js'
import { validateOrder } from '../tree.js'
import { groupsView } from '../views.js'
import { requireAdmin, adminAuthEnabled } from '../middleware/admin.js'

export function treeRoutes(db) {
  const router = Router()

  // Cay cho UI nguoi dung: chi node dang bat, va ca nhanh cua folder tat cung bien mat.
  router.get('/api/tree', (req, res) => {
    res.json({ groups: groupsView(db, true) })
  })

  // Client can biet co phai dang nhap hay khong de quyet dinh hien man login.
  router.get('/api/admin/status', (req, res) => {
    res.json({ authRequired: adminAuthEnabled(db) })
  })

  // Cay day du cho admin, ke ca node da tat.
  router.get('/api/admin/tree', requireAdmin, (req, res) => {
    res.json({ groups: groupsView(db, false) })
  })

  /**
   * Ghi lai bo cuc cay sau khi keo-tha.
   * Body: { order: [{ id, parentId, groupId, sortOrder }, ...] }
   *
   * groupId chi co y nghia voi node goc (parentId = null). Node nam trong mot thu muc
   * thi suy nhom tu goc cua nhanh minh, nen group_id cua no phai duoc xoa ve NULL --
   * giu lai ca hai la som muon cung lech nhau.
   *
   * Ca danh sach duoc ghi trong mot transaction -- hong giua chung thi rollback sach.
   */
  router.put('/api/admin/tree/order', requireAdmin, (req, res) => {
    const entries = req.body?.order
    const rows = allNodes(db)
    const existingIds = new Set(rows.map((r) => r.id))

    const check = validateOrder(entries, existingIds)
    if (!check.ok) return res.status(400).json({ error: check.error })

    // Khong cho nhet node vao ben trong mot trang -- chi thu muc moi chua duoc con.
    const typeById = new Map(rows.map((r) => [r.id, r.type]))
    for (const e of entries) {
      const parentId = e.parentId ?? e.parent_id ?? null
      if (parentId !== null && typeById.get(parentId) !== 'folder') {
        return res.status(400).json({ error: 'Chi thu muc moi chua duoc muc con.' })
      }
    }

    const groupIds = new Set(allGroups(db).map((g) => g.id))
    const groupOf = new Map(rows.map((r) => [r.id, r.group_id]))
    for (const e of entries) {
      const parentId = e.parentId ?? e.parent_id ?? null
      if (parentId !== null) continue
      const groupId = e.groupId ?? groupOf.get(e.id) ?? null
      if (!groupIds.has(groupId)) {
        return res.status(400).json({ error: `Nhom id=${groupId} khong ton tai.` })
      }
    }

    const now = new Date().toISOString()
    const stmt = db.prepare(
      'UPDATE nodes SET parent_id = ?, group_id = ?, sort_order = ?, updated_at = ? WHERE id = ?',
    )
    const apply = db.transaction((list) => {
      list.forEach((e, index) => {
        const parentId = e.parentId ?? e.parent_id ?? null
        const groupId = parentId === null ? (e.groupId ?? groupOf.get(e.id) ?? null) : null
        const sortOrder = Number.isInteger(e.sortOrder) ? e.sortOrder : index
        stmt.run(parentId, groupId, sortOrder, now, e.id)
      })
    })

    apply(entries)
    res.json({ groups: groupsView(db, false) })
  })

  return router
}
