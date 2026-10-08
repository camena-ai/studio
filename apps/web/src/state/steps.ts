/**
 * A conversation's agent steps, by assistant message id. Refreshed by the turn
 * whenever it sees a step event, and when the turn ends, so the live turn and a reload read the
 * same record.
 */
import type { ConversationId } from "@camena-ai/contracts"
import { Effect } from "effect"
import { Atom } from "effect/unstable/reactivity"
import { type AgentStep, fetchSteps } from "../api/agent.ts"

export const stepsAtom = Atom.family((id: ConversationId) =>
  Atom.make(
    Effect.tryPromise({
      try: () => fetchSteps(id),
      catch: () => new Error("steps unavailable"),
    }),
  ).pipe(Atom.keepAlive),
)

export type StepsByMessage = ReadonlyMap<string, ReadonlyArray<AgentStep>>
