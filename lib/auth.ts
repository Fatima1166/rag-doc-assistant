"use client"
import { useEffect, useState } from "react"
import { API, restoreToken, logout as apiLogout, me, signup as apiSignup, login as apiLogin, wantsRemember, Unauthorized, type PublicUser } from "./api"
import { useDocs } from "./docs"

export type User = { name: string; email: string; verified?: boolean; avatar?: string }
const KEY = "ragdocs-user", COOKIE = "ragdocs_session", TICK = "ragdocs-session"
const DEMO_USER: User = { name: "Demo user", email: "demo@ragdocs.local", verified: true }
const toUser = (p: PublicUser): User => ({ name: p.name, email: p.email, verified: p.verified, avatar: p.avatar || undefined })

/** Write (or clear) the local cache + the marker cookie middleware.ts checks, then notify listeners.
 *  The cookie mirrors the token's lifetime: "remember me" persists it, otherwise it ends with the browser session. */
function setLocal(u: User | null, remember = false) {
  if (u) localStorage.setItem(KEY, JSON.stringify(u)); else localStorage.removeItem(KEY)
  document.cookie = u ? `${COOKIE}=1; path=/; samesite=lax${remember ? `; max-age=${60 * 60 * 24 * 30}` : ""}` : `${COOKIE}=; path=/; max-age=0`
  window.dispatchEvent(new Event(TICK))
}

/** The cached profile. With a backend there is no fallback identity: no sign-in means no user. */
export function readUser(): User | null {
  try {
    const cached = localStorage.getItem(KEY)
    if (cached) return JSON.parse(cached)
  } catch {}
  return API ? null : DEMO_USER
}

/** Demo sign-in (no backend). With a backend this is only the local cache; real auth is OAuth / signIn / signUp. */
export function startSession(u: User, remember = false) { setLocal(u, remember) }
export function endSession() {
  apiLogout()
  setLocal(null)
  useDocs.getState().setAll([]) // never let one account's document list linger for the next
}
export function nextPath() { const n = new URLSearchParams(location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") ? n : "/chat" }

export async function signIn(email: string, password: string, remember = false): Promise<User> {
  if (!API) { const u = { name: email.split("@")[0] || "Demo", email, verified: true }; startSession(u, remember); return u }
  const u = toUser(await apiLogin(email, password, remember)); startSession(u, remember); return u
}
export async function signUp(name: string, email: string, password: string, remember = false): Promise<User> {
  if (!API) { const u = { name, email, verified: true }; startSession(u, remember); return u }
  const u = toUser(await apiSignup(name, email, password, remember)); startSession(u, remember); return u
}

/** On boot: validate the stored token against the server and refresh the cached profile. */
export async function restoreSession(): Promise<User | null> {
  const local = readUser()
  if (!API) return local
  if (!restoreToken()) { if (local) setLocal(null); return null } // a cached profile without a token is not a session
  try {
    const u = toUser(await me())
    if (!local || local.name !== u.name || local.email !== u.email || local.verified !== u.verified || local.avatar !== u.avatar) setLocal(u, wantsRemember())
    return u
  } catch (e) {
    if (e instanceof Unauthorized) { setLocal(null); return null }
    return local // server unreachable: keep working from the cache
  }
}

/** Re-pull the profile from the server and refresh the cache (e.g. after email verification). */
export async function refreshUser(): Promise<User | null> {
  if (!API || !restoreToken()) return readUser()
  try { const u = toUser(await me()); setLocal(u, wantsRemember()); return u } catch { return readUser() }
}

/** Live session: re-renders every tab when it changes. `ready` is false until storage has been read. */
export function useSession() {
  const [s, setS] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false })
  useEffect(() => {
    let alive = true
    const sync = () => alive && setS({ user: readUser(), ready: true })
    sync()
    if (API) restoreSession().finally(sync)
    window.addEventListener(TICK, sync)
    return () => { alive = false; window.removeEventListener(TICK, sync) }
  }, [])
  return s
}
export function useUser() { return useSession().user }

/** Apply a saved profile locally so the sidebar/header update without a round-trip. */
export function cacheUser(u: User) { setLocal(u, wantsRemember()) }
