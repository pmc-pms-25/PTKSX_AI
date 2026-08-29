import { useMemo } from 'react'
import { motion } from 'framer-motion'

// Tieu de duoc coi la "dang doc" khi da qua khoi vach nay tinh tu dinh khung.
const READING_LINE = 96

/**
 * Cot "Trong trang nay". Danh sach tieu de do chinh tai lieu bao len:
 * noi dung nam trong iframe sandbox nen trang cha khong doc duoc DOM cua no,
 * doan script may chu chen vao se do vi tri tung tieu de roi gui ra ngoai.
 */
export default function Toc({ items, scrollTop, onJump }) {
  const activeId = useMemo(() => {
    if (items.length === 0) return null
    const line = scrollTop + READING_LINE
    let current = items[0].id
    for (const item of items) {
      if (item.absTop <= line) current = item.id
      else break
    }
    return current
  }, [items, scrollTop])

  if (items.length === 0) return null

  return (
    <nav aria-label="Trong trang này" className="thin-scroll h-full overflow-y-auto border-l border-line px-4 py-8">
      <div className="ui-eyebrow mb-2.5 px-2.5 text-fg-3">Trong trang này</div>

      <ul className="flex flex-col">
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <li key={item.id} className="relative">
              {active && (
                <motion.span
                  layoutId="toc-marker"
                  transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                  className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-accent"
                />
              )}
              <button
                onClick={() => onJump(item)}
                style={{ paddingLeft: 10 + (item.level - 1) * 12 }}
                className={`block w-full border-l border-transparent py-1.5 pr-2 text-left leading-snug transition-colors ${
                  active
                    ? 'font-medium text-accent'
                    : 'text-fg-2 hover:text-fg'
                } ${item.level > 1 ? 'text-[12px]' : 'text-[12.5px]'}`}
              >
                {item.text}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
