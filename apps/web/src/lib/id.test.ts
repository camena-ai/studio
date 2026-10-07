import { afterEach, describe, expect, it, vi } from "vitest"
import { newId } from "./id.ts"

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("newId", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("is a v4 UUID", () => {
    expect(newId()).toMatch(V4)
  })

  it("works where randomUUID is missing, as on a plain-HTTP page", () => {
    const { getRandomValues } = globalThis.crypto
    vi.stubGlobal("crypto", { getRandomValues: getRandomValues.bind(globalThis.crypto) })
    const ids = new Set(Array.from({ length: 50 }, newId))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(V4)
  })
})
