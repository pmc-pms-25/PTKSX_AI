import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

const ToastContext = createContext(() => {})

export function useToast() {
  return useContext(ToastContext)
}

const STYLES = {
  success: {
    Icon: CheckCircle2,
    ring: 'ring-emerald-500/25',
    tint: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    Icon: XCircle,
    ring: 'ring-rose-500/25',
    tint: 'text-rose-600 dark:text-rose-400',
  },
  info: {
    Icon: Info,
    ring: 'ring-sky-500/25',
    tint: 'text-sky-600 dark:text-sky-400',
  },
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
                className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl bg-white px-4 py-3 text-sm shadow-lg ring-1 ${style.ring} dark:bg-zinc-800`}
              >
                <Icon size={17} className={`mt-0.5 shrink-0 ${style.tint}`} />
                <span className="text-zinc-700 dark:text-zinc-200">{toast.message}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
