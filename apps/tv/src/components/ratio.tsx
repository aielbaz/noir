import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../utils/cn'

// CSS `aspect-ratio` needs Chromium 88; webOS 6 TVs ship 79. Padding-top is
// proportional to width, which gives the same box on every browser.
// `children` fill the box; `className` styles the outer element.
export default function Ratio({ ratio, className, innerClassName, children }: {
  ratio: number // width / height
  className?: string
  innerClassName?: string
  children?: ReactNode
}) {
  const style: CSSProperties = { paddingTop: `${100 / ratio}%` }
  return (
    <div className={cn('relative', className)} style={style}>
      <div className={cn('absolute left-0 top-0 h-full w-full', innerClassName)}>{children}</div>
    </div>
  )
}

export const POSTER = 2 / 3
export const WIDE = 16 / 9
export const SQUARE = 1
