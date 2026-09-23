/**
 * @studio/ui
 *
 * Shared presentational components (D21, §13):
 * - Design tokens in `styles/tokens.css` (mirrored by the root `DESIGN.md`) and the Tailwind
 *   theme bridge in `styles/globals.css`, exported as `@studio/ui/styles.css`.
 * - Vendored registry items from shadcn/ui (Radix flavour) under `components/ui`, each with the
 *   upstream SPDX id recorded in `REUSE.toml`. Registry items are copied, not rewritten; AI
 *   Elements join with the milestone-8 spike and are never patched beyond their `ai` type imports.
 * - Studio's own components below receive plain props from the app; no data fetching, no AI SDK
 *   runtime, no state library other than Effect Atom.
 * - Never fork or vendor code from LibreChat, Open WebUI, LobeChat, Cherry Studio or any other
 *   AGPL, GPL or branding-restricted project (D12, D20).
 */
export type { ModelOption, ModelRoute } from "./components/model.ts"
export { ModelChip, type ModelChipProps } from "./components/model-chip.tsx"
export { PromptComposer, type PromptComposerProps } from "./components/prompt-composer.tsx"
export { StudioMark } from "./components/studio-mark.tsx"
export {
  type ThemePreference,
  ThemeToggle,
  type ThemeToggleProps,
} from "./components/theme-toggle.tsx"
