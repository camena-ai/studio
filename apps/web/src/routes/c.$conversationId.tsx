import { ConversationId } from "@camena-ai/contracts"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { Schema } from "effect"
import { ConversationView } from "../components/conversation-view.tsx"

const isConversationId = Schema.is(ConversationId)

function Conversation() {
  const { conversationId } = Route.useParams()
  // Keyed so switching conversations remounts the view and interrupts the previous turn.
  return <ConversationView key={conversationId} id={conversationId as ConversationId} />
}

export const Route = createFileRoute("/c/$conversationId")({
  beforeLoad: ({ params }) => {
    if (!isConversationId(params.conversationId)) throw notFound()
  },
  component: Conversation,
})
