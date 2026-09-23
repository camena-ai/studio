import { Button } from "@studio/ui/components/ui/button"
import { SidebarTrigger } from "@studio/ui/components/ui/sidebar"
import { CircleDashed, SquarePen } from "lucide-react"

/**
 * The window strip from the reference screen: sidebar toggle, new chat, current tab title. The
 * strip is a drag region so the desktop app can hide its native title bar (D16).
 */
export function TopBar({ title }: { readonly title: string }) {
  return (
    <header className="titlebar-drag flex h-11 shrink-0 items-center gap-1 px-2">
      <div className="titlebar-no-drag flex items-center gap-1">
        <SidebarTrigger />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="New chat">
          <SquarePen />
        </Button>
      </div>
      <div className="ml-2 flex items-center gap-2 text-sm font-medium">
        <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>{title}</span>
      </div>
    </header>
  )
}
