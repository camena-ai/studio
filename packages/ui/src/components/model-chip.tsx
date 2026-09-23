import { cn } from "@studio/ui/lib/utils"
import { Cloud, Cpu } from "lucide-react"
import type { ModelOption } from "./model.ts"

export type ModelChipProps = {
  readonly model: ModelOption
  readonly className?: string
}

/** Route icon plus label. Cloud means the gateway route, chip means the on-device engine. */
export function ModelChip({ model, className }: ModelChipProps) {
  const Icon = model.route === "local" ? Cpu : Cloud
  return (
    <span
      data-slot="model-chip"
      data-route={model.route}
      className={cn("inline-flex items-center gap-1.5 text-sm font-medium", className)}
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span>{model.label}</span>
    </span>
  )
}
