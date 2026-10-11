import { describe, expect, it } from "vitest"
import { base64Of, describeSkillError } from "./skills.ts"

describe("skills api", () => {
  it("encodes a file as base64, large ones included", async () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 251)
    const encoded = await base64Of(new Blob([bytes]))
    expect(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))).toEqual(bytes)
  })

  it("words every refusal, and anything else as a retry", () => {
    expect(describeSkillError("multiple_skills")).toContain("more than one skill")
    expect(describeSkillError("whatever")).toBe("Something went wrong. Try again in a moment.")
  })
})
