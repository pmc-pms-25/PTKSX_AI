/**
 * Ep tang DB chay that nhieu truy van roi dong lai, de bat cac loi native chi
 * lo ra luc don dep prepared statement.
 *
 *     node scripts/stress-db.js
 *
 * Chi doc, khong ghi gi. Thoat 0 la sach.
 */
import path from 'node:path'
import { openDb, allNodes, getSettings } from '../server/db.js'
import { groupsView } from '../server/views.js'
import { DATA_DIR } from '../server/paths.js'

const db = openDb(path.join(DATA_DIR, 'portal.db'))

let rows = 0
for (let i = 0; i < 4000; i += 1) {
  // Moi lan prepare sinh mot Statement moi roi bo cho GC don.
  db.prepare('SELECT COUNT(*) AS c FROM nodes WHERE is_active = ?').get(1)
  rows += allNodes(db).length
  getSettings(db)
  if (i % 500 === 0) groupsView(db, true)
}

console.log(`4000 vong, doc ra ${rows} dong`)
if (global.gc) {
  global.gc()
  console.log('da ep GC')
}
db.close()
console.log('db.close() xong, thoat binh thuong')
