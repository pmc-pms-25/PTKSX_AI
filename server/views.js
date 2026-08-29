import { allGroups, allNodes } from './db.js'
import { buildGroups } from './tree.js'

/**
 * Hinh dang duy nhat ma client nhan ve: mot mang nhom, moi nhom co cay rieng.
 * Moi route tra ve cung mot hinh dang nay de client khong phai doan.
 *
 * activeOnly = true la goc nhin cua nguoi dung (bo het muc da tat),
 * false la goc nhin cua admin (thay tat ca).
 */
export function groupsView(db, activeOnly) {
  return buildGroups(allGroups(db), allNodes(db), { activeOnly })
}
