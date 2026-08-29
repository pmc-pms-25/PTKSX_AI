/**
 * Doan lai kieu hien thi cho cac trang da tai len TRUOC khi co tinh nang nay.
 *
 *     node scripts/detect-display-mode.js          # chi xem, khong sua
 *     node scripts/detect-display-mode.js --apply  # ghi xuong DB
 *
 * Tu lan tai len sau, may chu tu doan ngay luc nhan file nen khong can chay lai.
 * Doan sai thi vao trang quan tri doi lai o muc "Kieu hien thi".
 */
import fs from 'node:fs'
import path from 'node:path'
import { openDb } from '../server/db.js'
import { looksLikeApp } from '../server/routes/content.js'
import { DATA_DIR, resolveContentFile } from '../server/paths.js'

const apply = process.argv.includes('--apply')
const db = openDb(path.join(DATA_DIR, 'portal.db'))

const rows = db
  .prepare("SELECT id, title, slug, content_file, display_mode FROM nodes WHERE content_file IS NOT NULL")
  .all()

const update = db.prepare('UPDATE nodes SET display_mode = ?, updated_at = ? WHERE id = ?')
const now = new Date().toISOString()
let changed = 0

for (const row of rows) {
  const full = resolveContentFile(row.content_file)
  if (!full || !fs.existsSync(full)) {
    console.log(`  ?  ${row.title} -- khong tim thay file`)
    continue
  }

  const guess = looksLikeApp(fs.readFileSync(full, 'utf8')) ? 'app' : 'document'
  const current = row.display_mode || 'document'

  if (guess === current) {
    console.log(`  =  ${row.title.padEnd(28)} ${current}`)
    continue
  }

  changed += 1
  console.log(`  ${apply ? '->' : '~ '} ${row.title.padEnd(28)} ${current} => ${guess}`)
  if (apply) update.run(guess, now, row.id)
}

console.log(
  changed === 0
    ? '\nKhong co gi phai doi.'
    : apply
      ? `\nDa doi ${changed} trang.`
      : `\n${changed} trang nen doi. Chay lai voi --apply de ghi xuong.`,
)

db.close()
