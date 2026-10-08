import type { ConversationId } from "@camena-ai/contracts"
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/unstable/reactivity"
import { useEffect, useRef } from "react"
import { newId } from "../lib/id.ts"
import {
  conversationAtom,
  firstTurnAtom,
  liveTurnAtom,
  sendTurnAtom,
} from "../state/conversations.ts"
import { conversationLabel, mergeMessages } from "../state/turn.ts"
import { ChatComposer } from "./chat-composer.tsx"
import { MessageList } from "./message-list.tsx"
import { TopBar } from "./top-bar.tsx"

export function ConversationView({ id }: { readonly id: ConversationId }) {
  const conversation = useAtomValue(conversationAtom(id))
  const live = useAtomValue(liveTurnAtom(id))
  const firstTurn = useAtomValue(firstTurnAtom)
  // Mounted for the view's lifetime: leaving the conversation interrupts a running turn.
  useAtomMount(sendTurnAtom(id))
  const sendTurn = useAtomSet(sendTurnAtom(id))
  const bottom = useRef<HTMLDivElement>(null)
  const sentFirst = useRef(false)

  // A new chat's first message waits in `firstTurnAtom` until the gateway starts its turn, so a
  // view that remounts before then sends it again under the same Idempotency-Key and the gateway
  // replays it. The ref keeps StrictMode's second effect run in one mount from sending it twice.
  useEffect(() => {
    if (sentFirst.current || firstTurn?.conversationId !== id) return
    sentFirst.current = true
    sendTurn(firstTurn.input)
  }, [firstTurn, id, sendTurn])

  const stored = AsyncResult.isSuccess(conversation) ? conversation.value.messages : []
  const messages = mergeMessages(stored, live)
  const streaming = live !== null && !live.finished
  const lastLength = messages.at(-1)?.content.length ?? 0

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" })
  }, [messages.length, lastLength])

  const title = AsyncResult.isSuccess(conversation)
    ? conversationLabel(conversation.value.title, stored.length > 0 ? stored : messages)
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
          <MessageList messages={messages} refusal={live?.refusal} conversationId={id} />
          <div ref={bottom} />
        </div>
        <div className="mx-auto w-full max-w-2xl px-4 pb-6">
          <ChatComposer
            busy={streaming}
            onSend={(text, model, attachments) =>
              sendTurn({ text, model, attachments, idempotencyKey: newId() })
            }
          />
        </div>
      </main>
    </>
  )
}
