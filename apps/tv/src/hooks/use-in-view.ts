import { useEffect, useRef, useState } from 'react'

// Whether an element is on (or near) the screen. `once` stops watching after the first time it is,
// for things that only need to know "has it come close yet".
export function useInView<T extends Element>({ rootMargin = '0px', threshold = 0, once = false } = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      const visible = entries[entries.length - 1].isIntersecting
      setInView(visible)
      if (once && visible) observer.disconnect()
    }, { rootMargin, threshold })
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin, threshold, once])
  return [ref, inView] as const
}
