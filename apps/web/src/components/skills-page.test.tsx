import { RegistryProvider } from "@effect/atom-react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { afterEach, describe, expect, it, vi } from "vitest"
import { httpClientLayerAtom } from "../api/studio-api.ts"
import { SkillsList } from "./skills-page.tsx"

interface Call {
  readonly url: string
  readonly method: string
  readonly body: unknown
}

const finance = {
  name: "finance-timeseries",
  description: "Analyze a price series.",
  source: "builtin",
  sourceUrl: null,
  enabled: true,
  sizeBytes: 9_000,
  fileCount: 3,
  license: "Apache-2.0",
  updatedAt: null,
}
const dataCheck = {
  name: "data-check",
  description: "Checks a table.",
  source: "github",
  sourceUrl: "https://github.com/acme/skills/tree/main/data-check",
  enabled: true,
  sizeBytes: 300,
  fileCount: 2,
  updatedAt: "2026-10-11T00:00:00Z",
}

const me = (orgRole: string) => ({
  userId: "u1",
  orgId: "00000000-0000-4000-8000-000000000001",
  roleId: "00000000-0000-4000-8000-000000000002",
  orgRole,
})

/** A fake gateway for both the app's typed client and its direct fetches. */
const renderWith = (routes: Record<string, (call: Call) => Response>) => {
  const calls: Array<Call> = []
  const fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const request = input instanceof Request ? input : undefined
    const url = new URL(request?.url ?? String(input), "http://localhost").pathname
    const method = request?.method ?? init.method ?? "GET"
    const call = {
      url,
      method,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    const answer = routes[`${method} ${url}`]
    return answer === undefined ? Response.json({ code: "missing" }, { status: 500 }) : answer(call)
  }
  vi.stubGlobal("fetch", fetch)
  const layer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch as typeof globalThis.fetch)),
  )
  render(
    <RegistryProvider initialValues={[[httpClientLayerAtom, layer]]}>
      <SkillsList />
    </RegistryProvider>,
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Skills", () => {
  it("shows a member the skills without the owner's tools", async () => {
    renderWith({
      "GET /v1/skills": () => Response.json({ skills: [finance, dataCheck] }),
      "GET /v1/me": () => Response.json(me("member")),
    })
    expect(await screen.findByText("finance-timeseries")).toBeTruthy()
    expect(screen.getByText("Built-in")).toBeTruthy()
    expect(screen.getByText("From GitHub")).toBeTruthy()
    await waitFor(() => expect(screen.queryByText("Add a skill for everyone")).toBeNull())
    expect(screen.queryByText("My skills")).toBeNull()
    expect(screen.queryByRole("button", { name: "Turn off" })).toBeNull()
  })

  it("lets an owner install from GitHub, and replace one already installed", async () => {
    let installed = false
    const calls = renderWith({
      "GET /v1/skills": () =>
        Response.json({ skills: installed ? [finance, dataCheck] : [finance] }),
      "GET /v1/me": () => Response.json(me("owner")),
      "POST /v1/admin/skills": (call) => {
        if ((call.body as { replace?: boolean }).replace !== true) {
          return Response.json({ code: "skill_exists" }, { status: 409 })
        }
        installed = true
        return Response.json(dataCheck, { status: 201 })
      },
    })
    expect(await screen.findByText("Add a skill for everyone")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("From GitHub"), {
      target: { value: "https://github.com/acme/skills/tree/main/data-check" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Install/ }))
    expect(await screen.findByText("A skill with this name is already installed.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Replace it" }))
    expect(await screen.findByText("Installed data-check.")).toBeTruthy()
    expect(await screen.findByText("data-check")).toBeTruthy()
    const posts = calls.filter((call) => call.method === "POST").map((call) => call.body)
    expect(posts).toEqual([
      { url: "https://github.com/acme/skills/tree/main/data-check", replace: false },
      { url: "https://github.com/acme/skills/tree/main/data-check", replace: true },
    ])
  })

  it("lets an owner turn a skill off", async () => {
    let enabled = true
    const calls = renderWith({
      "GET /v1/skills": () => Response.json({ skills: [{ ...finance, enabled }] }),
      "GET /v1/me": () => Response.json(me("owner")),
      "PATCH /v1/admin/skills/finance-timeseries": () => {
        enabled = false
        return new Response(null, { status: 204 })
      },
    })
    fireEvent.click(await screen.findByRole("button", { name: "Turn off" }))
    expect(await screen.findByRole("button", { name: "Turn on" })).toBeTruthy()
    expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({ enabled: false })
  })

  it("lets a member add, see and remove a skill of their own", async () => {
    let mine: ReadonlyArray<unknown> = []
    const calls = renderWith({
      "GET /v1/skills": () =>
        Response.json({
          personalSkills: true,
          skills: [{ ...dataCheck, scope: "org" }, ...mine],
        }),
      "GET /v1/me": () => Response.json(me("member")),
      "POST /v1/skills/mine": () => {
        mine = [{ ...dataCheck, source: "upload", sourceUrl: null, scope: "personal" }]
        return Response.json(mine[0], { status: 201 })
      },
      "DELETE /v1/skills/mine/data-check": () => {
        mine = []
        return new Response(null, { status: 204 })
      },
    })
    expect(await screen.findByText("My skills")).toBeTruthy()
    expect(screen.getByText("You haven't added any skills yet.")).toBeTruthy()
    expect(screen.queryByText("Add a skill for everyone")).toBeNull()
    fireEvent.change(screen.getByLabelText("From GitHub"), {
      target: { value: "https://github.com/me/skills/tree/main/data-check" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Install/ }))
    expect(await screen.findByText("Installed data-check.")).toBeTruthy()
    // The org's copy says the member's own is used instead, and only theirs can be managed.
    expect(await screen.findByText("Yours is used instead")).toBeTruthy()
    vi.stubGlobal("confirm", () => true)
    fireEvent.click(screen.getByRole("button", { name: "Remove data-check" }))
    expect(await screen.findByText("You haven't added any skills yet.")).toBeTruthy()
    expect(calls.filter((call) => call.method !== "GET").map((call) => call.url)).toEqual([
      "/v1/skills/mine",
      "/v1/skills/mine/data-check",
    ])
  })

  it("lets an owner save a GitHub token and update a skill from GitHub", async () => {
    let tokenSet = false
    const calls = renderWith({
      "GET /v1/skills": () =>
        Response.json({ githubSkills: true, skills: [{ ...dataCheck, scope: "org" }] }),
      "GET /v1/me": () => Response.json(me("owner")),
      "GET /v1/admin/skill-settings/github-token": () =>
        Response.json({ set: tokenSet, updatedAt: tokenSet ? "2026-10-11T00:00:00Z" : null }),
      "PUT /v1/admin/skill-settings/github-token": () => {
        tokenSet = true
        return new Response(null, { status: 204 })
      },
      "POST /v1/admin/skills/data-check/refresh": () =>
        Response.json({ ...dataCheck, scope: "org" }),
    })
    expect(await screen.findByText(/No token saved/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText("GitHub token"), {
      target: { value: "github_pat_example_0000000000" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save token" }))
    expect(await screen.findByText(/A token is saved/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /Update from GitHub/ }))
    expect(await screen.findByText("Updated from GitHub.")).toBeTruthy()
    expect(
      calls.filter((call) => call.method !== "GET").map((call) => [call.method, call.body]),
    ).toEqual([
      ["PUT", { token: "github_pat_example_0000000000" }],
      ["POST", undefined],
    ])
  })

  it("offers no GitHub update or token where the gateway does not", async () => {
    renderWith({
      "GET /v1/skills": () => Response.json({ skills: [dataCheck] }),
      "GET /v1/me": () => Response.json(me("owner")),
    })
    expect(await screen.findByText("data-check")).toBeTruthy()
    expect(screen.queryByText("Private repositories")).toBeNull()
    expect(screen.queryByRole("button", { name: /Update from GitHub/ })).toBeNull()
  })

  it("says so when skills are off for the organization", async () => {
    renderWith({
      "GET /v1/skills": () => Response.json({ code: "not_enabled" }, { status: 404 }),
      "GET /v1/me": () => Response.json(me("owner")),
    })
    expect(await screen.findByText("Skills are not turned on for your organization.")).toBeTruthy()
  })
})
