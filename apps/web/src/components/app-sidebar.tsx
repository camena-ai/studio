import { useAtom } from "@effect/atom-react"
import { StudioMark, ThemeToggle } from "@studio/ui"
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
import { SquarePen } from "lucide-react"
import { themePreferenceAtom } from "../state/theme.ts"

const placeholderRows = ["recent-1", "recent-2", "recent-3"]

/**
 * The conversation sidebar. In v0 the recent list is a skeleton: conversations arrive with the
 * `AtomHttpApi` surface over `@studio/contracts` (§13).
 */
export function AppSidebar() {
  const [theme, setTheme] = useAtom(themePreferenceAtom)
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
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">Not signed in</span>
          <ThemeToggle theme={theme} onThemeChange={setTheme} />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
