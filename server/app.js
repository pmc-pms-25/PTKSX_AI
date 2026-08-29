import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { treeRoutes } from './routes/tree.js'
import { nodeRoutes } from './routes/nodes.js'
import { contentRoutes } from './routes/content.js'
import { CLIENT_DIST } from './paths.js'

/**
 * Dung app Express quanh mot ket noi DB co san.
 * Tach khoi server.js de test co the truyen vao DB in-memory.
 */
export function createApp(db, { serveClient = true } = {}) {
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  app.use(treeRoutes(db))
  app.use(nodeRoutes(db))
  app.use(contentRoutes(db))

  if (serveClient && fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST))
    // SPA dung hash routing nen chi can tra index.html cho moi duong dan con lai.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/content')) return next()
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
          ? 'File qua lon. Gioi han la 5MB.'
          : 'Tai file len that bai.'
      return res.status(400).json({ error: message })
    }
    const status = err.status ?? 500
    if (status >= 500) console.error(err)
    res.status(status).json({ error: err.message || 'Loi khong xac dinh o may chu.' })
  })

  return app
}
