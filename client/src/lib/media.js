import { useEffect, useState } from 'react'

/**
 * Dung de chi dung MOT trong hai: sidebar co dinh (man hinh rong) hoac drawer
 * (man hinh hep). Neu ve ca hai roi an bot bang CSS thi hai ban sao cua cung mot
 * cay se tranh nhau cac animation dung chung layoutId.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}
