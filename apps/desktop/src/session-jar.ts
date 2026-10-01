/**
 * The gateway session, held by the main process only (D16, §7: the renderer never holds the seat
 * token). Better Auth's cookies from the gateway's `Set-Cookie` headers are absorbed here and sent
 * back on proxied requests; the renderer's responses never carry them.
 */

export interface StoredCookie {
  readonly value: string
  /** Epoch milliseconds; absent for a session cookie. */
  readonly expiresAt?: number
}

export type JarSnapshot = Readonly<Record<string, StoredCookie>>

const parseSetCookie = (header: string, now: number): [string, StoredCookie | null] | null => {
  const [pair, ...attributes] = header.split(";")
  const eq = pair?.indexOf("=") ?? -1
  if (pair === undefined || eq <= 0) return null
  const name = pair.slice(0, eq).trim()
  const value = pair.slice(eq + 1).trim()
  let expiresAt: number | undefined
  for (const attribute of attributes) {
    const [key = "", raw = ""] = attribute.split("=").map((part) => part.trim())
    const lower = key.toLowerCase()
    if (lower === "max-age") {
      const seconds = Number(raw)
      if (Number.isFinite(seconds)) expiresAt = now + seconds * 1000
    } else if (lower === "expires" && expiresAt === undefined) {
      const at = Date.parse(raw)
      if (!Number.isNaN(at)) expiresAt = at
    }
  }
  if (value === "" || (expiresAt !== undefined && expiresAt <= now)) return [name, null]
  return [name, expiresAt === undefined ? { value } : { value, expiresAt }]
}

export class SessionJar {
  private readonly cookies = new Map<string, StoredCookie>()

  constructor(snapshot: JarSnapshot = {}, now = Date.now()) {
    for (const [name, cookie] of Object.entries(snapshot)) {
      if (cookie.expiresAt === undefined || cookie.expiresAt > now) this.cookies.set(name, cookie)
    }
  }

  /** Applies a response's `Set-Cookie` headers; returns whether the jar changed. */
  absorb(setCookies: ReadonlyArray<string>, now = Date.now()): boolean {
    let changed = false
    for (const header of setCookies) {
      const parsed = parseSetCookie(header, now)
      if (parsed === null) continue
      const [name, cookie] = parsed
      if (cookie === null) changed = this.cookies.delete(name) || changed
      else {
        this.cookies.set(name, cookie)
        changed = true
      }
    }
    return changed
  }

  /** The `Cookie` request header, or `null` when the jar holds nothing live. */
  header(now = Date.now()): string | null {
    const live = [...this.cookies].filter(([, c]) => c.expiresAt === undefined || c.expiresAt > now)
    return live.length === 0 ? null : live.map(([name, c]) => `${name}=${c.value}`).join("; ")
  }

  snapshot(): JarSnapshot {
    return Object.fromEntries(this.cookies)
  }

  clear(): void {
    this.cookies.clear()
  }
}
