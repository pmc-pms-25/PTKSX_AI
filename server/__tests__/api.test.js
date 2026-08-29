import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import { openDb } from '../db.js'
import { createApp } from '../app.js'
import { slugify, uniqueSlug, validateOrder, buildTree, descendantIds } from '../tree.js'
import { CONTENT_DIR, resolveContentFile } from '../paths.js'

// Test chay tren DB in-memory nen khong cham vao data/portal.db that.
let db
let app

beforeEach(() => {
  delete process.env.ADMIN_PASSWORD
  db = openDb(':memory:')
  app = createApp(db, { serveClient: false })
  fs.mkdirSync(CONTENT_DIR, { recursive: true })
})

const created = []
afterAll(() => {
  for (const f of created) {
    try {
      fs.unlinkSync(f)
    } catch {
      /* da bi xoa roi */
    }
  }
})

async function addFolder(title, parentId = null) {
  const res = await request(app)
    .post('/api/admin/nodes')
    .send({ type: 'folder', title, parentId })
    .expect(201)
  return res.body.node
}

async function addItem(title, parentId = null) {
  const res = await request(app)
    .post('/api/admin/nodes')
    .send({ type: 'item', title, parentId })
    .expect(201)
  return res.body.node
}

async function attach(id, html, name = 'trang.html') {
  const res = await request(app)
    .post(`/api/admin/nodes/${id}/content`)
    .attach('file', Buffer.from(html, 'utf8'), name)
  return res
}

describe('slugify', () => {
  it('bo dau tieng Viet va chu d gach ngang', () => {
    expect(slugify('Quy trình bảo trì')).toBe('quy-trinh-bao-tri')
    expect(slugify('Đơn vị Đo lường')).toBe('don-vi-do-luong')
    expect(slugify('Kế hoạch  2026 — Quý I')).toBe('ke-hoach-2026-quy-i')
  })

  it('tieu de khong con ky tu nao dung duoc van sinh ra slug hop le', () => {
    expect(slugify('🎉🎉')).toBe('muc')
    expect(slugify('')).toBe('muc')
  })
})

describe('uniqueSlug', () => {
  it('them hau to khi trung', () => {
    const taken = new Set(['bao-cao', 'bao-cao-2'])
    expect(uniqueSlug('bao-cao', taken)).toBe('bao-cao-3')
    expect(uniqueSlug('bao-cao-khac', taken)).toBe('bao-cao-khac')
  })
})

describe('tao node', () => {
  it('hai muc cung ten van co slug khac nhau', async () => {
    const a = await addItem('Báo cáo')
    const b = await addItem('Báo cáo')
    expect(a.slug).toBe('bao-cao')
    expect(b.slug).toBe('bao-cao-2')
  })

  it('khong cho tao con ben trong mot trang', async () => {
    const item = await addItem('Trang le')
    const res = await request(app)
      .post('/api/admin/nodes')
      .send({ type: 'item', title: 'Con', parentId: item.id })
      .expect(400)
    expect(res.body.error).toMatch(/thu muc/i)
  })

  it('tu choi ten rong', async () => {
    await request(app)
      .post('/api/admin/nodes')
      .send({ type: 'folder', title: '   ' })
      .expect(400)
  })
})

describe('GET /api/tree', () => {
  it('an ca nhanh khi folder cha bi tat', async () => {
    const folder = await addFolder('Tài liệu')
    await addItem('Con A', folder.id)

    let res = await request(app).get('/api/tree').expect(200)
    expect(res.body.tree[0].children).toHaveLength(1)

    await request(app)
      .patch(`/api/admin/nodes/${folder.id}`)
      .send({ isActive: false })
      .expect(200)

    res = await request(app).get('/api/tree').expect(200)
    expect(res.body.tree).toHaveLength(0)

    // Admin van thay day du.
    const admin = await request(app).get('/api/admin/tree').expect(200)
    expect(admin.body.tree).toHaveLength(1)
    expect(admin.body.tree[0].isActive).toBe(false)
  })
})

describe('PUT /api/admin/tree/order', () => {
  it('ghi lai thu tu va cha moi', async () => {
    const f = await addFolder('Thư mục')
    const a = await addItem('A')
    const b = await addItem('B')

    await request(app)
      .put('/api/admin/tree/order')
      .send({
        order: [
          { id: f.id, parentId: null, sortOrder: 0 },
          { id: b.id, parentId: f.id, sortOrder: 0 },
          { id: a.id, parentId: f.id, sortOrder: 1 },
        ],
      })
      .expect(200)

    const res = await request(app).get('/api/admin/tree').expect(200)
    expect(res.body.tree).toHaveLength(1)
    expect(res.body.tree[0].children.map((c) => c.title)).toEqual(['B', 'A'])
  })

  it('tu choi keo thu muc vao ben trong chinh no, khong ghi gi ca', async () => {
    const parent = await addFolder('Cha')
    const child = await addFolder('Con', parent.id)

    await request(app)
      .put('/api/admin/tree/order')
      .send({
        order: [
          { id: parent.id, parentId: child.id, sortOrder: 0 },
          { id: child.id, parentId: parent.id, sortOrder: 0 },
        ],
      })
      .expect(400)

    // Cay phai con nguyen ven.
    const res = await request(app).get('/api/admin/tree').expect(200)
    expect(res.body.tree).toHaveLength(1)
    expect(res.body.tree[0].id).toBe(parent.id)
  })

  it('tu choi khi mot id khong ton tai, khong ghi phan hop le di kem', async () => {
    const a = await addItem('A')
    await request(app)
      .put('/api/admin/tree/order')
      .send({
        order: [
          { id: a.id, parentId: null, sortOrder: 9 },
          { id: 99999, parentId: null, sortOrder: 0 },
        ],
      })
      .expect(400)

    const row = db.prepare('SELECT sort_order FROM nodes WHERE id = ?').get(a.id)
    expect(row.sort_order).toBe(0)
  })

  it('khong cho dat mot trang lam cha', async () => {
    const item = await addItem('Trang')
    const other = await addItem('Khac')
    await request(app)
      .put('/api/admin/tree/order')
      .send({ order: [{ id: other.id, parentId: item.id, sortOrder: 0 }] })
      .expect(400)
  })
})

describe('upload noi dung', () => {
  it('luu file va phuc vu lai qua /content/:slug', async () => {
    const item = await addItem('Hướng dẫn')
    const res = await attach(item.id, '<h1>Xin chào</h1>')
    expect(res.status).toBe(200)

    const row = db.prepare('SELECT content_file FROM nodes WHERE id = ?').get(item.id)
    created.push(resolveContentFile(row.content_file))

    const page = await request(app).get(`/content/${item.slug}`).expect(200)
    expect(page.text).toContain('Xin chào')
    expect(page.text).toContain('__portal_reset')
    expect(page.text).toContain('__portal_bridge')
  })

  it('tu choi file khong phai html', async () => {
    const item = await addItem('Tệp lạ')
    const res = await attach(item.id, 'noi dung', 'anh.png')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/\.html/i)
  })

  it('tai len lan hai thi xoa file cu di', async () => {
    const item = await addItem('Ghi đè')
    await attach(item.id, '<p>ban cu</p>')
    const first = db.prepare('SELECT content_file FROM nodes WHERE id = ?').get(item.id)
      .content_file

    await attach(item.id, '<p>ban moi</p>')
    const second = db.prepare('SELECT content_file FROM nodes WHERE id = ?').get(item.id)
      .content_file
    created.push(resolveContentFile(second))

    expect(second).not.toBe(first)
    expect(fs.existsSync(resolveContentFile(first))).toBe(false)

    const page = await request(app).get(`/content/${item.slug}`).expect(200)
    expect(page.text).toContain('ban moi')
  })

  it('khong cho gan noi dung vao thu muc', async () => {
    const folder = await addFolder('Thư mục')
    const res = await attach(folder.id, '<p>x</p>')
    expect(res.status).toBe(400)
  })

  it('file bien mat khoi dia thi tra 404 chu khong sap server', async () => {
    const item = await addItem('Mất file')
    await attach(item.id, '<p>x</p>')
    const row = db.prepare('SELECT content_file FROM nodes WHERE id = ?').get(item.id)
    fs.unlinkSync(resolveContentFile(row.content_file))

    const page = await request(app).get(`/content/${item.slug}`).expect(404)
    expect(page.text).toMatch(/khong con tren dia/i)
  })
})

describe('muc da tat', () => {
  it('khong mo duoc bang link truc tiep, ke ca khi da co noi dung', async () => {
    const item = await addItem('Bản nháp')
    await attach(item.id, '<p>noi dung nhay cam</p>')
    created.push(
      resolveContentFile(
        db.prepare('SELECT content_file FROM nodes WHERE id = ?').get(item.id).content_file,
      ),
    )

    await request(app).get(`/content/${item.slug}`).expect(200)

    await request(app)
      .patch(`/api/admin/nodes/${item.id}`)
      .send({ isActive: false })
      .expect(200)

    const blocked = await request(app).get(`/content/${item.slug}`).expect(404)
    expect(blocked.text).not.toContain('noi dung nhay cam')
  })

  it('tat thu muc cha thi chan luon trang ben trong', async () => {
    const folder = await addFolder('Thư mục ẩn')
    const item = await addItem('Trang bên trong', folder.id)
    await attach(item.id, '<p>ben trong</p>')
    created.push(
      resolveContentFile(
        db.prepare('SELECT content_file FROM nodes WHERE id = ?').get(item.id).content_file,
      ),
    )

    await request(app).get(`/content/${item.slug}`).expect(200)

    await request(app)
      .patch(`/api/admin/nodes/${folder.id}`)
      .send({ isActive: false })
      .expect(200)

    await request(app).get(`/content/${item.slug}`).expect(404)
  })

  it('admin van xem truoc duoc noi dung cua muc dang tat', async () => {
    const item = await addItem('Chờ duyệt')
    await attach(item.id, '<p>ban thao</p>')
    created.push(
      resolveContentFile(
        db.prepare('SELECT content_file FROM nodes WHERE id = ?').get(item.id).content_file,
      ),
    )
    await request(app)
      .patch(`/api/admin/nodes/${item.id}`)
      .send({ isActive: false })
      .expect(200)

    const res = await request(app).get(`/api/admin/nodes/${item.id}/content`).expect(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.html).toContain('ban thao')
  })
})

describe('chan path traversal', () => {
  it('resolveContentFile tu choi duong dan thoat ra ngoai content/', () => {
    expect(resolveContentFile('../../server/db.js')).toBeNull()
    expect(resolveContentFile('..\\..\\server\\db.js')).toBeNull()
    expect(resolveContentFile('C:\\Windows\\win.ini')).toBeNull()
    expect(resolveContentFile('')).toBeNull()
    expect(resolveContentFile('abc.html')).not.toBeNull()
  })

  it('content_file bi sua tay thanh duong dan la thi khong doc file ngoai ra', async () => {
    const item = await addItem('Bị sửa tay')
    db.prepare('UPDATE nodes SET content_file = ? WHERE id = ?').run(
      '../../server/db.js',
      item.id,
    )
    const page = await request(app).get(`/content/${item.slug}`)
    expect(page.status).toBe(400)
    expect(page.text).not.toContain('openDb')
  })
})

describe('xoa node', () => {
  it('xoa folder thi xoa ca con chau va file noi dung kem theo', async () => {
    const folder = await addFolder('Cả nhánh')
    const sub = await addFolder('Nhánh con', folder.id)
    const item = await addItem('Trang trong nhánh', sub.id)
    await attach(item.id, '<p>noi dung</p>')

    const file = resolveContentFile(
      db.prepare('SELECT content_file FROM nodes WHERE id = ?').get(item.id).content_file,
    )
    expect(fs.existsSync(file)).toBe(true)

    const res = await request(app).delete(`/api/admin/nodes/${folder.id}`).expect(200)
    expect(res.body.deleted).toBe(3)

    expect(db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n).toBe(0)
    expect(fs.existsSync(file)).toBe(false)
  })

  it('PRAGMA foreign_keys that su dang bat tren ket noi nay', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
  })
})

describe('xac thuc admin', () => {
  it('chan /api/admin/* khi ADMIN_PASSWORD duoc dat', async () => {
    process.env.ADMIN_PASSWORD = 'bi-mat'
    await request(app).get('/api/admin/tree').expect(401)
    await request(app)
      .get('/api/admin/tree')
      .set('x-admin-password', 'bi-mat')
      .expect(200)
    // UI nguoi dung van mo binh thuong.
    await request(app).get('/api/tree').expect(200)
  })
})

describe('cac ham thuan tuy', () => {
  it('descendantIds gom du con chau', () => {
    const rows = [
      { id: 1, parent_id: null },
      { id: 2, parent_id: 1 },
      { id: 3, parent_id: 2 },
      { id: 4, parent_id: null },
    ]
    expect([...descendantIds(rows, 1)].sort()).toEqual([2, 3])
    expect([...descendantIds(rows, 4)]).toEqual([])
  })

  it('buildTree sap xep theo sort_order', () => {
    const rows = [
      { id: 1, parent_id: null, type: 'folder', title: 'F', slug: 'f', sort_order: 1, is_active: 1 },
      { id: 2, parent_id: null, type: 'item', title: 'A', slug: 'a', sort_order: 0, is_active: 1 },
    ]
    expect(buildTree(rows).map((n) => n.title)).toEqual(['A', 'F'])
  })

  it('validateOrder bat vong lap ba cap', () => {
    const ids = new Set([1, 2, 3])
    const res = validateOrder(
      [
        { id: 1, parentId: 3 },
        { id: 2, parentId: 1 },
        { id: 3, parentId: 2 },
      ],
      ids,
    )
    expect(res.ok).toBe(false)
  })
})
