import { SidebarInset, SidebarProvider } from "@studio/ui/components/ui/sidebar"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { AppSidebar } from "../components/app-sidebar.tsx"
import { ThemeEffect } from "../components/theme-effect.tsx"
import { TopBar } from "../components/top-bar.tsx"

function RootLayout() {
  return (
    <>
      <ThemeEffect />
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset className="flex min-h-svh flex-col">
          <TopBar title="New chat" />
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}

export const Route = createRootRoute({ component: RootLayout })
