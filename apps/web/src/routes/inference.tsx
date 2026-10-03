import { createFileRoute } from "@tanstack/react-router"
import { LocalInferencePage } from "../components/local-inference-page.tsx"

export const Route = createFileRoute("/inference")({ component: LocalInferencePage })
