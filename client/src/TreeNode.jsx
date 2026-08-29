import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Folder, FileText } from 'lucide-react'
import { iconComponent } from './lib/icons.js'
import { highlightParts } from './lib/treeUtils.js'

const ROW =
  'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] transition-colors'

function Title({ text, query }) {
  const parts = highlightParts(text, query)
  return (
    <span className="min-w-0 truncate">
      {parts.map((part, i) =>
        part.hit ? (
          <mark key={i} className="bg-accent/15 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  )
}

export default function TreeNode({
  node,
  selectedSlug,
  expanded,
  focusedId,
  query,
  onToggleFolder,
  onSelect,
  onFocusNode,
}) {
  const isFolder = node.type === 'folder'
  const isOpen = expanded.has(node.id)
  const isSelected = !isFolder && node.slug === selectedSlug
  const CustomIcon = iconComponent(node.icon)
  const Icon = CustomIcon ?? (isFolder ? Folder : FileText)

  return (
    <li role="none">
      <button
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={isFolder ? isOpen : undefined}
        aria-current={isSelected ? 'page' : undefined}
        data-node-id={node.id}
        tabIndex={focusedId === node.id ? 0 : -1}
        onFocus={() => onFocusNode(node.id)}
        onClick={() => (isFolder ? onToggleFolder(node.id) : onSelect(node))}
        className={`${ROW} ${
          isSelected
            ? 'bg-accent-wash font-medium text-accent'
            : 'text-fg-2 hover:bg-hover hover:text-fg'
        }`}
      >
        {isFolder ? (
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="shrink-0 text-fg-3"
          >
            <ChevronRight size={13} strokeWidth={2.2} />
          </motion.span>
        ) : (
          <span className="w-[13px] shrink-0" aria-hidden="true" />
        )}

        <Icon
          size={15}
          strokeWidth={1.8}
          className={`shrink-0 ${isSelected ? 'text-accent' : 'text-fg-3'}`}
        />

        <Title text={node.title} query={query} />

        {/* Thu muc dang dong thi bao truoc ben trong co bao nhieu muc. */}
        {isFolder && !isOpen && node.children.length > 0 && (
          <span className="tnum ml-auto shrink-0 font-mono text-[10.5px] text-fg-3">
            {node.children.length}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isFolder && isOpen && node.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {/* Net ke doc noi cac muc cung mot cap -- doc cay sau van biet dang o nhanh nao. */}
            <ul role="group" className="ml-[15px] flex flex-col gap-px border-l border-line-soft pl-[9px]">
              {node.children.map((child) => (
                <TreeNode
                  key={child.id}
                  node={child}
                  selectedSlug={selectedSlug}
                  expanded={expanded}
                  focusedId={focusedId}
                  query={query}
                  onToggleFolder={onToggleFolder}
                  onSelect={onSelect}
                  onFocusNode={onFocusNode}
                />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
