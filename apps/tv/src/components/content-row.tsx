import ContentCard from './content-card'
import { FocusScope } from './focusable'
import type { Item, Kind } from '../utils/xtream'

export type Entry = { kind: Kind; item: Item }

type Props = {
  title: string
  entries: Entry[]
  onSelect: (kind: Kind, item: Item, siblings?: Item[]) => void
}

export default function ContentRow({ title, entries, onSelect }: Props) {
  if (entries.length === 0) return null
  // Live cards play with the row's other channels as the channel-up/down list.
  const channels = entries.filter(e => e.kind === 'live').map(e => e.item)

  return (
    <FocusScope focusWhen={false}>
      <h2 className="mb-2 pl-28 text-xl font-semibold tracking-tight text-white">{title}</h2>
      <div className="no-scrollbar flex gap-4 overflow-x-auto scroll-pl-[7.5rem] scroll-pr-12 pl-[7.5rem] pr-12 py-5">
        {entries.map(({ kind, item }, i) => (
          <div key={`${kind}:${item.stream_id ?? item.series_id ?? i}`} className={`${kind === 'live' ? 'w-72' : 'w-60'} flex-none`}>
            <ContentCard item={item} kind={kind} onSelect={(k, it) => onSelect(k, it, k === 'live' ? channels : undefined)} />
          </div>
        ))}
      </div>
    </FocusScope>
  )
}
