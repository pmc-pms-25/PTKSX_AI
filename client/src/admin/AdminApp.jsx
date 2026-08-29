import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  FolderPlus,
  FilePlus2,
  Lock,
  AlertTriangle,
  MousePointerSquareDashed,
} from 'lucide-react'
import { api, setAdminPassword } from '../lib/api.js'
import { findById } from '../lib/treeUtils.js'
import { useToast } from '../components/Toast.jsx'
import AdminTree from './AdminTree.jsx'
import NodeForm from './NodeForm.jsx'

/** Dem ca nhanh de canh bao dung so muc se bi xoa. */
function countSubtree(node) {
  return 1 + node.children.reduce((sum, child) => sum + countSubtree(child), 0)
}

function LoginScreen({ onSubmit, error }) {
  const [value, setValue] = useState('')
  return (
    <div className="grid h-full place-items-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(value)
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-7 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/10"
      >
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Lock size={16} />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">
              Quản trị nội dung
            </h1>
            <p className="text-[12.5px] text-zinc-500">Nhập mật khẩu để tiếp tục</p>
          </div>
        </div>

        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Mật khẩu quản trị"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />

        {error && <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Đăng nhập
        </button>

        <a href="#/" className="block text-center text-[13px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          Quay lại portal
        </a>
      </form>
    </div>
  )
}

export default function AdminApp() {
  const toast = useToast()
  const [tree, setTree] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Tang len sau moi lan tai file -- de khung xem truoc nap lai thay vi giu ban cu.
  const [contentVersion, setContentVersion] = useState(0)

  const load = useCallback(async () => {
    try {
      const data = await api.adminTree()
      setTree(data.tree)
      setStatus('ready')
    } catch (err) {
      if (err.status === 401) {
        setStatus('auth')
      } else {
        setError(err.message)
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selected = useMemo(
    () => (selectedId ? findById(tree, selectedId) : null),
    [tree, selectedId],
  )

  const run = async (fn, successMessage) => {
    try {
      const result = await fn()
      if (successMessage) toast(successMessage, 'success')
      return result
    } catch (err) {
      if (err.status === 401) {
        setAdminPassword('')
        setStatus('auth')
      }
      toast(err.message, 'error')
      return null
    }
  }

  const handleLogin = async (value) => {
    setAdminPassword(value)
    try {
      const data = await api.adminTree()
      setTree(data.tree)
      setStatus('ready')
      setLoginError('')
    } catch (err) {
      setAdminPassword('')
      setLoginError(err.status === 401 ? 'Mật khẩu không đúng.' : err.message)
    }
  }

  const createNode = async (type) => {
    // Muc moi nam trong thu muc dang chon; dang chon mot trang thi nam canh trang do.
    const parentId = selected ? (selected.type === 'folder' ? selected.id : selected.parentId) : null
    const title = type === 'folder' ? 'Thư mục mới' : 'Trang mới'

    const res = await run(() => api.createNode({ type, title, parentId }), 'Đã tạo mục mới.')
    if (res) {
      setTree(res.tree)
      setSelectedId(res.node.id)
    }
  }

  const saveNode = async (patch) => {
    setSaving(true)
    const res = await run(() => api.updateNode(selected.id, patch), 'Đã lưu.')
    if (res) setTree(res.tree)
    setSaving(false)
  }

  const toggleActive = async (item) => {
    const res = await run(
      () => api.updateNode(item.id, { isActive: !item.isActive }),
      item.isActive ? 'Đã ẩn khỏi portal.' : 'Đã hiện lên portal.',
    )
    if (res) setTree(res.tree)
  }

  const deleteNode = async (item) => {
    const node = findById(tree, item.id)
    const total = node ? countSubtree(node) : 1
    const message =
      total > 1
        ? `Xóa "${item.title}" sẽ xóa luôn ${total - 1} mục bên trong. Không khôi phục lại được. Tiếp tục?`
        : `Xóa "${item.title}"? Không khôi phục lại được.`
    if (!window.confirm(message)) return

    const res = await run(() => api.deleteNode(item.id), `Đã xóa ${total} mục.`)
    if (res) {
      setTree(res.tree)
      if (selectedId === item.id) setSelectedId(null)
    }
  }

  const reorder = async (order) => {
    // Cap nhat lac quan: cay ve dung cho moi ngay, hong thi lay lai tu may chu.
    const res = await run(() => api.reorder(order))
    if (res) setTree(res.tree)
    else load()
  }

  const uploadContent = async (file) => {
    setUploading(true)
    const res = await run(
      () => api.uploadContent(selected.id, file),
      `Đã tải lên "${file.name}".`,
    )
    if (res) {
      setTree(res.tree)
      setContentVersion((v) => v + 1)
    }
    setUploading(false)
  }

  if (status === 'auth') return <LoginScreen onSubmit={handleLogin} error={loginError} />

  if (status === 'error') {
    return (
      <div className="grid h-full place-items-center bg-zinc-100 px-4 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="text-amber-500" size={30} />
          <p className="text-zinc-700 dark:text-zinc-300">{error}</p>
          <button
            onClick={() => {
              setStatus('loading')
              load()
            }}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-zinc-100 dark:bg-zinc-950">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
        <a
          href="#/"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <ArrowLeft size={15} />
          Portal
        </a>
        <span className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-100">
          Quản trị nội dung
        </span>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => createNode('folder')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-[13px] text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <FolderPlus size={15} />
            Thư mục
          </button>
          <button
            onClick={() => createNode('item')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <FilePlus2 size={15} />
            Trang
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="w-[340px] shrink-0 overflow-y-auto thin-scroll border-r border-zinc-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          {status === 'loading' ? (
            <div className="space-y-1.5">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="shimmer h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              ))}
            </div>
          ) : tree.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-zinc-400">
              Chưa có mục nào. Bấm “Thư mục” hoặc “Trang” ở trên để bắt đầu.
            </p>
          ) : (
            <AdminTree
              tree={tree}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onReorder={reorder}
              onToggleActive={toggleActive}
              onDelete={deleteNode}
            />
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto thin-scroll p-6">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                className="mx-auto max-w-xl"
              >
                <NodeForm
                  node={selected}
                  version={contentVersion}
                  onSave={saveNode}
                  onUpload={uploadContent}
                  saving={saving}
                  uploading={uploading}
                />
              </motion.div>
            ) : (
              <motion.div
                key="__none__"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full flex-col items-center justify-center gap-3 text-center"
              >
                <MousePointerSquareDashed size={32} className="text-zinc-300 dark:text-zinc-600" />
                <p className="text-[15px] text-zinc-600 dark:text-zinc-300">
                  Chọn một mục để chỉnh sửa
                </p>
                <p className="max-w-xs text-sm text-zinc-400">
                  Kéo thả để đổi thứ tự, kéo sang phải để đưa vào trong thư mục phía trên.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
