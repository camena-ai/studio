import { createFileRoute } from "@tanstack/react-router"
import { ConnectorsPage } from "../components/connectors-page.tsx"

export const Route = createFileRoute("/connectors")({ component: ConnectorsPage })
