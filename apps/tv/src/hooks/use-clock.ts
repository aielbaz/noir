import { useSyncExternalStore } from 'react'

const TICK_MS = 20_000

// One shared wall clock for everything that shows a time-of-day or a progress through a programme.
// It ticks only while something is using it, and everything using it updates together.
let now = Date.now()
let timer = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    now = Date.now()
    timer = window.setInterval(() => {
      now = Date.now()
      listeners.forEach(l => l())
    }, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.clearInterval(timer)
  }
}

// Milliseconds since 1970, refreshed every 20 seconds.
export function useClock() {
  return useSyncExternalStore(subscribe, () => now)
}
