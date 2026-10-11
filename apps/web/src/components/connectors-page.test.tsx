import { RegistryProvider } from "@effect/atom-react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ManageConnectors, MyConnections, SignInOutcome } from "./connectors-page.tsx"

interface Call {
  readonly url: string
  readonly method: string
  readonly body: unknown
}

/** A fake gateway: answers each path from `routes`, records every call. */
const stubGateway = (routes: Record<string, () => Response>) => {
  const calls: Array<Call> = []
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET"
    calls.push({
      url,
      method,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    })
    const answer = routes[`${method} ${url}`]
    return answer === undefined ? Response.json({ code: "missing" }, { status: 500 }) : answer()
  })
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const crm = {
  id: "c1",
  name: "crm",
  description: "The CRM, as each person sees it.",
  transport: "http",
  auth: "personal",
  fields: [{ key: "Authorization", label: "API token", in: "header", prefix: "Bearer " }],
  connected: false,
  source: "org",
}

describe("Your connections", () => {
  it("lets a member connect their own account with every field filled in", async () => {
    let connected = false
    const calls = stubGateway({
      "GET /v1/connectors": () => Response.json({ connectors: [{ ...crm, connected }] }),
      "PUT /v1/connectors/c1/credential": () => {
        connected = true
        return new Response(null, { status: 204 })
      },
    })
    render(
      <RegistryProvider>
        <MyConnections />
      </RegistryProvider>,
    )
    expect(await screen.findByText("Not connected")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Connect" }))
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("API token"), { target: { value: "my-own-token" } })
    fireEvent.click(save)
    expect(await screen.findByText("Connected")).toBeTruthy()
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
      values: { Authorization: "my-own-token" },
    })
  })

  it("says so when connectors are off for the organization", async () => {
    stubGateway({
      "GET /v1/connectors": () => Response.json({ code: "not_enabled" }, { status: 404 }),
    })
    render(
      <RegistryProvider>
        <MyConnections />
      </RegistryProvider>,
    )
    expect(
      await screen.findByText("Connectors are not turned on for your organization."),
    ).toBeTruthy()
  })
})

describe("Manage connectors", () => {
  it("is hidden from a member who is not an owner", async () => {
    const calls = stubGateway({
      "GET /v1/admin/connectors": () => Response.json({ code: "owner_required" }, { status: 403 }),
    })
    const { container } = render(
      <RegistryProvider>
        <ManageConnectors />
      </RegistryProvider>,
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(container.textContent).toBe("")
  })

  it("lets an owner add a remote connector and shows the gateway's refusal in words", async () => {
    let created = false
    const stored = {
      id: "c2",
      name: "crm",
      description: "The CRM.",
      auth: "personal",
      fields: crm.fields,
      spec: { transport: "http", url: "https://crm.example/mcp" },
      sharedSet: [],
      createdAt: "2026-10-11T00:00:00Z",
      updatedAt: "2026-10-11T00:00:00Z",
    }
    const calls = stubGateway({
      "GET /v1/admin/connectors": () =>
        Response.json({ connectors: created ? [stored] : [], operator: [] }),
      "GET /v1/connectors": () => Response.json({ connectors: [] }),
      "POST /v1/admin/connectors": () => {
        const last = calls.at(-1)?.body as { spec: { url: string } }
        if (!last.spec.url.startsWith("https://")) {
          return Response.json({ code: "invalid_spec" }, { status: 400 })
        }
        created = true
        return Response.json(stored, { status: 201 })
      },
    })
    render(
      <RegistryProvider>
        <ManageConnectors />
      </RegistryProvider>,
    )
    fireEvent.click(await screen.findByRole("button", { name: /Add connector/ }))
    fireEvent.change(screen.getByPlaceholderText("sales_db"), { target: { value: "CRM" } })
    fireEvent.change(screen.getByPlaceholderText(/sales database/), {
      target: { value: "The CRM." },
    })
    fireEvent.change(screen.getByPlaceholderText("https://mcp.example.com/mcp"), {
      target: { value: "ftp://crm.example" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add connector" }))
    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toContain("A URL must start with http")
    fireEvent.change(screen.getByPlaceholderText("https://mcp.example.com/mcp"), {
      target: { value: "https://crm.example/mcp" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add connector" }))
    expect(await screen.findByText("Each person's own")).toBeTruthy()
    const posts = calls.filter((call) => call.method === "POST")
    expect(posts.at(-1)?.body).toMatchObject({
      name: "crm",
      auth: "personal",
      spec: { transport: "http", url: "https://crm.example/mcp" },
    })
  })
})

describe("signing in with a service", () => {
  it("starts the sign-in for an OAuth connector, coming back to this app", async () => {
    const calls = stubGateway({
      "GET /v1/connectors": () =>
        Response.json({ connectors: [{ ...crm, auth: "oauth", fields: [] }] }),
      "POST /v1/connectors/c1/oauth/start": () =>
        Response.json({ authorizationUrl: "https://service.example/authorize?x=1" }),
    })
    render(
      <RegistryProvider>
        <MyConnections />
      </RegistryProvider>,
    )
    fireEvent.click(await screen.findByRole("button", { name: "Connect" }))
    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true))
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({
      returnTo: window.location.origin,
    })
  })

  it("says how the sign-in ended", () => {
    const { rerender } = render(<SignInOutcome search="?connected=tracker" />)
    expect(screen.getByRole("status").textContent).toContain("Connected to tracker.")
    rerender(<SignInOutcome search="?oauth_error=invalid_state" />)
    expect(screen.getByRole("alert").textContent).toContain("expired or wasn't yours")
    rerender(<SignInOutcome search="" />)
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
