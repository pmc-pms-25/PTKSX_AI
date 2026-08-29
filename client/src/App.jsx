import { useHash } from './lib/hash.js'
import { ToastProvider } from './components/Toast.jsx'
import Portal from './Portal.jsx'
import AdminApp from './admin/AdminApp.jsx'

export default function App() {
  const hash = useHash()
  const isAdmin = hash === '/admin' || hash.startsWith('/admin/')

  return (
    <ToastProvider>{isAdmin ? <AdminApp /> : <Portal />}</ToastProvider>
  )
}
