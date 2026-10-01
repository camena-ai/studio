/**
 * The Content-Security-Policy for the bundled web build. Nothing loads from a remote origin: the
 * gateway is reached through the app's own origin. `index.html`'s inline theme script (applied
 * before first paint) is allowed by its hash, never by `'unsafe-inline'`.
 */
import { createHash } from "node:crypto"

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi

export const inlineScriptHashes = (html: string): ReadonlyArray<string> =>
  [...html.matchAll(INLINE_SCRIPT)].map(
    ([, body = ""]) => `'sha256-${createHash("sha256").update(body).digest("base64")}'`,
  )

export const contentSecurityPolicy = (scriptHashes: ReadonlyArray<string> = []): string =>
  [
    "default-src 'self'",
    ["script-src 'self'", ...scriptHashes].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ")
