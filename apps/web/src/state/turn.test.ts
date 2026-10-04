import type { Message, MessageId, TurnEvent, UnknownEvent } from "@camena-ai/contracts"
import { assert, describe, it } from "@effect/vitest"
import { beginTurn, conversationLabel, foldTurn, type LiveTurn, mergeMessages } from "./turn.ts"

const ASSISTANT = "11111111-1111-4111-8111-111111111111" as MessageId
const fold = (events: ReadonlyArray<TurnEvent | UnknownEvent>): LiveTurn =>
  events.reduce(foldTurn, beginTurn("Hello", "vendor/model-a"))

describe("foldTurn", () => {
  it("streams an online answer into the assistant message", () => {
    const turn = fold([
      { _tag: "start", messageId: ASSISTANT },
      { _tag: "classification", label: "clean" },
      { _tag: "route", type: "online", model: "vendor/model-a" },
      { _tag: "token", text: "Hi" },
      { _tag: "token", text: " there" },
      { _tag: "usage", tokensIn: 5, tokensOut: 2 },
      { _tag: "done" },
    ])
    assert.strictEqual(turn.assistantId, ASSISTANT)
    assert.isTrue(turn.finished)
    assert.deepInclude(turn.user, { label: "clean", route: "online", status: "complete" })
    assert.deepInclude(turn.assistant, {
      key: ASSISTANT,
      content: "Hi there",
      status: "complete",
      route: "online",
      modelId: "vendor/model-a",
    })
  })

  it("closes the turn on route.blocked and keeps the classified label visible", () => {
    const turn = fold([
      { _tag: "start", messageId: ASSISTANT },
      { _tag: "classification", label: "classified" },
      { _tag: "route", type: "blocked", reason: "no_chain_target" },
      { _tag: "done" },
    ])
    assert.isTrue(turn.finished)
    assert.strictEqual(turn.user.label, "classified")
    assert.deepInclude(turn.assistant, {
      status: "blocked",
      route: "blocked",
      blockedReason: "no_chain_target",
      content: "",
    })
  })

  it("marks the assistant failed with the error's code and reason only", () => {
    const turn = fold([
      { _tag: "start", messageId: ASSISTANT },
      { _tag: "classification", label: "clean" },
      { _tag: "route", type: "online", model: "vendor/model-a" },
      { _tag: "token", text: "partial" },
      { _tag: "error", code: "upstream_failed", reason: "timeout" },
    ])
    assert.isTrue(turn.finished)
    assert.strictEqual(turn.assistant.status, "failed")
    assert.deepStrictEqual(turn.assistant.error, { code: "upstream_failed", reason: "timeout" })
  })

  it("keeps a local route streaming after done, waiting for the device's result", () => {
    const turn = fold([
      { _tag: "start", messageId: ASSISTANT },
      { _tag: "classification", label: "classified" },
      { _tag: "route", type: "local", model: "device-model" },
      { _tag: "done" },
    ])
    assert.strictEqual(turn.assistant.status, "streaming")
    assert.strictEqual(turn.assistant.route, "local")
  })

  it("skips events it does not know", () => {
    const before = fold([{ _tag: "start", messageId: ASSISTANT }])
    assert.deepStrictEqual(foldTurn(before, { _tag: "unknown", event: "progress" }), before)
  })
})

describe("mergeMessages", () => {
  const stored = (id: string, author: "user" | "assistant", content: string): Message => ({
    id: id as MessageId,
    author,
    content,
    status: "complete",
    label: author === "user" ? "clean" : null,
    cleared: false,
    attachments: [],
    requestedModel: null,
    resolvedRoute: "online",
    modelId: "vendor/model-a",
    createdAt: new Date(0),
  })

  it("appends the live turn while the server does not hold it yet", () => {
    const live = fold([{ _tag: "start", messageId: ASSISTANT }])
    const merged = mergeMessages([stored("a", "user", "earlier")], live)
    assert.deepStrictEqual(
      merged.map((m) => m.key),
      ["a", "pending-user", ASSISTANT],
    )
  })

  it("hides the server's in-flight rows of the live turn instead of the overlay", () => {
    const live = fold([
      { _tag: "start", messageId: ASSISTANT },
      { _tag: "token", text: "Hi" },
    ])
    const inFlight = { ...stored(ASSISTANT, "assistant", ""), status: "streaming" as const }
    const merged = mergeMessages(
      [stored("a", "user", "earlier"), stored("u", "user", "Hello"), inFlight],
      live,
    )
    assert.deepStrictEqual(
      merged.map((m) => m.content),
      ["earlier", "Hello", "Hi"],
    )
  })

  it("drops the overlay once the server returns the assistant message", () => {
    const live = fold([{ _tag: "start", messageId: ASSISTANT }, { _tag: "done" }])
    const merged = mergeMessages(
      [stored("u", "user", "Hello"), stored(ASSISTANT, "assistant", "Hi there")],
      live,
    )
    assert.deepStrictEqual(
      merged.map((m) => m.content),
      ["Hello", "Hi there"],
    )
  })
})

describe("conversationLabel", () => {
  const user = (content: string | null) => ({ author: "user" as const, content })
  it("prefers the title", () => {
    assert.strictEqual(conversationLabel("Trip plan", [user("hello")]), "Trip plan")
  })
  it("falls back to the first user message on one line, shortened", () => {
    assert.strictEqual(
      conversationLabel(null, [user("  Reply with\nthree   words ")]),
      "Reply with three words",
    )
    const long = "a".repeat(80)
    const label = conversationLabel(null, [user(long)])
    assert.strictEqual(label.length, 48)
    assert.isTrue(label.endsWith("…"))
  })
  it("is New chat without a user message", () => {
    assert.strictEqual(conversationLabel(null, []), "New chat")
    assert.strictEqual(conversationLabel("  ", [user(null)]), "New chat")
  })
})
