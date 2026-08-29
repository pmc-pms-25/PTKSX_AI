import { useEffect, useState } from 'react'

/**
 * Router toi gian chay tren hash. Du cho hai man hinh (portal va admin) va
 * tranh keo them mot thu vien routing chi de lam vic nay.
 */
export function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/')

  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return hash
}

export function navigate(path) {
  window.location.hash = path
}
