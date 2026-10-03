import { createFileRoute } from "@tanstack/react-router"
import { EmptyState } from "../components/empty-state.tsx"
import { TopBar } from "../components/top-bar.tsx"

function NewChat() {
  return (
    <>
      <TopBar title="New chat" />
      <EmptyState />
    </>
  )
}

export const Route = createFileRoute("/")({ component: NewChat })
