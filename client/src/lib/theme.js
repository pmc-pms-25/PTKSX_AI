import { useCallback, useEffect, useState } from 'react'

const KEY = 'pktsx-theme'

/**
 * Chua chon gi thi bam theo he thong. Bam nut mot cai la chot han lua chon do
 * va luu lai -- dung mot nut duy nhat, khong bat nguoi dung doan qua ba trang thai.
 */
function stored() {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    // Trinh duyet chan localStorage o che do rieng tu -- van chay, chi la khong nho.
    return null
  }
}

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [choice, setChoice] = useState(stored)
  const theme = choice ?? systemTheme()

  useEffect(() => {
    apply(theme)
  }, [theme])

  useEffect(() => {
    if (choice) return
    // Chua chot lua chon thi phai doi mau ngay khi Windows doi mau, khong doi tai lai trang.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply(systemTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [choice])

  const toggle = useCallback(() => {
    const next = (choice ?? systemTheme()) === 'dark' ? 'light' : 'dark'
    setChoice(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Khong luu duoc thi thoi, lua chon van co hieu luc den khi dong tab.
    }
  }, [choice])

  return { theme, toggle }
}
