import { useEffect } from 'react'
import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import Navbar from '../../components/navbar'
import { FocusScope, sendFocus } from '../../components/focusable'

export const Route = createFileRoute('/(app)')({
  component: RouteComponent,
})

function RouteComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  // While a page is still loading nothing on it can take focus, so an arrow key
  // would do nothing at all. Let it open the rail instead.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode < 37 || e.keyCode > 40 || pathname === '/login') return
      if ((!document.activeElement || document.activeElement === document.body)) { e.preventDefault(); sendFocus('nav') }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [pathname])

  return <>
    {pathname !== '/login' && <Navbar />}
    <main className={pathname === '/login' ? undefined : 'pl-28'}>
      {/* Named scope so the rail can hand focus back to wherever you were. */}
      <FocusScope focusKey="content" focusWhen={false}>
        <Outlet />
      </FocusScope>
    </main>
  </>
}
