// The Magic Remote's wheel doesn't scroll the page on the TV (it only works inside elements that
// are scroll containers of their own, like the category list). Pages scroll the window, so turn the
// wheel into a window scroll here. Anything that can still scroll itself in that direction keeps
// the native behaviour.
const LINE = 40
const PAGE = 800

function canScroll(el: HTMLElement, dy: number) {
  const { overflowY } = getComputedStyle(el)
  if (overflowY !== 'auto' && overflowY !== 'scroll') return false
  return dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1
}

export function wheelToScroll() {
  let pending = 0
  let frame = 0
  const apply = () => {
    frame = 0
    window.scrollBy(0, pending)
    pending = 0
  }

  window.addEventListener('wheel', e => {
    if (e.defaultPrevented || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
    const dy = e.deltaY * (e.deltaMode === 1 ? LINE : e.deltaMode === 2 ? PAGE : 1)
    if (!dy) return
    for (let el = e.target instanceof HTMLElement ? e.target : null; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (canScroll(el, dy)) return
    }
    e.preventDefault()
    pending += dy
    if (!frame) frame = requestAnimationFrame(apply)
  }, { passive: false })
}
