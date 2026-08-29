import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

export const FALLBACK_SETTINGS = {
  siteTitle: 'Cổng tài liệu',
  siteSubtitle: '',
  logoUrl: null,
  showRecent: false,
}

/**
 * Ten portal va logo do admin dat. Goi API that bai thi van hien duoc portal
 * bang gia tri mac dinh -- doi ten la trang tri, khong duoc chan noi dung.
 */
export function useSettings() {
  const [settings, setSettings] = useState(FALLBACK_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try {
      setSettings(await api.settings())
    } catch {
      setSettings(FALLBACK_SETTINGS)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { settings, setSettings, reload, loaded }
}

/** Doi luon icon tren tab trinh duyet theo logo admin tai len. */
export function applyFavicon(logoUrl) {
  const href = logoUrl || '/favicon.svg'
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href)
    // Kieu anh khac nhau (svg / png / ico) nen de trinh duyet tu doan.
    link.removeAttribute('type')
  }
}

/** Chu viet tat dung khi chua tai logo len: hai chu cai dau cua ten portal. */
export function initialsOf(title) {
  const words = String(title || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '::'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
