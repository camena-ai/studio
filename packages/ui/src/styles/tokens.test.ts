// @vitest-environment node
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { parseTokens } from "./tokens.ts"

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8")
const tokens = parseTokens(css)

describe("tokens.css", () => {
  it("declares the same variables for light and dark", () => {
    expect(Object.keys(tokens.light).length).toBeGreaterThan(20)
    expect(Object.keys(tokens.dark).sort()).toEqual(Object.keys(tokens.light).sort())
  })

  it("carries the radius and the core surface roles", () => {
    for (const name of ["--radius", "--background", "--foreground", "--card", "--sidebar"]) {
      expect(tokens.light[name], name).toBeTruthy()
    }
  })

  it("uses a near-black dark canvas with a lighter card, as the reference screen does", () => {
    const lightness = (value: string) => Number(value.match(/oklch\(([\d.]+)/)?.[1])
    expect(lightness(tokens.dark["--background"] ?? "")).toBeLessThan(0.25)
    expect(lightness(tokens.dark["--card"] ?? "")).toBeGreaterThan(
      lightness(tokens.dark["--background"] ?? ""),
    )
  })
})
