import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Upload, Trash2, Check, Loader2, ImageIcon } from 'lucide-react'
import { initialsOf } from '../lib/settings.js'
import PasswordSection from './PasswordSection.jsx'

/** Cong tac bat/tat, dung chung cho cac lua chon hien/an. */
function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 flex h-[20px] w-[34px] shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`size-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-[14px]' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-fg-2">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-3">{hint}</span>}
      </span>
    </label>
  )
}

const MAX_LOGO_KB = 512
const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico'

/**
 * Ten portal, dong phu va logo -- nhung thu hien o goc trai thanh tren cung.
 * Tach thanh hop rieng vi day la cai dat toan portal, khong thuoc ve muc nao ca.
 */
export default function SiteSettings({
  settings,
  authRequired,
  onClose,
  onSave,
  onUploadLogo,
  onRemoveLogo,
  onChangePassword,
  onRemovePassword,
}) {
  const fileRef = useRef(null)
  const [title, setTitle] = useState(settings.siteTitle)
  const [subtitle, setSubtitle] = useState(settings.siteSubtitle)
  const [showRecent, setShowRecent] = useState(settings.showRecent)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Tai logo xong thi hop van dang mo -- dong bo lai o nhap voi gia tri moi nhat.
  useEffect(() => {
    setTitle(settings.siteTitle)
    setSubtitle(settings.siteSubtitle)
    setShowRecent(settings.showRecent)
  }, [settings.siteTitle, settings.siteSubtitle, settings.showRecent])

  const dirty =
    title !== settings.siteTitle ||
    subtitle !== settings.siteSubtitle ||
    showRecent !== settings.showRecent

  const submit = async (event) => {
    event.preventDefault()
    if (!dirty || !title.trim()) return
    setSaving(true)
    await onSave({ siteTitle: title.trim(), siteSubtitle: subtitle.trim(), showRecent })
    setSaving(false)
  }

  const pickFile = async (fileList) => {
    const file = fileList?.[0]
    if (!file) return
    setUploading(true)
    await onUploadLogo(file)
    setUploading(false)
  }

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[10vh] backdrop-blur-[3px]"
    >
      <motion.div
        role="dialog"
        aria-label="Cài đặt portal"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[480px] overflow-hidden rounded-[13px] border border-line bg-elevated shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-fg">Cài đặt portal</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-7 place-items-center rounded-md text-fg-3 transition hover:bg-hover hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <span className="mb-2 block text-[13px] font-medium text-fg-2">Logo</span>
            <div className="flex items-center gap-3.5">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Logo hiện tại"
                  className="size-12 shrink-0 rounded-[10px] border border-line object-cover"
                />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-[10px] bg-[linear-gradient(145deg,var(--ui-accent),#8b5cf6)] text-[15px] font-bold tracking-tight text-white">
                  {initialsOf(title)}
                </span>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-fg-2 transition hover:bg-hover hover:text-fg disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  {settings.logoUrl ? 'Đổi logo' : 'Tải logo lên'}
                </button>

                {settings.logoUrl && (
                  <button
                    type="button"
                    onClick={onRemoveLogo}
                    className="inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[13px] text-fg-3 transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={14} />
                    Bỏ logo
                  </button>
                )}
              </div>
            </div>

            <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-fg-3">
              <ImageIcon size={12} />
              PNG, JPG, WEBP, SVG hoặc ICO — tối đa {MAX_LOGO_KB}KB. Ảnh vuông hiển thị đẹp
              nhất.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files)
                // Cho phep chon lai dung file vua roi (vi du sau khi sua anh).
                e.target.value = ''
              }}
            />
          </div>

          <form onSubmit={submit} className="space-y-4 border-t border-line pt-5">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-fg-2">
                Tên portal
              </label>
              <input
                value={title}
                maxLength={40}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="PKTSX"
                className="w-full rounded-[7px] border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none transition focus:border-accent"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-fg-2">
                Dòng phụ
              </label>
              <input
                value={subtitle}
                maxLength={60}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Cổng tài liệu"
                className="w-full rounded-[7px] border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none transition focus:border-accent"
              />
              <p className="mt-1.5 text-[12px] text-fg-3">
                Hiện mờ bên cạnh tên portal. Để trống thì chỉ hiện tên.
              </p>
            </div>

            <div className="border-t border-line pt-4">
              <Toggle
                checked={showRecent}
                onChange={setShowRecent}
                label="Hiện mục “Mở gần đây”"
                hint="Danh sách các trang mỗi người vừa mở, nằm cuối cột mục lục và trên trang chủ. Danh sách này lưu trên máy từng người, không dùng chung."
              />
            </div>

            <button
              type="submit"
              disabled={!dirty || !title.trim() || saving}
              className="inline-flex items-center gap-1.5 rounded-[7px] bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
            >
              <Check size={15} />
              {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </form>

          <PasswordSection
            authRequired={authRequired}
            onChange={onChangePassword}
            onRemove={onRemovePassword}
          />
        </div>
      </motion.div>
    </div>
  )
}
