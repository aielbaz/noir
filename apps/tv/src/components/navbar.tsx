import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import type { ComponentType, SVGProps } from 'react'
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation'
import { cn } from '../utils/cn'
import { FocusLink, FocusScope, sendFocus } from './focusable'
import { HeartIcon, HomeIcon, LiveIcon, MovieIcon, SettingsIcon, ShowsIcon } from './icons'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

type NavTo = '/' | '/live' | '/movies' | '/series' | '/favorites' | '/settings'

const ALSO_ACTIVE: Partial<Record<NavTo, string[]>> = { '/movies': ['/movie'], '/settings': ['/banner', '/home-lists'] }

const isActive = (to: NavTo, pathname: string) =>
  to === '/' ? pathname === '/' : [to, ...(ALSO_ACTIVE[to] ?? [])].some(p => pathname === p || pathname.startsWith(p + '/'))

const navItems: { label: string; to: NavTo; Icon: Icon }[] = [
  { label: 'Home', to: '/', Icon: HomeIcon },
  { label: 'Live TV', to: '/live', Icon: LiveIcon },
  { label: 'Movies', to: '/movies', Icon: MovieIcon },
  { label: 'TV Shows', to: '/series', Icon: ShowsIcon },
  { label: 'My list', to: '/favorites', Icon: HeartIcon },
]



const item = 'flex h-12 items-center overflow-hidden rounded-full px-3 text-base font-medium whitespace-nowrap'

// Icon rail that overlays the content and expands with labels while it has focus.
export default function Navbar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const router = useRouter()
  const current = navItems.find(n => isActive(n.to, pathname))

  // While focus is in the rail it owns one history entry, so the TV's Back key
  // closes the rail (and returns focus to the page) instead of leaving the page.
  const railEntry = useRouterState({ select: s => !!(s.location.state as { rail?: boolean } | undefined)?.rail })
  const pushed = useRef(false)

  const onFocusWithin = useCallback((hasFocus: boolean) => {
    if (hasFocus && !pushed.current) {
      pushed.current = true
      router.history.push(router.state.location.href, { rail: true })
    } else if (!hasFocus && pushed.current) {
      pushed.current = false
      // Focus left on its own (arrow keys): drop our entry again.
      if ((router.state.location.state as { rail?: boolean } | undefined)?.rail) router.history.back()
    }
  }, [router])

  // Right from the rail goes back to the page. The expanded rail overlaps the
  // page's layout box, so the library's own geometry can't find "to the right".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode !== 39 || !pushed.current) return
      e.preventDefault()
      e.stopPropagation()
      sendFocus('content')
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // The entry disappeared while focus was still in the rail: that was Back.
  useEffect(() => {
    if (pushed.current && !railEntry) {
      pushed.current = false
      sendFocus('content')
    }
  }, [railEntry])

  return (
    <>
    <div className="pointer-events-none fixed left-4 top-6 z-50 flex w-16 justify-center">
      <img src="noir-wordmark.svg" alt="Noir" className="h-8 select-none" />
    </div>
    <FocusScope
      focusKey="nav"
      focusWhen={false}
      onFocusWithin={onFocusWithin}
      // Entering the pill lands on the current page's item, not wherever focus was last.
      rememberChild={false}
      preferredChildFocusKey={`nav-${current?.to ?? '/'}`}
      className="group fixed left-4 top-1/2 z-50 flex w-16 -translate-y-1/2 flex-col rounded-[2rem] bg-[#111418] p-2 ring-1 ring-white/10 transition-[width] duration-200 focus-within:w-44"
    >
      {navItems.map(entry => <NavLink key={entry.to} entry={entry} pathname={pathname} railEntry={railEntry} className="mb-1 last:mb-0" />)}
    </FocusScope>
    <SettingsButton active={isActive('/settings', pathname)} railEntry={railEntry} />
    </>
  )
}

function NavLink({ entry: { label, to, Icon }, pathname, railEntry, className }: {
  entry: { label: string; to: NavTo; Icon: Icon }
  pathname: string
  railEntry: boolean
  className?: string
}) {
  const active = isActive(to, pathname)
  return (
    <FocusLink
      focusKey={`nav-${to}`}
      to={to}
      replace={railEntry}
      aria-label={label}
      data-nav
      className={cn(item, className, active ? 'tv-ring-gap bg-white text-black' : 'text-[#aab8c2]')}
    >
      <Icon className="size-6 shrink-0" />
      <span className="ml-4 opacity-0 transition-opacity group-focus-within:opacity-100">{label}</span>
    </FocusLink>
  )
}

// Drawn apart from the rail (just an icon), but it belongs to the rail's focus group:
// Left from a page lands on the rail's own items, and Settings is one step Down from the last.
function SettingsButton({ active, railEntry }: { active: boolean; railEntry: boolean }) {
  return (
    <FocusContext.Provider value="nav">
    <div className="fixed bottom-6 left-4 z-50 flex w-16 justify-center">
      <FocusLink
        to="/settings"
        replace={railEntry}
        aria-label="Settings"
        data-nav
        className={cn('flex size-12 items-center justify-center rounded-full', active ? 'text-white' : 'text-[#aab8c2]')}
      >
        <SettingsIcon className="size-7" />
      </FocusLink>
    </div>
    </FocusContext.Provider>
  )
}
