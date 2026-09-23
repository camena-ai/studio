import { createFileRoute } from "@tanstack/react-router"
import { EmptyState } from "../components/empty-state.tsx"

export const Route = createFileRoute("/")({ component: EmptyState })
