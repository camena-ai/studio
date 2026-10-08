/**
 * Conversation state on Effect Atom over the contracts client (D21, D22, §13).
 *
 * `sendTurnAtom(id)` owns a turn: it posts to the raw streaming route, folds every decoded
 * `TurnEvent` into `liveTurnAtom(id)` and refreshes the conversation when the stream ends. It is
 * not kept alive, so unmounting the conversation interrupts its fiber, which closes the SSE
 * connection: the client side of the gateway's disconnect → abort contract.
 */
import type { AttachmentId, ConversationId } from "@camena-ai/contracts"
import { Effect, Stream } from "effect"
import { Atom } from "effect/unstable/reactivity"
import { STEP_EVENTS } from "../api/agent.ts"
import { StudioApiClient } from "../api/studio-api.ts"
import { newId } from "../lib/id.ts"
import { stepsAtom } from "./steps.ts"
import type { ChatAttachment } from "./turn.ts"
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
  /** Checked files the message carries (contracts 0.14). */
  readonly attachments?: ReadonlyArray<ChatAttachment & { readonly id: AttachmentId }>
}

/** Why the gateway refused a turn before streaming it; codes only. */
export const refusalOf = (error: unknown): string => {
  if (typeof error === "object" && error !== null) {
    if ("code" in error && typeof error.code === "string") return error.code
    if ("_tag" in error && typeof error._tag === "string") return error._tag
  }
  return "unreachable"
}

/** A new chat's first message: waits here until the gateway
 * has started its turn (`start`) or refused it. */
export const firstTurnAtom = Atom.make<{
  readonly conversationId: ConversationId
  readonly input: TurnInput
} | null>(null).pipe(Atom.keepAlive)

export const sendTurnAtom = Atom.family((id: ConversationId) =>
  StudioApiClient.runtime.fn(
    Effect.fnUntraced(function* (input: TurnInput, get) {
      const client = yield* StudioApiClient
      const registry = get.registry
      const live = liveTurnAtom(id)
      // Through the registry, so the turn never depends on, or is re-run by, its own overlay.
      const update = (f: (turn: LiveTurn) => LiveTurn) => {
        const current = registry.get(live)
        if (current !== null) registry.set(live, f(current))
      }
      // A new chat's first message stays pending until the gateway has the turn, so a view that
      // remounts first sends it again under the same key and the gateway replays it.
      const settleFirstTurn = () => {
        if (registry.get(firstTurnAtom)?.conversationId === id) registry.set(firstTurnAtom, null)
      }
      const attachments = input.attachments ?? []
      registry.set(live, beginTurn(input.text, input.model, attachments))
      yield* client.conversations
        .turn({
          params: { id },
          payload: {
            text: input.text,
            model: input.model,
            ...(attachments.length === 0 ? {} : { attachmentIds: attachments.map((a) => a.id) }),
          },
          headers: { "idempotency-key": input.idempotencyKey },
        })
        .pipe(
          Stream.unwrap,
          Stream.runForEach((event) =>
            Effect.sync(() => {
              if (event._tag === "start") settleFirstTurn()
              // A tool step was written: this client's contracts predate the
              // events, so it reads the record instead of their payload.
              if (event._tag === "unknown" && STEP_EVENTS.has(event.event)) {
                registry.refresh(stepsAtom(id))
              }
              update((turn) => foldTurn(turn, event))
            }),
          ),
          Effect.tapError((error) =>
            Effect.sync(() => {
              settleFirstTurn()
              update((turn) => ({
                ...turn,
                finished: true,
                refusal: refusalOf(error),
                assistant: { ...turn.assistant, status: "failed" },
              }))
            }),
          ),
          // Interruption disposes this atom, after which `get.set` is a no-op; the registry
          // outlives it, so the overlay of an abandoned turn is cleared through it.
          Effect.onInterrupt(() => Effect.sync(() => registry.set(live, null))),
        )
      get.refresh(conversationAtom(id))
      get.refresh(conversationsAtom)
      registry.refresh(stepsAtom(id))
    }),
  ),
)

export const startChatAtom = StudioApiClient.runtime.fn(
  Effect.fnUntraced(function* (input: Omit<TurnInput, "idempotencyKey">, get) {
    const client = yield* StudioApiClient
    const conversation = yield* client.conversations.create()
    get.set(firstTurnAtom, {
      conversationId: conversation.id,
      input: { ...input, idempotencyKey: newId() },
    })
    get.refresh(conversationsAtom)
    return conversation.id
  }),
)
