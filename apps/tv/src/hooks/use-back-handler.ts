import { useEffect, useEffectEvent } from 'react'
import { addBackHandler } from '../utils/back-handler'

// Claim the Back key while mounted. `handler` returns true when it used the key. A higher `priority`
// is asked first. The handler always sees the latest props and state.
export function useBackHandler(handler: () => boolean, priority = 0) {
  const run = useEffectEvent(handler)
  useEffect(() => addBackHandler(() => run(), priority), [priority])
}
