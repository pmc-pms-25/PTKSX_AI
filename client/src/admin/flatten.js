import { arrayMove } from '@dnd-kit/sortable'

export const INDENT_WIDTH = 22

/**
 * dnd-kit sap xep tren mot danh sach phang, khong lam viec truc tiep voi cay.
 * Nen cay duoc trai phang ra de keo-tha, roi tinh nguoc lai parent tu do thut dau dong.
 */
export function flatten(tree, parentId = null, depth = 0, out = []) {
  for (const node of tree) {
    out.push({
      id: node.id,
      parentId,
      depth,
      type: node.type,
      title: node.title,
      slug: node.slug,
      icon: node.icon,
      isActive: node.isActive,
      hasContent: node.hasContent,
      childCount: node.children.length,
    })
    flatten(node.children, node.id, depth + 1, out)
  }
  return out
}

/** Con chau cua node dang keo (va cua thu muc dang thu gon) khong duoc hien trong danh sach. */
export function removeChildrenOf(items, ids) {
  const excluded = [...ids]
  return items.filter((item) => {
    if (item.parentId != null && excluded.includes(item.parentId)) {
      if (item.childCount > 0) excluded.push(item.id)
      return false
    }
    return true
  })
}

function maxDepthAfter(previousItem) {
  if (!previousItem) return 0
  // Chi thu muc moi nhan con -- keo vao mot trang thi dung o cung cap voi no.
  return previousItem.type === 'folder' ? previousItem.depth + 1 : previousItem.depth
}

function minDepthBefore(nextItem) {
  return nextItem ? nextItem.depth : 0
}

/**
 * Tu vi tri tha va do lech ngang cua chuot, suy ra node se nam o cap nao va thuoc thu muc nao.
 */
export function getProjection(items, activeId, overId, dragOffset, indentWidth = INDENT_WIDTH) {
  const overIndex = items.findIndex((i) => i.id === overId)
  const activeIndex = items.findIndex((i) => i.id === activeId)
  if (overIndex === -1 || activeIndex === -1) return null

  const activeItem = items[activeIndex]
  const moved = arrayMove(items, activeIndex, overIndex)
  const previousItem = moved[overIndex - 1]
  const nextItem = moved[overIndex + 1]

  const dragDepth = Math.round(dragOffset / indentWidth)
  const projectedDepth = activeItem.depth + dragDepth
  const maxDepth = maxDepthAfter(previousItem)
  const minDepth = minDepthBefore(nextItem)

  let depth = projectedDepth
  if (projectedDepth >= maxDepth) depth = maxDepth
  else if (projectedDepth < minDepth) depth = minDepth

  const parentId = (() => {
    if (depth === 0 || !previousItem) return null
    if (depth === previousItem.depth) return previousItem.parentId
    if (depth > previousItem.depth) return previousItem.id
    // Tha lui ve trai vai cap: tim lai nguoi anh gan nhat o dung cap do.
    const sibling = moved
      .slice(0, overIndex)
      .reverse()
      .find((item) => item.depth === depth)
    return sibling?.parentId ?? null
  })()

  return { depth, maxDepth, minDepth, parentId }
}

/**
 * Ap ket qua keo-tha len danh sach phang, tra ve danh sach moi da doi cha va thu tu.
 */
export function applyMove(items, activeId, overId, projection) {
  const activeIndex = items.findIndex((i) => i.id === activeId)
  const overIndex = items.findIndex((i) => i.id === overId)
  if (activeIndex === -1 || overIndex === -1 || !projection) return items

  const moved = arrayMove(items, activeIndex, overIndex)
  const at = moved.findIndex((i) => i.id === activeId)
  moved[at] = { ...moved[at], parentId: projection.parentId, depth: projection.depth }
  return moved
}

/**
 * Doi danh sach phang thanh payload cho PUT /api/admin/tree/order.
 * sortOrder duoc danh lai tu 0 trong pham vi tung thu muc cha.
 *
 * groupId chi gan cho node goc. Node nam trong thu muc suy nhom tu goc cua nhanh
 * minh, va may chu se xoa group_id cua no ve NULL.
 */
export function toOrderPayload(items, groupId) {
  const counters = new Map()
  return items.map((item) => {
    const key = item.parentId ?? '__root__'
    const next = counters.get(key) ?? 0
    counters.set(key, next + 1)
    return {
      id: item.id,
      parentId: item.parentId,
      sortOrder: next,
      ...(item.parentId == null ? { groupId } : {}),
    }
  })
}
