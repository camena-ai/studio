import { describe, expect, it } from "vitest"
import { cn } from "./utils.ts"

describe("cn", () => {
  it("merges conflicting Tailwind utilities, last one wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4")
  })

  it("drops falsy inputs", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b")
  })
})
