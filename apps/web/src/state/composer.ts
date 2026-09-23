/**
 * Composer state on Effect Atom (D22). The draft never leaves the atom in v0; when turns exist,
 * submitting hands it to the conversation atom that owns the SSE stream (§13).
 */
import { Atom } from "effect/unstable/reactivity"
import { defaultModelId } from "../fixtures/models.ts"

export const composerDraftAtom: Atom.Writable<string> = Atom.make("").pipe(Atom.keepAlive)

export const selectedModelIdAtom: Atom.Writable<string> = Atom.make(defaultModelId).pipe(
  Atom.keepAlive,
)
