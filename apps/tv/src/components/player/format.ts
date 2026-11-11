// How the player writes times.

export const clamp = (n: number) => Math.min(100, Math.max(0, n))

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}


// "+40s", "−2m 10s", "+1h 5m": how far the jump goes from where the user was.
export function formatDelta(seconds: number) {
  const total = Math.round(Math.abs(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const parts = h > 0 ? [`${h}h`, m ? `${m}m` : ''] : m > 0 ? [`${m}m`, sec ? `${sec}s` : ''] : [`${sec}s`]
  return `${seconds < 0 ? '−' : '+'}${parts.filter(Boolean).join(' ')}`
}

