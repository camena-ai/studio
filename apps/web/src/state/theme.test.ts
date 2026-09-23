import { AtomRegistry } from "effect/unstable/reactivity"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { applyTheme, resolvedThemeAtom, THEME_STORAGE_KEY, themePreferenceAtom } from "./theme.ts"

function stubSystemTheme(theme: "light" | "dark") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: theme === "dark" && query.includes("dark"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe("theme atoms", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it("follows the system when no preference is stored", () => {
    stubSystemTheme("dark")
    const registry = AtomRegistry.make()
    expect(registry.get(themePreferenceAtom)).toBe("system")
    expect(registry.get(resolvedThemeAtom)).toBe("dark")
  })

  it("lets an explicit preference beat the system and persists it", () => {
    stubSystemTheme("dark")
    const registry = AtomRegistry.make()
    registry.set(themePreferenceAtom, "light")
    expect(registry.get(resolvedThemeAtom)).toBe("light")
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(JSON.stringify("light"))
  })

  it("reads a stored preference back", () => {
    stubSystemTheme("light")
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify("dark"))
    const registry = AtomRegistry.make()
    expect(registry.get(resolvedThemeAtom)).toBe("dark")
  })

  it("toggles the dark class on the root element", () => {
    const root = document.createElement("html")
    applyTheme("dark", root)
    expect(root.classList.contains("dark")).toBe(true)
    applyTheme("light", root)
    expect(root.classList.contains("dark")).toBe(false)
  })
})
