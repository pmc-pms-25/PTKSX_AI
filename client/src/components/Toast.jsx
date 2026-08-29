import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

const ToastContext = createContext(() => {})

export function useToast() {
  return useContext(ToastContext)
}

const STYLES = {
  success: { Icon: CheckCircle2, tint: 'text-ok' },
  error: { Icon: XCircle, tint: 'text-danger' },
  info: { Icon: Info, tint: 'text-accent' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const push = useCallback((message, kind = 'success') => {
    const id = nextId.current++
    setToasts((list) => [...list, { id, message, kind }])
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const style = STYLES[toast.kind] ?? STYLES.info
            const { Icon } = style
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-md border border-line bg-elevated px-4 py-3 text-[13.5px] shadow-lg"
              >
                <Icon size={16} className={`mt-0.5 shrink-0 ${style.tint}`} />
                <span className="text-fg-2">{toast.message}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
