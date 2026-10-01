import type { ConversationId } from "@camena-ai/contracts"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { AtomRegistry } from "effect/unstable/reactivity"
import { httpClientLayerAtom } from "../api/studio-api.ts"
import { firstTurnAtom, liveTurnAtom, sendTurnAtom } from "./conversations.ts"

const ID = "22222222-2222-4222-8222-222222222222" as ConversationId
const ASSISTANT = "33333333-3333-4333-8333-333333333333"

const sse = (frames: ReadonlyArray<[string, object]>) =>
  frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("")

function registryWith(respond: (request: Request) => Response) {
  const requests: Array<Request> = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
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

describe("sendTurnAtom", () => {
  it.effect("posts the turn with its idempotency key and folds the decoded stream", () =>
    Effect.gen(function* () {
      const body = sse([
        ["start", { messageId: ASSISTANT }],
        ["classification", { label: "clean" }],
        ["route", { type: "online", model: "vendor/model-a" }],
        ["token", { text: "Hel" }],
        ["token", { text: "lo" }],
        ["done", {}],
      ])
      const { registry, requests } = registryWith((request) =>
        request.method === "POST"
          ? new Response(`: hb\n\n${body}`, { headers: { "content-type": "text/event-stream" } })
          : Response.json({
              id: ID,
              title: null,
              createdAt: new Date(0).toISOString(),
              forkedFrom: null,
              messages: [],
              tainted: false,
            }),
      )
      const unmount = registry.mount(sendTurnAtom(ID))
      registry.set(sendTurnAtom(ID), {
        text: "Hi",
        model: "vendor/model-a",
        idempotencyKey: "key-1",
      })
      yield* AtomRegistry.getResult(registry, sendTurnAtom(ID), { suspendOnWaiting: true })

      const post = requests.find((r) => r.method === "POST")
      assert.strictEqual(new URL(post?.url ?? "").pathname, `/v1/conversations/${ID}/turns`)
      assert.strictEqual(post?.headers.get("idempotency-key"), "key-1")
      assert.deepStrictEqual(yield* Effect.promise(() => post?.json() ?? Promise.resolve()), {
        text: "Hi",
        model: "vendor/model-a",
      })
      const live = registry.get(liveTurnAtom(ID))
      assert.deepInclude(live?.assistant, { content: "Hello", status: "complete", route: "online" })
      assert.strictEqual(live?.user.label, "clean")
      unmount()
    }),
  )

  it.effect("records the gateway's refusal code when the turn is refused", () =>
    Effect.gen(function* () {
      const { registry } = registryWith(() =>
        Response.json(
          { _tag: "TurnConflict", code: "conversation_busy", messageId: ASSISTANT },
          { status: 409 },
        ),
      )
      const unmount = registry.mount(sendTurnAtom(ID))
      registry.set(sendTurnAtom(ID), { text: "Hi", model: "m", idempotencyKey: "key-2" })
      yield* Effect.flip(
        AtomRegistry.getResult(registry, sendTurnAtom(ID), { suspendOnWaiting: true }),
      )
      const live = registry.get(liveTurnAtom(ID))
      assert.strictEqual(live?.refusal, "conversation_busy")
      assert.strictEqual(live?.assistant.status, "failed")
      unmount()
    }),
  )

  it.effect("clears a new chat's pending first message once the gateway starts the turn", () =>
    Effect.gen(function* () {
      const body = sse([
        ["start", { messageId: ASSISTANT }],
        ["done", {}],
      ])
      const { registry } = registryWith((request) =>
        request.method === "POST"
          ? new Response(body, { headers: { "content-type": "text/event-stream" } })
          : new Response(null, { status: 503 }),
      )
      const input = { text: "Hi", model: "m", idempotencyKey: "key-3" }
      registry.set(firstTurnAtom, { conversationId: ID, input })
      const unmount = registry.mount(sendTurnAtom(ID))
      registry.set(sendTurnAtom(ID), input)
      yield* AtomRegistry.getResult(registry, sendTurnAtom(ID), { suspendOnWaiting: true })
      assert.isNull(registry.get(firstTurnAtom))
      unmount()
    }),
  )

  it.live("keeps the pending first message when the turn is interrupted before it starts", () =>
    Effect.gen(function* () {
      const { registry } = registryWith(
        () =>
          new Response(new ReadableStream(), {
            headers: { "content-type": "text/event-stream" },
          }),
      )
      const input = { text: "Hi", model: "m", idempotencyKey: "key-4" }
      registry.set(firstTurnAtom, { conversationId: ID, input })
      const unmount = registry.mount(sendTurnAtom(ID))
      registry.set(sendTurnAtom(ID), input)
      yield* Effect.sleep("10 millis")
      unmount()
      yield* Effect.sleep("10 millis")
      // A remounted view re-sends it with the same key, so the gateway replays rather than reruns.
      assert.deepStrictEqual(registry.get(firstTurnAtom), { conversationId: ID, input })
      assert.isNull(registry.get(liveTurnAtom(ID)))
    }),
  )
})
