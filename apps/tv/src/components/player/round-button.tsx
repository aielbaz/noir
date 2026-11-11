import { cn } from '../../utils/cn'

export default function RoundButton({ label, onClick, large, focused, children }: { label: string; onClick: () => void; large?: boolean; focused?: boolean; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-full transition duration-150 active:scale-95',
        large ? 'size-20' : 'size-16',
        focused ? 'scale-110 bg-white text-black' : cn('text-white hover:bg-white/20', large && 'bg-white/15'),
      )}
    >
      {children}
    </button>
  )
}

