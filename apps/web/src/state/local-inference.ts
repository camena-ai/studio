/**
 * Local inference state on Effect Atom (D22): the supervisor's status, refreshed by the page while
 * it is open, and the start and pause actions.
 */
import { Effect } from "effect"
import { Atom } from "effect/unstable/reactivity"
import * as Inference from "../api/local-inference.ts"
import { httpClientLayerAtom } from "../api/studio-api.ts"

const runtime = Atom.runtime((get) => get(httpClientLayerAtom))

export const inferenceStatusAtom = runtime.atom(Inference.getStatus)

export const startInferenceAtom = runtime.fn(
  // biome-ignore lint/suspicious/noConfusingVoidType: `void` is Atom.fn's no-argument write.
  Effect.fnUntraced(function* (_: void, get) {
    yield* Inference.startInference
    get.refresh(inferenceStatusAtom)
  }),
)

export const pauseInferenceAtom = runtime.fn(
  // biome-ignore lint/suspicious/noConfusingVoidType: `void` is Atom.fn's no-argument write.
  Effect.fnUntraced(function* (_: void, get) {
    yield* Inference.pauseInference
    get.refresh(inferenceStatusAtom)
  }),
)

const GB = 1024 ** 3

export const formatBytes = (bytes: number | null): string =>
  bytes === null
    ? "—"
    : bytes >= GB
      ? `${(bytes / GB).toFixed(1)} GB`
      : `${Math.round(bytes / 1024 ** 2)} MB`

/** Share of the model's memory that is swapped out, 0 to 1, or null when it is not loaded. */
export const swappedShare = (status: Inference.InferenceStatus): number | null => {
  const { footprintBytes, swappedBytes } = status.memory
  if (footprintBytes === null || swappedBytes === null || footprintBytes === 0) return null
  return Math.min(1, swappedBytes / footprintBytes)
}

/** Above this share the model reads its weights back from disk and answers slow down sharply. */
export const SWAP_WARNING_SHARE = 0.25

export const formatDuration = (ms: number | null): string =>
  ms === null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`

export const formatSince = (iso: string, now: number = Date.now()): string => {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
