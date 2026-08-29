import 'dotenv/config'
import path from 'node:path'
import { openDb } from './db.js'
import { createApp } from './app.js'
import { ensureDirs, DATA_DIR, CLIENT_DIST } from './paths.js'
import fs from 'node:fs'

ensureDirs()

const db = openDb(path.join(DATA_DIR, 'portal.db'))
const app = createApp(db)
const port = Number(process.env.PORT) || 8080

if (!fs.existsSync(CLIENT_DIST)) {
  console.warn('[canh bao] Chua co client/dist. Chay `npm run build` truoc khi dung that.')
}

const server = app.listen(port, () => {
  console.log(`PKTSX Portal dang chay tai http://localhost:${port}`)
  console.log(
    process.env.ADMIN_PASSWORD
      ? '  Admin: yeu cau mat khau (ADMIN_PASSWORD da duoc dat).'
      : '  Admin: mo cho moi nguoi (ADMIN_PASSWORD dang de trong).',
  )
})

// NSSM dung service bang cach gui tin hieu; dong DB tu te de khong bo lai file WAL do dang.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      db.close()
      process.exit(0)
    })
  })
}
