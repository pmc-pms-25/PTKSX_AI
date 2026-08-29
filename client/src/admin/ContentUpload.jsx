import { useRef, useState } from 'react'
import { UploadCloud, FileCheck2, Loader2 } from 'lucide-react'

/**
 * Vung tai file HTML len cho mot trang. Nhan ca bam chon lan keo-tha file vao.
 */
export default function ContentUpload({ node, onUpload, busy }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (fileList) => {
    const file = fileList?.[0]
    if (file) onUpload(file)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[13px] font-medium text-fg-2">
          Nội dung trang
        </label>
        {node.hasContent && (
          <span className="inline-flex items-center gap-1 text-[12px] text-ok">
            <FileCheck2 size={13} />
            Đã có file
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-7 text-center transition ${
          dragging
            ? 'border-accent-line bg-accent-wash/60'
            : 'border-line hover:border-fg-3 hover:bg-hover/40'
        } ${busy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
      >
        {busy ? (
          <Loader2 size={20} className="animate-spin text-fg-3" />
        ) : (
          <UploadCloud size={20} className="text-fg-3" />
        )}
        <span className="text-[13px] text-fg-2">
          {node.hasContent ? 'Tải file khác lên để thay thế' : 'Kéo file .html vào đây'}
        </span>
        <span className="text-[12px] text-fg-3">Chỉ nhận .html hoặc .htm, tối đa 5MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm,text/html"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          // Cho phep chon lai dung file vua roi (vi du sau khi sua noi dung file).
          e.target.value = ''
        }}
      />
    </div>
  )
}
