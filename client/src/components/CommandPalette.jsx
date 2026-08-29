import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Folder, FileText, CornerDownLeft } from 'lucide-react'
import { iconComponent } from '../lib/icons.js'
import { normalize, flattenGroups, highlightParts } from '../lib/treeUtils.js'

const MAX_RESULTS = 12

function Highlight({ text, query }) {
  return highlightParts(text, query).map((part, i) =>
    part.hit ? (
      <strong key={i} className="font-semibold text-fg">
        {part.text}
      </strong>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  )
}

function Row({ entry, query, active, onPick, onHover }) {
  const { node, path } = entry
  const Icon = iconComponent(node.icon) ?? (node.type === 'folder' ? Folder : FileText)

  return (
    <button
      onClick={() => onPick(entry)}
      onMouseMove={onHover}
      className={`flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13.5px] transition-colors ${
        active ? 'bg-accent-wash text-accent' : 'text-fg-2'
      }`}
    >
      <Icon size={15} className="shrink-0" />
      <span className="min-w-0 truncate">
        <Highlight text={node.title} query={query} />
      </span>
      <span className="ml-auto shrink-0 truncate pl-3 text-[11.5px] text-fg-3">
        {node.type === 'folder'
          ? `${node.children.length} mục`
          : path.join(' / ')}
      </span>
    </button>
  )
}

export default function CommandPalette({ open, groups, onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const entries = useMemo(() => flattenGroups(groups), [groups])

  const results = useMemo(() => {
    const q = normalize(query)
    // Chua go gi thi goi y cac trang dau tien thay vi de trong.
    const pool = q ? entries.filter((e) => normalize(e.node.title).includes(q)) : entries
    // Trang xep truoc thu muc: nguoi dung tim tai lieu la chinh.
    const items = pool.filter((e) => e.node.type === 'item')
    const folders = pool.filter((e) => e.node.type === 'folder')
    return [...items, ...folders].slice(0, MAX_RESULTS)
  }, [entries, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    // Doi hop ve xong roi moi dat con tro, khong thi trinh duyet cuon giat mot cai.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    setCursor(0)
  }, [query])

  // Di chuyen bang phim thi dong dang chon phai tu cuon vao tam nhin.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-row="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor, results])

  if (!open) return null

  const pick = (entry) => {
    onClose()
    if (entry.node.type === 'item') onSelect(entry.node)
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => (results.length ? (c + 1) % results.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (results[cursor]) pick(results[cursor])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.14 }}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[14vh] backdrop-blur-[3px]"
      >
        <motion.div
          role="dialog"
          aria-label="Tìm tài liệu"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          onKeyDown={onKeyDown}
          className="w-full max-w-[560px] overflow-hidden rounded-[13px] border border-line bg-elevated shadow-lg"
        >
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
            <Search size={16} className="shrink-0 text-fg-3" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên tài liệu…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-3"
            />
            <kbd className="shrink-0 rounded border border-line bg-surface px-1.5 py-px font-mono text-[10.5px] text-fg-3">
              Esc
            </kbd>
          </div>

          <div ref={listRef} className="thin-scroll max-h-[340px] overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-10 text-center text-[13.5px] text-fg-3">
                Không có tài liệu nào khớp.
              </p>
            ) : (
              results.map((entry, i) => (
                <div key={`${entry.node.type}-${entry.node.id}`} data-row={i}>
                  <Row
                    entry={entry}
                    query={query}
                    active={i === cursor}
                    onPick={pick}
                    onHover={() => setCursor(i)}
                  />
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3.5 border-t border-line px-4 py-2 text-[11.5px] text-fg-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono">↑↓</kbd> chọn
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft size={11} /> mở
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono">esc</kbd> đóng
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
