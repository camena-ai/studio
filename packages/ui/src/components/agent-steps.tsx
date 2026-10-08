import { cn } from "@studio/ui/lib/utils"
import {
  ChevronRight,
  CircleCheck,
  CircleX,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  TerminalSquare,
} from "lucide-react"
import type { ReactNode } from "react"

export type AgentStepArtifact = {
  readonly id: string
  readonly name: string
  readonly mime: string
  readonly sizeBytes: number
}

/** One tool call with its result, once it arrives. */
export type AgentCall = {
  readonly callId: string
  readonly tool: string
  /** `run_python`'s code, or another tool's arguments. */
  readonly input: string
  /** Undefined while the call runs. */
  readonly result?: { readonly ok: boolean; readonly output: string }
  readonly artifacts: ReadonlyArray<AgentStepArtifact>
}

export type AgentStepsProps = {
  readonly calls: ReadonlyArray<AgentCall>
  /** The turn is still running: the last call without a result shows as running. */
  readonly running?: boolean
  /** Renders an image artifact (the app fetches its bytes). */
  readonly renderImage: (artifact: AgentStepArtifact) => ReactNode
  /** Starts a file artifact's download. */
  readonly onDownload: (artifact: AgentStepArtifact) => void
  readonly className?: string
}

const isImage = (artifact: AgentStepArtifact) => artifact.mime.startsWith("image/")

const sizeText = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const toolTitle = (tool: string) =>
  tool === "run_python" ? "Python" : tool.replaceAll("__", " · ").replaceAll("_", " ")

/**
 * The agent's work on one answer: each call collapsed to a line (its tool and status) that opens
 * to the code and what it printed, and below them every chart inline and every other file as a
 * download. The list itself starts collapsed once the answer is done.
 */
export function AgentSteps({
  calls,
  running,
  renderImage,
  onDownload,
  className,
}: AgentStepsProps) {
  if (calls.length === 0) return null
  const artifacts = calls.flatMap((call) => call.artifacts)
  const images = artifacts.filter(isImage)
  const files = artifacts.filter((artifact) => !isImage(artifact))
  const pending = calls.filter((call) => call.result === undefined).length
  return (
    <div data-slot="agent-steps" className={cn("flex flex-col gap-3 font-sans", className)}>
      <details className="group rounded-xl border bg-muted/30" open={running === true}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-muted-foreground select-none">
          <ChevronRight
            className="size-4 transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          <TerminalSquare className="size-4" aria-hidden="true" />
          <span>
            {running === true && pending > 0
              ? `Working… ${calls.length - pending} of ${calls.length} steps done`
              : `Worked through ${calls.length} ${calls.length === 1 ? "step" : "steps"}`}
          </span>
        </summary>
        <ol className="flex flex-col gap-2 border-t px-3 py-2">
          {calls.map((call, index) => (
            <li key={call.callId} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {call.result === undefined ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-label="Running" />
                ) : call.result.ok ? (
                  <CircleCheck className="size-3.5 text-emerald-600" aria-label="Done" />
                ) : (
                  <CircleX className="size-3.5 text-destructive" aria-label="Failed" />
                )}
                <span>
                  {index + 1}. {toolTitle(call.tool)}
                </span>
              </div>
              <pre className="max-h-64 overflow-auto rounded-lg bg-background px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre">
                {call.input}
              </pre>
              {call.result !== undefined && call.result.output !== "" && (
                <pre
                  className={cn(
                    "max-h-64 overflow-auto rounded-lg px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap",
                    call.result.ok ? "bg-muted" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {call.result.output}
                </pre>
              )}
            </li>
          ))}
        </ol>
      </details>
      {images.length > 0 && (
        <div className="flex flex-col gap-3">
          {images.map((image) => (
            <figure key={image.id} className="flex flex-col gap-1">
              {renderImage(image)}
              <figcaption className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{image.name}</span>
                <button
                  type="button"
                  onClick={() => onDownload(image)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted"
                >
                  <Download className="size-3" aria-hidden="true" />
                  Download
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => onDownload(file)}
              className="flex max-w-64 items-center gap-2 rounded-xl border bg-background px-2.5 py-1.5 text-left text-sm hover:bg-muted"
            >
              {/sheet|csv|excel/.test(file.mime) ? (
                <FileSpreadsheet
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">{sizeText(file.sizeBytes)}</span>
              </span>
              <Download
                className="ml-1 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
