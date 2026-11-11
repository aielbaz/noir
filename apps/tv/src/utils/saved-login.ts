// The signed-in account lives in localStorage (see AppProvider); routes read it before React renders.
export const LOGIN_KEY = 'streambox_creds'

export function hasSavedLogin() {
  try { return !!localStorage.getItem(LOGIN_KEY) } catch { return false }
}
