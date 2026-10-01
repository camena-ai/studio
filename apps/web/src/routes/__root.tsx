import { SidebarInset, SidebarProvider } from "@studio/ui/components/ui/sidebar"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { AppSidebar } from "../components/app-sidebar.tsx"
import { SessionGate } from "../components/session-gate.tsx"
import { ThemeEffect } from "../components/theme-effect.tsx"

function RootLayout() {
  return (
    <>
      <ThemeEffect />
      <SessionGate>
        <SidebarProvider defaultOpen={false}>
          <AppSidebar />
          <SidebarInset className="flex min-h-svh flex-col">
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </SessionGate>
    </>
  )
}

export const Route = createRootRoute({ component: RootLayout })
