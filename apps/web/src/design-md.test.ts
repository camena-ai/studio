// @vitest-environment node
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parseTokens } from "@studio/ui/styles/tokens"
import { describe, expect, it } from "vitest"

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")

const designMd = read("../../../DESIGN.md")
const tokens = parseTokens(read("../../../packages/ui/src/styles/tokens.css"))

describe("DESIGN.md", () => {
  it("lists every token with its light and dark value", () => {
    for (const [name, light] of Object.entries(tokens.light)) {
      const dark = tokens.dark[name] ?? ""
      expect(designMd, name).toContain(`| \`${name}\` | \`${light}\` | \`${dark}\` |`)
    }
  })
})
