// Lets parts of a screen claim the Back key for something smaller than leaving it (cancelling a pending
// seek, hiding a card). The root asks first, highest priority first; the first handler that returns true
// has dealt with it. Handlers come and go with the components that own them (see hooks/use-back-handler).
type Entry = { run: () => boolean; priority: number }
const entries = new Set<Entry>()

export function addBackHandler(run: () => boolean, priority: number) {
  const entry = { run, priority }
  entries.add(entry)
  return () => { entries.delete(entry) }
}

export function handleBack() {
  for (const entry of [...entries].sort((a, b) => b.priority - a.priority)) {
    if (entry.run()) return true
  }
  return false
}
