/**
 * In ra bang nodes de kiem tra nhanh trang thai du lieu.
 *     node scripts/dump-nodes.js
 */
import path from 'node:path'
import Database from 'better-sqlite3'
import { DATA_DIR } from '../server/paths.js'

const db = new Database(path.join(DATA_DIR, 'portal.db'), { readonly: true })
const rows = db
  .prepare('SELECT id, parent_id, type, title, slug, is_active, sort_order, content_file FROM nodes ORDER BY id')
  .all()

console.log(`tong so dong: ${rows.length}`)
console.log(' id  cha  loai   hien  file  thu-tu  ten')
for (const r of rows) {
  console.log(
    [
      String(r.id).padStart(3),
      String(r.parent_id ?? '-').padStart(4),
      r.type.padEnd(6),
      r.is_active ? ' ON ' : ' OFF',
      r.content_file ? ' co ' : '    ',
      String(r.sort_order).padStart(6),
      ' ' + r.title,
    ].join(' '),
  )
}
db.close()
