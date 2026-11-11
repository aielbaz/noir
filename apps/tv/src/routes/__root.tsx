import { createRootRoute, Outlet, redirect, useRouter, useRouterState } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { hasSavedLogin } from "../utils/saved-login"
import ExitDialog from "../components/exit-dialog"
import { handleBack } from "../utils/back-handler"

function exitApp() {
  // webOS exposes PalmSystem to apps; window.close() alone does nothing there.
  const palm = (window as unknown as { PalmSystem?: { close?: () => void } }).PalmSystem
  if (palm?.close) palm.close()
  else window.close()
}

function RootLayout() {
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [confirmExit, setConfirmExit] = useState(false)

  // Escape does the same as Back for keyboards and the browser dev server.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || pathname === "/" || pathname === "/login") return
      if (handleBack()) { e.preventDefault(); return }
      if (router.history.canGoBack()) {
        e.preventDefault()
        router.history.back()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, pathname])

  // appinfo sets disableBackHistoryAPI, so the TV's Back key (keyCode 461) reaches the
  // app instead of walking history behind its back. Back walks history as before (that
  // is also how the rail, search and panels close), and leaves the app from Home or
  // when there is nowhere left to go.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode !== 461 && e.key !== "GoBack") return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (confirmExit) return setConfirmExit(false) // Back on the dialog means "stay"
      if (handleBack()) return // the screen used it for something smaller than leaving
      const state = router.state.location.state as { rail?: boolean } | undefined
      if (pathname === "/" && !state?.rail) return setConfirmExit(true)
      if (router.history.canGoBack() || window.history.length > 1) router.history.back()
      else setConfirmExit(true)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [router, pathname, confirmExit])

  return (
    <>
      <Outlet />
      {confirmExit && <ExitDialog onExit={exitApp} onStay={() => setConfirmExit(false)} />}
    </>
  )
}

// Signed out goes to the login screen, signed in leaves it. Checked on every navigation; login() and
// logout() navigate themselves, since a change of credentials alone is not a navigation.
export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const signedIn = hasSavedLogin()
    if (!signedIn && location.pathname !== "/login") throw redirect({ to: "/login", replace: true })
    if (signedIn && location.pathname === "/login") throw redirect({ to: "/", replace: true })
  },
  component: RootLayout,
})
