import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiError } from "effect/unstable/httpapi"
import { AtomRegistry } from "effect/unstable/reactivity"
import { healthAtom, httpClientLayerAtom } from "./studio-api.ts"

/** A registry whose `StudioApiClient` answers every request with `respond()`. */
function registryAnswering(respond: () => Response) {
  const urls: Array<string> = []
  const fetch: typeof globalThis.fetch = async (input) => {
    urls.push(String(input))
    return respond()
  }
  const layer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  )
  return { registry: AtomRegistry.make({ initialValues: [[httpClientLayerAtom, layer]] }), urls }
}

describe("healthAtom", () => {
  it.effect("decodes { status: ok } from GET /health", () =>
    Effect.gen(function* () {
      const { registry, urls } = registryAnswering(() => Response.json({ status: "ok" }))
      const health = yield* AtomRegistry.getResult(registry, healthAtom)
      assert.deepStrictEqual(health, { status: "ok" })
      assert.deepStrictEqual(urls, [`${globalThis.location.origin}/health`])
    }),
  )

  it.effect("decodes an empty 503 as ServiceUnavailable, not a defect", () =>
    Effect.gen(function* () {
      const { registry } = registryAnswering(() => new Response(null, { status: 503 }))
      const error = yield* Effect.flip(AtomRegistry.getResult(registry, healthAtom))
      assert.instanceOf(error, HttpApiError.ServiceUnavailable)
    }),
  )
})
