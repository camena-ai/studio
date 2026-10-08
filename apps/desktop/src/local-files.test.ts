import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { framesOf, runLocalCall, turnConversationOf } from "./agent-tools.ts"
import { localFoldersOf, withLocalFolders } from "./config.ts"
import { listFiles, readLocal, resolveInside, rootsOf, searchFiles } from "./local-files.ts"
import { proxyToGateway } from "./proxy.ts"
import { SessionJar } from "./session-jar.ts"

/** A granted folder `reports` and a secret file beside it, outside the grant. */
const fixture = () => {
  const base = mkdtempSync(path.join(tmpdir(), "yel-local-"))
  const reports = path.join(base, "reports")
  mkdirSync(path.join(reports, "2025"), { recursive: true })
  writeFileSync(path.join(reports, "notes.md"), "Quarterly review\nRevenue grew in Toboso.\n")
  writeFileSync(path.join(reports, "2025", "q1.csv"), "region,amount\nnorth,10\n")
  writeFileSync(path.join(reports, ".hidden"), "x")
  writeFileSync(path.join(reports, "photo.heic"), "x")
  writeFileSync(path.join(base, "secret.txt"), "do not read")
  symlinkSync(path.join(base, "secret.txt"), path.join(reports, "link.txt"))
  return { base, reports }
}

describe("local files", () => {
  it("lists the granted folders, then a folder's entries without hidden files or links", async () => {
    const { reports } = fixture()
    const roots = await rootsOf([reports])
    expect(await listFiles(roots)).toBe("reports/")
    const listing = await listFiles(roots, "reports")
    expect(listing).toContain("reports/2025/")
    expect(listing).toMatch(/reports\/notes\.md {2}\d+ B {2}\d{4}-\d{2}-\d{2}/)
    expect(listing).not.toContain(".hidden")
    expect(listing).not.toContain("link.txt")
  })

  it("never resolves outside a grant: .., a symbolic link out, or an unknown folder", async () => {
    const { reports } = fixture()
    const roots = await rootsOf([reports])
    expect(await resolveInside(roots, "reports/../secret.txt")).toEqual({
      error: "paths may not contain ..",
    })
    expect(await resolveInside(roots, "reports/link.txt")).toEqual({
      error: "that path leads outside the granted folder",
    })
    expect(await resolveInside(roots, "elsewhere/x")).toMatchObject({
      error: expect.stringContaining("no granted folder"),
    })
    expect(await readLocal(roots, "reports/link.txt")).toMatchObject({ kind: "error" })
  })

  it("searches names and text contents", async () => {
    const { reports } = fixture()
    const roots = await rootsOf([reports])
    expect(await searchFiles(roots, "q1")).toContain("reports/2025/q1.csv  (name)")
    expect(await searchFiles(roots, "toboso")).toContain(
      "reports/notes.md: Revenue grew in Toboso.",
    )
    expect(await searchFiles(roots, "nothing-like-this")).toMatch(/^No file name/)
  })

  it("reads a text file as text, hands a table back as a document, and refuses other kinds", async () => {
    const { reports } = fixture()
    const roots = await rootsOf([reports])
    expect(await readLocal(roots, "reports/notes.md")).toEqual({
      kind: "text",
      text: "Quarterly review\nRevenue grew in Toboso.\n",
    })
    expect(await readLocal(roots, "reports/2025/q1.csv")).toMatchObject({
      kind: "document",
      name: "reports/2025/q1.csv",
      mime: "text/csv",
    })
    expect(await readLocal(roots, "reports/photo.heic")).toMatchObject({ kind: "error" })
    expect(await readLocal(roots, "reports/2025")).toMatchObject({ kind: "error" })
  })

  it("keeps the grants in config.json beside the other settings", () => {
    const file = withLocalFolders('{"gatewayUrl":"http://h:3000"}', ["/a", "/b", "/a"])
    expect(JSON.parse(file)).toEqual({ gatewayUrl: "http://h:3000", localFolders: ["/a", "/b"] })
    expect(localFoldersOf(file)).toEqual(["/a", "/b"])
    expect(localFoldersOf('{"localFolders":["relative", 3, "/ok"]}')).toEqual(["/ok"])
    expect(localFoldersOf(null)).toEqual([])
  })
})

describe("agent tools", () => {
  it("splits event-stream text into frames and keeps the remainder", () => {
    const { frames, rest } = framesOf(
      'event: start\ndata: {"messageId":"m"}\n\n: hb\n\nevent: tool_call\ndata: {"id":"c"}\n\nevent: tok',
    )
    expect(frames).toEqual([
      { event: "start", data: '{"messageId":"m"}' },
      { event: "tool_call", data: '{"id":"c"}' },
    ])
    expect(rest).toBe("event: tok")
  })

  it("knows a turn's or an edit's conversation and nothing else", () => {
    const id = "0b9e5f1e-6f3c-4b7e-9a8f-1d2c3b4a5e6f"
    expect(turnConversationOf("POST", `/v1/conversations/${id}/turns`)).toBe(id)
    expect(turnConversationOf("POST", `/v1/conversations/${id}/messages/${id}/edit`)).toBe(id)
    expect(turnConversationOf("GET", `/v1/conversations/${id}/turns`)).toBeNull()
    expect(turnConversationOf("POST", "/v1/attachments")).toBeNull()
  })

  it("uploads a document it opens and answers with the attachment's id", async () => {
    const { reports } = fixture()
    const roots = await rootsOf([reports])
    const sent: Array<{ url: string; type: string | null; cookie: string | null }> = []
    const fetch = (async (url: URL, init: RequestInit) => {
      const headers = new Headers(init.headers)
      sent.push({
        url: String(url),
        type: headers.get("studio-declared-type"),
        cookie: headers.get("cookie"),
      })
      return new Response(JSON.stringify({ id: "att-1", status: "pending" }), { status: 201 })
    }) as unknown as typeof globalThis.fetch
    const result = await runLocalCall(roots, "local_read_file", '{"path":"reports/2025/q1.csv"}', {
      gateway: new URL("http://gateway:3000"),
      cookie: () => "session=s",
      fetch,
    })
    expect(result).toMatchObject({ ok: true, attachmentId: "att-1" })
    expect(sent).toEqual([
      { url: "http://gateway:3000/v1/attachments", type: "text/csv", cookie: "session=s" },
    ])
  })
})

describe("the proxy and local tools", () => {
  it("marks a turn request and hands a copy of its event stream to the watcher", async () => {
    const id = "0b9e5f1e-6f3c-4b7e-9a8f-1d2c3b4a5e6f"
    let header: string | null = null
    const fetch = (async (_url: URL, init: RequestInit) => {
      header = new Headers(init.headers).get("studio-client-tools")
      return new Response("event: done\ndata: {}\n\n", {
        headers: { "content-type": "text/event-stream" },
      })
    }) as unknown as typeof globalThis.fetch
    const watched: Array<string> = []
    const response = await proxyToGateway(
      new Request(`app://studio/v1/conversations/${id}/turns`, { method: "POST", body: "{}" }),
      {
        gateway: new URL("http://gateway:3000"),
        jar: new SessionJar(),
        fetch,
        localTools: {
          enabled: () => true,
          watch: (conversationId, stream) => {
            watched.push(conversationId)
            void new Response(stream).text()
          },
        },
      },
    )
    expect(header).toBe("files")
    expect(await response.text()).toBe("event: done\ndata: {}\n\n")
    expect(watched).toEqual([id])
  })

  it("sends no header and watches nothing without grants", async () => {
    let header: string | null = "unset"
    const fetch = (async (_url: URL, init: RequestInit) => {
      header = new Headers(init.headers).get("studio-client-tools")
      return new Response("", { headers: { "content-type": "text/event-stream" } })
    }) as unknown as typeof globalThis.fetch
    await proxyToGateway(
      new Request("app://studio/v1/conversations/0b9e5f1e-6f3c-4b7e-9a8f-1d2c3b4a5e6f/turns", {
        method: "POST",
        body: "{}",
      }),
      {
        gateway: new URL("http://gateway:3000"),
        jar: new SessionJar(),
        fetch,
        localTools: { enabled: () => false, watch: () => expect.unreachable() },
      },
    )
    expect(header).toBeNull()
  })
})
