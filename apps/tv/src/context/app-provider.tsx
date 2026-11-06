import { clearLists } from '../utils/lists-client'
import { clearRows } from '../utils/row-cache'
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { router } from '../router'
import { buildUrl } from '../utils/xtream'
import { clearProgress } from '../utils/progress'
import { rememberAccount } from '../utils/accounts'
import { forgetViews } from '../utils/view-memory'
import { clearFavorites } from '../utils/favorites'
import { clearRecentChannels } from '../utils/recents'

type PlaybackItem = {
  name: string
  type: 'live' | 'movie' | 'episode'
  streamUrl: string
  channelGroup?: string
  // Set for anything that should show up under Continue Watching.
  id?: string
  group?: string
  image?: string
}

type Credentials = {
  base: string
  username: string
  password: string
}

type AppContextValue = {
  creds: Credentials | null
  login: (server: string, username: string, password: string) => void
  logout: () => void
  play: (item: PlaybackItem, options?: { replace?: boolean }) => void
  stopPlay: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [creds, setCreds] = useState<Credentials | null>(() => {
    try {
      const saved = localStorage.getItem('streambox_creds')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const login = useCallback((server: string, username: string, password: string) => {
    const c = buildUrl(server, username, password)
    setCreds(c)
    rememberAccount(c)
    localStorage.setItem('streambox_creds', JSON.stringify(c))
  }, [])

  const logout = useCallback(() => {
    setCreds(null)
    localStorage.removeItem('streambox_creds')
    clearProgress()
    forgetViews()
    clearFavorites()
    clearRecentChannels()
    clearRows()
    clearLists()
    queryClient.clear()
  }, [queryClient])

  const play = useCallback((item: PlaybackItem, options?: { replace?: boolean }) => {
    router.navigate({
      to: '/player',
      replace: options?.replace,
      search: {
        name: item.name,
        type: item.type,
        streamUrl: item.streamUrl,
        channelGroup: item.channelGroup,
        id: item.id,
        group: item.group,
        image: item.image,
      },
    })
  }, [])

  const stopPlay = useCallback(() => {
    if (router.history.canGoBack()) {
      router.history.back()
      return
    }

    router.navigate({ to: '/', replace: true })
  }, [])

  return (
    <AppContext.Provider value={{
      creds, login, logout,
      play, stopPlay,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }

  return context
}