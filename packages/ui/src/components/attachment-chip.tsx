import { cn } from "@studio/ui/lib/utils"
import { FileText, LoaderCircle, ShieldAlert, TriangleAlert, X } from "lucide-react"

export type AttachmentChipState = "uploading" | "checking" | "ready" | "failed"

export type AttachmentChipProps = {
  readonly name: string
  readonly state: AttachmentChipState
  /** The classifier's label once checked; `classified` and `error` are never hidden. */
  readonly label?: "clean" | "classified" | "error" | null
  /** Why a failed file was rejected, in words. */
  readonly detail?: string
  readonly onRemove?: () => void
  readonly className?: string
}

const STATE_TEXT: Record<AttachmentChipState, string> = {
  uploading: "Uploading…",
  checking: "Checking…",
  ready: "",
  failed: "Rejected",
}

/** One attached file: its name, where it is in upload and checking, its label, and remove. */
export function AttachmentChip({
  name,
  state,
  label,
  detail,
  onRemove,
  className,
}: AttachmentChipProps) {
  const busy = state === "uploading" || state === "checking"
  return (
    <div
      data-slot="attachment-chip"
      title={detail}
      className={cn(
        "flex max-w-64 items-center gap-2 rounded-xl border bg-background px-2.5 py-1.5 text-sm",
        state === "failed" && "border-destructive/40 bg-destructive/5",
        className,
      )}
    >
      {busy ? (
        <LoaderCircle
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : state === "failed" ? (
        <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
      ) : label === "classified" ? (
        <ShieldAlert className="size-4 shrink-0 text-amber-600" aria-label="Classified" />
      ) : (
        <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-medium">{name}</span>
        {(STATE_TEXT[state] || label === "classified" || label === "error") && (
          <span
            className={cn(
              "truncate text-xs",
              state === "failed" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {state === "failed"
              ? (detail ?? STATE_TEXT.failed)
              : label === "classified"
                ? "Classified"
                : label === "error"
                  ? "Not checked"
                  : STATE_TEXT[state]}
          </span>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
