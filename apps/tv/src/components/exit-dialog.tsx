import { useEffect } from 'react'
import { buttonClass } from './button'
import { cn } from '../utils/cn'

// "Exit Noir?" shown when Back is pressed on Home. Plain buttons driven by a
// capture-phase key handler, so the spatial-navigation library can't swallow the keys.
export default function ExitDialog({ onExit, onStay }: { onExit: () => void; onStay: () => void }) {
  useEffect(() => {
    const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-exit-actions] button'))
    buttons()[1]?.focus() // Stay is the safe default
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode === 37 || e.keyCode === 39 || e.keyCode === 13) {
        e.preventDefault()
        e.stopImmediatePropagation()
        const all = buttons()
        const current = all.indexOf(document.activeElement as HTMLButtonElement)
        if (e.keyCode === 13) (all[current] ?? all[1]).click()
        else all[e.keyCode === 37 ? 0 : all.length - 1]?.focus()
      } else if (e.keyCode === 38 || e.keyCode === 40) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const ring = 'focus:ring-4 focus:ring-[#1a98ff] outline-none'
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 text-center">
      <p className="text-3xl font-semibold text-white">Exit Noir?</p>
      <p className="mt-3 text-xl text-[#8b95a1]">Your place in everything you're watching is saved.</p>
      <div data-exit-actions className="mt-10 flex">
        <button onClick={onExit} className={cn(buttonClass('secondary'), ring)}>Exit</button>
        <button onClick={onStay} className={cn(buttonClass('primary'), ring, 'ml-4')}>Stay</button>
      </div>
    </div>
  )
}
