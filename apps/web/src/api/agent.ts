/**
 * The agent's record: an assistant message's steps (each tool call and its result)
 * and the files they produced, read from `GET /v1/conversations/:id/steps` and
 * `GET /v1/artifacts/:id`.
 *
 * TODO(contracts): the published `@camena-ai/contracts` this app pins (0.17) predates these
 * endpoints, so their schemas are mirrored here from the public contract and fetched directly.
 * Switch to `StudioApiClient` and the package's `ConversationSteps` at the next contracts bump.
 */
import { Schema } from "effect"

export const AgentArtifact = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  mime: Schema.String,
  sizeBytes: Schema.Number,
})
export type AgentArtifact = typeof AgentArtifact.Type

export const AgentStep = Schema.Struct({
  id: Schema.String,
  seq: Schema.Number,
  kind: Schema.String,
  tool: Schema.String,
  callId: Schema.String,
  code: Schema.optionalKey(Schema.String),
  arguments: Schema.optionalKey(Schema.String),
  ok: Schema.optionalKey(Schema.Boolean),
  output: Schema.optionalKey(Schema.String),
  label: Schema.optionalKey(Schema.String),
  artifacts: Schema.Array(AgentArtifact),
})
export type AgentStep = typeof AgentStep.Type

export const ConversationSteps = Schema.Struct({
  conversationId: Schema.String,
  messages: Schema.Array(
    Schema.Struct({ messageId: Schema.String, steps: Schema.Array(AgentStep) }),
  ),
})
export type ConversationSteps = typeof ConversationSteps.Type

const decodeSteps = Schema.decodeUnknownSync(ConversationSteps)

/** The turn events that mean a step was written: refetch the steps when one arrives. */
export const STEP_EVENTS: ReadonlySet<string> = new Set(["tool_call", "tool_result", "artifact"])

/** Each live assistant message's steps, by message id; empty for a gateway without the agent. */
export const fetchSteps = async (
  conversationId: string,
): Promise<ReadonlyMap<string, ReadonlyArray<AgentStep>>> => {
  const response = await fetch(`/v1/conversations/${conversationId}/steps`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  })
  // An older gateway has no such route: no steps, not an error.
  if (response.status === 404) return new Map()
  if (!response.ok) throw new Error(`steps ${response.status}`)
  const body = decodeSteps(await response.json())
  return new Map(body.messages.map((message) => [message.messageId, message.steps]))
}

/** One artifact's bytes as a `Blob` of its type. */
export const fetchArtifact = async (artifact: AgentArtifact): Promise<Blob> => {
  const response = await fetch(`/v1/artifacts/${artifact.id}`, { credentials: "same-origin" })
  if (!response.ok) throw new Error(`artifact ${response.status}`)
  return new Blob([await response.arrayBuffer()], { type: artifact.mime })
}
