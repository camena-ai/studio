import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react"
import { Button } from "@studio/ui/components/ui/button"
import { cn } from "@studio/ui/lib/utils"
import { Option } from "effect"
import { AsyncResult } from "effect/unstable/reactivity"
import { Pause, Play, TriangleAlert } from "lucide-react"
import { useEffect } from "react"
import { type InferenceStatus, InferenceUnavailable } from "../api/local-inference.ts"
import {
  formatBytes,
  formatDuration,
  formatSince,
  inferenceStatusAtom,
  pauseInferenceAtom,
  SWAP_WARNING_SHARE,
  startInferenceAtom,
  swappedShare,
} from "../state/local-inference.ts"
import { TopBar } from "./top-bar.tsx"

const STATE_LABEL: Record<InferenceStatus["state"], string> = {
  running: "Running",
  starting: "Starting…",
  stopping: "Pausing…",
  stopped: "Paused",
  failed: "Failed",
}

const STATE_DOT: Record<InferenceStatus["state"], string> = {
  running: "bg-emerald-500",
  starting: "bg-amber-500 animate-pulse",
  stopping: "bg-amber-500 animate-pulse",
  stopped: "bg-muted-foreground",
  failed: "bg-destructive",
}

function Stat({
  label,
  value,
  hint,
}: {
  readonly label: string
  readonly value: string
  readonly hint?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function StatusView({ status }: { readonly status: InferenceStatus }) {
  const [startResult, start] = useAtom(startInferenceAtom)
  const [pauseResult, pause] = useAtom(pauseInferenceAtom)
  const busy =
    AsyncResult.isWaiting(startResult) ||
    AsyncResult.isWaiting(pauseResult) ||
    status.state === "starting" ||
    status.state === "stopping"
  const share = swappedShare(status)
  const { memory } = status

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={cn("size-2.5 rounded-full", STATE_DOT[status.state])}
              aria-hidden="true"
            />
            <span className="font-semibold">{STATE_LABEL[status.state]}</span>
            <span className="text-sm text-muted-foreground">for {formatSince(status.since)}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {status.model.name} · {status.model.contextLength.toLocaleString()} token context
          </span>
          {status.lastError && (
            <span role="alert" className="text-sm text-destructive">
              {status.lastError}
            </span>
          )}
        </div>
        {status.state === "running" || status.state === "stopping" ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => pause()}>
            <Pause /> Pause
          </Button>
        ) : (
          <Button type="button" disabled={busy} onClick={() => start()}>
            <Play /> Start
          </Button>
        )}
      </section>

      {share !== null && share >= SWAP_WARNING_SHARE && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {Math.round(share * 100)}% of the model is swapped out to disk, so answers will be slow or
          time out. Free memory by closing apps or virtual machines, then pause and start the model.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Model memory" value={formatBytes(memory.footprintBytes)} />
        <Stat
          label="Swapped out"
          value={formatBytes(memory.swappedBytes)}
          {...(share === null ? {} : { hint: `${Math.round(share * 100)}% of the model` })}
        />
        <Stat
          label="System swap"
          value={formatBytes(memory.swapUsedBytes)}
          hint={`of ${formatBytes(memory.swapTotalBytes)}`}
        />
        <Stat
          label="In flight"
          value={String(status.inFlight)}
          hint={`${formatBytes(memory.systemBytes)} RAM`}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Recent requests</h2>
        {status.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests since the supervisor started.</p>
        ) : (
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">When</th>
                <th className="py-1 font-medium">First token</th>
                <th className="py-1 font-medium">Total</th>
                <th className="py-1 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {status.recent.map((request) => (
                <tr key={request.at} className="border-t">
                  <td className="py-1.5">{formatSince(request.at)} ago</td>
                  <td className="py-1.5">{formatDuration(request.ttftMs)}</td>
                  <td className="py-1.5">{formatDuration(request.durationMs)}</td>
                  <td className={cn("py-1.5", request.outcome === "error" && "text-destructive")}>
                    {request.outcome}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

/** The local inference server's status, with start and pause; refreshed every 2 s while open. */
export function LocalInferencePage() {
  const status = useAtomValue(inferenceStatusAtom)
  const refresh = useAtomRefresh(inferenceStatusAtom)
  useEffect(() => {
    const timer = setInterval(refresh, 2000)
    return () => clearInterval(timer)
  }, [refresh])

  return (
    <>
      <TopBar title="Local inference" />
      <main className="flex-1 overflow-y-auto">
        {AsyncResult.match(status, {
          onInitial: () => <div aria-busy="true" />,
          onFailure: (failure) => {
            const error = Option.getOrUndefined(AsyncResult.error(failure))
            return (
              <p className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">
                {error instanceof InferenceUnavailable
                  ? "This deployment has no local inference server to control."
                  : "The local inference server could not be reached."}
              </p>
            )
          },
          onSuccess: ({ value }) => <StatusView status={value} />,
        })}
      </main>
    </>
  )
}
