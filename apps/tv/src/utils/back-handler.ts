// Lets a screen claim the Back key for something smaller than leaving it (cancelling a pending
// seek, say). The root asks first; if the handler returns true, Back has been dealt with.
let handler: (() => boolean) | null = null

export function setBackHandler(next: (() => boolean) | null) {
  handler = next
}

export function handleBack() {
  return handler?.() ?? false
}
