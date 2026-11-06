import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useApp } from '../context/app-provider'
import { getAccountInfo, type AccountInfo, type Kind } from '../utils/xtream'
import { useCategories } from '../hooks/use-catalog'
import { syncList } from '../utils/lists-client'
import { queryClient } from '../react-query/client'
import { expireRows } from '../utils/row-cache'
import { REFRESH_OPTIONS, SPEEDS, refreshLabel, updateSettings, useSettings } from '../utils/settings'
import { SORTS } from '../utils/sort'
import { nextOf } from '../utils/cycle'
import { FocusButton, FocusScope } from './focusable'
import ActionButton from './button'
import { SignOutIcon } from './icons'

const DAY = 86400

function describeExpiry(info: AccountInfo) {
  const exp = Number(info.exp_date)
  if (!info.exp_date || !Number.isFinite(exp)) return 'Never expires'
  const date = new Date(exp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const days = Math.ceil((exp - Date.now() / 1000) / DAY)
  if (days < 0) return `Expired on ${date}`
  return `${date} · ${days === 0 ? 'today' : days === 1 ? '1 day left' : `${days} days left`}`
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10 max-w-2xl">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#667684]">{title}</h2>
      {children}
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between py-2">
      <span className="text-[#8b95a1]">{label}</span>
      <span dir="ltr" className="ml-6 text-right text-white">{value}</span>
    </div>
  )
}

// OK flips a switch, or steps through a short list of values.
function SettingRow({ label, hint, value, onPress, focusKey, top }: { label: string; hint?: string; value: string; onPress: () => void; focusKey?: string; top?: boolean }) {
  return (
    // `top`: the first row has nothing focusable above it, so bring the whole page header back into view.
    <FocusButton focusKey={focusKey} onClick={onPress} onFocus={top ? () => window.scrollTo(0, 0) : undefined} className="mb-2 flex w-full scroll-my-14 items-center justify-between rounded-lg bg-[#111418] px-6 py-4 text-left">
      <span>
        <span className="block text-lg text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-base text-[#667684]">{hint}</span>}
      </span>
      <span className="ml-6 flex-none rounded-full bg-white/10 px-4 py-1.5 text-lg font-semibold text-white">{value}</span>
    </FocusButton>
  )
}

export default function SettingsPage() {
  const { creds, logout } = useApp()
  const settings = useSettings()
  const router = useRouter()
  // Signing out wipes this provider's saved data, so ask twice.
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!confirming) return
    const t = window.setTimeout(() => setConfirming(false), 5000)
    return () => window.clearTimeout(t)
  }, [confirming])

  const account = useQuery({
    queryKey: ['account', creds?.base, creds?.username],
    queryFn: ({ signal }) => getAccountInfo(creds!, { signal }),
    enabled: !!creds,
    staleTime: 60_000,
  })
  const info = account.data
  const status = info?.status ? info.status.charAt(0).toUpperCase() + info.status.slice(1).toLowerCase() : undefined
  const max = Number(info?.max_connections)
  const active = Number(info?.active_cons)

  // Each section's category list has its own age; that is its "last refresh".
  const movies = useCategories('movie')
  const series = useCategories('series')
  const live = useCategories('live')
  const sections = [
    { kind: 'movie', label: 'Movies', query: movies },
    { kind: 'series', label: 'TV Shows', query: series },
    { kind: 'live', label: 'Live TV', query: live },
  ] as const
  // Titles come from one big saved list per section, which refreshes separately from the category names.
  const [syncing, setSyncing] = useState<Kind[]>([])
  const refreshing = syncing.length > 0 || sections.some(s => s.query.isFetching)
  const nextRefresh = () => updateSettings({ refreshMinutes: nextOf(REFRESH_OPTIONS, settings.refreshMinutes) })
  const refresh = (kind?: Kind) => {
    const kinds: Kind[] = kind ? [kind] : ['movie', 'series', 'live']
    expireRows(kind)
    queryClient.invalidateQueries({ queryKey: kind ? ['categories', kind] : ['categories'] })
    setSyncing(s => [...s, ...kinds])
    // Fetches the full list again, then lets every open list pick up the new titles.
    kinds.forEach(k => {
      syncList(creds!, k, true)
        .catch(() => undefined)
        .finally(() => setSyncing(s => s.filter(x => x !== k)))
    })
  }
  const when = (at: number) => !at ? 'Not yet'
    : new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const nextSpeed = () => updateSettings({ defaultSpeed: nextOf(SPEEDS, settings.defaultSpeed) })
  const onOff = (v: boolean) => (v ? 'On' : 'Off')

  return (
    <FocusScope className="min-h-screen pr-12 pb-16 pt-12" preferredChildFocusKey="setting-autoplay">
      <h1 className="mb-10 text-4xl font-bold text-white">Settings</h1>

      <Section title="Account">
        <div className="rounded-lg bg-[#111418] px-6 py-5 text-lg">
          <InfoRow label="Username" value={creds?.username} />
          <InfoRow label="Server" value={creds?.base.replace(/^https?:\/\//, '')} />
          {info ? (
            <>
              {status && <InfoRow label="Status" value={info.is_trial && Number(info.is_trial) ? `${status} · Trial` : status} />}
              <InfoRow label="Expires" value={describeExpiry(info)} />
              {Number.isFinite(max) && max > 0 && (
                <InfoRow label="Connections" value={Number.isFinite(active) ? `${active} of ${max} in use` : `${max} allowed`} />
              )}
            </>
          ) : (
            <InfoRow label="Subscription" value={<span className="text-[#667684]">{account.isError ? 'Couldn’t load' : 'Loading…'}</span>} />
          )}
        </div>
      </Section>

      <Section title="Playback">
        <SettingRow
          focusKey="setting-autoplay"
          top
          label="Autoplay next episode"
          hint="Start the next episode when one ends"
          value={onOff(settings.autoplayNext)}
          onPress={() => updateSettings({ autoplayNext: !settings.autoplayNext })}
        />
        <SettingRow
          label="Up next card"
          hint="Show the next episode near the end of one"
          value={onOff(settings.upNextCard)}
          onPress={() => updateSettings({ upNextCard: !settings.upNextCard })}
        />
        <SettingRow
          label="Default speed"
          hint="For movies and episodes. Press OK to change"
          value={settings.defaultSpeed === 1 ? 'Normal' : `${settings.defaultSpeed}×`}
          onPress={nextSpeed}
        />
      </Section>

      <Section title="Library">
        <SettingRow
          label="Home banner"
          hint="Choose the categories the banner at the top of Home draws its new titles from"
          value={settings.heroSelection ? `${settings.heroSelection.length} selected` : 'Default'}
          onPress={() => router.navigate({ to: '/banner' })}
        />
        <SettingRow
          label="Home lists"
          hint="Choose the categories shown as rows on Home"
          value={settings.homeLists ? `${settings.homeLists.length} selected` : 'Default'}
          onPress={() => router.navigate({ to: '/home-lists' })}
        />
        <SettingRow
          label="Default order"
          hint="How the Movies, TV Shows and Live TV lists start out. Press OK to change"
          value={SORTS.find(s => s.id === settings.defaultSort)?.label ?? ''}
          onPress={() => updateSettings({ defaultSort: nextOf(SORTS.map(s => s.id), settings.defaultSort) })}
        />
        <SettingRow
          label="Watched badge"
          hint="Tick movies and episodes you've finished"
          value={onOff(settings.watchedBadge)}
          onPress={() => updateSettings({ watchedBadge: !settings.watchedBadge })}
        />
      </Section>

      <Section title="Content">
        <SettingRow
          label="Refresh lists"
          hint="Saved lists show instantly; older ones reload in the background"
          value={refreshLabel(settings.refreshMinutes)}
          onPress={nextRefresh}
        />
        <SettingRow
          label="Refresh everything"
          hint={refreshing ? 'Refreshing…' : 'Reload every list now'}
          value="Refresh"
          onPress={() => refresh()}
        />
        {sections.map(({ kind, label, query }) => (
          <SettingRow
            key={kind}
            label={`Refresh ${label}`}
            hint={`Last refreshed: ${when(query.dataUpdatedAt)}`}
            value={query.isFetching || syncing.includes(kind) ? 'Refreshing…' : 'Refresh'}
            onPress={() => refresh(kind)}
          />
        ))}
      </Section>

      <Section title="Sign out">
        <ActionButton
          focusKey="sign-out"
          className="scroll-my-14"
          icon={<SignOutIcon />}
          onClick={() => (confirming ? logout() : setConfirming(true))}
        >
          {confirming ? 'Press OK again to sign out' : 'Sign out'}
        </ActionButton>
        <p className="mt-3 text-base text-[#667684]">
          Signing out also clears Continue Watching, My list and recent channels on this device.
        </p>
      </Section>
    </FocusScope>
  )
}
