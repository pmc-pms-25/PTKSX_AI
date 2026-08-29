/**
 * Go mat khau quan tri ra khoi DB khi quen mat khau.
 *
 *     node scripts/reset-password.js
 *
 * Sau khi chay, trang quan tri mo lai cho moi nguoi -- vao ngay Cai dat de dat
 * mat khau moi. Chay duoc lenh nay nghia la da co quyen tren may chu, tuc la da
 * doc/sua duoc file portal.db roi; no khong mo them duong nao cho nguoi ngoai.
 */
import path from 'node:path'
import Database from 'better-sqlite3'
import { DATA_DIR } from '../server/paths.js'

const file = path.join(DATA_DIR, 'portal.db')
const db = new Database(file)

const row = db.prepare("SELECT value FROM settings WHERE key = 'adminPasswordHash'").get()

if (!row?.value) {
  console.log('Portal dang khong dat mat khau trong trang quan tri.')
  console.log('Neu van bi doi mat khau thi kiem tra ADMIN_PASSWORD trong file .env.')
} else {
  db.prepare("DELETE FROM settings WHERE key = 'adminPasswordHash'").run()
  console.log('Da go mat khau quan tri khoi ' + file)
  console.log('Khoi dong lai portal roi vao Cai dat de dat mat khau moi.')
}

db.close()
