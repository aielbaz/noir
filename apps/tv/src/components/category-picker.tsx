import { useMemo } from 'react'
import { useCategories } from '../hooks/use-catalog'
import { useCategorySelection, type SelectionSetting } from '../hooks/use-category-selection'
import { updateSettings, useSettings } from '../utils/settings'
import type { Kind } from '../utils/xtream'
import { CheckIcon } from './icons'
import { FocusButton, FocusScope } from './focusable'
import { cn } from '../utils/cn'

function CategoryRow({ name, selected, onToggle }: { name: string; selected: boolean; onToggle: () => void }) {
  return (
    <FocusButton
      onClick={onToggle}
      className="mb-2 flex w-full scroll-my-14 items-center justify-between rounded-lg bg-[#111418] px-6 py-3 text-left"
    >
      <span dir="auto" className="truncate text-lg text-white">{name}</span>
      <span className={cn('ml-6 flex size-8 flex-none items-center justify-center rounded-full', selected ? 'bg-white text-black' : 'border-2 border-white/25')}>
        {selected && <CheckIcon className="size-5" aria-label="Selected" />}
      </span>
    </FocusButton>
  )
}

function Group({ title, kind, chosen, onToggle }: { title: string; kind: Kind; chosen: Set<string>; onToggle: (key: string) => void }) {
  const categories = useCategories(kind)
  return (
    <section className="mb-10 max-w-2xl">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#667684]">{title}</h2>
      {categories.data?.map(c => {
        const key = `${kind}:${c.category_id}`
        return <CategoryRow key={c.category_id} name={c.category_name} selected={chosen.has(key)} onToggle={() => onToggle(key)} />
      })}
      {!categories.data && <p className="text-base text-[#667684]">{categories.isError ? 'Couldn’t load the categories' : 'Loading…'}</p>}
    </section>
  )
}

// Tick the categories a setting uses. Nothing ticked means the default (the first `perKind` of each).
export default function CategoryPicker({ title, description, setting, perKind }: { title: string; description: string; setting: SelectionSetting; perKind: number }) {
  const isDefault = useSettings()[setting] === null
  const list = useCategorySelection(setting, perKind)
  const chosen = useMemo(() => new Set(list), [list])
  const toggle = (key: string) => {
    const current = list ?? []
    // Unticking the last one goes back to the default.
    updateSettings({ [setting]: chosen.has(key) ? (current.length > 1 ? current.filter(k => k !== key) : null) : [...current, key] })
  }
  return (
    <FocusScope className="min-h-screen pr-12 pb-16 pt-12" preferredChildFocusKey="picker-default">
      <h1 className="mb-2 text-4xl font-bold text-white">{title}</h1>
      <p className="mb-8 max-w-2xl text-lg text-[#8b95a1]">{description}</p>

      <FocusButton
        focusKey="picker-default"
        onClick={() => updateSettings({ [setting]: null })}
        className="mb-10 flex w-full max-w-2xl scroll-my-14 items-center justify-between rounded-lg bg-[#111418] px-6 py-4 text-left"
      >
        <span className="text-lg text-white">Default</span>
        <span className="ml-6 flex-none rounded-full bg-white/10 px-4 py-1.5 text-lg font-semibold text-white">
          {isDefault ? 'In use' : 'Tap to reset'}
        </span>
      </FocusButton>

      <Group title="Movies" kind="movie" chosen={chosen} onToggle={toggle} />
      <Group title="TV Shows" kind="series" chosen={chosen} onToggle={toggle} />
    </FocusScope>
  )
}
