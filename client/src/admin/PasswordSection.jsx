import { useState } from 'react'
import { Lock, LockOpen, Check, Loader2 } from 'lucide-react'

const MIN_LENGTH = 6

/**
 * Dat, doi hoac bo mat khau quan tri. Nam trong hop "Cai dat portal" vi day la
 * thiet lap cua ca portal, khong thuoc muc nao.
 *
 * Mat khau duoc bam bang scrypt o may chu; trinh duyet chi giu ban go vao trong
 * sessionStorage de gui kem moi request, va mat khi dong tab.
 */
export default function PasswordSection({ authRequired, onChange, onRemove }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError('')
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const submit = async (event) => {
    event.preventDefault()
    if (next.length < MIN_LENGTH) {
      return setError(`Mật khẩu phải dài ít nhất ${MIN_LENGTH} ký tự.`)
    }
    if (next !== confirm) {
      return setError('Hai ô mật khẩu mới không giống nhau.')
    }

    setBusy(true)
    const ok = await onChange(current, next)
    setBusy(false)
    if (ok) close()
    else setError('Không đổi được mật khẩu. Kiểm tra lại mật khẩu hiện tại.')
  }

  const remove = async () => {
    if (current.length === 0) return setError('Nhập mật khẩu hiện tại để bỏ khóa.')
    if (!window.confirm('Bỏ mật khẩu? Sau đó ai vào được máy chủ cũng sửa được nội dung.')) {
      return
    }

    setBusy(true)
    const ok = await onRemove(current)
    setBusy(false)
    if (ok) close()
    else setError('Mật khẩu hiện tại không đúng.')
  }

  return (
    <div className="border-t border-line pt-5">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] ${
            authRequired ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'
          }`}
        >
          {authRequired ? <Lock size={15} /> : <LockOpen size={15} />}
        </span>

        <div className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-fg-2">Mật khẩu quản trị</span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-fg-3">
            {authRequired
              ? 'Đang bật. Mở trang quản trị phải nhập mật khẩu; phần xem của người dùng vẫn mở bình thường.'
              : 'Chưa đặt. Bất kỳ ai vào được máy chủ đều sửa, xóa và tải nội dung lên được.'}
          </span>

          {!open && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-[7px] border border-line px-3 py-1.5 text-[13px] text-fg-2 transition hover:bg-hover hover:text-fg"
            >
              {authRequired ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-3.5 space-y-3">
          {authRequired && (
            <input
              type="password"
              autoFocus
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Mật khẩu hiện tại"
              autoComplete="current-password"
              className="w-full rounded-[7px] border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none transition focus:border-accent"
            />
          )}

          <input
            type="password"
            autoFocus={!authRequired}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={`Mật khẩu mới (ít nhất ${MIN_LENGTH} ký tự)`}
            autoComplete="new-password"
            className="w-full rounded-[7px] border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none transition focus:border-accent"
          />

          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            autoComplete="new-password"
            className="w-full rounded-[7px] border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none transition focus:border-accent"
          />

          {error && <p className="text-[12.5px] text-danger">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-[7px] bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {authRequired ? 'Đổi mật khẩu' : 'Bật khóa'}
            </button>

            <button
              type="button"
              onClick={close}
              className="rounded-[7px] px-2.5 py-2 text-[13px] text-fg-3 transition hover:text-fg"
            >
              Hủy
            </button>

            {authRequired && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="ml-auto rounded-[7px] px-2.5 py-2 text-[13px] text-fg-3 transition hover:bg-danger/10 hover:text-danger disabled:opacity-40"
              >
                Bỏ mật khẩu
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
