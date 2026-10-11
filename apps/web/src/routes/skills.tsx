import { createFileRoute } from "@tanstack/react-router"
import { SkillsPage } from "../components/skills-page.tsx"

export const Route = createFileRoute("/skills")({ component: SkillsPage })
