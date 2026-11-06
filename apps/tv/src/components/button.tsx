import type { ReactElement } from 'react'
import { cn } from '../utils/cn'
import { FocusButton } from './focusable'

type Variant = 'primary' | 'secondary'
type Size = 'md' | 'sm'

// One look for every action button: same height, corner radius, weight and
// icon-to-label spacing. Primary is the single main action on a screen.
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md') {
  return cn(
    'flex items-center justify-center rounded-lg font-semibold',
    size === 'md' ? 'h-14 px-7 text-xl' : 'h-12 px-5 text-lg',
    variant === 'primary' ? 'tv-ring-gap bg-white text-black' : 'bg-white/15 text-white',
  )
}

type Props = Omit<React.ComponentProps<typeof FocusButton>, 'plain'> & {
  icon?: ReactElement // any icon from ./icons; sized and spaced here
  variant?: Variant
  size?: Size
}

export default function ActionButton({ icon, variant = 'secondary', size = 'md', className, children, ...props }: Props) {
  return (
    <FocusButton className={cn(buttonClass(variant, size), className)} {...props}>
      {icon && (
        <span className={cn('flex shrink-0 items-center justify-center [&>svg]:size-full', size === 'md' ? 'mr-3 size-6' : 'mr-2.5 size-5')}>
          {icon}
        </span>
      )}
      {children}
    </FocusButton>
  )
}
