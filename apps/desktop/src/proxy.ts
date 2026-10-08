/**
 * The main-process proxy for the gateway's routes (D16, §7). A renderer request to
 * `app://studio/v1/...` is replayed against the gateway with the jar's cookies and the gateway's
 * own origin as `Origin` (the cookie-write check accepts it). The response streams back with every
 * `Set-Cookie` absorbed into the jar and removed, so the renderer never sees the session token.
 * Server-sent events stream through unchanged.
 *
 * With folders granted (`localTools`), a turn or an edit request says so to the gateway
 * (`studio-client-tools: files`), and a copy of its event stream goes to `localTools.watch`, which
 * answers the agent's local calls (`agent-tools.ts`); the renderer reads the original.
 */
import { turnConversationOf } from "./agent-tools.ts"
import type { SessionJar } from "./session-jar.ts"

/** Request headers the renderer may not set: the session and origin are the main process's. */
const DROPPED_REQUEST = new Set(["cookie", "origin", "host", "referer", "authorization"])
/** Response headers that are hop-by-hop or carry the session. */
const DROPPED_RESPONSE = new Set(["set-cookie", "connection", "keep-alive", "transfer-encoding"])

export interface ProxyOptions {
  readonly gateway: URL
  readonly jar: SessionJar
  /** Called after the jar changed, so it can be persisted. */
  readonly onJarChange?: () => void
  readonly fetch?: typeof globalThis.fetch
  /** The agent's local tools, when the user granted folders. */
  readonly localTools?: {
    readonly enabled: () => boolean
    readonly watch: (conversationId: string, stream: ReadableStream<Uint8Array>) => void
  }
}

export const proxyToGateway = async (
  request: Request,
  options: ProxyOptions,
): Promise<Response> => {
  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, options.gateway)

  const headers = new Headers()
  request.headers.forEach((value, name) => {
    if (!DROPPED_REQUEST.has(name.toLowerCase())) headers.set(name, value)
  })
  headers.set("origin", options.gateway.origin)
  const turnOf = turnConversationOf(request.method, incoming.pathname)
  const localTools = turnOf !== null && options.localTools?.enabled() === true
  if (localTools) headers.set("studio-client-tools", "files")
  const cookie = options.jar.header()
  if (cookie !== null) headers.set("cookie", cookie)

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const response = await (options.fetch ?? globalThis.fetch)(target, {
    method: request.method,
    headers,
    redirect: "manual",
    signal: request.signal,
    ...(hasBody ? { body: request.body, duplex: "half" } : {}),
  } as RequestInit)

  if (options.jar.absorb(response.headers.getSetCookie())) options.onJarChange?.()

  const out = new Headers()
  response.headers.forEach((value, name) => {
    if (!DROPPED_RESPONSE.has(name.toLowerCase())) out.set(name, value)
  })
  if (
    localTools &&
    turnOf !== null &&
    response.status === 200 &&
    response.body !== null &&
    (response.headers.get("content-type") ?? "").startsWith("text/event-stream")
  ) {
    const [renderer, watcher] = response.body.tee()
    options.localTools?.watch(turnOf, watcher)
    return new Response(renderer, { status: response.status, headers: out })
  }
  return new Response(response.body, { status: response.status, headers: out })
}
