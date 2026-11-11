import { flushSync } from 'react-dom'
import { sendFocus } from './focusable'
import { setFastScrolling } from './poster'
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  className: string
  // Items available so far, and how to draw one. Only the rows near the screen are
  // ever mounted: a long list would otherwise keep thousands of cards (and their
  // focus registrations) alive, which slows every key press.
  total: number
  renderItem: (index: number) => ReactNode
  // Changes whenever the list is a different list (category, search, sort).
  resetKey: string
  // Index the page is about to focus (restoring a position); kept mounted until focus arrives.
  ensureIndex?: number
  // Focus key of the card at an index. When given, arrow keys move inside the grid by index
  // (no spatial search, which gets lost when the target row isn't mounted yet during fast scrolling).
  focusKeyOf?: (index: number) => string
  hasMore: boolean
  loadMore: () => void
}

const BUFFER_ROWS = 3 // mounted above and below the screen, so arrow keys always find a neighbour
const FIRST_BATCH = 40 // enough to measure columns and row height
const PAD = 8 // the grid's own py-2

// Renders a window of rows and loads the next page when the bottom sentinel gets
// within ~1 screen of the viewport (works with D-pad scrolling too).
type View = { key: string; start: number; end: number; cols: number; pitch: number }

export default function InfiniteGrid({ className, total, renderItem, resetKey, ensureIndex, focusKeyOf, hasMore, loadMore }: Props) {
  const grid = useRef<HTMLDivElement>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const ensure = useRef<{ key: string; index?: number }>({ key: '' })
  // Row that holds focus: always kept mounted with its neighbours, even when scroll events lag behind fast key presses.
  const focusRow = useRef<{ key: string; row: number } | null>(null)
  // While a key is held: extra rows to keep mounted in the direction of travel, so the rows ahead exist (and start loading) before they scroll into view.
  const ahead = useRef({ dir: 0, rows: 0 })
  // cols/pitch are 0 until the first batch has been measured. A view from another list is stale.
  const [stored, setView] = useState<View>({ key: '', start: 0, end: FIRST_BATCH, cols: 0, pitch: 0 })
  const view = stored.key === resetKey ? stored : { key: resetKey, start: 0, end: FIRST_BATCH, cols: 0, pitch: 0 }
  const currentView = useEffectEvent(() => view)
  const currentFocusKey = useEffectEvent(() => focusKeyOf)
  const loaded = useEffectEvent(() => total)

  const update = useCallback(() => {
    const el = grid.current
    if (!el) return
    if (ensure.current.key !== resetKey) ensure.current = { key: resetKey, index: ensureIndex }
    setView(prev => {
      let { cols, pitch } = prev.key === resetKey ? prev : { cols: 0, pitch: 0 }
      if (!cols && el.children.length > 1) {
        const first = (el.children[0] as HTMLElement).offsetTop
        for (let i = 1; i < el.children.length; i++) {
          if ((el.children[i] as HTMLElement).offsetTop > first + 2) {
            cols = i
            pitch = (el.children[i] as HTMLElement).offsetTop - first
            break
          }
        }
      }
      if (!cols || pitch <= 0) {
        return prev.key === resetKey && prev.cols === 0 && prev.end === FIRST_BATCH ? prev : { key: resetKey, start: 0, end: FIRST_BATCH, cols: 0, pitch: 0 }
      }
      const origin = el.getBoundingClientRect().top + window.scrollY + PAD
      let firstRow = Math.floor((window.scrollY - origin) / pitch) - BUFFER_ROWS
      let lastRow = Math.floor((window.scrollY + window.innerHeight - origin) / pitch) + BUFFER_ROWS
      const wanted = ensure.current.index
      if (wanted != null) {
        const row = Math.floor(wanted / cols)
        firstRow = Math.min(firstRow, row - BUFFER_ROWS)
        lastRow = Math.max(lastRow, row + BUFFER_ROWS)
      }
      if (focusRow.current && focusRow.current.key === resetKey) {
        firstRow = Math.min(firstRow, focusRow.current.row - BUFFER_ROWS)
        lastRow = Math.max(lastRow, focusRow.current.row + BUFFER_ROWS)
      }
      if (ahead.current.dir > 0) lastRow += ahead.current.rows
      else if (ahead.current.dir < 0) firstRow -= ahead.current.rows
      const start = Math.max(0, firstRow) * cols
      const end = Math.min(total, (lastRow + 1) * cols)
      return prev.key === resetKey && prev.start === start && prev.end === end && prev.cols === cols ? prev : { key: resetKey, start, end, cols, pitch }
    })
  }, [resetKey, ensureIndex, total])

  // After each render, measure if needed and (re)compute the window.
  useLayoutEffect(() => { update() })

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => { frame = 0; update() })
    }
    const onFocus = (e: FocusEvent) => {
      ensure.current = { key: ensure.current.key, index: undefined }
      const cell = (e.target as HTMLElement).closest('[data-grid] > *')
      const cols = currentView().cols
      if (!el || !cell || !cols) return
      const index = Number(el.dataset.start ?? 0) + Array.from(el.children).indexOf(cell)
      focusRow.current = { key: currentView().key, row: Math.floor(index / cols) }
    }
    const el = grid.current
    // While an arrow key is held the page scrolls too fast to read: skip painting the
    // posters (the cards keep their background) and show them again once it stops.
    let lastKey = 0
    let settle = 0
    let busy = false // a move is still being drawn
    const settled = () => { busy = false }
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode < 37 || e.keyCode > 40) return
      const now = Date.now()
      const held = e.repeat || now - lastKey < 160
      lastKey = now
      const active = document.activeElement
      if (!el || !active || !el.contains(active)) return
      const cell = active.closest('[data-grid] > *')
      const cols = currentView().cols
      if (!cell || !cols) return
      // Only a key held while focus is inside this grid counts: elsewhere nothing is hidden.
      if (held) {
        el.classList.add('fast')
      setFastScrolling(true)
        window.clearTimeout(settle)
        settle = window.setTimeout(() => { el.classList.remove('fast'); setFastScrolling(false); ahead.current = { dir: 0, rows: 0 } }, 200)
      }
      const start = Number(el.dataset.start ?? 0)
      const index = start + Array.from(el.children).indexOf(cell)
      const row = Math.floor(index / cols)
      // Holding Up stops at the top row; leaving the grid takes a fresh press.
      if (held && e.keyCode === 38 && row === 0) {
        e.preventDefault()
        e.stopImmediatePropagation()
        return
      }
      const keyOf = currentFocusKey()
      if (!keyOf) return
      // Move by index: the same cell one row up/down, or the neighbour left/right. Edges
      // (leaving the grid, wrapping to the next row) are left to the page's own handlers.
      let target = -1
      const vertical = e.keyCode === 40 || e.keyCode === 38
      if (vertical && held) {
        // Holding a vertical key: one row per move, and a new move only once the last one has
        // been drawn. Repeats that arrive in between are dropped, so nothing queues up and it
        // stops the moment the key is released.
        if (busy) { e.preventDefault(); e.stopImmediatePropagation(); return }
      }
      if (e.keyCode === 40) {
        const lastRow = Math.floor((loaded() - 1) / cols)
        const rows = Math.min(1, lastRow - row)
        target = rows <= 0 ? -2 : index + rows * cols < loaded() ? index + rows * cols : loaded() - 1
      } else if (e.keyCode === 38) {
        if (row > 0) target = index - cols
      } else if (e.keyCode === 37) {
        if (index % cols !== 0) target = index - 1
      } else if (index % cols !== cols - 1 && index + 1 < loaded()) {
        target = index + 1
      }
      if (target === -1) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (target === -2) return // bottom of what is loaded
      // Make sure the target is mounted before focusing it, however fast the keys come.
      const end = Number(el.dataset.start ?? 0) + el.children.length
      if (target < start || target >= end) {
        focusRow.current = { key: currentView().key, row: Math.floor(target / cols) }
        flushSync(update)
      }
      sendFocus(keyOf(target))
      if (vertical && held) {
        // Mount the rows around the new position before the next paint, so the screen never shows a gap.
        ahead.current = { dir: e.keyCode === 40 ? 1 : -1, rows: 3 }
        focusRow.current = { key: currentView().key, row: Math.floor(target / cols) }
        flushSync(update)
        busy = true
        window.requestAnimationFrame(() => window.requestAnimationFrame(settled))
        window.setTimeout(settled, 400) // never stay blocked if no frame comes
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    el?.addEventListener('focusin', onFocus)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('keydown', onKey, true)
      window.clearTimeout(settle)
      setFastScrolling(false)
      el?.removeEventListener('focusin', onFocus)
    }
  }, [update])

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '0px 0px 1000px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [total, hasMore, loadMore])

  const end = Math.min(view.end, total)
  const start = Math.min(view.start, end)
  const style = view.cols
    ? { paddingTop: PAD + (start / view.cols) * view.pitch, paddingBottom: PAD + Math.ceil((total - end) / view.cols) * view.pitch }
    : undefined

  const items: ReactNode[] = []
  for (let i = start; i < end; i++) items.push(renderItem(i))

  return (
    <>
      <div ref={grid} data-grid data-start={start} className={className} style={style}>{items}</div>
      {hasMore && <div ref={sentinel} className="h-16" aria-hidden />}
    </>
  )
}
