import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronRight,
  Folder,
  FileText,
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  CircleDot,
} from 'lucide-react'
import {
  INDENT_WIDTH,
  flatten,
  removeChildrenOf,
  getProjection,
  applyMove,
  toOrderPayload,
} from './flatten.js'
import { iconComponent } from '../lib/icons.js'

function Row({
  item,
  isSelected,
  isCollapsed,
  depthOverride,
  onSelect,
  onToggleCollapse,
  onToggleActive,
  onDelete,
  dragHandle,
  style,
  setNodeRef,
  isGhost,
}) {
  const CustomIcon = iconComponent(item.icon)
  const Icon = CustomIcon ?? (item.type === 'folder' ? Folder : FileText)
  const depth = depthOverride ?? item.depth

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, paddingLeft: depth * INDENT_WIDTH }}
      className={isGhost ? 'opacity-40' : undefined}
    >
      <div
        onClick={() => onSelect(item.id)}
        className={`group flex items-center gap-1 rounded-lg py-1.5 pl-1 pr-1.5 text-[13.5px] transition-colors ${
          isSelected
            ? 'bg-blue-500/10 text-blue-700 ring-1 ring-inset ring-blue-500/25 dark:text-blue-300'
            : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
        }`}
      >
        <button
          {...dragHandle}
          onClick={(e) => e.stopPropagation()}
          aria-label="Kéo để sắp xếp"
          className="shrink-0 cursor-grab touch-none rounded p-0.5 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-600"
        >
          <GripVertical size={14} />
        </button>

        {item.type === 'folder' && item.childCount > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(item.id)
            }}
            aria-label={isCollapsed ? 'Mở thư mục' : 'Thu gọn thư mục'}
            className="shrink-0 rounded p-0.5 text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-200"
            style={{ transform: isCollapsed ? 'none' : 'rotate(90deg)' }}
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          <span className="w-[19px] shrink-0" />
        )}

        <Icon
          size={15}
          className={`shrink-0 ${item.type === 'folder' ? 'text-amber-500/90' : 'text-zinc-400'}`}
        />

        <span
          className={`min-w-0 flex-1 truncate ${
            item.isActive ? '' : 'text-zinc-400 line-through decoration-dashed dark:text-zinc-500'
          }`}
        >
          {item.title}
        </span>

        {item.type === 'item' && !item.hasContent && (
          <span
            title="Chưa có nội dung"
            className="shrink-0 text-amber-500"
          >
            <CircleDot size={12} />
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleActive(item)
          }}
          aria-label={item.isActive ? 'Tắt mục này' : 'Bật mục này'}
          title={item.isActive ? 'Đang hiện — bấm để ẩn' : 'Đang ẩn — bấm để hiện'}
          className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-200/70 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
        >
          {item.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item)
          }}
          aria-label="Xóa mục này"
          className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function SortableRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
  })

  return (
    <Row
      {...props}
      setNodeRef={setNodeRef}
      isGhost={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragHandle={{ ...attributes, ...listeners }}
    />
  )
}

export default function AdminTree({
  tree,
  selectedId,
  onSelect,
  onReorder,
  onToggleActive,
  onDelete,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [activeId, setActiveId] = useState(null)
  const [overId, setOverId] = useState(null)
  const [offsetLeft, setOffsetLeft] = useState(0)

  const items = useMemo(() => {
    const flat = flatten(tree)
    const hidden = flat
      .filter((i) => i.childCount > 0 && collapsed.has(i.id))
      .map((i) => i.id)
    // Keo mot thu muc thi ca nhanh con di theo, khong hien rieng le trong luc keo.
    return removeChildrenOf(flat, activeId ? [activeId, ...hidden] : hidden)
  }, [tree, collapsed, activeId])

  const projection = useMemo(
    () => (activeId && overId ? getProjection(items, activeId, overId, offsetLeft) : null),
    [items, activeId, overId, offsetLeft],
  )

  const sensors = useSensors(
    // Nguong 5px de mot cu bam chon muc khong bi hieu nham thanh keo.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null

  const reset = () => {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
  }

  const toggleCollapse = (id) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={({ active }) => {
        setActiveId(active.id)
        setOverId(active.id)
      }}
      onDragMove={({ delta }) => setOffsetLeft(delta.x)}
      onDragOver={({ over }) => setOverId(over?.id ?? null)}
      onDragCancel={reset}
      onDragEnd={({ active, over }) => {
        const proj = projection
        reset()
        if (!over || !proj) return
        const moved = applyMove(items, active.id, over.id, proj)
        onReorder(toOrderPayload(moved))
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-0.5">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              isCollapsed={collapsed.has(item.id)}
              // Trong luc keo, dong dang keo hien o do sau da chieu -- thay truoc ket qua.
              depthOverride={item.id === activeId && projection ? projection.depth : undefined}
              onSelect={onSelect}
              onToggleCollapse={toggleCollapse}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <div className="rounded-lg bg-white shadow-lg ring-1 ring-zinc-900/10 dark:bg-zinc-800 dark:ring-white/10">
            <Row
              item={{ ...activeItem, depth: 0 }}
              depthOverride={0}
              isSelected={false}
              isCollapsed={false}
              onSelect={() => {}}
              onToggleCollapse={() => {}}
              onToggleActive={() => {}}
              onDelete={() => {}}
              dragHandle={{}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
