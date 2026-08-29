import { useEffect, useRef, useState } from 'react'
import { FileQuestion, Compass, ExternalLink } from 'lucide-react'

const MIN_HEIGHT = 320

function EmptyState({ Icon, title, hint }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
      <Icon size={34} className="text-zinc-300 dark:text-zinc-600" />
      <p className="text-[15px] font-medium text-zinc-700 dark:text-zinc-200">{title}</p>
      {hint && <p className="text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  )
}

export default function Viewer({ node, hasTree, status }) {
  const frameRef = useRef(null)
  const [height, setHeight] = useState(MIN_HEIGHT)
  const [loaded, setLoaded] = useState(false)

  // Doi trang thi phai tra chieu cao ve mac dinh, khong thi khung giu nguyen do dai trang cu.
  useEffect(() => {
    setLoaded(false)
    setHeight(MIN_HEIGHT)
  }, [node?.slug])

  // Iframe khong tu bao chieu cao. Doan script server chen vao noi dung se postMessage len day.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow) return
      if (event.data?.__portal !== 'height') return
      const value = Number(event.data.height)
      if (Number.isFinite(value)) setHeight(Math.max(MIN_HEIGHT, value))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
        <div className="shimmer h-[420px] rounded-2xl bg-white dark:bg-zinc-900" />
      </div>
    )
  }

  if (!node) {
    return (
      <EmptyState
        Icon={Compass}
        title={hasTree ? 'Chọn một mục ở menu bên trái' : 'Portal chưa có nội dung'}
        hint={
          hasTree
            ? 'Nội dung của mục sẽ hiện ra ở đây.'
            : 'Vào trang quản trị để tạo thư mục và trang đầu tiên.'
        }
      />
    )
  }

  if (!node.hasContent) {
    return (
      <EmptyState
        Icon={FileQuestion}
        title="Trang này chưa có nội dung"
        hint="Người quản trị cần tải file HTML lên cho mục này."
      />
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-900/5 dark:ring-white/10">
        {!loaded && (
          <div className="shimmer absolute inset-0 z-10 bg-zinc-50 dark:bg-zinc-100" />
        )}
        {/*
          sandbox co allow-scripts nhung co tinh KHONG co allow-same-origin:
          co ca hai cung luc la noi dung thoat duoc sandbox.
        */}
        <iframe
          ref={frameRef}
          key={node.slug}
          title={node.title}
          src={`/content/${encodeURIComponent(node.slug)}`}
          sandbox="allow-scripts allow-popups allow-forms allow-modals"
          onLoad={() => setLoaded(true)}
          style={{ height }}
          className="block w-full border-0 transition-[height] duration-200"
        />
      </div>

      <div className="mt-3 flex justify-end">
        <a
          href={`/content/${encodeURIComponent(node.slug)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-500 transition hover:bg-zinc-200/60 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <ExternalLink size={14} />
          Mở trong tab mới
        </a>
      </div>
    </div>
  )
}
