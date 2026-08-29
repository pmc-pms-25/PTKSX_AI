import { useEffect, useState } from 'react'
import { Check, ExternalLink, Folder, FileText } from 'lucide-react'
import { ICON_KEYS, iconComponent } from '../lib/icons.js'
import { api } from '../lib/api.js'
import ContentUpload from './ContentUpload.jsx'

export default function NodeForm({ node, version = 0, onSave, onUpload, saving, uploading }) {
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
      <div className="flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
        <TypeIcon size={15} className={node.type === 'folder' ? 'text-amber-500' : ''} />
        {node.type === 'folder' ? 'Thư mục' : 'Trang'}
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[11.5px] ${
            node.isActive
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'bg-zinc-500/10 text-zinc-500'
          }`}
        >
          {node.isActive ? 'Đang hiện' : 'Đang ẩn'}
        </span>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-zinc-600 dark:text-zinc-300">
            Tên hiển thị
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-zinc-600 dark:text-zinc-300">
            Đường dẫn
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-[13px] text-zinc-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <p className="mt-1.5 text-[12px] text-zinc-400">
            Đổi tên hiển thị không tự đổi đường dẫn — sửa ở đây sẽ làm hỏng các liên kết đã
            chia sẻ trước đó.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-zinc-600 dark:text-zinc-300">
            Biểu tượng
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setIcon('')}
              className={`grid size-8 place-items-center rounded-lg text-[11px] transition ${
                icon === ''
                  ? 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400'
                  : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
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
                  className={`grid size-8 place-items-center rounded-lg transition ${
                    icon === key
                      ? 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <Check size={15} />
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </form>

      {node.type === 'item' && (
        <>
          <hr className="border-zinc-200 dark:border-zinc-800" />
          <ContentUpload node={node} onUpload={onUpload} busy={uploading} />

          {node.hasContent && (
            <div className="overflow-hidden rounded-xl ring-1 ring-zinc-900/5 dark:ring-white/10">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
                <span className="text-[12px] text-zinc-500 dark:text-zinc-400">Xem trước</span>
                {node.isActive ? (
                  <a
                    href={`/content/${encodeURIComponent(node.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    <ExternalLink size={12} />
                    Tab mới
                  </a>
                ) : (
                  <span className="text-[12px] text-zinc-400">Đang ẩn khỏi portal</span>
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
