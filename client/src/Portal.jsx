import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, AlertTriangle } from 'lucide-react'
import { api } from './lib/api.js'
import { useHash, navigate } from './lib/hash.js'
import { useMediaQuery } from './lib/media.js'
import { useSettings, applyFavicon } from './lib/settings.js'
import { allRoots, locate, findBySlug, ancestorIdsOf } from './lib/treeUtils.js'
import { readRecent, pushRecent } from './lib/recent.js'
import Topbar from './components/Topbar.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import Sidebar from './Sidebar.jsx'
import Viewer from './Viewer.jsx'
import Home from './Home.jsx'
import Toc from './Toc.jsx'

const SIDEBAR_W = 252
const TOC_W = 216

export default function Portal() {
  const hash = useHash()
  const slug = hash === '/' ? '' : hash.replace(/^\//, '')

  const isDesktop = useMediaQuery('(min-width: 768px)')
  const isWide = useMediaQuery('(min-width: 1180px)')

  const scrollRef = useRef(null)
  const { settings } = useSettings()

  const [groups, setGroups] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [recentEntries, setRecentEntries] = useState(() => readRecent())
  const [outline, setOutline] = useState([])
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .publicTree()
      .then((data) => {
        if (cancelled) return
        setGroups(data.groups)
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

  // Gop cay cua moi nhom lai de tim theo slug, dieu huong truoc/sau va doc lai
  // danh sach vua mo -- nhung viec do khong quan tam trang nam o nhom nao.
  const roots = useMemo(() => allRoots(groups), [groups])

  const found = useMemo(() => (slug ? locate(groups, slug) : null), [groups, slug])
  const selected = found?.node ?? null

  // Danh sach vua mo nam trong localStorage, co the tro toi trang da bi xoa hoac da tat.
  // Doi chieu lai voi cay hien tai truoc khi hien ra.
  // Admin tat muc nay thi tra ve mang rong -- cot muc luc va trang chu tu an theo.
  const recent = useMemo(() => {
    if (!settings.showRecent) return []
    return recentEntries
      .filter((entry) => entry.slug !== slug)
      .map((entry) => findBySlug(roots, entry.slug))
      .filter(Boolean)
      .slice(0, 4)
  }, [settings.showRecent, recentEntries, roots, slug])

  // Mo deep-link toi mot trang nam sau vai lop thu muc thi phai tu bung duong di toi no.
  useEffect(() => {
    if (!slug || roots.length === 0) return
    const ancestors = ancestorIdsOf(roots, slug)
    if (ancestors?.length) {
      setExpanded((prev) => new Set([...prev, ...ancestors]))
    }
  }, [slug, roots])

  // Doi trang: dong drawer, cuon len dau, xoa muc luc cua trang cu.
  useEffect(() => {
    setDrawerOpen(false)
    setOutline([])
    setScrollTop(0)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [slug])

  useEffect(() => {
    document.title = selected ? `${selected.title} · ${settings.siteTitle}` : settings.siteTitle
    applyFavicon(settings.logoUrl)
  }, [selected, settings])

  useEffect(() => {
    if (!selected) return
    setRecentEntries(pushRecent(selected))
  }, [selected])

  // Vi tri cuon dieu khien cot "Trong trang nay". Gom ve mot lan moi khung hinh,
  // khong thi moi pixel cuon lai lam React ve lai ca cay.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrollTop(el.scrollTop)
        ticking = false
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [status])

  useEffect(() => {
    const onKey = (event) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (event.key === '/' && !typing && !paletteOpen) {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen])

  const toggleFolder = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const go = useCallback((node) => navigate(`/${node.slug}`), [])

  const jumpToHeading = useCallback((item) => {
    scrollRef.current?.scrollTo({ top: Math.max(0, item.absTop - 24), behavior: 'smooth' })
  }, [])

  const sidebar = (
    <Sidebar
      groups={groups}
      status={status}
      selectedSlug={slug}
      expanded={expanded}
      recent={recent}
      onToggleFolder={toggleFolder}
      onSelect={go}
    />
  )

  // Trang che do "ung dung" chiem tron vung ben phai: khong bo le, khong cuon o
  // ngoai (no tu cuon ben trong), va khong co cot muc luc trong trang.
  const isApp = selected?.displayMode === 'app'
  const showToc = isWide && Boolean(selected) && !isApp && outline.length > 0
  const columns = [
    isDesktop ? `${SIDEBAR_W}px` : null,
    'minmax(0,1fr)',
    showToc ? `${TOC_W}px` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex h-full flex-col bg-canvas">
      <Topbar
        settings={settings}
        showMenuButton={!isDesktop}
        onOpenMenu={() => setDrawerOpen(true)}
        onOpenSearch={() => setPaletteOpen(true)}
      />

      {status === 'loading' && (
        <div className="ui-progress relative h-0.5 shrink-0 overflow-hidden" />
      )}

      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: columns }}>
        {isDesktop && <div className="min-h-0">{sidebar}</div>}

        <main
          ref={scrollRef}
          className={`min-h-0 ${isApp ? 'overflow-hidden' : 'thin-scroll overflow-y-auto'}`}
        >
          {status === 'error' ? (
            <div className="mx-auto mt-24 flex max-w-md flex-col items-center gap-3 px-6 text-center">
              <AlertTriangle className="text-warn" size={28} />
              <p className="text-[15px] font-medium text-fg">Không tải được mục lục</p>
              <p className="text-[13.5px] text-fg-3">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-1 rounded-[7px] bg-accent px-4 py-2 text-[13px] font-medium text-white transition hover:bg-accent-hover"
              >
                Tải lại trang
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selected?.slug ?? '__home__'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                className={isApp ? 'h-full' : undefined}
              >
                {selected ? (
                  <Viewer node={selected} scrollRef={scrollRef} onOutline={setOutline} />
                ) : (
                  <Home
                    groups={groups}
                    status={status}
                    settings={settings}
                    recent={recent}
                    onSelect={go}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {showToc && (
          <div className="min-h-0">
            <Toc items={outline} scrollTop={scrollTop} onJump={jumpToHeading} />
          </div>
        )}
      </div>

      {/* Duoi 768px cot muc luc thanh drawer truot tu trai. */}
      {!isDesktop && (
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
              />
              <motion.div
                key="drawer"
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                className="fixed inset-y-0 left-0 z-50 w-[280px] shadow-lg"
              >
                {sidebar}
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Đóng mục lục"
                  className="absolute right-2 top-2.5 rounded-md p-1.5 text-fg-3 transition hover:bg-hover hover:text-fg"
                >
                  <X size={17} />
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      <CommandPalette
        open={paletteOpen}
        groups={groups}
        onClose={() => setPaletteOpen(false)}
        onSelect={go}
      />
    </div>
  )
}
