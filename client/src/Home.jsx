import { motion } from 'framer-motion'
import { ArrowRight, Clock, FolderOpen, FileText, Settings2 } from 'lucide-react'
import { iconComponent } from './lib/icons.js'
import { countTree } from './lib/treeUtils.js'

const rise = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
}

function Section({ label, children }) {
  return (
    <motion.section variants={rise} className="mt-11">
      <h2 className="ui-eyebrow mb-3 text-fg-3">{label}</h2>
      {children}
    </motion.section>
  )
}

function FolderCard({ folder, onSelect }) {
  const inner = countTree(folder.children)
  const Icon = iconComponent(folder.icon) ?? FolderOpen

  return (
    <div className="rounded-[10px] border border-line bg-surface px-4 py-4">
      <div className="flex items-center gap-2.5">
        <Icon size={16} className="shrink-0 text-accent" />
        <span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-fg">
          {folder.title}
        </span>
        <span className="tnum ml-auto shrink-0 font-mono text-[11px] text-fg-3">
          {inner.items}
        </span>
      </div>

      {folder.children.length > 0 && (
        <ul className="mt-3 space-y-0.5 border-l border-line-soft pl-3">
          {folder.children.slice(0, 4).map((child) => (
            <li key={child.id}>
              {child.type === 'item' ? (
                <button
                  onClick={() => onSelect(child)}
                  className="w-full truncate text-left text-[12.5px] text-fg-2 transition hover:text-accent"
                >
                  {child.title}
                </button>
              ) : (
                <span className="block truncate text-[12.5px] text-fg-3">{child.title}</span>
              )}
            </li>
          ))}
          {folder.children.length > 4 && (
            <li className="pt-0.5 font-mono text-[11px] text-fg-3">
              +{folder.children.length - 4} mục nữa
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function Home({ groups, status, settings, recent, onSelect }) {
  const isEmpty = groups.every((group) => group.tree.length === 0)

  return (
    <motion.div
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      className="mx-auto max-w-[768px] px-6 pb-24 pt-14 md:px-10 md:pt-20"
    >
      <motion.div variants={rise}>
        <h1 className="text-[40px] font-[680] leading-[1.1] tracking-[-0.035em] text-fg md:text-[46px]">
          {settings.siteTitle}
        </h1>
        {settings.siteSubtitle && (
          <p className="mt-3.5 max-w-lg text-[15.5px] leading-relaxed text-fg-2">
            {settings.siteSubtitle}
          </p>
        )}
      </motion.div>

      {status === 'loading' && (
        <motion.div variants={rise} className="mt-11 grid gap-2.5 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="shimmer h-[88px] rounded-[10px] border border-line bg-surface" />
          ))}
        </motion.div>
      )}

      {status === 'ready' && isEmpty && (
        <motion.div
          variants={rise}
          className="mt-11 rounded-[10px] border border-dashed border-line px-6 py-12 text-center"
        >
          <p className="text-[15px] font-medium text-fg">Chưa có tài liệu nào</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-fg-3">
            Vào trang quản trị để tạo thư mục đầu tiên và tải file HTML lên.
          </p>
          <a
            href="#/admin"
            className="mt-5 inline-flex items-center gap-1.5 rounded-[7px] bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-accent-hover"
          >
            <Settings2 size={14} />
            Mở trang quản trị
          </a>
        </motion.div>
      )}

      {recent.length > 0 && (
        <Section label="Mở gần đây">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {recent.map((node) => {
              const Icon = iconComponent(node.icon) ?? Clock
              return (
                <button
                  key={node.id}
                  onClick={() => onSelect(node)}
                  className="group flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-3.5 text-left transition hover:border-accent-line hover:bg-accent-wash"
                >
                  <Icon size={16} className="shrink-0 text-fg-3 transition group-hover:text-accent" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium tracking-[-0.015em] text-fg">
                    {node.title}
                  </span>
                  <ArrowRight
                    size={14}
                    className="shrink-0 text-fg-3 opacity-0 transition group-hover:opacity-100"
                  />
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {/* Moi nhom la mot muc rieng tren trang chu, dung ten do admin dat. */}
      {groups.map((group) => {
        if (group.tree.length === 0) return null
        const folders = group.tree.filter((node) => node.type === 'folder')
        const items = group.tree.filter((node) => node.type === 'item')

        return (
          <Section key={group.id} label={group.title}>
            {folders.length > 0 && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {folders.map((folder) => (
                  <FolderCard key={folder.id} folder={folder} onSelect={onSelect} />
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className={`flex flex-wrap gap-2 ${folders.length > 0 ? 'mt-2.5' : ''}`}>
                {items.map((node) => {
                  const Icon = iconComponent(node.icon) ?? FileText
                  return (
                    <button
                      key={node.id}
                      onClick={() => onSelect(node)}
                      className="inline-flex items-center gap-2 rounded-[7px] border border-line bg-surface px-3 py-2 text-[13px] text-fg-2 transition hover:border-accent-line hover:text-fg"
                    >
                      <Icon size={14} className="text-fg-3" />
                      {node.title}
                    </button>
                  )
                })}
              </div>
            )}
          </Section>
        )
      })}
    </motion.div>
  )
}
