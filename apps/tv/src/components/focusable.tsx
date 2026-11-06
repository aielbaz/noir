import { useEffect, type ButtonHTMLAttributes, type KeyboardEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { cn } from '../utils/cn'

// The library only hands out setFocus through its hook; keep a reference so
// code outside a component (e.g. a history handler) can move focus by key.
let setFocusByKey: (key: string) => void = () => {}
export const sendFocus = (key: string) => setFocusByKey(key)

// Keep the focused element on screen. `scroll-margin` utilities on the element
// control how far it stays from the sticky header / screen edge.
// The spatial-navigation library swallows the OK (Enter) key, which stops the
// browser from synthesising a click on the focused element. Register OK as an
// explicit click instead.
const clickOnEnter = (el: HTMLElement | null) => () => el?.click()

const topOf = (el: Element) => el.getBoundingClientRect().top + window.scrollY

// Nothing focusable sits above the page's first control, so "nearest" would leave
// whatever is above it (hero, page title, header) scrolled out of sight. Reaching
// the first control means "back to the top".
function isFirstControl(el: HTMLElement) {
  // Only near the top of the page can this be the first control, and the first
  // control is among the first few in the document: no need to measure a long list.
  if (topOf(el) > window.innerHeight) return false
  // Pinned panels (sticky/fixed) don't scroll with the page, so they say nothing about its top.
  const scrolls = (c: Element) => !c.closest('.sticky, .fixed')
  if (!scrolls(el)) return false
  const candidates = document.querySelectorAll<HTMLElement>('main button, main a, main input')
  let highest = Infinity
  let seen = 0
  for (let i = 0; i < candidates.length && seen < 40; i++) {
    const c = candidates[i]
    if (c.offsetParent === null || !scrolls(c)) continue
    seen++
    highest = Math.min(highest, topOf(c))
  }
  return topOf(el) - highest < 2
}

// A row of cards scrolls sideways. scrollIntoView centres an element that is entirely out
// of view (this Chromium's "nearest" does that), so stepping onto the first card past the edge
// would jump the row by several cards. Move the row by just enough to bring the card
// into view instead, leaving nothing for scrollIntoView to do horizontally.
function nudgeRow(el: HTMLElement) {
  let scroller = el.parentElement
  while (scroller && scroller !== document.body && scroller.scrollWidth <= scroller.clientWidth) scroller = scroller.parentElement
  if (!scroller || scroller === document.body) return
  const style = getComputedStyle(scroller)
  if (style.overflowX !== 'auto' && style.overflowX !== 'scroll') return
  const box = scroller.getBoundingClientRect()
  const card = el.getBoundingClientRect()
  const left = box.left + (parseFloat(style.scrollPaddingLeft) || 0)
  const right = box.right - (parseFloat(style.scrollPaddingRight) || 0)
  if (card.right > right) scroller.scrollLeft += card.right - right
  else if (card.left < left) scroller.scrollLeft -= left - card.left
}

// Focus that comes from the pointer hovering a control: the control is already under the cursor,
// so nothing may scroll (and wheel-scrolling under a still pointer must not drag focus around).
let pointerFocusing = false

const reveal = (e: { currentTarget: HTMLElement }) => {
  if (pointerFocusing) return
  const el = e.currentTarget
  nudgeRow(el)
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  if (isFirstControl(el)) window.scrollTo(0, 0)
}

// `plain` skips the default focus ring so a component can draw its own
// (e.g. a card that rings only its poster).
type FocusButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { focusKey?: string; plain?: boolean }

export function FocusButton({ className, focusKey, onFocus, plain, ...props }: FocusButtonProps) {
  const { ref, focusKey: key } = useFocusable({ focusKey, onEnterPress: () => clickOnEnter(ref.current)() })
  return (
    <button
      type="button"
      ref={ref}
      data-fk={key}
      onFocus={e => { reveal(e); onFocus?.(e) }}
      className={cn(plain ? 'outline-none' : 'tv-focus', className)}
      {...props}
    />
  )
}

export function FocusInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & { focusKey?: string }) {
  const { focusKey, ...rest } = props
  // OK on a text field must focus it and click it so webOS opens the keyboard.
  const { ref } = useFocusable({ focusKey, onEnterPress: () => { ref.current?.focus(); clickOnEnter(ref.current)() } })
  // Enter while typing means "done": close the keyboard but keep the spatial focus here.
  // Stopped so spatial navigation doesn't treat it as another press and reopen the field.
  const done = (e: KeyboardEvent<HTMLInputElement>) => {
    rest.onKeyDown?.(e)
    if (e.key !== 'Enter' || document.activeElement !== e.currentTarget) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.blur()
  }
  return <input ref={ref} onFocus={reveal} className={cn('tv-focus', className)} {...rest} onKeyDown={done} />
}

export function FocusLink({ className, focusKey, ...props }: LinkProps & { className?: string; focusKey?: string }) {
  const { ref, focusKey: key } = useFocusable({ focusKey, onEnterPress: () => clickOnEnter(ref.current)() })
  return <Link ref={ref} data-fk={key} onFocus={reveal} className={cn('tv-focus', className)} {...props} />
}

// Groups focusables so arrow navigation remembers where you were in a section.
export function FocusScope({ children, className, focusWhen = true, preferredChildFocusKey, restoreKey, focusKey: scopeKey, onFocusWithin, rememberChild = true }: {
  children: ReactNode
  className?: string
  focusWhen?: boolean
  preferredChildFocusKey?: string
  // Focus this child first (e.g. the card the user left) when it exists.
  restoreKey?: string
  // Stable key so other code can send focus here (setFocus restores the last-focused child).
  focusKey?: string
  // Re-enter on the last focused child (default). Turn off to always use preferredChildFocusKey.
  rememberChild?: boolean
  // Fires when focus enters or leaves anything inside this scope.
  onFocusWithin?: (hasFocus: boolean) => void
}) {
  const { ref, focusKey, focusSelf, setFocus, getCurrentFocusKey, hasFocusedChild } = useFocusable({
    focusKey: scopeKey,
    trackChildren: true,
    saveLastFocusedChild: rememberChild,
    preferredChildFocusKey,
  })

  useEffect(() => { setFocusByKey = setFocus }, [setFocus])

  useEffect(() => {
    onFocusWithin?.(hasFocusedChild)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFocusedChild])

  useEffect(() => {
    if (!focusWhen) return
    if (restoreKey) {
      setFocus(restoreKey)
      if (getCurrentFocusKey() === restoreKey) return
    }
    focusSelf()
    // restoreKey is only meaningful on the render that first enables focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusWhen, focusSelf])

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className={className}>{children}</div>
    </FocusContext.Provider>
  )
}

// The Magic Remote's pointer highlights what it hovers, the same way the arrow keys do. Only a real
// movement counts: the browser re-sends mouse events after a scroll with the pointer unchanged.
export function hoverToFocus() {
  let lastX = -1
  let lastY = -1
  window.addEventListener('mousemove', e => {
    if (e.clientX === lastX && e.clientY === lastY) return
    lastX = e.clientX
    lastY = e.clientY
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-fk]') : null
    if (!el || el === document.activeElement) return
    pointerFocusing = true
    try { setFocusByKey(el.dataset.fk!) } finally { pointerFocusing = false }
  }, { passive: true })
}
