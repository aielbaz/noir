import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'

export type PanelKind = 'speed' | 'tracks'

// The speed and audio & subtitles menus live in the history stack (as location state), so the TV's Back
// key closes the menu first instead of leaving the player.
export function usePlayerPanel() {
  const router = useRouter()
  const panel = useRouterState({ select: s => (s.location.state as { panel?: PanelKind } | undefined)?.panel })
  const isOpenRef = useRef(false)
  useEffect(() => { isOpenRef.current = !!panel })
  const open = useCallback((kind: PanelKind = 'tracks') => {
    if (!isOpenRef.current) router.history.push(router.state.location.href, { panel: kind })
  }, [router])
  const close = useCallback(() => {
    if (isOpenRef.current) router.history.back()
  }, [router])
  const isOpen = useCallback(() => isOpenRef.current, [])
  return { panel, open, close, isOpen }
}
