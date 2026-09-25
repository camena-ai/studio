/**
 * The typed client for the gateway's `StudioApi` (D21, D22): `AtomHttpApi` over the published
 * `@camena-ai/contracts`, so every response is decoded with the contract schemas.
 *
 * The HTTP client layer is an atom so tests can swap `fetch` per registry. Atom runtimes memoize
 * layers across registries and `FetchHttpClient` reads `fetch` when its layer is built, so
 * stubbing `globalThis.fetch` is not enough.
 */
import { StudioApi } from "@camena-ai/contracts"
import type { Layer } from "effect"
import { FetchHttpClient, type HttpClient } from "effect/unstable/http"
import { Atom, AtomHttpApi } from "effect/unstable/reactivity"

export const httpClientLayerAtom = Atom.make<Layer.Layer<HttpClient.HttpClient>>(
  FetchHttpClient.layer,
)

/** Same-origin: CloudFront on the web, the `app://` proxy on the desktop. */
export class StudioApiClient extends AtomHttpApi.Service<StudioApiClient>()("StudioApiClient", {
  api: StudioApi,
  httpClient: (get) => get(httpClientLayerAtom),
  baseUrl: globalThis.location?.origin,
}) {}

/** `GET /health`: `{ status: "ok" }`, or `ServiceUnavailable` while the gateway drains. */
export const healthAtom = StudioApiClient.query("system", "health", {})
