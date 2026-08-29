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
 * Duong di tu goc toi `slug`, tra ve chinh cac node de dung lam breadcrumb.
 */
export function trailBySlug(tree, slug, trail = []) {
  for (const node of tree) {
    if (node.slug === slug) return [...trail, node]
    const hit = trailBySlug(node.children, slug, [...trail, node])
    if (hit) return hit
  }
  return null
}

/** Dem so thu muc va so trang trong ca cay, de hien o trang chu. */
export function countTree(nodes) {
  let folders = 0
  let items = 0
  for (const node of nodes) {
    if (node.type === 'folder') folders += 1
    else items += 1
    const inner = countTree(node.children)
    folders += inner.folders
    items += inner.items
  }
  return { folders, items }
}

/**
 * Trai phang cay theo dung thu tu dang nhin thay tren man hinh (thu muc dong thi
 * bo qua phan con). Dung cho dieu huong bang phim mui ten.
 */
export function flattenVisible(nodes, expanded, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ node, depth })
    if (node.type === 'folder' && expanded.has(node.id)) {
      flattenVisible(node.children, expanded, depth + 1, out)
    }
  }
  return out
}

/**
 * Cat tieu de thanh cac doan de to sang phan khop tu khoa.
 * Phai anh xa tung ky tu vi o tim kiem bo dau: go 'bao tri' khop 'Bảo trì',
 * nhung vi tri chu cai giua chuoi da bo dau va chuoi goc khong trung nhau.
 */
export function highlightParts(title, query) {
  const text = String(title ?? '')
  const q = normalize(query)
  if (!q) return [{ text, hit: false }]

  let flat = ''
  const originIndex = []
  for (let i = 0; i < text.length; i += 1) {
    const piece = normalize(text[i])
    for (const ch of piece) {
      flat += ch
      originIndex.push(i)
    }
  }

  const at = flat.indexOf(q)
  if (at === -1) return [{ text, hit: false }]

  const start = originIndex[at]
  // +1 vi can vi tri ngay SAU ky tu cuoi cung cua doan khop.
  const end = originIndex[at + q.length - 1] + 1

  return [
    { text: text.slice(0, start), hit: false },
    { text: text.slice(start, end), hit: true },
    { text: text.slice(end), hit: false },
  ].filter((part) => part.text)
}

/**
 * Trai phang toan bo cay kem duong dan thu muc dan toi tung muc.
 * Bang lenh tim kiem can duong dan de phan biet hai trang trung ten o hai thu muc.
 */
export function flattenWithPath(nodes, path = [], out = []) {
  for (const node of nodes) {
    out.push({ node, path })
    if (node.children.length) {
      flattenWithPath(node.children, [...path, node.title], out)
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Nhom muc luc: moi nhom co ten rieng va mot cay rieng.
 * Phan lon ham o tren lam viec tren mot cay; may ham duoi day trai
 * phang nhieu nhom ve mot cho de tim kiem va dieu huong.
 * ------------------------------------------------------------------ */

/** Gop cay cua moi nhom lai thanh mot danh sach node goc duy nhat. */
export function allRoots(groups) {
  return groups.flatMap((g) => g.tree)
}

/** Tim mot trang trong moi nhom, kem duong dan va nhom chua no. */
export function locate(groups, slug) {
  for (const group of groups) {
    const trail = trailBySlug(group.tree, slug)
    if (trail) return { group, trail, node: trail[trail.length - 1] }
  }
  return null
}

/**
 * Trai phang moi nhom cho bang lenh tim kiem.
 * Duong dan bat dau bang ten nhom -- hai trang trung ten o hai nhom khac nhau
 * phai phan biet duoc ngay tren ket qua.
 */
export function flattenGroups(groups) {
  const out = []
  for (const group of groups) {
    flattenWithPath(group.tree, [group.title], out)
  }
  return out
}
