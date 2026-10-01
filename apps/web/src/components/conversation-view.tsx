import type { ConversationId } from "@camena-ai/contracts"
import { useAtom, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/unstable/reactivity"
import { useEffect, useRef } from "react"
import {
  conversationAtom,
  firstTurnAtom,
  liveTurnAtom,
  sendTurnAtom,
} from "../state/conversations.ts"
import { mergeMessages } from "../state/turn.ts"
import { ChatComposer } from "./chat-composer.tsx"
import { MessageList } from "./message-list.tsx"
import { TopBar } from "./top-bar.tsx"

export function ConversationView({ id }: { readonly id: ConversationId }) {
  const conversation = useAtomValue(conversationAtom(id))
  const live = useAtomValue(liveTurnAtom(id))
  const [firstTurn, setFirstTurn] = useAtom(firstTurnAtom)
  // Mounted for the view's lifetime: leaving the conversation interrupts a running turn.
  useAtomMount(sendTurnAtom(id))
  const sendTurn = useAtomSet(sendTurnAtom(id))
  const bottom = useRef<HTMLDivElement>(null)
  const sentFirst = useRef(false)

  // A new chat's first message waits in `firstTurnAtom` until its conversation opens. The ref
  // keeps StrictMode's second effect run from sending it again.
  useEffect(() => {
    if (sentFirst.current || firstTurn?.conversationId !== id) return
    sentFirst.current = true
    setFirstTurn(null)
    sendTurn(firstTurn.input)
  }, [firstTurn, id, sendTurn, setFirstTurn])

  const stored = AsyncResult.isSuccess(conversation) ? conversation.value.messages : []
  const messages = mergeMessages(stored, live)
  const streaming = live !== null && !live.finished
  const lastLength = messages.at(-1)?.content.length ?? 0

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" })
  }, [messages.length, lastLength])

  const title = AsyncResult.isSuccess(conversation)
    ? (conversation.value.title ?? "New chat")
    : "Conversation"
  const tainted = AsyncResult.isSuccess(conversation) && conversation.value.tainted

  return (
    <>
      <TopBar title={title} tainted={tainted} />
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          {AsyncResult.isFailure(conversation) && (
            <p role="alert" className="mx-auto max-w-2xl px-4 py-6 text-sm text-destructive">
              This conversation could not be loaded.
            </p>
          )}
          <MessageList messages={messages} refusal={live?.refusal} />
          <div ref={bottom} />
        </div>
        <div className="mx-auto w-full max-w-2xl px-4 pb-6">
          <ChatComposer
            busy={streaming}
            onSend={(text, model) => sendTurn({ text, model, idempotencyKey: crypto.randomUUID() })}
          />
        </div>
      </main>
    </>
  )
}
