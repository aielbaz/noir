import { formatDelta } from './format'

// How far the jump goes, large and on the picture, where the eyes already are. For a seek staged with
// the arrows it also says what the keys do while there is still time to change your mind; a direct jump
// (`jumped`: the 10-second buttons, the rewind / fast-forward keys) shows the amount alone.
export default function SeekOverlay({ scrub, from, sent, okWorks, jumped }: { scrub: number | null; from: number | null; sent: boolean; okWorks: boolean; jumped: number | null }) {
  const staged = scrub !== null && from !== null
  if (!staged && jumped === null) return null
  return (
    <div className="pointer-events-none absolute left-1/2 top-[34%] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
      <div className="rounded-full bg-black/60 px-6 py-2.5 text-4xl font-semibold tabular-nums text-white">
        {formatDelta(staged ? scrub - from : jumped!)}
      </div>
      {staged && !sent && (
        <div className="rounded-full bg-black/50 px-5 py-1.5 text-xl text-white/80">
          <span className="font-semibold text-white">Back</span> to cancel
          {okWorks && <> · <span className="font-semibold text-white">OK</span> to go now</>}
        </div>
      )}
    </div>
  )
}
