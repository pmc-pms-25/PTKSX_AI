import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import { openDb } from '../db.js'
import { createApp } from '../app.js'
import { slugify, uniqueSlug, validateOrder, buildTree, descendantIds } from '../tree.js'
import { CONTENT_DIR, BRANDING_DIR, resolveContentFile, resolveBrandingFile } from '../paths.js'
import { hashPassword, verifyPassword } from '../auth.js'
import { looksLikeApp, injectIntoHtml } from '../routes/content.js'

// Test chay tren DB in-memory nen khong cham vao data/portal.db that.
let db
let app

beforeEach(() => {
  delete process.env.ADMIN_PASSWORD
  db = openDb(':memory:')
  app = createApp(db, { serveClient: false })
  fs.mkdirSync(CONTENT_DIR, { recursive: true })
  fs.mkdirSync(BRANDING_DIR, { recursive: true })
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

/** Cay cua nhom dau tien -- phan lon test chi dung mot nhom. */
function firstTree(body) {
  return body.groups[0].tree
}

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
    expect(firstTree(res.body)[0].children).toHaveLength(1)

    await request(app)
      .patch(`/api/admin/nodes/${folder.id}`)
      .send({ isActive: false })
      .expect(200)

    res = await request(app).get('/api/tree').expect(200)
    expect(firstTree(res.body)).toHaveLength(0)

    // Admin van thay day du.
    const admin = await request(app).get('/api/admin/tree').expect(200)
    expect(firstTree(admin.body)).toHaveLength(1)
    expect(firstTree(admin.body)[0].isActive).toBe(false)
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
    expect(firstTree(res.body)).toHaveLength(1)
    expect(firstTree(res.body)[0].children.map((c) => c.title)).toEqual(['B', 'A'])
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
    expect(firstTree(res.body)).toHaveLength(1)
    expect(firstTree(res.body)[0].id).toBe(parent.id)
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

// 1x1 pixel PNG -- du de multer nhan la anh that.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

function brandingPath(logoUrl) {
  return resolveBrandingFile(decodeURIComponent(logoUrl.replace('/branding/', '')))
}

describe('cai dat portal', () => {
  it('tra ve gia tri mac dinh khi admin chua doi gi', async () => {
    const res = await request(app).get('/api/settings').expect(200)
    expect(res.body.siteTitle).toBe('PKTSX')
    expect(res.body.logoUrl).toBe(null)
  })

  it('luu ten va dong phu moi', async () => {
    await request(app)
      .put('/api/admin/settings')
      .send({ siteTitle: '  Phong Ky thuat  ', siteSubtitle: 'So tay van hanh' })
      .expect(200)

    const res = await request(app).get('/api/settings').expect(200)
    // Khoang trang thua o hai dau phai bi cat di truoc khi luu.
    expect(res.body.siteTitle).toBe('Phong Ky thuat')
    expect(res.body.siteSubtitle).toBe('So tay van hanh')
  })

  it('mac dinh tat muc "Mo gan day"', async () => {
    const res = await request(app).get('/api/settings').expect(200)
    expect(res.body.showRecent).toBe(false)
  })

  it('bat va tat lai muc "Mo gan day"', async () => {
    let res = await request(app)
      .put('/api/admin/settings')
      .send({ siteTitle: 'PKTSX', showRecent: true })
      .expect(200)
    expect(res.body.showRecent).toBe(true)

    res = await request(app)
      .put('/api/admin/settings')
      .send({ siteTitle: 'PKTSX', showRecent: false })
      .expect(200)
    expect(res.body.showRecent).toBe(false)
  })

  it('khong gui showRecent thi giu nguyen gia tri cu', async () => {
    await request(app)
      .put('/api/admin/settings')
      .send({ siteTitle: 'PKTSX', showRecent: true })
      .expect(200)

    // Luu ten portal khong duoc lam mat lua chon hien/an.
    const res = await request(app)
      .put('/api/admin/settings')
      .send({ siteTitle: 'Ten khac' })
      .expect(200)
    expect(res.body.showRecent).toBe(true)
  })

  it('tu choi ten portal de trong', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .send({ siteTitle: '   ' })
      .expect(400)
    expect(res.body.error).toMatch(/khong duoc de trong/i)
  })

  it('tai logo len roi phuc vu duoc qua /branding', async () => {
    const upload = await request(app)
      .post('/api/admin/settings/logo')
      .attach('logo', TINY_PNG, { filename: 'logo.png', contentType: 'image/png' })
      .expect(200)

    expect(upload.body.logoUrl).toMatch(/^\/branding\/.+\.png$/)
    created.push(brandingPath(upload.body.logoUrl))

    const served = await request(app).get(upload.body.logoUrl).expect(200)
    expect(served.headers['content-type']).toMatch(/image\/png/)
    expect(Buffer.from(served.body).equals(TINY_PNG)).toBe(true)
  })

  it('tai logo moi thi xoa han file logo cu', async () => {
    const first = await request(app)
      .post('/api/admin/settings/logo')
      .attach('logo', TINY_PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(200)
    const firstPath = brandingPath(first.body.logoUrl)

    const second = await request(app)
      .post('/api/admin/settings/logo')
      .attach('logo', TINY_PNG, { filename: 'b.png', contentType: 'image/png' })
      .expect(200)
    created.push(brandingPath(second.body.logoUrl))

    expect(second.body.logoUrl).not.toBe(first.body.logoUrl)
    expect(fs.existsSync(firstPath)).toBe(false)
  })

  it('bo logo thi xoa ca file lan tham chieu', async () => {
    const upload = await request(app)
      .post('/api/admin/settings/logo')
      .attach('logo', TINY_PNG, { filename: 'logo.png', contentType: 'image/png' })
      .expect(200)
    const filePath = brandingPath(upload.body.logoUrl)

    await request(app).delete('/api/admin/settings/logo').expect(200)

    expect(fs.existsSync(filePath)).toBe(false)
    const res = await request(app).get('/api/settings').expect(200)
    expect(res.body.logoUrl).toBe(null)
  })

  it('tu choi file khong phai anh', async () => {
    const res = await request(app)
      .post('/api/admin/settings/logo')
      .attach('logo', Buffer.from('<html></html>'), {
        filename: 'x.html',
        contentType: 'text/html',
      })
      .expect(400)
    expect(res.body.error).toMatch(/anh/i)
  })

  it('chan path traversal tren duong dan logo', async () => {
    expect(resolveBrandingFile('../data/portal.db')).toBe(null)
    expect(resolveBrandingFile('..\\data\\portal.db')).toBe(null)
    await request(app).get('/branding/..%2F..%2Fpackage.json').expect(404)
  })

  it('cai dat portal cung nam sau cong dang nhap', async () => {
    process.env.ADMIN_PASSWORD = 'bi-mat'
    const guarded = createApp(openDb(':memory:'), { serveClient: false })

    await request(guarded).put('/api/admin/settings').send({ siteTitle: 'X' }).expect(401)
    // Phia nguoi dung thi van doc duoc, chi khong sua duoc.
    await request(guarded).get('/api/settings').expect(200)
  })
})

describe('nhom muc luc', () => {
  async function groupList() {
    const res = await request(app).get('/api/admin/tree').expect(200)
    return res.body.groups
  }

  it('DB moi co san hai nhom mac dinh', async () => {
    const groups = await groupList()
    expect(groups.map((g) => g.title)).toEqual(['Tài liệu', 'Biểu mẫu'])
  })

  it('muc goc tao ra roi vao nhom dau tien khi khong noi ro', async () => {
    await addFolder('Quy trình')
    const groups = await groupList()
    expect(groups[0].tree.map((n) => n.title)).toEqual(['Quy trình'])
    expect(groups[1].tree).toHaveLength(0)
  })

  it('tao muc thang vao mot nhom cu the', async () => {
    const groups = await groupList()
    const target = groups[1].id

    await request(app)
      .post('/api/admin/nodes')
      .send({ type: 'folder', title: 'Biên bản', groupId: target })
      .expect(201)

    const after = await groupList()
    expect(after[0].tree).toHaveLength(0)
    expect(after[1].tree.map((n) => n.title)).toEqual(['Biên bản'])
  })

  it('tu choi tao muc vao nhom khong ton tai', async () => {
    const res = await request(app)
      .post('/api/admin/nodes')
      .send({ type: 'item', title: 'X', groupId: 9999 })
      .expect(400)
    expect(res.body.error).toMatch(/nhom khong ton tai/i)
  })

  it('doi ten nhom', async () => {
    const groups = await groupList()
    await request(app)
      .patch(`/api/admin/groups/${groups[0].id}`)
      .send({ title: '  Sổ tay vận hành  ' })
      .expect(200)

    const after = await groupList()
    expect(after[0].title).toBe('Sổ tay vận hành')
  })

  it('tu choi ten nhom de trong', async () => {
    const groups = await groupList()
    await request(app)
      .patch(`/api/admin/groups/${groups[0].id}`)
      .send({ title: '   ' })
      .expect(400)
  })

  it('them nhom moi xep xuong cuoi', async () => {
    await request(app).post('/api/admin/groups').send({ title: 'Tra cứu' }).expect(201)
    const groups = await groupList()
    expect(groups.map((g) => g.title)).toEqual(['Tài liệu', 'Biểu mẫu', 'Tra cứu'])
  })

  it('doi thu tu cac nhom', async () => {
    const groups = await groupList()
    await request(app)
      .put('/api/admin/groups/order')
      .send({ order: [groups[1].id, groups[0].id] })
      .expect(200)

    const after = await groupList()
    expect(after.map((g) => g.title)).toEqual(['Biểu mẫu', 'Tài liệu'])
  })

  it('tu choi thu tu thieu nhom', async () => {
    const groups = await groupList()
    await request(app)
      .put('/api/admin/groups/order')
      .send({ order: [groups[0].id] })
      .expect(400)
  })

  it('chuyen mot muc sang nhom khac se dua no ra ngoai cung', async () => {
    const folder = await addFolder('Quy trình')
    const child = await addItem('Con', folder.id)
    const groups = await groupList()

    await request(app)
      .patch(`/api/admin/nodes/${child.id}`)
      .send({ groupId: groups[1].id })
      .expect(200)

    const after = await groupList()
    expect(after[0].tree[0].children).toHaveLength(0)
    expect(after[1].tree.map((n) => n.title)).toEqual(['Con'])
  })

  it('keo mot muc goc sang nhom khac qua duong sap xep', async () => {
    const a = await addItem('A')
    const groups = await groupList()

    await request(app)
      .put('/api/admin/tree/order')
      .send({ order: [{ id: a.id, parentId: null, groupId: groups[1].id, sortOrder: 0 }] })
      .expect(200)

    const after = await groupList()
    expect(after[0].tree).toHaveLength(0)
    expect(after[1].tree.map((n) => n.title)).toEqual(['A'])
  })

  it('keo muc goc vao trong thu muc thi xoa nhom cua no', async () => {
    const folder = await addFolder('Thư mục')
    const a = await addItem('A')

    await request(app)
      .put('/api/admin/tree/order')
      .send({
        order: [
          { id: folder.id, parentId: null, sortOrder: 0 },
          { id: a.id, parentId: folder.id, sortOrder: 0 },
        ],
      })
      .expect(200)

    // Node con khong duoc giu group_id, neu khong no se hien o ca hai noi.
    const row = db.prepare('SELECT group_id FROM nodes WHERE id = ?').get(a.id)
    expect(row.group_id).toBe(null)
  })

  it('tu choi keo muc goc vao nhom khong ton tai', async () => {
    const a = await addItem('A')
    await request(app)
      .put('/api/admin/tree/order')
      .send({ order: [{ id: a.id, parentId: null, groupId: 9999, sortOrder: 0 }] })
      .expect(400)
  })

  it('xoa nhom la xoa ca cay ben trong lan file noi dung', async () => {
    const item = await addItem('Có file')
    await request(app)
      .post(`/api/admin/nodes/${item.id}/content`)
      .attach('file', Buffer.from('<h1>x</h1>'), 'a.html')
      .expect(200)

    const stored = db.prepare('SELECT content_file FROM nodes WHERE id = ?').get(item.id)
    const filePath = resolveContentFile(stored.content_file)
    expect(fs.existsSync(filePath)).toBe(true)

    const groups = await groupList()
    const res = await request(app).delete(`/api/admin/groups/${groups[0].id}`).expect(200)

    expect(res.body.deleted).toBe(1)
    expect(fs.existsSync(filePath)).toBe(false)
    expect(res.body.groups.map((g) => g.title)).toEqual(['Biểu mẫu'])
  })

  it('khong cho xoa nhom cuoi cung', async () => {
    const groups = await groupList()
    await request(app).delete(`/api/admin/groups/${groups[1].id}`).expect(200)

    const left = await groupList()
    expect(left).toHaveLength(1)

    const res = await request(app).delete(`/api/admin/groups/${left[0].id}`).expect(400)
    expect(res.body.error).toMatch(/it nhat mot nhom/i)
  })

  it('nhom nam sau cong dang nhap', async () => {
    process.env.ADMIN_PASSWORD = 'bi-mat'
    const guarded = createApp(openDb(':memory:'), { serveClient: false })

    await request(guarded).post('/api/admin/groups').send({ title: 'X' }).expect(401)
    // Phia nguoi dung van doc duoc cay, chi khong sua duoc nhom.
    await request(guarded).get('/api/tree').expect(200)
  })
})

describe('mat khau quan tri', () => {
  const PW = 'mat-khau-manh'

  async function lock(password = PW) {
    return request(app).put('/api/admin/password').send({ newPassword: password }).expect(200)
  }

  it('portal moi la dang mo', async () => {
    const res = await request(app).get('/api/admin/status').expect(200)
    expect(res.body.authRequired).toBe(false)
    await request(app).get('/api/admin/tree').expect(200)
  })

  it('dat mat khau xong la khoa ngay', async () => {
    const res = await lock()
    expect(res.body.authRequired).toBe(true)

    await request(app).get('/api/admin/tree').expect(401)
    await request(app).get('/api/admin/tree').set('x-admin-password', PW).expect(200)

    // Phia nguoi dung khong bi anh huong.
    await request(app).get('/api/tree').expect(200)
    const status = await request(app).get('/api/admin/status').expect(200)
    expect(status.body.authRequired).toBe(true)
  })

  it('mat khau khong bao gio ro trong DB hay trong phan hoi', async () => {
    await lock()

    const stored = db.prepare("SELECT value FROM settings WHERE key = 'adminPasswordHash'").get()
    expect(stored.value).toMatch(/^scrypt\$/)
    expect(stored.value).not.toContain(PW)

    const settings = await request(app).get('/api/settings').expect(200)
    expect(JSON.stringify(settings.body)).not.toContain(PW)
    expect(settings.body.adminPasswordHash).toBeUndefined()
  })

  it('tu choi mat khau qua ngan', async () => {
    const res = await request(app)
      .put('/api/admin/password')
      .send({ newPassword: 'abc' })
      .expect(400)
    expect(res.body.error).toMatch(/it nhat/i)
  })

  it('doi mat khau phai nhap dung mat khau cu', async () => {
    await lock()

    const wrong = await request(app)
      .put('/api/admin/password')
      .set('x-admin-password', PW)
      .send({ currentPassword: 'sai-roi', newPassword: 'mat-khau-moi' })
      .expect(400)
    expect(wrong.body.error).toMatch(/hien tai khong dung/i)

    await request(app)
      .put('/api/admin/password')
      .set('x-admin-password', PW)
      .send({ currentPassword: PW, newPassword: 'mat-khau-moi' })
      .expect(200)

    // Mat khau cu phai het hieu luc ngay.
    await request(app).get('/api/admin/tree').set('x-admin-password', PW).expect(401)
    await request(app).get('/api/admin/tree').set('x-admin-password', 'mat-khau-moi').expect(200)
  })

  it('bo mat khau tra portal ve trang thai mo', async () => {
    await lock()

    await request(app)
      .delete('/api/admin/password')
      .set('x-admin-password', PW)
      .send({ currentPassword: 'sai-roi' })
      .expect(400)

    const res = await request(app)
      .delete('/api/admin/password')
      .set('x-admin-password', PW)
      .send({ currentPassword: PW })
      .expect(200)

    expect(res.body.authRequired).toBe(false)
    await request(app).get('/api/admin/tree').expect(200)
  })

  it('ADMIN_PASSWORD trong .env van dung duoc lam duong du phong', async () => {
    process.env.ADMIN_PASSWORD = 'du-phong'
    const guarded = createApp(openDb(':memory:'), { serveClient: false })

    await request(guarded).get('/api/admin/tree').expect(401)
    await request(guarded).get('/api/admin/tree').set('x-admin-password', 'du-phong').expect(200)
  })

  it('mat khau dat trong trang quan tri de len .env', async () => {
    process.env.ADMIN_PASSWORD = 'du-phong'
    const guarded = createApp(openDb(':memory:'), { serveClient: false })

    await request(guarded)
      .put('/api/admin/password')
      .set('x-admin-password', 'du-phong')
      .send({ currentPassword: 'du-phong', newPassword: 'mat-khau-that' })
      .expect(200)

    await request(guarded).get('/api/admin/tree').set('x-admin-password', 'mat-khau-that').expect(200)
    await request(guarded).get('/api/admin/tree').set('x-admin-password', 'du-phong').expect(401)
  })

  it('ham bam: dung khop, sai khong khop, moi lan bam ra chuoi khac nhau', () => {
    const a = hashPassword(PW)
    const b = hashPassword(PW)

    expect(a).not.toBe(b) // moi lan mot muoi khac nhau
    expect(verifyPassword(PW, a)).toBe(true)
    expect(verifyPassword(PW + 'x', a)).toBe(false)
    expect(verifyPassword('', a)).toBe(false)
    expect(verifyPassword(PW, 'rac-khong-phai-hash')).toBe(false)
  })
})

describe('kieu hien thi cua trang', () => {
  const APP_HTML = '<html><head><style>html,body{margin:0;height:100%}#app{height:100vh}</style></head><body><div id="app">x</div></body></html>'
  const DOC_HTML = '<html><head><style>p{margin:0}</style></head><body><h1>Quy trinh</h1><p>abc</p></body></html>'

  async function upload(id, html) {
    return request(app)
      .post(`/api/admin/nodes/${id}/content`)
      .attach('file', Buffer.from(html), 'a.html')
      .expect(200)
  }

  it('mac dinh la kieu tai lieu', async () => {
    const item = await addItem('Trang')
    expect(item.displayMode).toBe('document')
  })

  it('tai len trang tu lo bo cuc thi tu doan ra kieu toan khung', async () => {
    const item = await addItem('Cong cu')
    const res = await upload(item.id, APP_HTML)
    expect(res.body.node.displayMode).toBe('app')
  })

  it('tai len tai lieu thuong thi van la kieu tai lieu', async () => {
    const item = await addItem('Quy trinh')
    const res = await upload(item.id, DOC_HTML)
    expect(res.body.node.displayMode).toBe('document')
  })

  it('doan tu dong khong ghi de lua chon cua admin', async () => {
    const item = await addItem('Cong cu')
    await upload(item.id, APP_HTML)

    // Admin chu y chon lai kieu tai lieu.
    await request(app)
      .patch(`/api/admin/nodes/${item.id}`)
      .send({ displayMode: 'document' })
      .expect(200)

    // Tai len lai chinh file do -- lua chon cua admin phai duoc giu.
    const res = await upload(item.id, APP_HTML)
    expect(res.body.node.displayMode).toBe('document')
  })

  it('tu choi kieu hien thi la', async () => {
    const item = await addItem('Trang')
    const res = await request(app)
      .patch(`/api/admin/nodes/${item.id}`)
      .send({ displayMode: 'fullscreen' })
      .expect(400)
    expect(res.body.error).toMatch(/document/)
  })

  it('kieu toan khung thi khong chen gi vao file', async () => {
    const item = await addItem('Cong cu')
    await upload(item.id, APP_HTML)

    const page = await request(app).get(`/content/${item.slug}`).expect(200)
    expect(page.text).toBe(APP_HTML)
    expect(page.text).not.toContain('__portal_reset')
    expect(page.text).not.toContain('__portal_bridge')
  })

  it('kieu tai lieu van duoc chen style va cau noi chieu cao', async () => {
    const item = await addItem('Quy trinh')
    await upload(item.id, DOC_HTML)

    const page = await request(app).get(`/content/${item.slug}`).expect(200)
    expect(page.text).toContain('__portal_reset')
    expect(page.text).toContain('__portal_bridge')
  })

  it('injectIntoHtml tra nguyen ven khi o kieu toan khung', () => {
    expect(injectIntoHtml(DOC_HTML, 'app')).toBe(DOC_HTML)
    expect(injectIntoHtml(DOC_HTML, 'document')).toContain('__portal_reset')
  })

  it('nhan dien: 100vh va html/body height 100% la app, con lai la tai lieu', () => {
    expect(looksLikeApp('<style>.x{height:100vh}</style>')).toBe(true)
    expect(looksLikeApp('<style>html,body{height:100%}</style>')).toBe(true)
    expect(looksLikeApp('<style>body { margin:0; height: 100% }</style>')).toBe(true)

    expect(looksLikeApp(DOC_HTML)).toBe(false)
    // Header dinh khong lam trang phu thuoc khung nhin.
    expect(looksLikeApp('<style>.bar{position:fixed;top:0}</style>')).toBe(false)
    // Khong duoc khop nham vao mot class co chua chu 'body'.
    expect(looksLikeApp('<style>.somebody{height:100%}</style>')).toBe(false)
  })
})
