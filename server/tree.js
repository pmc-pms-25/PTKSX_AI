/**
 * Cac ham thuan tuy thao tac tren cay node. Khong dung toi Express, de test truc tiep.
 */

/**
 * Bien tieu de tieng Viet thanh slug an toan cho URL.
 * 'Quy trinh bao tri' -> 'quy-trinh-bao-tri'
 */
// U+0300..U+036F la khoi "Combining Diacritical Marks" -- phan dau thanh va dau mu
// tach ra khoi chu cai sau khi normalize('NFD').
const COMBINING_MARKS = /[̀-ͯ]/g
// 'd' co gach ngang (U+0111 / U+0110) khong tach ra duoc bang NFD nen phai thay tay.
const D_WITH_STROKE = /[đĐ]/g

export function slugify(title) {
  const slug = String(title ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(D_WITH_STROKE, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // Tieu de toan ky tu la (vi du chi co emoji) van phai co slug dung duoc.
  return slug || 'muc'
}

/**
 * Tim slug chua bi dung. Trung thi them hau to -2, -3, ...
 * `taken` la mot Set cac slug dang ton tai.
 */
export function uniqueSlug(base, taken) {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/**
 * Lay tat ca slug dang co trong DB duoi dang Set.
 */
export function takenSlugs(db) {
  const rows = db.prepare('SELECT slug FROM nodes').all()
  return new Set(rows.map((r) => r.slug))
}

function toClient(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    type: row.type,
    title: row.title,
    slug: row.slug,
    icon: row.icon,
    hasContent: Boolean(row.content_file),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
    children: [],
  }
}

/**
 * Long danh sach phang thanh cay.
 * activeOnly = true thi cat bo ca nhanh cua node da tat, khong chi rieng node do.
 */
export function buildTree(rows, { activeOnly = false } = {}) {
  const source = activeOnly ? rows.filter((r) => r.is_active) : rows
  const byId = new Map()
  for (const row of source) byId.set(row.id, toClient(row))

  const roots = []
  for (const node of byId.values()) {
    if (node.parentId == null) {
      roots.push(node)
      continue
    }
    const parent = byId.get(node.parentId)
    if (parent) {
      parent.children.push(node)
    } else if (!activeOnly) {
      // Cha khong ton tai (du lieu hong) thi van hien o goc con hon la nuot mat node.
      roots.push(node)
    }
    // Voi activeOnly, cha bi tat nghia la ca nhanh bi an -- co tinh bo qua.
  }

  const sortRec = (list) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    for (const n of list) sortRec(n.children)
  }
  sortRec(roots)
  return roots
}

/**
 * Tap id cua toan bo con chau cua `id` (khong bao gom chinh no).
 */
export function descendantIds(rows, id) {
  const childrenOf = new Map()
  for (const row of rows) {
    if (!childrenOf.has(row.parent_id)) childrenOf.set(row.parent_id, [])
    childrenOf.get(row.parent_id).push(row.id)
  }
  const out = new Set()
  const stack = [...(childrenOf.get(id) ?? [])]
  while (stack.length) {
    const cur = stack.pop()
    if (out.has(cur)) continue
    out.add(cur)
    stack.push(...(childrenOf.get(cur) ?? []))
  }
  return out
}

/**
 * Kiem tra mot bo cuc cay moi co hop le khong, truoc khi ghi xuong DB.
 * Tra ve { ok: true } hoac { ok: false, error: '...' }.
 */
export function validateOrder(entries, existingIds) {
  if (!Array.isArray(entries)) {
    return { ok: false, error: 'Du lieu sap xep phai la mot mang.' }
  }

  const parentOf = new Map()
  for (const e of entries) {
    if (!Number.isInteger(e?.id) || !existingIds.has(e.id)) {
      return { ok: false, error: `Muc id=${e?.id} khong ton tai.` }
    }
    if (parentOf.has(e.id)) {
      return { ok: false, error: `Muc id=${e.id} xuat hien hai lan.` }
    }
    const parent = e.parentId ?? e.parent_id ?? null
    if (parent !== null && !existingIds.has(parent)) {
      return { ok: false, error: `Thu muc cha id=${parent} khong ton tai.` }
    }
    if (parent === e.id) {
      return { ok: false, error: 'Khong the dat mot muc lam cha cua chinh no.' }
    }
    parentOf.set(e.id, parent)
  }

  // Di nguoc chuoi cha cua tung node; gap lai chinh no la co vong lap.
  for (const id of parentOf.keys()) {
    const seen = new Set([id])
    let cur = parentOf.get(id)
    while (cur != null) {
      if (seen.has(cur)) {
        return { ok: false, error: 'Khong the keo mot thu muc vao ben trong chinh no.' }
      }
      seen.add(cur)
      if (!parentOf.has(cur)) break // cha nam ngoai danh sach gui len, dung lai
      cur = parentOf.get(cur)
    }
  }

  return { ok: true }
}
