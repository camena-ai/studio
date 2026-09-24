// @vitest-environment node
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// `@camena-ai/contracts` takes `effect` as an exact peer so the app has one `effect` instance
// (a second copy breaks `Redacted` and every other identity check). The lockfile proves it.
const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")

const lockfile = read("../../../pnpm-lock.yaml")
const catalogEffect = /^ {2}effect: (\S+)$/m.exec(read("../../../pnpm-workspace.yaml"))?.[1]

describe("the effect instance", () => {
  it("resolves exactly one effect version, the catalog's", () => {
    const versions = new Set(
      [...lockfile.matchAll(/^ {2}'?effect@([^:'(]+)/gm)].map((match) => match[1]),
    )
    expect(catalogEffect).toBeDefined()
    expect([...versions]).toEqual([catalogEffect])
  })

  it("resolves the contracts peer to that version", () => {
    const snapshot = /^ {2}'@camena-ai\/contracts@[^(]+\(effect@([^)]+)\)':$/m.exec(lockfile)
    expect(snapshot?.[1]).toBe(catalogEffect)
  })
})
