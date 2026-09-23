/**
 * Synthetic model list for the v0 shell. Replaced by `GET /v1/models` through `AtomHttpApi`
 * once `@studio/contracts` is published. Names are invented; none is a customer or provider fact.
 */
import type { ModelOption } from "@studio/ui"

export const models: ReadonlyArray<ModelOption> = [
  { id: "aurora-2", label: "Aurora 2", route: "online" },
  { id: "aurora-2-mini", label: "Aurora 2 Mini", route: "online" },
  { id: "pocket-8b", label: "Pocket 8B", route: "local" },
]

export const defaultModelId = "aurora-2"
