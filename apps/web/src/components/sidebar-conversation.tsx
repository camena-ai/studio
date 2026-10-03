import type { Conversation } from "@camena-ai/contracts"
import { useAtomValue } from "@effect/atom-react"
import { SidebarMenuButton, SidebarMenuItem } from "@studio/ui/components/ui/sidebar"
import { Link } from "@tanstack/react-router"
import { AsyncResult } from "effect/unstable/reactivity"
import { ShieldAlert } from "lucide-react"
import { conversationAtom } from "../state/conversations.ts"
import { conversationLabel } from "../state/turn.ts"

/**
 * One sidebar row, labelled by `conversationLabel`. The gateway sets no titles yet, so the label
 * comes from the conversation's `GET`, which the view shares when the row is opened.
 */
export function SidebarConversation({
  conversation,
  active,
}: {
  readonly conversation: Conversation
  readonly active: boolean
}) {
  const detail = useAtomValue(conversationAtom(conversation.id))
  const loaded = AsyncResult.isSuccess(detail) ? detail.value : null
  const label = loaded
    ? conversationLabel(conversation.title, loaded.messages)
    : (conversation.title ?? "…")
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link to="/c/$conversationId" params={{ conversationId: conversation.id }}>
          <span className="truncate">{label}</span>
          {loaded?.tainted && (
            <ShieldAlert
              className="ml-auto size-3.5 shrink-0 text-amber-600"
              aria-label="Classified"
            />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
