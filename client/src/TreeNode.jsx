import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Folder, FileText } from 'lucide-react'
import { iconComponent } from './lib/icons.js'

const ROW = 'group relative flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-[13.5px] transition-colors'

export default function TreeNode({
  node,
  depth,
  selectedSlug,
  expanded,
  onToggleFolder,
  onSelect,
}) {
  const isFolder = node.type === 'folder'
  const isOpen = expanded.has(node.id)
  const isSelected = !isFolder && node.slug === selectedSlug
  const CustomIcon = iconComponent(node.icon)
  const Icon = CustomIcon ?? (isFolder ? Folder : FileText)

  const indent = 8 + depth * 14

  return (
    <div>
      <button
        onClick={() => (isFolder ? onToggleFolder(node.id) : onSelect(node))}
        style={{ paddingLeft: indent }}
        className={`${ROW} ${
          isSelected
            ? 'text-blue-700 dark:text-blue-300'
            : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
        }`}
      >
        {/* Vien chay theo muc dang chon thay vi nhay giat giua cac dong. */}
        {isSelected && (
          <motion.span
            layoutId="portal-active-pill"
            transition={{ type: 'spring', stiffness: 520, damping: 42 }}
            className="absolute inset-0 -z-10 rounded-lg bg-blue-500/10 ring-1 ring-inset ring-blue-500/25 dark:bg-blue-400/10"
          />
        )}

        {isFolder ? (
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="shrink-0 text-zinc-400"
          >
            <ChevronRight size={14} />
          </motion.span>
        ) : (
          <span className="w-[14px] shrink-0" />
        )}

        <Icon
          size={15}
          className={`shrink-0 ${
            isSelected
              ? 'text-blue-600 dark:text-blue-400'
              : isFolder
                ? 'text-amber-500/90'
                : 'text-zinc-400'
          }`}
        />
        <span className={`truncate ${isSelected ? 'font-medium' : ''}`}>{node.title}</span>
      </button>

      <AnimatePresence initial={false}>
        {isFolder && isOpen && node.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedSlug={selectedSlug}
                expanded={expanded}
                onToggleFolder={onToggleFolder}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
