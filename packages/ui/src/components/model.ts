/** Where a model runs. `online` goes through the gateway; `local` is the desktop on-device engine (§7). */
export type ModelRoute = "online" | "local"

/** The presentational shape of a model picker entry. The web app derives it from `GET /v1/models` later. */
export type ModelOption = {
  readonly id: string
  readonly label: string
  readonly route: ModelRoute
}
