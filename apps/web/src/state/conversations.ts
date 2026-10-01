/**
 * Conversation state on Effect Atom over the contracts client (D21, D22, §13).
 *
 * `sendTurnAtom(id)` owns a turn: it posts to the raw streaming route, folds every decoded
 * `TurnEvent` into `liveTurnAtom(id)` and refreshes the conversation when the stream ends. It is
 * not kept alive, so unmounting the conversation interrupts its fiber, which closes the SSE
 * connection: the client side of the gateway's disconnect → abort contract.
 */
import type { ConversationId } from "@camena-ai/contracts"
import { Effect, Stream } from "effect"
import { Atom } from "effect/unstable/reactivity"
import { StudioApiClient } from "../api/studio-api.ts"
import { beginTurn, foldTurn, type LiveTurn } from "./turn.ts"

export const conversationsAtom = StudioApiClient.query("conversations", "list", {
  reactivityKeys: ["conversations"],
})

export const modelsAtom = StudioApiClient.query("models", "list", {})

export const conversationAtom = Atom.family((id: ConversationId) =>
  StudioApiClient.query("conversations", "get", { params: { id } }),
)

/** The turn in flight on a conversation, or the last one until the server holds it. */
export const liveTurnAtom = Atom.family((_: ConversationId) =>
  Atom.make<LiveTurn | null>(null).pipe(Atom.keepAlive),
)

export interface TurnInput {
  readonly text: string
  readonly model: string
  /** Reused on a retry, so the gateway replays a finished turn rather than running it twice. */
  readonly idempotencyKey: string
}

/** Why the gateway refused a turn before streaming it; codes only. */
export const refusalOf = (error: unknown): string => {
  if (typeof error === "object" && error !== null) {
    if ("code" in error && typeof error.code === "string") return error.code
    if ("_tag" in error && typeof error._tag === "string") return error._tag
  }
  return "unreachable"
}

export const sendTurnAtom = Atom.family((id: ConversationId) =>
  StudioApiClient.runtime.fn(
    Effect.fnUntraced(function* (input: TurnInput, get) {
      const client = yield* StudioApiClient
      const live = liveTurnAtom(id)
      const update = (f: (turn: LiveTurn) => LiveTurn) => {
        const current = get(live)
        if (current !== null) get.set(live, f(current))
      }
      get.set(live, beginTurn(input.text, input.model))
      yield* client.conversations
        .turn({
          params: { id },
          payload: { text: input.text, model: input.model },
          headers: { "idempotency-key": input.idempotencyKey },
        })
        .pipe(
          Stream.unwrap,
          Stream.runForEach((event) => Effect.sync(() => update((turn) => foldTurn(turn, event)))),
          Effect.tapError((error) =>
            Effect.sync(() =>
              update((turn) => ({
                ...turn,
                finished: true,
                refusal: refusalOf(error),
                assistant: { ...turn.assistant, status: "failed" },
              })),
            ),
          ),
          Effect.onInterrupt(() => Effect.sync(() => get.set(live, null))),
        )
      get.refresh(conversationAtom(id))
      get.refresh(conversationsAtom)
    }),
  ),
)

/** A new chat's first message: waits here while the conversation is created and opened. */
export const firstTurnAtom = Atom.make<{
  readonly conversationId: ConversationId
  readonly input: TurnInput
} | null>(null).pipe(Atom.keepAlive)

export const startChatAtom = StudioApiClient.runtime.fn(
  Effect.fnUntraced(function* (input: Omit<TurnInput, "idempotencyKey">, get) {
    const client = yield* StudioApiClient
    const conversation = yield* client.conversations.create()
    get.set(firstTurnAtom, {
      conversationId: conversation.id,
      input: { ...input, idempotencyKey: crypto.randomUUID() },
    })
    get.refresh(conversationsAtom)
    return conversation.id
  }),
)
