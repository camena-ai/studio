/**
 * Theme state on Effect Atom (D22): the user's preference persisted in localStorage, the system
 * preference from `prefers-color-scheme`, and the resolved theme the shell applies as the `.dark`
 * class on `<html>`. `index.html` applies the same rule before first paint.
 */

import type { ThemePreference } from "@studio/ui"
import { Schema } from "effect"
import { KeyValueStore } from "effect/unstable/persistence"
import { Atom } from "effect/unstable/reactivity"

export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "studio.theme"

const ThemePreferenceSchema = Schema.Literals(["light", "dark", "system"])

const storageRuntime = Atom.runtime(KeyValueStore.layerStorage(() => globalThis.localStorage))

/** The user's choice. Falls back to `system` when storage is unavailable or holds garbage. */
export const themePreferenceAtom: Atom.Writable<ThemePreference> = Atom.kvs({
  runtime: storageRuntime,
  key: THEME_STORAGE_KEY,
  schema: ThemePreferenceSchema,
  defaultValue: (): ThemePreference => "system",
  mode: "sync",
}).pipe(Atom.keepAlive)

const DARK_QUERY = "(prefers-color-scheme: dark)"

/** The operating system's preference, tracked live. Defaults to `light` where `matchMedia` is missing. */
export const systemThemeAtom: Atom.Atom<ResolvedTheme> = Atom.make<ResolvedTheme>((get) => {
  if (typeof globalThis.matchMedia !== "function") return "light"
  const query = globalThis.matchMedia(DARK_QUERY)
  const read = (): ResolvedTheme => (query.matches ? "dark" : "light")
  const onChange = () => get.setSelf(read())
  query.addEventListener("change", onChange)
  get.addFinalizer(() => query.removeEventListener("change", onChange))
  return read()
}).pipe(Atom.keepAlive)

/** Preference wins; `system` defers to the OS. */
export const resolvedThemeAtom: Atom.Atom<ResolvedTheme> = Atom.make<ResolvedTheme>((get) => {
  const preference = get(themePreferenceAtom)
  return preference === "system" ? get(systemThemeAtom) : preference
}).pipe(Atom.keepAlive)

/** Reflects the resolved theme on the document root (the shadcn `.dark` convention). */
export function applyTheme(theme: ResolvedTheme, root: HTMLElement): void {
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
}
