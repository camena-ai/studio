import { useAtomSet } from "@effect/atom-react"
import { LaManchaScene } from "@studio/ui"
import { useNavigate } from "@tanstack/react-router"
import { Exit } from "effect"
import { useState } from "react"
import { quoteOfTheDay } from "../brand.ts"
import { startChatAtom } from "../state/conversations.ts"
import { ChatComposer, type SentAttachment } from "./chat-composer.tsx"

/**
 * The new-chat screen: the knight charging the windmills, the composer and a line of Cervantes.
 * Sending creates the conversation and opens it.
 */
export function EmptyState() {
  const startChat = useAtomSet(startChatAtom, { mode: "promiseExit" })
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const quote = quoteOfTheDay()

  const send = async (text: string, model: string, attachments: ReadonlyArray<SentAttachment>) => {
    setBusy(true)
    setFailed(false)
    const exit = await startChat({ text, model, attachments })
    setBusy(false)
    if (Exit.isSuccess(exit)) {
      await navigate({ to: "/c/$conversationId", params: { conversationId: exit.value } })
    } else {
      setFailed(true)
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        <LaManchaScene className="max-w-lg text-foreground/80" />
        <h1 className="text-center text-3xl font-semibold tracking-tight">
          Which giant shall we face today?
        </h1>
        <div className="flex w-full flex-col gap-3">
          <ChatComposer onSend={send} busy={busy} />
          {failed ? (
            <p role="alert" className="px-4 text-sm text-destructive">
              The conversation could not be created. Try again.
            </p>
          ) : (
            <p className="px-4 font-serif text-sm text-muted-foreground italic">
              “{quote.text}” <span className="not-italic">— {quote.by}</span>
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
