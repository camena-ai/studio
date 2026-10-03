import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { AtomRegistry } from "effect/unstable/reactivity"
import { InferenceUnavailable } from "../api/local-inference.ts"
import { httpClientLayerAtom } from "../api/studio-api.ts"
import {
  formatBytes,
  formatDuration,
  inferenceStatusAtom,
  pauseInferenceAtom,
  swappedShare,
} from "./local-inference.ts"

const GB = 1024 ** 3
const STATUS = {
  state: "running",
  since: "2026-10-03T12:00:00.000Z",
  lastError: null,
  model: { id: "local/model", name: "Local model", path: "/models/x", contextLength: 65536 },
  endpoint: "http://127.0.0.1:8083/v1",
  inFlight: 0,
  memory: {
    pid: 42,
    footprintBytes: 20 * GB,
    swappedBytes: 15 * GB,
    systemBytes: 36 * GB,
    swapUsedBytes: 18 * GB,
    swapTotalBytes: 20 * GB,
  },
  recent: [
    {
      at: "2026-10-03T12:01:00.000Z",
      promptTokens: null,
      completionTokens: null,
      ttftMs: 2393,
      durationMs: 2688,
      outcome: "ok",
    },
  ],
}

function registryWith(respond: (request: Request) => Response) {
  const requests: Array<Request> = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    return respond(request)
  }
  const layer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  )
  return {
    registry: AtomRegistry.make({ initialValues: [[httpClientLayerAtom, layer]] }),
    requests,
  }
}

describe("inferenceStatusAtom", () => {
  it.effect("decodes the supervisor's status from /local-inference/status", () =>
    Effect.gen(function* () {
      const { registry, requests } = registryWith(() => Response.json(STATUS))
      const status = yield* AtomRegistry.getResult(registry, inferenceStatusAtom)
      assert.strictEqual(status.state, "running")
      assert.strictEqual(status.recent[0]?.ttftMs, 2393)
      assert.strictEqual(new URL(requests[0]?.url ?? "").pathname, "/local-inference/status")
    }),
  )

  it.effect("is InferenceUnavailable where no supervisor answers", () =>
    Effect.gen(function* () {
      const { registry } = registryWith(() => new Response("not found", { status: 404 }))
      const error = yield* Effect.flip(AtomRegistry.getResult(registry, inferenceStatusAtom))
      assert.instanceOf(error, InferenceUnavailable)
    }),
  )
})

describe("pauseInferenceAtom", () => {
  it.effect("posts with the control header", () =>
    Effect.gen(function* () {
      const { registry, requests } = registryWith((request) =>
        request.method === "POST"
          ? Response.json({ state: "stopping" }, { status: 202 })
          : Response.json(STATUS),
      )
      registry.set(pauseInferenceAtom, undefined)
      yield* AtomRegistry.getResult(registry, pauseInferenceAtom, { suspendOnWaiting: true })
      const post = requests.find((r) => r.method === "POST")
      assert.strictEqual(new URL(post?.url ?? "").pathname, "/local-inference/pause")
      assert.strictEqual(post?.headers.get("x-studio-control"), "1")
    }),
  )
})

describe("helpers", () => {
  it("formats bytes and durations", () => {
    assert.strictEqual(formatBytes(20.7 * GB), "20.7 GB")
    assert.strictEqual(formatBytes(55 * 1024 ** 2), "55 MB")
    assert.strictEqual(formatBytes(null), "—")
    assert.strictEqual(formatDuration(420), "420 ms")
    assert.strictEqual(formatDuration(2688), "2.7 s")
  })

  it("computes the swapped share of a loaded model only", () => {
    assert.strictEqual(swappedShare(STATUS as never), 0.75)
    const paused = {
      ...STATUS,
      memory: { ...STATUS.memory, footprintBytes: null, swappedBytes: null },
    }
    assert.isNull(swappedShare(paused as never))
  })
})
