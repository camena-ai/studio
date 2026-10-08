/**
 * The agent's work on an assistant message: its steps from `stepsAtom`, paired into
 * calls for `AgentSteps`, each chart fetched once as a blob URL, and every file downloadable.
 */

import type { ConversationId } from "@camena-ai/contracts"
import { useAtomValue } from "@effect/atom-react"
import { type AgentCall, type AgentStepArtifact, AgentSteps } from "@studio/ui"
import { AsyncResult } from "effect/unstable/reactivity"
import { useEffect, useState } from "react"
import { type AgentStep, fetchArtifact } from "../api/agent.ts"
import { stepsAtom } from "../state/steps.ts"

/** A message's steps as calls: each `tool_call` with the `tool_result` that shares its id. */
export const callsOf = (steps: ReadonlyArray<AgentStep>): ReadonlyArray<AgentCall> => {
  const calls: Array<AgentCall> = []
  const byId = new Map<string, number>()
  for (const step of steps) {
    if (step.kind === "tool_call" || step.kind === "client_call") {
      byId.set(step.callId, calls.length)
      calls.push({
        callId: step.callId,
        tool: step.tool,
        input: step.code ?? step.arguments ?? "",
        artifacts: [],
      })
      continue
    }
    const index = byId.get(step.callId)
    const result = { ok: step.ok ?? true, output: step.output ?? "" }
    if (index === undefined) {
      calls.push({
        callId: step.callId,
        tool: step.tool,
        input: "",
        result,
        artifacts: step.artifacts,
      })
    } else {
      const call = calls[index]
      if (call !== undefined) calls[index] = { ...call, result, artifacts: step.artifacts }
    }
  }
  return calls
}

function ArtifactImage({ artifact }: { readonly artifact: AgentStepArtifact }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let revoked = false
    let objectUrl: string | null = null
    fetchArtifact(artifact).then(
      (blob) => {
        if (revoked) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      },
      () => setFailed(true),
    )
    return () => {
      revoked = true
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl)
    }
  }, [artifact])
  if (failed) {
    return <p className="text-xs text-destructive">This chart could not be loaded.</p>
  }
  if (url === null) {
    return <div className="h-48 w-full animate-pulse rounded-xl bg-muted" />
  }
  return (
    <img
      src={url}
      alt={artifact.name}
      className="max-h-[28rem] w-full rounded-xl border bg-white object-contain"
    />
  )
}

const download = (artifact: AgentStepArtifact) => {
  fetchArtifact(artifact).then(
    (blob) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = artifact.name
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
    () => {},
  )
}

export function AgentWork({
  conversationId,
  messageId,
  running,
}: {
  readonly conversationId: ConversationId
  readonly messageId: string
  readonly running: boolean
}) {
  const result = useAtomValue(stepsAtom(conversationId))
  const steps = AsyncResult.isSuccess(result) ? (result.value.get(messageId) ?? []) : []
  if (steps.length === 0) return null
  return (
    <AgentSteps
      calls={callsOf(steps)}
      running={running}
      renderImage={(artifact) => <ArtifactImage artifact={artifact} />}
      onDownload={download}
    />
  )
}
