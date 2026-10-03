/**
 * Composer state on Effect Atom (D22): the draft and the picked model. Submitting hands the draft
 * to the conversation atom that owns the SSE stream (§13).
 */
import type { ModelSummary } from "@camena-ai/contracts"
import { Atom } from "effect/unstable/reactivity"

export const composerDraftAtom: Atom.Writable<string> = Atom.make("").pipe(Atom.keepAlive)

/** The user's pick; empty until they choose, which means the first model the gateway lists. */
export const selectedModelIdAtom: Atom.Writable<string> = Atom.make("").pipe(Atom.keepAlive)

/** The picked model if the gateway still lists it, else the first one, else none. */
export const effectiveModel = (
  models: ReadonlyArray<ModelSummary>,
  selectedId: string,
): ModelSummary | undefined => models.find((model) => model.id === selectedId) ?? models[0]
