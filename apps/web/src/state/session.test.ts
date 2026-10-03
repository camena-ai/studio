import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { AtomRegistry } from "effect/unstable/reactivity"
import { AuthFailed } from "../api/auth.ts"
import { httpClientLayerAtom } from "../api/studio-api.ts"
import { sessionAtom, signInAtom, slugFor } from "./session.ts"

type Route = (body: unknown) => Response
const ORG = { id: "org-1", name: "Acme Test", slug: "acme-test" }
const USER = { id: "user-1", email: "owner@example.test", name: "Owner" }
const session = (activeOrganizationId: string | null) => ({
  session: { activeOrganizationId },
  user: USER,
})

/** A registry whose HTTP client answers by path and records `METHOD path body` per call. */
function registryRouting(routes: Record<string, Route>) {
  const calls: Array<string> = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    const raw = init?.body ? String(init.body) : ""
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${raw ? ` ${raw}` : ""}`)
    const route = routes[url.pathname]
    if (!route) return new Response(null, { status: 404 })
    return route(raw ? JSON.parse(raw) : undefined)
  }
  const layer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  )
  return { registry: AtomRegistry.make({ initialValues: [[httpClientLayerAtom, layer]] }), calls }
}

describe("signInAtom", () => {
  it.effect("signs in and activates the user's org when the session has none", () =>
    Effect.gen(function* () {
      let active: string | null = null
      const { registry, calls } = registryRouting({
        "/api/auth/sign-in/email": () => Response.json({ user: USER }),
        "/api/auth/get-session": () => Response.json(session(active)),
        "/api/auth/organization/list": () => Response.json([ORG]),
        "/api/auth/organization/set-active": (body) => {
          active = (body as { organizationId: string }).organizationId
          return Response.json(ORG)
        },
      })
      registry.set(signInAtom, { email: USER.email, password: "correct horse" })
      yield* AtomRegistry.getResult(registry, signInAtom, { suspendOnWaiting: true })

      assert.deepStrictEqual(calls, [
        `POST /api/auth/sign-in/email {"email":"${USER.email}","password":"correct horse"}`,
        "GET /api/auth/get-session",
        "GET /api/auth/organization/list",
        `POST /api/auth/organization/set-active {"organizationId":"${ORG.id}"}`,
      ])
      const current = yield* AtomRegistry.getResult(registry, sessionAtom, {
        suspendOnWaiting: true,
      })
      assert.strictEqual(current?.session.activeOrganizationId, ORG.id)
    }),
  )

  it.effect("keeps an already active org", () =>
    Effect.gen(function* () {
      const { registry, calls } = registryRouting({
        "/api/auth/sign-in/email": () => Response.json({ user: USER }),
        "/api/auth/get-session": () => Response.json(session("org-2")),
      })
      registry.set(signInAtom, { email: USER.email, password: "x" })
      yield* AtomRegistry.getResult(registry, signInAtom, { suspendOnWaiting: true })
      assert.isFalse(calls.some((call) => call.includes("/organization/")))
    }),
  )

  it.effect("fails with the status and Better Auth's code, never the body", () =>
    Effect.gen(function* () {
      const { registry } = registryRouting({
        "/api/auth/sign-in/email": () =>
          Response.json(
            { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
            { status: 401 },
          ),
      })
      registry.set(signInAtom, { email: USER.email, password: "wrong" })
      const error = yield* Effect.flip(
        AtomRegistry.getResult(registry, signInAtom, { suspendOnWaiting: true }),
      )
      assert.instanceOf(error, AuthFailed)
      assert.deepStrictEqual(
        { status: error.status, code: error.code },
        {
          status: 401,
          code: "INVALID_EMAIL_OR_PASSWORD",
        },
      )
    }),
  )
})

describe("sessionAtom", () => {
  it.effect("is null when signed out", () =>
    Effect.gen(function* () {
      const { registry } = registryRouting({
        "/api/auth/get-session": () => Response.json(null),
      })
      const current = yield* AtomRegistry.getResult(registry, sessionAtom)
      assert.isNull(current)
    }),
  )
})

describe("slugFor", () => {
  it("lower-cases, strips accents and joins words with dashes", () => {
    assert.strictEqual(slugFor("  Çay & Kahve Ltd. "), "cay-kahve-ltd")
    assert.strictEqual(slugFor("!!!"), "org")
  })
})
