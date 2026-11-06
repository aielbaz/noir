import { Fragment } from 'react'
import { StarIcon } from './icons'

// "★ 6.2  •  2026  •  1 h 44 min  •  Horror / Thriller": the rating sits in its own
// chip and every other detail is separated by a dot, so nothing runs together.
export default function MetaLine({ rating, parts }: { rating?: number; parts: (string | undefined | false)[] }) {
  const shown = parts.filter((p): p is string => !!p)
  const hasRating = !!rating && rating > 0

  return (
    <div className="flex flex-wrap items-center text-xl text-[#aab8c2]">
      {hasRating && (
        <span className="flex items-center rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-amber-400">
          <StarIcon className="mr-2 size-5" />
          {rating.toFixed(1)}
        </span>
      )}
      {shown.map((part, i) => (
        <Fragment key={part}>
          {(i > 0 || hasRating) && <span aria-hidden className="mx-4 size-1.5 rounded-full bg-white/30" />}
          <span>{part}</span>
        </Fragment>
      ))}
    </div>
  )
}
