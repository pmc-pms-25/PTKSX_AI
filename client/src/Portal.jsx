import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, AlertTriangle } from 'lucide-react'
import { api } from './lib/api.js'
import { useHash, navigate } from './lib/hash.js'
import { findBySlug, ancestorIdsOf } from './lib/treeUtils.js'
import Sidebar from './Sidebar.jsx'
import Viewer from './Viewer.jsx'

export default function Portal() {
  const hash = useHash()
  const slug = hash === '/' ? '' : hash.replace(/^\//, '')

  const [tree, setTree] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .publicTree()
      .then((data) => {
        if (cancelled) return
        setTree(data.tree)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Mo deep-link toi mot trang nam sau vai lop thu muc thi phai tu bung duong di toi no.
  useEffect(() => {
    if (!slug || tree.length === 0) return
    const ancestors = ancestorIdsOf(tree, slug)
    if (ancestors?.length) {
      setExpanded((prev) => new Set([...prev, ...ancestors]))
    }
  }, [slug, tree])

  // Chon trang khac thi dong drawer tren dien thoai.
  useEffect(() => {
    setDrawerOpen(false)
  }, [slug])

  const selected = useMemo(() => (slug ? findBySlug(tree, slug) : null), [tree, slug])

  const toggleFolder = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sidebar = (
    <Sidebar
      tree={tree}
      status={status}
      selectedSlug={slug}
      expanded={expanded}
      onToggleFolder={toggleFolder}
      onSelect={(node) => navigate(`/${node.slug}`)}
      query={query}
      onQueryChange={setQuery}
    />
  )

  return (
    <div className="flex h-full bg-zinc-100 dark:bg-zinc-950">
      {/* Sidebar co dinh tu man hinh tablet tro len. */}
      <div className="hidden w-[280px] shrink-0 md:block">{sidebar}</div>

      {/* Duoi 768px sidebar thanh drawer truot tu trai. */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm md:hidden"
            />
            <motion.div
              key="drawer"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] md:hidden"
            >
              {sidebar}
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Dong menu"
                className="absolute right-2 top-3 rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60"
              >
                <X size={18} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-white/70 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Mo menu"
            className="rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-100 md:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Menu size={19} />
          </button>
          <h1 className="truncate text-[15px] font-medium text-zinc-800 dark:text-zinc-100">
            {selected?.title ?? 'PKTSX Portal'}
          </h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
          {status === 'error' ? (
            <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 px-6 text-center">
              <AlertTriangle className="text-amber-500" size={30} />
              <p className="text-zinc-700 dark:text-zinc-300">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Tải lại
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selected?.slug ?? '__home__'}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              >
                <Viewer node={selected} hasTree={tree.length > 0} status={status} />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  )
}
