import { Router } from 'express'
import { allNodes } from '../db.js'
import { buildTree, validateOrder } from '../tree.js'
import { requireAdmin, adminAuthEnabled } from '../middleware/admin.js'

export function treeRoutes(db) {
  const router = Router()

  // Cay cho UI nguoi dung: chi node dang bat, va ca nhanh cua folder tat cung bien mat.
  router.get('/api/tree', (req, res) => {
    res.json({ tree: buildTree(allNodes(db), { activeOnly: true }) })
  })

  // Client can biet co phai dang nhap hay khong de quyet dinh hien man login.
  router.get('/api/admin/status', (req, res) => {
    res.json({ authRequired: adminAuthEnabled() })
  })

  // Cay day du cho admin, ke ca node da tat.
  router.get('/api/admin/tree', requireAdmin, (req, res) => {
    res.json({ tree: buildTree(allNodes(db), { activeOnly: false }) })
  })

  /**
   * Ghi lai bo cuc cay sau khi keo-tha.
   * Body: { order: [{ id, parentId, sortOrder }, ...] }
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

    const now = new Date().toISOString()
    const stmt = db.prepare(
      'UPDATE nodes SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?',
    )
    const apply = db.transaction((list) => {
      list.forEach((e, index) => {
        const parentId = e.parentId ?? e.parent_id ?? null
        const sortOrder = Number.isInteger(e.sortOrder) ? e.sortOrder : index
        stmt.run(parentId, sortOrder, now, e.id)
      })
    })

    apply(entries)
    res.json({ tree: buildTree(allNodes(db), { activeOnly: false }) })
  })

  return router
}
