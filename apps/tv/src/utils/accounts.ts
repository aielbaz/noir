import { createListStore } from './list-store'
import type { Creds } from './xtream'

const store = createListStore<Creds>('streambox_accounts', 8)

export function rememberAccount(creds: Creds) {
  const same = (a: Creds) => a.base === creds.base && a.username === creds.username
  store.set([creds, ...store.get().filter(a => !same(a))])
}

export function forgetAccount(creds: Creds) {
  store.set(store.get().filter(a => !(a.base === creds.base && a.username === creds.username)))
}

export const useAccounts = store.useList
