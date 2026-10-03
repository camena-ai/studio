import { Button } from "@studio/ui/components/ui/button"
import { SidebarTrigger } from "@studio/ui/components/ui/sidebar"
import { Link } from "@tanstack/react-router"
import { CircleDashed, ShieldAlert, SquarePen } from "lucide-react"

/**
 * The window strip from the reference screen: sidebar toggle, new chat, current tab title. The
 * strip is a drag region so the desktop app can hide its native title bar (D16).
 */
export function TopBar({
  title,
  tainted = false,
}: {
  readonly title: string
  /** A tainted conversation shows a persistent badge (§5.5). */
  readonly tainted?: boolean
}) {
  return (
    <header className="titlebar-drag flex h-11 shrink-0 items-center gap-1 px-2">
      <div className="titlebar-no-drag flex items-center gap-1">
        <SidebarTrigger />
        <Button asChild variant="ghost" size="icon-sm" aria-label="New chat">
          <Link to="/">
            <SquarePen />
          </Link>
        </Button>
      </div>
      <div className="ml-2 flex items-center gap-2 text-sm font-medium">
        <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{title}</span>
        {tainted && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            <ShieldAlert className="size-3" aria-hidden="true" />
            Classified content
          </span>
        )}
      </div>
    </header>
  )
}
