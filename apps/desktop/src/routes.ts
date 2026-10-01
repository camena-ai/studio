/**
 * What the `app://` scheme serves for a request path (D16, §7): the gateway's routes go through
 * the main-process proxy, everything else is the bundled web build, with the SPA's `index.html`
 * for any path that is not a file.
 */
import path from "node:path"

/** The same routes CloudFront forwards to the gateway on the web, plus `/health` for plumbing. */
export const isGatewayPath = (pathname: string): boolean =>
  pathname === "/health" ||
  pathname === "/v1" ||
  pathname.startsWith("/v1/") ||
  pathname === "/api/auth" ||
  pathname.startsWith("/api/auth/")

/**
 * The file under `root` a static path names, or `null` for a path that escapes `root`. An empty
 * path or a directory-like one (no extension) is the SPA's `index.html`, so client-side routes
 * such as `/c/<id>` reload correctly.
 */
export const staticFileFor = (root: string, pathname: string): string | null => {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes("\0")) return null
  const relative = path.posix.normalize(decoded).replace(/^\/+/, "")
  if (relative === "" || path.posix.extname(relative) === "") return path.join(root, "index.html")
  const file = path.resolve(root, relative)
  const base = path.resolve(root)
  return file.startsWith(base + path.sep) ? file : null
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
}

export const contentTypeFor = (file: string): string =>
  TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream"
