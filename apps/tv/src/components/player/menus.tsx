import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAudioOptions, useCaptionOptions } from '@vidstack/react'
import { cn } from '../../utils/cn'
import { SPEEDS } from '../../utils/settings'
import { KEY } from './keys'

const MENU = 'absolute bottom-56 right-16 z-20 rounded-xl bg-[#111418]/95 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.6)]'

// Keys while a menu is open: arrows move, OK picks, anything else closes.
function useMenuKeys(count: number, start: number, vertical: boolean, onPick: (i: number) => void, onClose: () => void) {
  const [index, setIndex] = useState(start)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const prev = vertical ? KEY.up : KEY.left
      const next = vertical ? KEY.down : KEY.right
      if (e.keyCode === prev) setIndex(i => Math.max(0, i - 1))
      else if (e.keyCode === next) setIndex(i => Math.min(count - 1, i + 1))
      else if (e.keyCode === KEY.enter && count) { onPick(index); onClose() }
      else if (e.keyCode !== KEY.enter) onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [count, index, vertical, onPick, onClose])
  return index
}

export function SpeedMenu({ onClose, rate, onRate }: { onClose: () => void; rate: number; onRate: (rate: number) => void }) {
  const index = useMenuKeys(SPEEDS.length, Math.max(0, SPEEDS.indexOf(rate)), false, i => onRate(SPEEDS[i]), onClose)
  return (
    <div className={cn(MENU, 'flex')}>
      {SPEEDS.map((r, i) => (
        <div key={r} className={cn(
          'rounded-full px-5 py-3 text-lg font-semibold',
          i > 0 && 'ml-1',
          i === index ? 'bg-white text-black' : r === rate ? 'text-[#1a98ff]' : 'text-white/80',
        )}>{r}×</div>
      ))}
    </div>
  )
}

// Language names for the three- and two-letter codes MKV files use.
const LANGUAGES: Record<string, string> = {
  ara: 'Arabic', ar: 'Arabic', eng: 'English', en: 'English', ger: 'German', deu: 'German', de: 'German',
  fre: 'French', fra: 'French', fr: 'French', spa: 'Spanish', es: 'Spanish', ita: 'Italian', it: 'Italian',
  rus: 'Russian', ru: 'Russian', tur: 'Turkish', tr: 'Turkish', fin: 'Finnish', fi: 'Finnish', swe: 'Swedish', sv: 'Swedish',
  por: 'Portuguese', pt: 'Portuguese', hin: 'Hindi', hi: 'Hindi', kor: 'Korean', ko: 'Korean', jpn: 'Japanese', ja: 'Japanese',
  chi: 'Chinese', zho: 'Chinese', zh: 'Chinese', dut: 'Dutch', nld: 'Dutch', nl: 'Dutch', pol: 'Polish', pl: 'Polish',
  per: 'Persian', fas: 'Persian', fa: 'Persian', heb: 'Hebrew', he: 'Hebrew', und: 'Unknown',
}

// A plain file (an MKV, say) isn't reported through the player's own track list, but this TV's
// browser lists its audio tracks on the video element itself.
type NativeAudioTrack = { label?: string; language?: string; enabled: boolean }
type NativeAudioTracks = EventTarget & { length: number; [index: number]: NativeAudioTrack }

function useNativeAudio() {
  // audioTracks is missing from the DOM typings but present in this TV's browser.
  const tracks = (document.querySelector('video') as (HTMLVideoElement & { audioTracks?: NativeAudioTracks }) | null)?.audioTracks
  // The list only changes through its own events: re-read it whenever one fires.
  useSyncExternalStore(
    notify => {
      tracks?.addEventListener('change', notify)
      return () => tracks?.removeEventListener('change', notify)
    },
    () => tracks ? Array.from({ length: tracks.length }, (_, i) => tracks[i].enabled ? 1 : 0).join('') : '',
  )
  if (!tracks) return []
  return Array.from({ length: tracks.length }, (_, i) => {
    const t = tracks[i]
    const language = LANGUAGES[(t.language || '').toLowerCase()] ?? (t.language || '')
    return {
      label: [t.label || language || `Track ${i + 1}`, t.label && language && !t.label.includes(language) ? `· ${language}` : ''].filter(Boolean).join(' '),
      selected: t.enabled,
      select: () => { for (let k = 0; k < tracks.length; k++) tracks[k].enabled = k === i },
    }
  })
}

// HLS streams (all live, some VOD) report audio/subtitle tracks through the player; for a plain
// file the audio comes from the video element. Subtitles inside a plain file can't be read here.
export function TrackMenu({ onClose }: { onClose: () => void }) {
  const playerAudio = useAudioOptions()
  const nativeAudio = useNativeAudio()
  const audio = playerAudio.length > 1 ? playerAudio : nativeAudio
  const captions = useCaptionOptions()
  const rows = [
    ...(audio.length > 1 ? audio.map(option => ({ section: 'Audio', option })) : []),
    ...(captions.length > 1 ? captions.map(option => ({ section: 'Subtitles', option })) : []),
  ]
  const index = useMenuKeys(rows.length, Math.max(0, rows.findIndex(r => r.option.selected)), true, i => rows[i].option.select(), onClose)

  return (
    <div className={cn(MENU, 'w-96')}>
      {rows.length === 0 && <p className="px-4 py-3 text-base text-white/50">No alternative audio or subtitles for this stream.</p>}
      {captions.length <= 1 && rows.length > 0 && <p className="mt-3 px-4 text-sm text-white/40">Subtitles inside this file can’t be read on this TV.</p>}
      {rows.map(({ section, option }, i) => (
        <div key={`${section}:${option.label}:${i}`}>
          {(i === 0 || rows[i - 1].section !== section) && (
            <p className={cn('mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-white/40', i > 0 ? 'mt-3' : 'mt-1')}>{section}</p>
          )}
          <div className={cn(
            'flex items-center justify-between rounded-full px-5 py-3 text-lg',
            i === index ? 'bg-white font-semibold text-black' : option.selected ? 'text-[#1a98ff]' : 'text-white/80',
          )}>
            <span className="truncate">{option.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
