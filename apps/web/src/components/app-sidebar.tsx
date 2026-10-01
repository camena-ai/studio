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
import { AsyncResult } from "effect/unstable/reactivity"
import { LogOut, SquarePen } from "lucide-react"
import { sessionAtom, signOutAtom } from "../state/session.ts"
import { themePreferenceAtom } from "../state/theme.ts"

const placeholderRows = ["recent-1", "recent-2", "recent-3"]

/**
 * The conversation sidebar. In v0 the recent list is a skeleton: conversations arrive with the
 * `AtomHttpApi` surface over `@camena-ai/contracts` (§13).
 */
export function AppSidebar() {
  const [theme, setTheme] = useAtom(themePreferenceAtom)
  const session = useAtomValue(sessionAtom)
  const signOut = useAtomSet(signOutAtom)
  const email = AsyncResult.isSuccess(session) ? (session.value?.user.email ?? "") : ""
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
                <SidebarMenuButton isActive>
                  <SquarePen />
                  <span>New chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {placeholderRows.map((key) => (
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
