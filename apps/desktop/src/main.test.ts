import { createHash } from "node:crypto"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { contentSecurityPolicy, inlineScriptHashes } from "./csp.ts"
import { proxyToGateway } from "./proxy.ts"
import { contentTypeFor, isGatewayPath, staticFileFor } from "./routes.ts"
import { SessionJar } from "./session-jar.ts"

describe("isGatewayPath", () => {
  it("routes the gateway's paths and nothing else", () => {
    for (const p of ["/v1/me", "/v1/conversations/x/turns", "/api/auth/sign-in/email", "/health"]) {
      expect(isGatewayPath(p)).toBe(true)
    }
    for (const p of ["/", "/c/abc", "/assets/index.js", "/v1x", "/api/other", "/healthz"]) {
      expect(isGatewayPath(p)).toBe(false)
    }
  })
})

describe("staticFileFor", () => {
  const root = path.resolve("/srv/web")
  it("serves files under the root and the SPA for routes", () => {
    expect(staticFileFor(root, "/assets/index-abc.js")).toBe(path.join(root, "assets/index-abc.js"))
    expect(staticFileFor(root, "/")).toBe(path.join(root, "index.html"))
    expect(staticFileFor(root, "/c/2222")).toBe(path.join(root, "index.html"))
  })
  it("refuses paths that escape the root", () => {
    expect(staticFileFor(root, "/../../etc/passwd.txt")).toBe(path.join(root, "etc/passwd.txt"))
    expect(staticFileFor(root, "/%2e%2e/%2e%2e/etc/hosts.txt")).toBe(
      path.join(root, "etc/hosts.txt"),
    )
    expect(staticFileFor(root, "/a%00.js")).toBeNull()
    expect(staticFileFor(root, "/%E0%A4%A.js")).toBeNull()
  })
  it("knows the web build's content types", () => {
    expect(contentTypeFor("/x/index.html")).toBe("text/html; charset=utf-8")
    expect(contentTypeFor("/x/a.js")).toBe("text/javascript; charset=utf-8")
    expect(contentTypeFor("/x/blob.bin")).toBe("application/octet-stream")
  })
})

describe("SessionJar", () => {
  const now = Date.UTC(2026, 9, 1)
  it("absorbs Set-Cookie and answers a Cookie header", () => {
    const jar = new SessionJar({}, now)
    jar.absorb(
      [
        "better-auth.session_token=tok.sig; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800",
        "better-auth.session_data=abc; Path=/; Max-Age=300",
      ],
      now,
    )
    expect(jar.header(now)).toBe("better-auth.session_token=tok.sig; better-auth.session_data=abc")
    expect(jar.header(now + 301_000)).toBe("better-auth.session_token=tok.sig")
  })
  it("deletes a cookie the gateway expires", () => {
    const jar = new SessionJar({ "better-auth.session_token": { value: "tok" } }, now)
    expect(jar.absorb(["better-auth.session_token=; Max-Age=0; Path=/"], now)).toBe(true)
    expect(jar.header(now)).toBeNull()
  })
  it("round-trips through a snapshot and drops expired entries", () => {
    const jar = new SessionJar({}, now)
    jar.absorb(["a=1; Max-Age=60", "b=2"], now)
    const restored = new SessionJar(jar.snapshot(), now + 120_000)
    expect(restored.header(now + 120_000)).toBe("b=2")
  })
})

describe("proxyToGateway", () => {
  const gateway = new URL("http://127.0.0.1:3000")

  it("sends the jar's session and the gateway's origin, never the renderer's", async () => {
    const jar = new SessionJar({ "better-auth.session_token": { value: "tok" } })
    let seen: Request | undefined
    const fetch: typeof globalThis.fetch = async (input, init) => {
      seen = new Request(input, init)
      return Response.json({ ok: true })
    }
    const request = new Request("app://studio/v1/models?x=1", {
      headers: { cookie: "evil=1", origin: "app://studio", accept: "application/json" },
    })
    await proxyToGateway(request, { gateway, jar, fetch })
    expect(seen?.url).toBe("http://127.0.0.1:3000/v1/models?x=1")
    expect(seen?.headers.get("cookie")).toBe("better-auth.session_token=tok")
    expect(seen?.headers.get("origin")).toBe("http://127.0.0.1:3000")
    expect(seen?.headers.get("accept")).toBe("application/json")
  })

  it("keeps Set-Cookie in the jar and out of the renderer's response", async () => {
    const jar = new SessionJar()
    let changed = 0
    const fetch: typeof globalThis.fetch = async () => {
      const headers = new Headers({ "content-type": "application/json" })
      headers.append("set-cookie", "better-auth.session_token=new; Path=/; HttpOnly")
      return new Response('{"user":{}}', { status: 200, headers })
    }
    const response = await proxyToGateway(
      new Request("app://studio/api/auth/sign-in/email", { method: "POST", body: "{}" }),
      { gateway, jar, fetch, onJarChange: () => changed++ },
    )
    expect(response.headers.get("set-cookie")).toBeNull()
    expect(response.headers.get("content-type")).toBe("application/json")
    expect(await response.text()).toBe('{"user":{}}')
    expect(jar.header()).toBe("better-auth.session_token=new")
    expect(changed).toBe(1)
  })

  it("streams a response body through as it arrives", async () => {
    const encoder = new TextEncoder()
    const fetch: typeof globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode("event: start\ndata: {}\n\n"))
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"))
            controller.close()
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      )
    const response = await proxyToGateway(new Request("app://studio/v1/conversations/x/turns"), {
      gateway,
      jar: new SessionJar(),
      fetch,
    })
    expect(response.headers.get("content-type")).toBe("text/event-stream")
    expect(await response.text()).toBe("event: start\ndata: {}\n\nevent: done\ndata: {}\n\n")
  })
})

describe("contentSecurityPolicy", () => {
  it("allows an inline script by its hash, not by unsafe-inline", () => {
    const html =
      '<script>document.documentElement.classList.add("dark")</script>' +
      '<script type="module" src="/assets/index.js"></script>'
    const hashes = inlineScriptHashes(html)
    expect(hashes).toEqual([
      "'sha256-" +
        createHash("sha256")
          .update('document.documentElement.classList.add("dark")')
          .digest("base64") +
        "'",
    ])
    const csp = contentSecurityPolicy(hashes)
    expect(csp).toContain(`script-src 'self' ${hashes[0]}`)
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    expect(csp).toContain("connect-src 'self'")
  })
})
