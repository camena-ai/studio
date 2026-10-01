import { cn } from "@studio/ui/lib/utils"
import { Ban, ShieldAlert, TriangleAlert } from "lucide-react"
import type { ChatMessage } from "../state/turn.ts"
import { MessageContent } from "./message-content.tsx"

/** A `classified` or `error` label is never hidden (§5.5); `clean` needs no badge. */
function LabelBadge({ label }: { readonly label: ChatMessage["label"] }) {
  if (label === "classified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <ShieldAlert className="size-3" aria-hidden="true" />
        Classified
      </span>
    )
  }
  if (label === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        <TriangleAlert className="size-3" aria-hidden="true" />
        Not checked
      </span>
    )
  }
  return null
}

const errorText = (message: ChatMessage, refusal: string | undefined) => {
  if (refusal) return `The gateway refused this turn (${refusal}).`
  if (message.error) {
    const reason = message.error.reason ? `, ${message.error.reason}` : ""
    return `The answer failed (${message.error.code}${reason}).`
  }
  return "The answer failed."
}

function AssistantBody({
  message,
  refusal,
}: {
  readonly message: ChatMessage
  readonly refusal: string | undefined
}) {
  if (message.status === "blocked") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Ban className="size-4" aria-hidden="true" />
        Blocked{message.blockedReason ? ` (${message.blockedReason})` : ""}: no approved model could
        take this turn.
      </p>
    )
  }
  return (
    <>
      {message.content !== "" && <MessageContent markdown={message.content} />}
      {message.status === "streaming" && message.content === "" && (
        <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground" />
      )}
      {message.status === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(message, refusal)}
        </p>
      )}
    </>
  )
}

/** The flat message list (§13): no tree, no branches. */
export function MessageList({
  messages,
  refusal,
}: {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly refusal?: string | undefined
}) {
  return (
    <ol className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      {messages.map((message) =>
        message.author === "user" ? (
          <li key={message.key} className="flex flex-col items-end gap-1">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5">
              {message.content}
            </div>
            <LabelBadge label={message.label} />
          </li>
        ) : (
          <li key={message.key} className={cn("flex flex-col gap-2")}>
            <AssistantBody message={message} refusal={refusal} />
            {message.modelId && message.status === "complete" && (
              <span className="text-xs text-muted-foreground">{message.modelId}</span>
            )}
          </li>
        ),
      )}
    </ol>
  )
}
