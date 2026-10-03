/**
 * The local inference supervisor's control API, for self-hosted deployments that run the model on
 * the same machine. Not part of `StudioApi`: the dev server and the desktop main process forward
 * `/local-inference/*` to the supervisor's `/control/*`; a deployment without one answers 404,
 * which the page shows as unavailable. Writes carry `x-studio-control: 1`, which the supervisor
 * requires so a cross-origin page cannot trigger them.
 */
import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"

export const InferenceState = Schema.Literals([
  "stopped",
  "starting",
  "running",
  "stopping",
  "failed",
])
export type InferenceState = typeof InferenceState.Type

const Bytes = Schema.NullOr(Schema.Number)

export const InferenceRequest = Schema.Struct({
  at: Schema.String,
  promptTokens: Schema.NullOr(Schema.Number),
  completionTokens: Schema.NullOr(Schema.Number),
  ttftMs: Schema.NullOr(Schema.Number),
  durationMs: Schema.Number,
  outcome: Schema.Literals(["ok", "error", "cancelled"]),
})
export type InferenceRequest = typeof InferenceRequest.Type

export const InferenceStatus = Schema.Struct({
  state: InferenceState,
  since: Schema.String,
  lastError: Schema.NullOr(Schema.String),
  model: Schema.Struct({ id: Schema.String, name: Schema.String, contextLength: Schema.Number }),
  inFlight: Schema.Number,
  memory: Schema.Struct({
    footprintBytes: Bytes,
    swappedBytes: Bytes,
    systemBytes: Schema.Number,
    swapUsedBytes: Schema.Number,
    swapTotalBytes: Schema.Number,
  }),
  recent: Schema.Array(InferenceRequest),
})
export type InferenceStatus = typeof InferenceStatus.Type

/** The deployment has no local inference supervisor behind `/local-inference`. */
export class InferenceUnavailable extends Schema.TaggedError<InferenceUnavailable>()(
  "InferenceUnavailable",
  { status: Schema.Int },
) {}

const url = (action: string) => `${globalThis.location?.origin ?? ""}/local-inference/${action}`

export const getStatus = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client.execute(HttpClientRequest.get(url("status")))
  if (response.status !== 200) return yield* new InferenceUnavailable({ status: response.status })
  return yield* Effect.flatMap(response.json, Schema.decodeUnknownEffect(InferenceStatus))
})

const control = (action: "start" | "pause") =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const response = yield* client.execute(
      HttpClientRequest.post(url(action)).pipe(
        HttpClientRequest.setHeader("x-studio-control", "1"),
      ),
    )
    if (response.status >= 300) return yield* new InferenceUnavailable({ status: response.status })
  })

export const startInference = control("start")
export const pauseInference = control("pause")
