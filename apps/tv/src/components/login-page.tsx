import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { HttpError, TimeoutError } from '../utils/http'
import { authenticate } from '../utils/xtream'
import { useApp } from '../context/app-provider'
import { forgetAccount, useAccounts } from '../utils/accounts'
import { FocusButton, FocusInput, FocusScope } from './focusable'
import ActionButton from './button'
import { EyeIcon, EyeOffIcon } from './icons'

function describeError(err: unknown) {
  if (err instanceof HttpError) {
    const { status } = err
    if (status === 401 || status === 403) return 'The server rejected these details, or blocked this device.'
    if (status === 404) return 'The server says it doesn’t know this account. Check the username, and the address and port.'
    return `The server returned an error (${status}). Try again in a moment.`
  }
  if (err instanceof TimeoutError) return 'The server took too long to respond. Check the address and port.'
  // fetch() reports every network-level failure as the same opaque TypeError.
  if (err instanceof TypeError) return `Couldn't connect. Check the address and port, and that the server is reachable from this TV. (${err.message})`
  return err instanceof Error && err.message ? err.message : 'Connection failed. Check your details and try again.'
}

export default function LoginPage() {
  const { login } = useApp()
  const accounts = useAccounts()
  const [server, setServer] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const loginMutation = useMutation({
    mutationFn: ({ serverUrl, user, pass }: { serverUrl: string; user: string; pass: string }) => authenticate(serverUrl, user, pass),
    onSuccess: (_, variables) => {
      login(variables.serverUrl, variables.user, variables.pass)
    },
    onError: (err: unknown) => setError(describeError(err)),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!server || !username || !password) {
      setError('Please fill in all fields')
      return
    }
    setError('')
    loginMutation.mutate({ serverUrl: server, user: username, pass: password })
  }

  const pending = loginMutation.isPending

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-[#050607]">
      <FocusScope className="flex w-[1120px] items-center" preferredChildFocusKey={accounts.length ? undefined : 'login-server'}>
        <div className="w-[420px] flex-none pr-16">
          <img src="noir-wordmark.svg" alt="Noir" className="-ml-1 mb-4 h-20" />
          <h1 className="text-5xl font-bold leading-tight text-white">Sign in</h1>
          <p className="mt-4 text-xl text-[#8b95a1]">Use the server address, username and password from your IPTV provider.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1">
          {accounts.length > 0 && (
            <div className="mb-8">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#667684]">Saved accounts</p>
              {accounts.slice(0, 3).map(acc => (
                <div key={`${acc.base}|${acc.username}`} className="mb-2 flex">
                  <FocusButton
                    className="flex h-14 flex-1 items-center justify-between rounded-lg bg-white/10 px-5 text-left text-lg text-white"
                    disabled={pending}
                    onClick={() => { setError(''); loginMutation.mutate({ serverUrl: acc.base, user: acc.username, pass: acc.password }) }}
                  >
                    <span className="font-semibold">{acc.username}</span>
                    <span className="ml-4 truncate text-[#667684]">{acc.base.replace(/^https?:\/\//, '')}</span>
                  </FocusButton>
                  <FocusButton
                    className="ml-2 h-14 rounded-lg bg-white/10 px-5 text-lg text-[#aab8c2]"
                    aria-label={`Forget ${acc.username}`}
                    onClick={() => forgetAccount(acc)}
                  >
                    Forget
                  </FocusButton>
                </div>
              ))}
            </div>
          )}

          <Field label="Server">
            <FocusInput
              focusKey="login-server"
              className={INPUT}
              type="text"
              placeholder="http://yourserver.com:8080"
              value={server}
              onChange={e => setServer(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Username">
            <FocusInput className={INPUT} type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="Password">
            <div className="flex">
              <FocusInput
                className={`${INPUT} flex-1`}
                type={showPass ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <FocusButton
                className="ml-3 flex size-14 flex-none items-center justify-center rounded-lg bg-white/10 text-white"
                aria-label={showPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowPass(v => !v)}
              >
                {showPass ? <EyeOffIcon className="size-6" /> : <EyeIcon className="size-6" />}
              </FocusButton>
            </div>
          </Field>

          {error && <p className="mb-5 rounded-lg bg-red-500/10 px-5 py-3 text-base text-red-400">{error}</p>}

          <ActionButton variant="primary" type="submit" disabled={pending} className="w-full">
            {pending ? 'Connecting…' : 'Sign in'}
          </ActionButton>
        </form>
      </FocusScope>
    </div>
  )
}

const INPUT = 'h-14 w-full rounded-lg bg-white/10 px-5 text-xl text-white placeholder-[#667684]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="mb-2 block text-sm font-semibold uppercase tracking-wider text-[#667684]">{label}</label>
      {children}
    </div>
  )
}
