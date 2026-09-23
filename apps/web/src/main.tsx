/**
 * @studio/web entry (D21, D22, §13). One AtomRegistry for the whole app, one router. Everything
 * else in this package follows the rules in CLAUDE.md: state in Effect Atom, contracts decoded
 * with their schemas, never log message content.
 */
import { RegistryProvider } from "@effect/atom-react"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { router } from "./router.tsx"
import "./styles.css"

const container = document.getElementById("root")
if (!container) throw new Error("Missing #root")

createRoot(container).render(
  <StrictMode>
    <RegistryProvider>
      <RouterProvider router={router} />
    </RegistryProvider>
  </StrictMode>,
)
