import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { flattenVisible } from './lib/treeUtils.js'
import { iconComponent } from './lib/icons.js'
import TreeNode from './TreeNode.jsx'

function Eyebrow({ children, className = '' }) {
  return <div className={`ui-eyebrow px-2 text-fg-3 ${className}`}>{children}</div>
}

export default function Sidebar({
  groups,
  status,
  selectedSlug,
  expanded,
  recent,
  onToggleFolder,
  onSelect,
}) {
  const navRef = useRef(null)
  const [focusedId, setFocusedId] = useState(null)

  // Dieu huong bang phim di xuyen qua tat ca cac nhom nhu mot danh sach duy nhat,
  // dung nhu mat nguoi doc nhin thay cot muc luc.
  const rows = useMemo(
    () => groups.flatMap((group) => flattenVisible(group.tree, expanded)),
    [groups, expanded],
  )

  // Cot muc luc chi duoc co dung mot diem dung Tab. Neu muc dang giu focus bien mat
  // thi tra diem dung ve dong dau tien.
  useEffect(() => {
    if (rows.length === 0) return
    if (!rows.some((r) => r.node.id === focusedId)) {
      setFocusedId(rows[0].node.id)
    }
  }, [rows, focusedId])

  const focusNode = (id) => {
    setFocusedId(id)
    navRef.current?.querySelector('[data-node-id="' + id + '"]')?.focus()
  }

  const onKeyDown = (event) => {
    const index = rows.findIndex((r) => r.node.id === focusedId)
    if (index === -1) return
    const { node, depth } = rows[index]
    const isFolder = node.type === 'folder'
    const isOpen = expanded.has(node.id)

    const move = (to) => {
      event.preventDefault()
      if (rows[to]) focusNode(rows[to].node.id)
    }

    switch (event.key) {
      case 'ArrowDown':
        return move(index + 1)
      case 'ArrowUp':
        return move(index - 1)
      case 'Home':
        return move(0)
      case 'End':
        return move(rows.length - 1)
      case 'ArrowRight':
        if (!isFolder) return
        event.preventDefault()
        if (!isOpen) onToggleFolder(node.id)
        else if (rows[index + 1]) focusNode(rows[index + 1].node.id)
        return
      case 'ArrowLeft': {
        event.preventDefault()
        if (isFolder && isOpen) return onToggleFolder(node.id)
        // Da dong roi (hoac day la mot trang) thi nhay nguoc len thu muc cha.
        for (let i = index - 1; i >= 0; i -= 1) {
          if (rows[i].depth < depth) return focusNode(rows[i].node.id)
        }
        return
      }
      default:
    }
  }

  const visibleGroups = useMemo(
    () => groups.filter((group) => group.tree.length > 0),
    [groups],
  )

  return (
    <nav
      ref={navRef}
      onKeyDown={onKeyDown}
      className="thin-scroll h-full overflow-y-auto border-r border-line bg-surface px-2.5 pb-8 pt-3.5"
    >
      {status === 'loading' && (
        <>
          <Eyebrow className="mb-1.5">Tài liệu</Eyebrow>
          <div className="space-y-1.5 px-2 pt-1">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="shimmer h-7 rounded-md bg-hover"
                style={{ width: 92 - i * 7 + '%' }}
              />
            ))}
          </div>
        </>
      )}

      {/* Nhom rong la bo khung admin dung do, nguoi doc khong can thay. */}
      {status === 'ready' &&
        visibleGroups.map((group, index) => (
          <section key={group.id} className={index > 0 ? 'mt-6' : ''}>
            <Eyebrow className="mb-1.5">{group.title}</Eyebrow>

            <motion.ul
              role="tree"
              aria-label={group.title}
              initial="hidden"
              animate="shown"
              variants={{ shown: { transition: { staggerChildren: 0.03 } } }}
              className="flex flex-col gap-px"
            >
              {group.tree.map((node) => (
                <motion.div
                  key={node.id}
                  variants={{
                    hidden: { opacity: 0, x: -6 },
                    shown: { opacity: 1, x: 0, transition: { duration: 0.22 } },
                  }}
                >
                  <TreeNode
                    node={node}
                    selectedSlug={selectedSlug}
                    expanded={expanded}
                    focusedId={focusedId}
                    query=""
                    onToggleFolder={onToggleFolder}
                    onSelect={onSelect}
                    onFocusNode={setFocusedId}
                  />
                </motion.div>
              ))}
            </motion.ul>
          </section>
        ))}

      {recent.length > 0 && (
        <section className="mt-6">
          <Eyebrow className="mb-1.5">Mở gần đây</Eyebrow>
          <ul className="flex flex-col gap-px">
            {recent.map((node) => {
              const Icon = iconComponent(node.icon) ?? Clock
              return (
                <li key={node.id}>
                  <button
                    onClick={() => onSelect(node)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] text-fg-2 transition-colors hover:bg-hover hover:text-fg"
                  >
                    <Icon size={15} strokeWidth={1.8} className="shrink-0 text-fg-3" />
                    <span className="min-w-0 truncate">{node.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

    </nav>
  )
}
