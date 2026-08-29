import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Pencil, Trash2, X } from 'lucide-react'

/**
 * Dong tieu de cua mot nhom trong trang quan tri: doi ten tai cho, doi thu tu,
 * va xoa. Bam vao ten se chon nhom do lam noi tao muc moi.
 */
export default function GroupHeader({
  group,
  active,
  canMoveUp,
  canMoveDown,
  canDelete,
  onActivate,
  onRename,
  onMove,
  onDelete,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group.title)
  const inputRef = useRef(null)

  useEffect(() => {
    setDraft(group.title)
  }, [group.title])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    const title = draft.trim()
    setEditing(false)
    if (!title || title === group.title) {
      setDraft(group.title)
      return
    }
    onRename(title)
  }

  if (editing) {
    return (
      <div className="mb-1.5 flex items-center gap-1 px-1">
        <input
          ref={inputRef}
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(group.title)
              setEditing(false)
            }
          }}
          className="min-w-0 flex-1 rounded-[6px] border border-accent bg-canvas px-2 py-1 text-[13px] font-medium text-fg outline-none"
        />
        <button
          onClick={commit}
          aria-label="Lưu tên nhóm"
          className="grid size-6 shrink-0 place-items-center rounded text-ok transition hover:bg-hover"
        >
          <Check size={14} />
        </button>
        <button
          onClick={() => {
            setDraft(group.title)
            setEditing(false)
          }}
          aria-label="Hủy"
          className="grid size-6 shrink-0 place-items-center rounded text-fg-3 transition hover:bg-hover hover:text-fg"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div
      className={`group mb-1.5 flex items-center gap-0.5 rounded-[6px] px-1.5 py-1 transition-colors ${
        active ? 'bg-accent-wash' : 'hover:bg-hover'
      }`}
    >
      <button
        onClick={onActivate}
        title="Chọn nhóm này để tạo mục mới"
        className={`ui-eyebrow min-w-0 flex-1 truncate py-0.5 text-left ${
          active ? 'text-accent' : 'text-fg-3'
        }`}
      >
        {group.title}
      </button>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button
          onClick={() => setEditing(true)}
          aria-label={`Đổi tên nhóm ${group.title}`}
          className="grid size-6 place-items-center rounded text-fg-3 transition hover:bg-hover hover:text-fg"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onMove(-1)}
          disabled={!canMoveUp}
          aria-label="Đưa nhóm lên trên"
          className="grid size-6 place-items-center rounded text-fg-3 transition hover:bg-hover hover:text-fg disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={!canMoveDown}
          aria-label="Đưa nhóm xuống dưới"
          className="grid size-6 place-items-center rounded text-fg-3 transition hover:bg-hover hover:text-fg disabled:opacity-25 disabled:hover:bg-transparent"
        >
          <ChevronDown size={13} />
        </button>
        <button
          onClick={onDelete}
          disabled={!canDelete}
          title={canDelete ? 'Xóa nhóm' : 'Phải còn ít nhất một nhóm'}
          aria-label={`Xóa nhóm ${group.title}`}
          className="grid size-6 place-items-center rounded text-fg-3 transition hover:bg-danger/10 hover:text-danger disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-fg-3"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
