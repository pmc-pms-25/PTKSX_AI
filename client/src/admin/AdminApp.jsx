import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  FolderPlus,
  FilePlus2,
  Lock,
  AlertTriangle,
  MousePointerSquareDashed,
  SlidersHorizontal,
  Plus,
} from 'lucide-react'
import { api, setAdminPassword } from '../lib/api.js'
import { findById, allRoots } from '../lib/treeUtils.js'
import { useSettings, applyFavicon } from '../lib/settings.js'
import { useToast } from '../components/Toast.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { Brand } from '../components/Topbar.jsx'
import AdminTree from './AdminTree.jsx'
import NodeForm from './NodeForm.jsx'
import SiteSettings from './SiteSettings.jsx'
import GroupHeader from './GroupHeader.jsx'

/** Node co nam trong cay nay khong -- dung de biet muc dang chon thuoc nhom nao. */
function containsNode(nodes, id) {
  return nodes.some((node) => node.id === id || containsNode(node.children, id))
}

/** Dem ca nhanh de canh bao dung so muc se bi xoa. */
function countSubtree(node) {
  return 1 + node.children.reduce((sum, child) => sum + countSubtree(child), 0)
}

function LoginScreen({ onSubmit, error }) {
  const [value, setValue] = useState('')
  return (
    <div className="grid h-full place-items-center bg-canvas px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(value)
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-elevated p-7 shadow-lg"
      >
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-md bg-accent text-white">
            <Lock size={16} />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight text-fg">
              Quản trị nội dung
            </h1>
            <p className="text-[12.5px] text-fg-3">Nhập mật khẩu để tiếp tục</p>
          </div>
        </div>

        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Mật khẩu quản trị"
          className="w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none transition focus:border-accent-line"
        />

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-accent py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          Đăng nhập
        </button>

        <a href="#/" className="block text-center text-[13px] text-fg-3 transition hover:text-fg">
          Quay lại portal
        </a>
      </form>
    </div>
  )
}

export default function AdminApp() {
  const toast = useToast()
  const [groups, setGroups] = useState([])
  // Nhom se nhan muc moi khi khong co muc nao dang duoc chon.
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Tang len sau moi lan tai file -- de khung xem truoc nap lai thay vi giu ban cu.
  const [contentVersion, setContentVersion] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const { settings, setSettings } = useSettings()

  const load = useCallback(async () => {
    try {
      const data = await api.adminTree()
      setGroups(data.groups)
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

  // Hop cai dat can biet portal dang khoa hay dang mo de hien dung nut.
  useEffect(() => {
    api
      .adminStatus()
      .then((res) => setAuthRequired(res.authRequired))
      .catch(() => setAuthRequired(false))
  }, [status])

  const roots = useMemo(() => allRoots(groups), [groups])

  const selected = useMemo(
    () => (selectedId ? findById(roots, selectedId) : null),
    [roots, selectedId],
  )

  // Muc dang chon quyet dinh nhom dang lam viec; khong chon gi thi dung nhom da bam,
  // cuoi cung moi den nhom dau tien.
  const targetGroup = useMemo(() => {
    if (selected) {
      const owner = groups.find((g) => containsNode(g.tree, selected.id))
      if (owner) return owner
    }
    return groups.find((g) => g.id === activeGroupId) ?? groups[0] ?? null
  }, [groups, selected, activeGroupId])

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
      setGroups(data.groups)
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

    const res = await run(
      () => api.createNode({ type, title, parentId, groupId: targetGroup?.id ?? null }),
      'Đã tạo mục mới.',
    )
    if (res) {
      setGroups(res.groups)
      setSelectedId(res.node.id)
    }
  }

  const saveNode = async (patch) => {
    setSaving(true)
    const res = await run(() => api.updateNode(selected.id, patch), 'Đã lưu.')
    if (res) setGroups(res.groups)
    setSaving(false)
  }

  const toggleActive = async (item) => {
    const res = await run(
      () => api.updateNode(item.id, { isActive: !item.isActive }),
      item.isActive ? 'Đã ẩn khỏi portal.' : 'Đã hiện lên portal.',
    )
    if (res) setGroups(res.groups)
  }

  const deleteNode = async (item) => {
    const node = findById(roots, item.id)
    const total = node ? countSubtree(node) : 1
    const message =
      total > 1
        ? `Xóa "${item.title}" sẽ xóa luôn ${total - 1} mục bên trong. Không khôi phục lại được. Tiếp tục?`
        : `Xóa "${item.title}"? Không khôi phục lại được.`
    if (!window.confirm(message)) return

    const res = await run(() => api.deleteNode(item.id), `Đã xóa ${total} mục.`)
    if (res) {
      setGroups(res.groups)
      if (selectedId === item.id) setSelectedId(null)
    }
  }

  const reorder = async (order) => {
    // Cap nhat lac quan: cay ve dung cho moi ngay, hong thi lay lai tu may chu.
    const res = await run(() => api.reorder(order))
    if (res) setGroups(res.groups)
    else load()
  }

  const addGroup = async () => {
    const res = await run(() => api.createGroup('Nhóm mới'), 'Đã tạo nhóm mới.')
    if (res) {
      setGroups(res.groups)
      setActiveGroupId(res.groupId)
      setSelectedId(null)
    }
  }

  const renameGroup = async (group, title) => {
    const res = await run(() => api.renameGroup(group.id, title), 'Đã đổi tên nhóm.')
    if (res) setGroups(res.groups)
  }

  const moveGroup = async (group, delta) => {
    const order = groups.map((g) => g.id)
    const at = order.indexOf(group.id)
    const to = at + delta
    if (to < 0 || to >= order.length) return
    order.splice(to, 0, ...order.splice(at, 1))

    const res = await run(() => api.reorderGroups(order))
    if (res) setGroups(res.groups)
    else load()
  }

  const deleteGroup = async (group) => {
    const total = group.tree.reduce((sum, node) => sum + countSubtree(node), 0)
    const message =
      total > 0
        ? `Xóa nhóm \"${group.title}\" sẽ xóa luôn ${total} mục bên trong. Không khôi phục lại được. Tiếp tục?`
        : `Xóa nhóm \"${group.title}\"?`
    if (!window.confirm(message)) return

    const res = await run(() => api.deleteGroup(group.id), 'Đã xóa nhóm.')
    if (res) {
      setGroups(res.groups)
      setSelectedId(null)
      setActiveGroupId(null)
    }
  }

  const changeDisplayMode = async (displayMode) => {
    const res = await run(
      () => api.updateNode(selected.id, { displayMode }),
      displayMode === 'app' ? 'Đã chuyển sang toàn khung.' : 'Đã chuyển sang kiểu tài liệu.',
    )
    if (res) {
      setGroups(res.groups)
      // Khung xem truoc phai nap lai vi phan chen vao noi dung doi theo kieu hien thi.
      setContentVersion((v) => v + 1)
    }
  }

  const moveNodeToGroup = async (groupId) => {
    const res = await run(
      () => api.updateNode(selected.id, { groupId }),
      'Đã chuyển sang nhóm khác.',
    )
    if (res) setGroups(res.groups)
  }

  const saveSettings = async (patch) => {
    const res = await run(() => api.updateSettings(patch), 'Đã lưu cài đặt portal.')
    if (res) setSettings(res)
  }

  const uploadLogo = async (file) => {
    const res = await run(() => api.uploadLogo(file), 'Đã cập nhật logo.')
    if (res) {
      setSettings(res)
      applyFavicon(res.logoUrl)
    }
  }

  const removeLogo = async () => {
    const res = await run(() => api.removeLogo(), 'Đã bỏ logo.')
    if (res) {
      setSettings(res)
      applyFavicon(res.logoUrl)
    }
  }

  const changePassword = async (currentPassword, newPassword) => {
    const res = await run(
      () => api.changePassword(currentPassword, newPassword),
      'Đã đổi mật khẩu quản trị.',
    )
    if (!res) return false
    setAuthRequired(res.authRequired)
    // Tab dang mo phai tiep tuc goi API duoc, nen doi luon mat khau dang giu.
    setAdminPassword(newPassword)
    return true
  }

  const removePassword = async (currentPassword) => {
    const res = await run(() => api.removePassword(currentPassword), 'Đã bỏ mật khẩu.')
    if (!res) return false
    setAuthRequired(res.authRequired)
    setAdminPassword('')
    return true
  }

  const uploadContent = async (file) => {
    setUploading(true)
    const res = await run(
      () => api.uploadContent(selected.id, file),
      `Đã tải lên "${file.name}".`,
    )
    if (res) {
      setGroups(res.groups)
      setContentVersion((v) => v + 1)
    }
    setUploading(false)
  }

  if (status === 'auth') return <LoginScreen onSubmit={handleLogin} error={loginError} />

  if (status === 'error') {
    return (
      <div className="grid h-full place-items-center bg-canvas px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="text-warn" size={30} />
          <p className="text-fg-2">{error}</p>
          <button
            onClick={() => {
              setStatus('loading')
              load()
            }}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-elevated px-4">
        <a
          href="#/"
          title="Quay lại portal"
          className="-ml-1 grid size-[30px] shrink-0 place-items-center rounded-[7px] text-fg-2 transition hover:bg-hover hover:text-fg"
        >
          <ArrowLeft size={16} />
        </a>

        <Brand settings={settings} />

        <span className="hidden h-[18px] w-px shrink-0 bg-line md:block" />
        <span className="hidden text-[13px] text-fg-3 md:block">Quản trị nội dung</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[13px] text-fg-2 transition hover:bg-hover hover:text-fg"
          >
            <SlidersHorizontal size={15} />
            <span className="max-sm:hidden">Cài đặt</span>
          </button>
          <ThemeToggle />
          <span className="h-5 w-px bg-line" />
          <button
            onClick={() => createNode('folder')}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-[13px] text-fg-2 transition hover:bg-hover/60 hover:text-fg"
          >
            <FolderPlus size={15} />
            Thư mục
          </button>
          <button
            onClick={() => createNode('item')}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-accent-hover"
          >
            <FilePlus2 size={15} />
            Trang
          </button>
        </div>
      </header>

      {settingsOpen && (
        <SiteSettings
          settings={settings}
          authRequired={authRequired}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onUploadLogo={uploadLogo}
          onRemoveLogo={removeLogo}
          onChangePassword={changePassword}
          onRemovePassword={removePassword}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <div className="w-[340px] shrink-0 overflow-y-auto thin-scroll border-r border-line bg-elevated p-3">
          {status === 'loading' ? (
            <div className="space-y-1.5">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="shimmer h-8 rounded bg-hover/70" />
              ))}
            </div>
          ) : (
            <>
              {groups.map((group, index) => (
                <section key={group.id} className={index > 0 ? 'mt-5' : ''}>
                  <GroupHeader
                    group={group}
                    active={group.id === targetGroup?.id}
                    canMoveUp={index > 0}
                    canMoveDown={index < groups.length - 1}
                    canDelete={groups.length > 1}
                    onActivate={() => {
                      setActiveGroupId(group.id)
                      setSelectedId(null)
                    }}
                    onRename={(title) => renameGroup(group, title)}
                    onMove={(delta) => moveGroup(group, delta)}
                    onDelete={() => deleteGroup(group)}
                  />

                  {group.tree.length === 0 ? (
                    <p className="px-2 pb-1 text-[12.5px] leading-relaxed text-fg-3">
                      Nhóm này chưa có mục nào.
                    </p>
                  ) : (
                    <AdminTree
                      tree={group.tree}
                      groupId={group.id}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onReorder={reorder}
                      onToggleActive={toggleActive}
                      onDelete={deleteNode}
                    />
                  )}
                </section>
              ))}

              <button
                onClick={addGroup}
                className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-[7px] border border-dashed border-line py-2 text-[13px] text-fg-3 transition hover:border-accent-line hover:text-accent"
              >
                <Plus size={14} />
                Thêm nhóm
              </button>
            </>
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
                  groups={groups}
                  currentGroupId={targetGroup?.id ?? null}
                  onSave={saveNode}
                  onUpload={uploadContent}
                  onMoveToGroup={moveNodeToGroup}
                  onChangeDisplayMode={changeDisplayMode}
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
                <MousePointerSquareDashed size={32} className="text-fg-3" />
                <p className="text-[15px] text-fg-2">
                  Chọn một mục để chỉnh sửa
                </p>
                <p className="max-w-xs text-sm text-fg-3">
                  Kéo thả để đổi thứ tự, kéo sang phải để đưa vào trong thư mục phía trên.
                  Muốn chuyển mục sang nhóm khác thì chọn mục đó rồi đổi ở ô “Nhóm”.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
