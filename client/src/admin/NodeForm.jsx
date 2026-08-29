import { useEffect, useState } from 'react'
import { Check, ExternalLink, Folder, FileText, Maximize2, ScrollText } from 'lucide-react'
import { ICON_KEYS, iconComponent } from '../lib/icons.js'
import { api } from '../lib/api.js'
import ContentUpload from './ContentUpload.jsx'

const DISPLAY_MODES = [
  {
    value: 'document',
    Icon: ScrollText,
    label: 'Tài liệu',
    hint: 'Đóng khung như tờ giấy, tự kéo cao theo nội dung. Portal chèn sẵn kiểu chữ, bảng biểu.',
  },
  {
    value: 'app',
    Icon: Maximize2,
    label: 'Toàn khung',
    hint: 'Chiếm trọn vùng bên phải và tự cuộn bên trong. Portal không chèn gì thêm. Dùng cho trang tự lo bố cục.',
  },
]

export default function NodeForm({
  node,
  version = 0,
  groups = [],
  currentGroupId = null,
  onSave,
  onUpload,
  onMoveToGroup,
  onChangeDisplayMode,
  saving,
  uploading,
}) {
  const [title, setTitle] = useState(node.title)
  const [slug, setSlug] = useState(node.slug)
  const [icon, setIcon] = useState(node.icon ?? '')
  const [preview, setPreview] = useState('')

  // Chon sang muc khac thi form phai nap lai gia tri cua muc do.
  useEffect(() => {
    setTitle(node.title)
    setSlug(node.slug)
    setIcon(node.icon ?? '')
  }, [node.id, node.title, node.slug, node.icon])

  // Lay noi dung qua API roi do vao srcdoc, thay vi tro iframe toi /content/:slug:
  // duong cong khai chan muc dang tat, ma admin thi phai xem duoc truoc khi bat len.
  useEffect(() => {
    if (node.type !== 'item' || !node.hasContent) {
      setPreview('')
      return
    }
    let cancelled = false
    api
      .rawContent(node.id)
      .then((res) => {
        if (!cancelled) setPreview(res.html)
      })
      .catch(() => {
        if (!cancelled) setPreview('')
      })
    return () => {
      cancelled = true
    }
  }, [node.id, node.type, node.hasContent, version])

  const dirty = title !== node.title || slug !== node.slug || (icon || null) !== node.icon
  const TypeIcon = node.type === 'folder' ? Folder : FileText

  const submit = (e) => {
    e.preventDefault()
    if (!dirty) return
    onSave({ title, slug, icon: icon || null })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[13px] text-fg-3">
        <TypeIcon size={15} className={node.type === 'folder' ? 'text-warn' : ''} />
        {node.type === 'folder' ? 'Thư mục' : 'Trang'}
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[11.5px] ${
            node.isActive
              ? 'bg-ok/15 text-ok'
              : 'bg-hover text-fg-3'
          }`}
        >
          {node.isActive ? 'Đang hiện' : 'Đang ẩn'}
        </span>
      </div>

      {groups.length > 1 && (
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-fg-2">Nhóm</label>
          <select
            value={currentGroupId ?? ''}
            onChange={(e) => onMoveToGroup(Number(e.target.value))}
            className="w-full rounded-[7px] border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none transition focus:border-accent"
          >
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.title}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] text-fg-3">
            Chuyển sang nhóm khác sẽ đưa mục này (và mọi mục bên trong) ra ngoài cùng của
            nhóm đó.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-fg-2">
            Tên hiển thị
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none transition focus:border-accent-line"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-fg-2">
            Đường dẫn
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-md border border-line bg-canvas px-3 py-2 font-mono text-[13px] text-fg outline-none transition focus:border-accent-line"
          />
          <p className="mt-1.5 text-[12px] text-fg-3">
            Đổi tên hiển thị không tự đổi đường dẫn — sửa ở đây sẽ làm hỏng các liên kết đã
            chia sẻ trước đó.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-fg-2">
            Biểu tượng
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setIcon('')}
              className={`grid size-8 place-items-center rounded-md text-[11px] transition ${
                icon === ''
                  ? 'bg-accent-wash text-accent ring-1 ring-accent-line/45'
                  : 'text-fg-3 hover:bg-hover/60 hover:text-fg'
              }`}
              title="Mặc định theo loại mục"
            >
              —
            </button>
            {ICON_KEYS.map((key) => {
              const Icon = iconComponent(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  title={key}
                  className={`grid size-8 place-items-center rounded-md transition ${
                    icon === key
                      ? 'bg-accent-wash text-accent ring-1 ring-accent-line/45'
                      : 'text-fg-3 hover:bg-hover/60 hover:text-fg'
                  }`}
                >
                  <Icon size={15} />
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
        >
          <Check size={15} />
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </form>

      {node.type === 'item' && (
        <>
          <hr className="border-line" />
          <ContentUpload node={node} onUpload={onUpload} busy={uploading} />

          <div>
            <span className="mb-2 block text-[13px] font-medium text-fg-2">Kiểu hiển thị</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {DISPLAY_MODES.map(({ value, Icon, label, hint }) => {
                const active = (node.displayMode ?? 'document') === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => !active && onChangeDisplayMode(value)}
                    className={`rounded-[9px] border px-3.5 py-3 text-left transition ${
                      active
                        ? 'border-accent bg-accent-wash'
                        : 'border-line hover:border-fg-3 hover:bg-hover'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={14} className={active ? 'text-accent' : 'text-fg-3'} />
                      <span
                        className={`text-[13px] font-medium ${active ? 'text-accent' : 'text-fg'}`}
                      >
                        {label}
                      </span>
                    </span>
                    <span className="mt-1 block text-[12px] leading-relaxed text-fg-3">{hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {node.hasContent && (
            <div className="overflow-hidden rounded-md border border-line">
              <div className="flex items-center justify-between border-b border-line bg-canvas px-3 py-1.5">
                <span className="text-[12px] text-fg-3">Xem trước</span>
                {node.isActive ? (
                  <a
                    href={`/content/${encodeURIComponent(node.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-fg-3 transition hover:text-fg"
                  >
                    <ExternalLink size={12} />
                    Tab mới
                  </a>
                ) : (
                  <span className="text-[12px] text-fg-3">Đang ẩn khỏi portal</span>
                )}
              </div>
              <iframe
                // srcdoc chu khong phai src: xem duoc ca muc dang tat, va noi dung tai len
                // moi hien ra ngay thay vi giu lai ban cu trong iframe.
                title={`Xem trước ${node.title}`}
                srcDoc={preview}
                sandbox="allow-scripts allow-popups allow-forms allow-modals"
                className="block h-[340px] w-full border-0 bg-white"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
