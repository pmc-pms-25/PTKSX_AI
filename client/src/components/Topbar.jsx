import { Menu, Search, Settings2 } from 'lucide-react'
import { initialsOf } from '../lib/settings.js'
import ThemeToggle from './ThemeToggle.jsx'

/** Logo + ten portal. Dung chung cho ca portal lan trang quan tri. */
export function Brand({ settings, href = '#/' }) {
  return (
    <a href={href} className="flex min-w-0 items-center gap-2.5">
      {settings.logoUrl ? (
        <img
          src={settings.logoUrl}
          alt=""
          className="size-[26px] shrink-0 rounded-[7px] object-cover"
        />
      ) : (
        <span className="grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-[linear-gradient(145deg,var(--ui-accent),#8b5cf6)] text-[11px] font-bold tracking-tight text-white shadow-sm">
          {initialsOf(settings.siteTitle)}
        </span>
      )}

      <span className="truncate text-[14px] font-semibold tracking-[-0.02em] text-fg">
        {settings.siteTitle}
      </span>

      {settings.siteSubtitle && (
        <>
          <span className="hidden h-[18px] w-px shrink-0 bg-line sm:block" />
          <span className="hidden truncate text-[13px] text-fg-3 sm:block">
            {settings.siteSubtitle}
          </span>
        </>
      )}
    </a>
  )
}

export default function Topbar({ settings, onOpenSearch, onOpenMenu, showMenuButton }) {
  return (
    <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-xl">
      {showMenuButton && (
        <button
          onClick={onOpenMenu}
          aria-label="Mở mục lục"
          className="-ml-1 grid size-[30px] shrink-0 place-items-center rounded-[7px] text-fg-2 transition hover:bg-hover hover:text-fg"
        >
          <Menu size={18} />
        </button>
      )}

      <Brand settings={settings} />

      <button
        onClick={onOpenSearch}
        className="mx-auto flex h-8 w-[min(400px,38vw)] items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 text-[13px] text-fg-3 transition hover:border-fg-3 hover:bg-surface hover:text-fg-2 max-sm:w-9 max-sm:justify-center max-sm:px-0"
      >
        <Search size={15} className="shrink-0" />
        <span className="max-sm:hidden">Tìm tài liệu</span>
        <kbd className="ml-auto rounded border border-line bg-surface px-1.5 py-px font-mono text-[10.5px] text-fg-3 max-sm:hidden">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <ThemeToggle />
        <a
          href="#/admin"
          className="inline-flex h-[30px] items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] font-medium text-fg-2 transition hover:bg-hover hover:text-fg"
        >
          <Settings2 size={15} />
          <span className="max-sm:hidden">Quản trị</span>
        </a>
      </div>
    </header>
  )
}
