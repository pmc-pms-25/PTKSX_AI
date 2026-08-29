import { useEffect, useRef, useState } from 'react'
import { FileQuestion, ExternalLink } from 'lucide-react'

const MIN_HEIGHT = 360

// Trang tu lo bo cuc (bang dieu khien, cong cu) khong the nam trong khung tu keo cao:
// no do minh theo khung nhin, khung lai do theo no, ket qua la ket o chieu cao toi thieu.
// Nhung trang nhu vay duoc giao tron vung ben phai va tu cuon ben trong.
const SANDBOX = 'allow-scripts allow-popups allow-forms allow-modals'

function EmptyState() {
  return (
    <div className="mx-auto max-w-[768px] px-6 py-10 md:px-10">
      <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-line px-6 py-16 text-center">
        <FileQuestion size={28} className="text-fg-3" strokeWidth={1.6} />
        <p className="text-[15px] font-medium text-fg">Tài liệu này chưa có nội dung</p>
        <p className="max-w-xs text-[13.5px] leading-relaxed text-fg-3">
          Người quản trị cần tải file HTML lên cho mục này.
        </p>
        <a
          href="#/admin"
          className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent transition hover:text-accent-hover"
        >
          <ExternalLink size={13} />
          Mở trang quản trị
        </a>
      </div>
    </div>
  )
}

export default function Viewer({ node, scrollRef, onOutline }) {
  const frameRef = useRef(null)
  const [height, setHeight] = useState(MIN_HEIGHT)
  const [loaded, setLoaded] = useState(false)

  const isApp = node.displayMode === 'app'
  const contentUrl = `/content/${encodeURIComponent(node.slug)}`

  // Doi trang thi tra chieu cao ve mac dinh, khong thi khung giu nguyen do dai trang cu.
  useEffect(() => {
    setLoaded(false)
    setHeight(MIN_HEIGHT)
    onOutline([])
  }, [node.slug, onOutline])

  useEffect(() => {
    // Che do ung dung khong dung cau noi chieu cao lan muc luc trong trang.
    if (isApp) return

    const onMessage = (event) => {
      const frame = frameRef.current
      if (!frame || event.source !== frame.contentWindow) return

      if (event.data?.__portal === 'height') {
        const value = Number(event.data.height)
        if (Number.isFinite(value)) setHeight(Math.max(MIN_HEIGHT, value))
        return
      }

      if (event.data?.__portal === 'outline' && Array.isArray(event.data.items)) {
        const container = scrollRef.current
        if (!container) return
        // Vi tri tieu de ma iframe bao la tinh tu dau tai lieu ben trong no.
        // Cong them khoang cach tu dinh vung cuon toi iframe de ra vi tri that.
        const base =
          frame.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop
        onOutline(
          event.data.items.map((item) => ({ ...item, absTop: base + Number(item.top || 0) })),
        )
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isApp, scrollRef, onOutline])

  if (!node.hasContent) return <EmptyState />

  if (isApp) {
    return (
      <div className="relative h-full bg-white">
        {!loaded && <div className="shimmer absolute inset-0 z-10 bg-white" />}
        <iframe
          ref={frameRef}
          key={node.slug}
          title={node.title}
          src={contentUrl}
          sandbox={SANDBOX}
          onLoad={() => setLoaded(true)}
          className="block h-full w-full border-0"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[768px] px-6 pb-16 pt-8 md:px-10">
      {/*
        To giay luon trang o ca hai che do giao dien. File tai len thuong la ban
        xuat tu Word, gia dinh chu den tren nen trang va chi dat mau cho mot vai
        phan -- ep chung sang nen toi la thanh khong doc noi.
      */}
      <div className="relative overflow-hidden rounded-[10px] border border-line bg-white shadow-sm dark:border-transparent dark:shadow-lg">
        {!loaded && <div className="shimmer absolute inset-0 z-10 bg-white" />}
        {/*
          sandbox co allow-scripts nhung co tinh KHONG co allow-same-origin:
          co ca hai cung luc la noi dung thoat duoc sandbox.
        */}
        <iframe
          ref={frameRef}
          key={node.slug}
          title={node.title}
          src={contentUrl}
          sandbox={SANDBOX}
          onLoad={() => setLoaded(true)}
          style={{ height }}
          className="block w-full border-0 transition-[height] duration-200"
        />
      </div>
    </div>
  )
}
