import Database from 'better-sqlite3'

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id    INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
  type         TEXT    NOT NULL CHECK (type IN ('folder','item')),
  title        TEXT    NOT NULL,
  slug         TEXT    NOT NULL UNIQUE,
  icon         TEXT,
  content_file TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id, sort_order);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`

// Nhom mac dinh cho mot DB moi tinh. Admin doi ten duoc ngay trong trang quan tri.
export const DEFAULT_GROUPS = ['Tài liệu', 'Biểu mẫu']

/**
 * Chi node GOC mang group_id; node con suy ra tu goc cua nhanh minh.
 * Luu ca hai noi la som muon cung lech nhau khi keo tha.
 */
function migrate(db) {
  const columns = db
    .prepare('PRAGMA table_info(nodes)')
    .all()
    .map((c) => c.name)

  if (!columns.includes('group_id')) {
    // DB tao truoc khi co tinh nang nhom. SQLite cho them cot co REFERENCES
    // mien la mac dinh NULL.
    db.exec(
      'ALTER TABLE nodes ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE',
    )
  }

  if (!columns.includes('display_mode')) {
    // 'document' = tai lieu de doc, portal dong khung nhu to giay va tu keo cao.
    // 'app'      = trang tu lo bo cuc (bang dieu khien, cong cu), chiem tron khung.
    db.exec("ALTER TABLE nodes ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'document'")
  }

  const count = db.prepare('SELECT COUNT(*) AS n FROM groups').get().n
  if (count === 0) {
    const now = new Date().toISOString()
    const insert = db.prepare(
      'INSERT INTO groups (title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?)',
    )
    DEFAULT_GROUPS.forEach((title, i) => insert.run(title, i, now, now))
  }

  // Node goc chua thuoc nhom nao thi cho vao nhom dau tien, khong de no bien mat
  // khoi cot muc luc.
  const first = db.prepare('SELECT id FROM groups ORDER BY sort_order, id LIMIT 1').get()
  db.prepare('UPDATE nodes SET group_id = ? WHERE parent_id IS NULL AND group_id IS NULL').run(
    first.id,
  )
}

/**
 * Mo mot ket noi SQLite da san sang dung.
 * Truyen ':memory:' de lay DB tam cho test.
 */
export function openDb(file) {
  const db = new Database(file)
  // Khong co dong nay thi SQLite lang le bo qua ON DELETE CASCADE.
  db.pragma('foreign_keys = ON')
  if (file !== ':memory:') db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  migrate(db)
  return db
}

export function allNodes(db) {
  return db.prepare('SELECT * FROM nodes ORDER BY sort_order, id').all()
}

export function getNode(db, id) {
  return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id)
}

export function getNodeBySlug(db, slug) {
  return db.prepare('SELECT * FROM nodes WHERE slug = ?').get(slug)
}

export function allGroups(db) {
  return db.prepare('SELECT * FROM groups ORDER BY sort_order, id').all()
}

export function getGroup(db, id) {
  return db.prepare('SELECT * FROM groups WHERE id = ?').get(id)
}

export function firstGroupId(db) {
  return db.prepare('SELECT id FROM groups ORDER BY sort_order, id LIMIT 1').get()?.id ?? null
}

/**
 * Node co that su cong khai khong: chinh no va moi thu muc cha deu phai dang bat.
 * Tat mot thu muc ma van mo duoc trang ben trong bang link truc tiep thi nut
 * an/hien chi la trang tri.
 */
export function isChainActive(db, node) {
  let current = node
  const seen = new Set()
  while (current) {
    if (!current.is_active) return false
    if (current.parent_id == null) return true
    if (seen.has(current.id)) return true // du lieu hong co vong lap, dung lai cho an toan
    seen.add(current.id)
    current = getNode(db, current.parent_id)
  }
  return true
}

/**
 * Ten portal va logo do admin dat. Luu dang key/value de sau nay them muc moi
 * khong phai doi lai cau truc bang.
 */
export const SETTING_DEFAULTS = {
  siteTitle: 'PKTSX',
  siteSubtitle: 'Cổng tài liệu',
  logoFile: null,
  // Bang settings chi chua TEXT, nen cong tac luu duoi dang '1' / '0'.
  showRecent: '0',
  // Chuoi scrypt, khong bao gio duoc tra ve cho client. Null = portal dang mo.
  adminPasswordHash: null,
}

const SETTING_KEYS = Object.keys(SETTING_DEFAULTS)

export function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const out = { ...SETTING_DEFAULTS }
  for (const key of SETTING_KEYS) {
    if (stored[key] !== undefined) out[key] = stored[key]
  }
  return out
}

export function setSetting(db, key, value) {
  if (!SETTING_KEYS.includes(key)) throw new Error('Khoa cai dat khong hop le: ' + key)
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value)
}
