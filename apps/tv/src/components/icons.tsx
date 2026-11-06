import type { SVGProps } from 'react'

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

type P = SVGProps<SVGSVGElement>

export const HomeIcon = (p: P) => <svg {...base} {...p}><path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-8z" /></svg>
export const LiveIcon = (p: P) => <svg {...base} {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M8 3l4 3 4-3" /></svg>
export const MovieIcon = (p: P) => <svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5M16 4v5" /></svg>
export const ShowsIcon = (p: P) => <svg {...base} {...p}><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
export const SearchIcon = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
export const SignOutIcon = (p: P) => <svg {...base} {...p}><path d="M10 4H6a1 1 0 00-1 1v14a1 1 0 001 1h4M15 8l4 4-4 4M19 12H9" /></svg>
export const PlayIcon = (p: P) => <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" aria-hidden {...p}><path d="M8 5.5v13L19 12z" /></svg>
export const StarIcon = (p: P) => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
export const HeartIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base} {...p} fill={filled ? 'currentColor' : 'none'}><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" /></svg>
)
export const CheckIcon = (p: P) => <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
export const PauseIcon = (p: P) => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><rect x="6" y="4.5" width="4.2" height="15" rx="1" /><rect x="13.8" y="4.5" width="4.2" height="15" rx="1" /></svg>
export const ChevronRightIcon = (p: P) => <svg {...base} {...p}><path d="M9 5l7 7-7 7" /></svg>
export const BackIcon = (p: P) => <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>
export const CaptionsIcon = (p: P) => <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 10.2a2.2 2.2 0 100 3.6M17 10.2a2.2 2.2 0 100 3.6" /></svg>
export const Replay10Icon = (p: P) => <svg {...base} {...p}><path d="M4.5 12a7.5 7.5 0 107.5-7.5H8M8 2.5l-3.5 2L8 7" /><text x="12" y="15.2" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">10</text></svg>
export const Forward10Icon = (p: P) => <svg {...base} {...p}><path d="M19.5 12A7.5 7.5 0 1112 4.5h4M16 2.5l3.5 2L16 7" /><text x="12" y="15.2" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none">10</text></svg>
export const SettingsIcon = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
export const RestartIcon = (p: P) => <svg {...base} {...p}><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
export const RetryIcon = (p: P) => <svg {...base} {...p}><path d="M21 12a9 9 0 11-9-9 9.75 9.75 0 016.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
export const SortIcon = (p: P) => <svg {...base} {...p}><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" /></svg>

export const EyeIcon = (p: P) => <svg {...base} {...p}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
export const EyeOffIcon = (p: P) => <svg {...base} {...p}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /><path d="M4 4l16 16" /></svg>
