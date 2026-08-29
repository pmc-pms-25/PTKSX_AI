/**
 * Bo dau tieng Viet de o tim kiem go 'bao tri' van khop 'bảo trì'.
 */
const COMBINING_MARKS = /[̀-ͯ]/g
const D_WITH_STROKE = /[đĐ]/g

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(D_WITH_STROKE, 'd')
    .toLowerCase()
    .trim()
}

export function findBySlug(tree, slug) {
  for (const node of tree) {
    if (node.slug === slug) return node
    const hit = findBySlug(node.children, slug)
    if (hit) return hit
  }
  return null
}

export function findById(tree, id) {
  for (const node of tree) {
    if (node.id === id) return node
    const hit = findById(node.children, id)
    if (hit) return hit
  }
  return null
}

/**
 * Id cua toan bo thu muc cha tren duong di toi `slug`, de tu bung cay khi mo deep-link.
 */
export function ancestorIdsOf(tree, slug, trail = []) {
  for (const node of tree) {
    if (node.slug === slug) return trail
    const hit = ancestorIdsOf(node.children, slug, [...trail, node.id])
    if (hit) return hit
  }
  return null
}

/**
 * Trang dau tien tim thay theo thu tu hien thi -- dung lam trang mac dinh khi vao portal.
 */
export function firstItem(tree) {
  for (const node of tree) {
    if (node.type === 'item') return node
    const hit = firstItem(node.children)
    if (hit) return hit
  }
  return null
}

/**
 * Loc cay theo tu khoa. Giu lai node khop, va giu ca thu muc nao co con khop
 * (neu khong thi ket qua nam trong thu muc bi cat mat, khong hien ra duoc).
 * Tra ve { tree, matchedFolderIds } -- id thu muc can bung san de thay ket qua.
 */
export function filterTree(tree, query) {
  const q = normalize(query)
  if (!q) return { tree, matchedFolderIds: [] }

  const openIds = []

  const walk = (nodes) => {
    const out = []
    for (const node of nodes) {
      const selfMatches = normalize(node.title).includes(q)
      const children = walk(node.children)
      if (selfMatches || children.length) {
        if (children.length) openIds.push(node.id)
        // Thu muc khop ten thi hien nguyen ven ca noi dung ben trong.
        out.push({ ...node, children: selfMatches && !children.length ? node.children : children })
      }
    }
    return out
  }

  return { tree: walk(tree), matchedFolderIds: openIds }
}
