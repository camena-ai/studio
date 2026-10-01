import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { StudioMark, ThemeToggle } from "@studio/ui"
import { Button } from "@studio/ui/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@studio/ui/components/ui/sidebar"
import { Link, useRouterState } from "@tanstack/react-router"
import { AsyncResult } from "effect/unstable/reactivity"
import { LogOut, SquarePen } from "lucide-react"
import { conversationsAtom } from "../state/conversations.ts"
import { sessionAtom, signOutAtom } from "../state/session.ts"
import { themePreferenceAtom } from "../state/theme.ts"

const placeholderRows = ["recent-1", "recent-2", "recent-3"]

/** The conversation sidebar: new chat, the seat's conversations (`GET /v1/conversations`), the user. */
export function AppSidebar() {
  const [theme, setTheme] = useAtom(themePreferenceAtom)
  const session = useAtomValue(sessionAtom)
  const signOut = useAtomSet(signOutAtom)
  const email = AsyncResult.isSuccess(session) ? (session.value?.user.email ?? "") : ""
  const conversations = useAtomValue(conversationsAtom)
  const activeId = useRouterState({
    select: (state) => (state.location.pathname.match(/^\/c\/([^/]+)/) ?? [])[1],
  })
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="titlebar-drag">
        <div className="flex items-center gap-2 px-1 py-1">
          <StudioMark className="size-6" />
          <span className="font-semibold">Studio</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={activeId === undefined}>
                  <Link to="/">
                    <SquarePen />
                    <span>New chat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {AsyncResult.isSuccess(conversations)
                ? conversations.value.conversations.map((conversation) => (
                    <SidebarMenuItem key={conversation.id}>
                      <SidebarMenuButton asChild isActive={activeId === conversation.id}>
                        <Link to="/c/$conversationId" params={{ conversationId: conversation.id }}>
                          <span className="truncate">{conversation.title ?? "New chat"}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                : placeholderRows.map((key) => (
                    <SidebarMenuItem key={key}>
                      <SidebarMenuSkeleton />
                    </SidebarMenuItem>
                  ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="truncate text-xs text-muted-foreground">{email}</span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              onClick={() => signOut()}
            >
              <LogOut />
            </Button>
            <ThemeToggle theme={theme} onThemeChange={setTheme} />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
