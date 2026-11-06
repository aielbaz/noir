// Minimal JSON-over-fetch helper. Deliberately dependency-free: the oldest
// target TVs run Chromium 79, which lacks newer platform APIs that general
// purpose HTTP libraries lean on (AbortSignal.timeout/any, throwIfAborted...).

// Full section lists run to ~13 MB, which a TV on Wi-Fi can take a while to pull.
const TIMEOUT_MS = 120_000
// A reachable server starts answering within seconds; only the download is slow.
const FIRST_BYTE_MS = 20_000
// How long a redirect may take to answer before it is treated as a block.
const REDIRECT_MS = 8_000

// Short, plain-language reason for the screens that show a failed load.
export function describeError(error: unknown): string {
  if (error instanceof RedirectError) return 'Your internet provider is redirecting the provider’s address, so it can’t be reached. Check your internet account or quota, or try another network.'
  if (error instanceof TimeoutError) return 'The provider took too long to answer.'
  if (error instanceof HttpError) return `The provider answered with an error (${error.status}).`
  return 'Couldn’t reach the provider. Check your internet connection.'
}

export class HttpError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
  }
}

// The provider's address answered with a redirect to some other site. On a home
// connection that is almost always the ISP (quota or billing notice, or a block).
export class RedirectError extends Error {
  constructor() {
    super('Redirected away from the provider')
    this.name = 'RedirectError'
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Request timed out')
    this.name = 'TimeoutError'
  }
}

export async function getJson<T>(url: string, { signal }: { signal?: AbortSignal } = {}): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const expire = () => { timedOut = true; controller.abort() }
  let timer = window.setTimeout(expire, FIRST_BYTE_MS)
  const total = window.setTimeout(expire, TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', onAbort)

  try {
    // Redirects are not followed blindly: an ISP notice page can hang for ages.
    let response = await fetch(url, { signal: controller.signal, redirect: 'manual' })
    if (response.type === 'opaqueredirect') {
      // Some providers legitimately redirect (e.g. to https), so give it a short chance.
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { timedOut = true; controller.abort() }, REDIRECT_MS)
      try {
        response = await fetch(url, { signal: controller.signal })
      } catch (error) {
        if (timedOut) throw new RedirectError()
        throw error
      }
    }
    window.clearTimeout(timer)
    if (!response.ok) throw new HttpError(response.status)
    return (await response.json()) as T
  } catch (error) {
    if (timedOut) throw error instanceof RedirectError ? error : new TimeoutError()
    throw error
  } finally {
    window.clearTimeout(timer)
    window.clearTimeout(total)
    signal?.removeEventListener('abort', onAbort)
  }
}
