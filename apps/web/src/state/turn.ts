/**
 * The in-flight turn and its fold (D21, §13). A turn is a stream of contract-decoded `TurnEvent`s;
 * `foldTurn` applies one to the live turn: `classification` and `route` attach to the pending user
 * message, `token` and `usage` to the assistant message, `route.blocked` closes the turn, and
 * `done`/`error` end it. Unknown events are skipped, as the contract asks of clients.
 *
 * The live turn is an overlay on the server's message list: once the conversation's `GET` holds
 * the assistant message (`start.messageId`), the overlay is dropped (`mergeMessages`).
 */
import type {
  ErrorCode,
  ErrorReason,
  Message,
  MessageLabel,
  MessageStatus,
  ResolvedRoute,
  TurnEvent,
  UnknownEvent,
} from "@camena-ai/contracts"

export interface ChatMessage {
  readonly key: string
  readonly author: "user" | "assistant"
  readonly content: string
  readonly status: MessageStatus
  readonly label: MessageLabel | null
  readonly route: ResolvedRoute | null
  readonly modelId: string | null
  readonly blockedReason?: string
  readonly error?: { readonly code: ErrorCode; readonly reason?: ErrorReason }
}

export interface LiveTurn {
  /** The assistant message id from `start`; null until it arrives. */
  readonly assistantId: string | null
  readonly user: ChatMessage
  readonly assistant: ChatMessage
  readonly finished: boolean
  /** The gateway refused the turn before streaming it (an error code), or it could not be reached. */
  readonly refusal?: string
}

export const beginTurn = (text: string, model: string): LiveTurn => ({
  assistantId: null,
  finished: false,
  user: {
    key: "pending-user",
    author: "user",
    content: text,
    status: "streaming",
    label: null,
    route: null,
    modelId: model,
  },
  assistant: {
    key: "pending-assistant",
    author: "assistant",
    content: "",
    status: "streaming",
    label: null,
    route: null,
    modelId: null,
  },
})

export const foldTurn = (turn: LiveTurn, event: TurnEvent | UnknownEvent): LiveTurn => {
  switch (event._tag) {
    case "start":
      return {
        ...turn,
        assistantId: event.messageId,
        assistant: { ...turn.assistant, key: event.messageId },
      }
    case "classification":
      return { ...turn, user: { ...turn.user, label: event.label } }
    case "route": {
      const modelId = event.model ?? null
      if (event.type === "blocked") {
        return {
          ...turn,
          user: { ...turn.user, route: "blocked", status: "complete" },
          assistant: {
            ...turn.assistant,
            route: "blocked",
            status: "blocked",
            ...(event.reason === undefined ? {} : { blockedReason: event.reason }),
          },
          finished: true,
        }
      }
      return {
        ...turn,
        user: { ...turn.user, route: event.type, modelId: modelId ?? turn.user.modelId },
        assistant: { ...turn.assistant, route: event.type, modelId },
      }
    }
    case "token":
      return {
        ...turn,
        assistant: { ...turn.assistant, content: turn.assistant.content + event.text },
      }
    case "usage":
      return turn
    case "done":
      return {
        ...turn,
        finished: true,
        user: { ...turn.user, status: "complete" },
        assistant:
          turn.assistant.status === "blocked"
            ? turn.assistant
            : {
                ...turn.assistant,
                status: turn.assistant.route === "local" ? "streaming" : "complete",
              },
      }
    case "error":
      return {
        ...turn,
        finished: true,
        user: { ...turn.user, status: "complete" },
        assistant: {
          ...turn.assistant,
          status: "failed",
          error: {
            code: event.code,
            ...(event.reason === undefined ? {} : { reason: event.reason }),
          },
        },
      }
    case "unknown":
      return turn
  }
}

export const fromMessage = (message: Message): ChatMessage => ({
  key: message.id,
  author: message.author,
  content: message.content ?? "",
  status: message.status,
  label: message.label,
  route: message.resolvedRoute,
  modelId: message.modelId,
})

/**
 * The server's messages with the live turn on top. A `GET` that lands mid-turn already holds the
 * turn's rows (its assistant row still `streaming`, without the text so far); those are hidden in
 * favour of the overlay until the server's assistant row has settled.
 */
export const mergeMessages = (
  messages: ReadonlyArray<Message>,
  live: LiveTurn | null,
): ReadonlyArray<ChatMessage> => {
  const stored = messages.map(fromMessage)
  if (live === null) return stored
  const index =
    live.assistantId === null ? -1 : messages.findIndex((m) => m.id === live.assistantId)
  if (index === -1) return [...stored, live.user, live.assistant]
  if (messages[index]?.status !== "streaming") return stored
  const start = messages[index - 1]?.author === "user" ? index - 1 : index
  return [...stored.slice(0, start), ...stored.slice(index + 1), live.user, live.assistant]
}
