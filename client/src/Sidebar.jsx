import { useMemo } from 'react'
import { Search, X, Settings2, Layers } from 'lucide-react'
import { filterTree } from './lib/treeUtils.js'
import TreeNode from './TreeNode.jsx'

export default function Sidebar({
  tree,
  status,
  selectedSlug,
  expanded,
  onToggleFolder,
  onSelect,
  query,
  onQueryChange,
}) {
  const { tree: visible, matchedFolderIds } = useMemo(
    () => filterTree(tree, query),
    [tree, query],
  )

  // Khi dang tim kiem, thu muc chua ket qua phai bung san du nguoi dung chua bam vao.
  const effectiveExpanded = useMemo(() => {
    if (!query.trim()) return expanded
    return new Set([...expanded, ...matchedFolderIds])
  }, [expanded, matchedFolderIds, query])

  return (
    <nav className="flex h-full flex-col border-r border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-zinc-200/80 px-4 dark:border-zinc-800">
        <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
          <Layers size={15} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
          PKTSX Portal
        </span>
      </div>

      <div className="shrink-0 px-3 pb-1 pt-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Tìm mục..."
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-8 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-800"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              aria-label="Xóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto thin-scroll px-2 pb-3 pt-1">
        {status === 'loading' && (
          <div className="space-y-1.5 px-1 pt-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="shimmer h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800"
                style={{ width: `${88 - i * 6}%` }}
              />
            ))}
          </div>
        )}

        {status === 'ready' && visible.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-zinc-400">
            {query.trim() ? 'Không có mục nào khớp.' : 'Chưa có mục nào.'}
          </p>
        )}

        {visible.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            selectedSlug={selectedSlug}
            expanded={effectiveExpanded}
            onToggleFolder={onToggleFolder}
            onSelect={onSelect}
          />
        ))}
      </div>

      <a
        href="#/admin"
        className="flex shrink-0 items-center gap-2 border-t border-zinc-200/80 px-4 py-3 text-[13px] text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
      >
        <Settings2 size={15} />
        Quản trị nội dung
      </a>
    </nav>
  )
}
