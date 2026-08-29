import Database from 'better-sqlite3'

export const SCHEMA = `
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
`

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
