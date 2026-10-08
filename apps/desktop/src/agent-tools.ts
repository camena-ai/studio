/**
 * The desktop's half of the agent's local tools (main process). The proxy hands every turn's
 * event stream here (a copy; the renderer gets the original). When the gateway streams a
 * `tool_call` for `local_list_files`, `local_search_files` or `local_read_file`, the call runs over
 * the granted folders (`local-files.ts`) and its answer is posted to the gateway's
 * `…/client-results` with the jar's session: text as text, a document uploaded first through
 * `POST /v1/attachments` and named by its id, so the gateway checks and frames it.
 */
import { listFiles, type ReadResult, type Root, readLocal, searchFiles } from "./local-files.ts"

export const LOCAL_TOOLS = new Set(["local_list_files", "local_search_files", "local_read_file"])

export interface GatewayCall {
  readonly gateway: URL
  /** The jar's `Cookie` header, read when a call is made. */
  readonly cookie: () => string | null
  readonly fetch?: typeof globalThis.fetch
}

/** Splits an SSE text into complete frames, returning them and what is left over. */
export const framesOf = (
  buffered: string,
): { readonly frames: ReadonlyArray<{ event: string; data: string }>; readonly rest: string } => {
  const frames: Array<{ event: string; data: string }> = []
  const parts = buffered.split("\n\n")
  const rest = parts.pop() ?? ""
  for (const part of parts) {
    let event = "message"
    const data: Array<string> = []
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim()
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart())
    }
    if (data.length > 0) frames.push({ event, data: data.join("\n") })
  }
  return { frames, rest }
}

const argsOf = (code: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(code)
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const post = (call: GatewayCall, pathname: string, init: RequestInit) => {
  const headers = new Headers(init.headers)
  headers.set("origin", call.gateway.origin)
  const cookie = call.cookie()
  if (cookie !== null) headers.set("cookie", cookie)
  return (call.fetch ?? globalThis.fetch)(new URL(pathname, call.gateway), {
    ...init,
    method: "POST",
    headers,
  })
}

/** Runs one local call and answers it: the result's fields for `…/client-results`. */
export const runLocalCall = async (
  roots: ReadonlyArray<Root>,
  name: string,
  code: string,
  call: GatewayCall,
): Promise<{ ok: boolean; output: string; attachmentId?: string }> => {
  const args = argsOf(code)
  const text = (value: unknown) => (typeof value === "string" ? value : "")
  if (name === "local_list_files")
    return { ok: true, output: await listFiles(roots, text(args["path"])) }
  if (name === "local_search_files")
    return { ok: true, output: await searchFiles(roots, text(args["query"])) }
  const read: ReadResult = await readLocal(roots, text(args["path"]))
  if (read.kind === "error") return { ok: false, output: `Error: ${read.message}.` }
  if (read.kind === "text") return { ok: true, output: read.text }
  const uploaded = await post(call, "/v1/attachments", {
    headers: { "content-type": "application/octet-stream", "studio-declared-type": read.mime },
    body: read.bytes,
  })
  if (uploaded.status !== 201) {
    return { ok: false, output: `Error: the file could not be uploaded (${uploaded.status}).` }
  }
  const { id } = (await uploaded.json()) as { id: string }
  return { ok: true, output: `Opened ${read.name} (${read.bytes.length} bytes).`, attachmentId: id }
}

/**
 * Reads a turn's event stream and answers its local calls. Never throws: a failed call is
 * answered with its error, and a stream that breaks just ends the watch.
 */
export const watchTurn = async (
  stream: ReadableStream<Uint8Array>,
  conversationId: string,
  roots: () => Promise<ReadonlyArray<Root>>,
  call: GatewayCall,
): Promise<void> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffered = ""
  let messageId: string | undefined
  const answering: Array<Promise<unknown>> = []
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      const { frames, rest } = framesOf(buffered + decoder.decode(value, { stream: true }))
      buffered = rest
      for (const frame of frames) {
        if (frame.event === "start") {
          messageId = (JSON.parse(frame.data) as { messageId?: string }).messageId
          continue
        }
        if (frame.event !== "tool_call" || messageId === undefined) continue
        const event = JSON.parse(frame.data) as { id: string; name: string; code: string }
        if (!LOCAL_TOOLS.has(event.name)) continue
        const forMessage = messageId
        answering.push(
          (async () => {
            const result = await runLocalCall(await roots(), event.name, event.code, call).catch(
              (error: unknown) => ({
                ok: false,
                output: `Error: ${error instanceof Error ? error.message : "failed"}.`,
              }),
            )
            await post(
              call,
              `/v1/conversations/${conversationId}/messages/${forMessage}/client-results`,
              {
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ callId: event.id, ...result }),
              },
            ).catch(() => undefined)
          })(),
        )
      }
    }
  } catch {
    // The renderer's side of the stream ended or broke; nothing more to answer.
  }
  await Promise.allSettled(answering)
}

/** The conversation a turn or an edit request belongs to, or null for any other request. */
export const turnConversationOf = (method: string, pathname: string): string | null => {
  if (method !== "POST") return null
  const match =
    /^\/v1\/conversations\/([0-9a-f-]{36})\/(?:turns|messages\/[0-9a-f-]{36}\/edit)$/.exec(pathname)
  return match?.[1] ?? null
}
