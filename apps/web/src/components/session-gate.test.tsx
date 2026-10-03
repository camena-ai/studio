import { RegistryProvider } from "@effect/atom-react"
import { render, screen } from "@testing-library/react"
import { Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { describe, expect, it } from "vitest"
import { httpClientLayerAtom } from "../api/studio-api.ts"
import { SessionGate } from "./session-gate.tsx"

function renderGate(session: unknown) {
  const fetch: typeof globalThis.fetch = async () => Response.json(session)
  const layer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  )
  return render(
    <RegistryProvider initialValues={[[httpClientLayerAtom, layer]]}>
      <SessionGate>
        <p>the app</p>
      </SessionGate>
    </RegistryProvider>,
  )
}

const user = { id: "u1", email: "someone@example.test", name: "Someone" }

describe("SessionGate", () => {
  it("asks a signed-out visitor to sign in", async () => {
    renderGate(null)
    expect(await screen.findByRole("heading", { name: "Sign in to Studio" })).toBeTruthy()
    expect(screen.queryByText("the app")).toBeNull()
  })

  it("asks a user without an org to create one", async () => {
    renderGate({ session: { activeOrganizationId: null }, user })
    expect(await screen.findByRole("heading", { name: "Name your organization" })).toBeTruthy()
  })

  it("renders the app for a seat", async () => {
    renderGate({ session: { activeOrganizationId: "org-1" }, user })
    expect(await screen.findByText("the app")).toBeTruthy()
  })
})
