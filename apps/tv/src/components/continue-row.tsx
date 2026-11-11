import { useApp } from '../context/app-provider'
import { useQuery } from '@tanstack/react-query'
import { getProgress, removeProgress, saveProgress, useContinueWatching, type WatchEntry } from '../utils/progress'
import { getVodInfo, hasImage, vodArt } from '../utils/xtream'
import { useActionKeys } from '../hooks/use-action-keys'
import Poster from './poster'
import Ratio, { WIDE } from './ratio'
import { FocusButton, FocusScope } from './focusable'

function minutesLeft(entry: WatchEntry) {
  const mins = Math.max(1, Math.round((entry.duration - entry.position) / 60))
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min left` : `${mins} min left`
}

export default function ContinueRow() {
  const entries = useContinueWatching()
  if (entries.length === 0) return null

  return (
    <FocusScope focusWhen={false}>
      <h2 className="mb-2 flex items-baseline pl-28 text-xl font-semibold text-white">
        Continue watching
        <span className="ml-4 text-sm font-normal text-[#667684]">Hold OK to remove</span>
      </h2>
      <div className="no-scrollbar flex gap-4 overflow-x-auto scroll-pl-[7.5rem] scroll-pr-12 pl-[7.5rem] pr-12 py-5">
        {entries.map(entry => <ContinueCard key={entry.group} entry={entry} />)}
      </div>
    </FocusScope>
  )
}

function ContinueCard({ entry }: { entry: WatchEntry }) {
  const { creds, play } = useApp()

  // Entries saved before artwork was recorded fill themselves in from the provider.
  const missingArt = !hasImage(entry.image)
  const movieId = missingArt && entry.kind === 'movie' ? entry.id.replace('movie:', '') : undefined
  // The artwork is written back as soon as it arrives, so the entry has it from then on.
  useQuery({
    queryKey: ['vodInfo', movieId],
    queryFn: async ({ signal }) => {
      const found = await getVodInfo(creds!, movieId!, { signal })
      const image = vodArt(found)
      const latest = getProgress(entry.id)
      if (image && latest) saveProgress({ ...latest, image })
      return found
    },
    enabled: !!movieId && !!creds,
  })
  const progress = entry.duration > 0 ? Math.min(100, (entry.position / entry.duration) * 100) : 0

  const keys = useActionKeys(
    () => play({
      name: entry.name,
      type: entry.kind,
      streamUrl: entry.streamUrl,
      id: entry.id,
      group: entry.group,
      image: entry.image,
    }),
    () => removeProgress(entry.group),
  )

  return (
    <FocusButton
      plain
      aria-label={`Resume ${entry.name}`}
      className="group w-80 flex-none scroll-my-0 text-left"
      {...keys}
    >
      <Ratio ratio={WIDE} className="rounded-lg bg-[#111418] transition-transform duration-200 ease-out group-focus:scale-[1.04] group-focus:ring-4 group-focus:ring-white">
        <Poster src={entry.image} title={entry.name} />
        <div className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
        </div>
      </Ratio>
      <p className="mt-3 truncate px-1 text-lg font-medium text-[#d3dbe2] transition-colors duration-200 group-focus:text-white">{entry.name}</p>
      {entry.duration > 0 && <p className="mt-0.5 px-1 text-sm text-[#9aa8b3]">{minutesLeft(entry)}</p>}
    </FocusButton>
  )
}
