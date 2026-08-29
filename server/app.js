import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { treeRoutes } from './routes/tree.js'
import { nodeRoutes } from './routes/nodes.js'
import { groupRoutes } from './routes/groups.js'
import { contentRoutes } from './routes/content.js'
import { settingsRoutes } from './routes/settings.js'
import { CLIENT_DIST } from './paths.js'

/**
 * Dung app Express quanh mot ket noi DB co san.
 * Tach khoi server.js de test co the truyen vao DB in-memory.
 */
export function createApp(db, { serveClient = true } = {}) {
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  // Middleware xac thuc can doc mat khau da bam trong DB, nen DB phai di kem request.
  app.use((req, res, next) => {
    req.db = db
    next()
  })

  app.use(treeRoutes(db))
  app.use(nodeRoutes(db))
  app.use(groupRoutes(db))
  app.use(contentRoutes(db))
  app.use(settingsRoutes(db))

  if (serveClient && fs.existsSync(CLIENT_DIST)) {
    // Noi dung tai len chay trong iframe sandbox, tuc la o mot origin rieng biet.
    // Trinh duyet coi moi request font tu do la cross-origin va chan neu khong co
    // header nay -- khong co no thi tai lieu se hien bang font he thong.
    app.use('/fonts', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      next()
    })
    app.use(express.static(CLIENT_DIST))
    // SPA dung hash routing nen chi can tra index.html cho moi duong dan con lai.
    app.get('*', (req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/content') ||
        req.path.startsWith('/branding')
      ) {
        return next()
      }
      res.sendFile(path.join(CLIENT_DIST, 'index.html'))
    })
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Khong tim thay duong dan nay.' })
  })

  // eslint-disable-next-line no-unused-vars -- Express nhan dien error handler qua so tham so
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File qua lon so voi gioi han cho phep.'
          : 'Tai file len that bai.'
      return res.status(400).json({ error: message })
    }
    const status = err.status ?? 500
    if (status >= 500) console.error(err)
    res.status(status).json({ error: err.message || 'Loi khong xac dinh o may chu.' })
  })

  return app
}
