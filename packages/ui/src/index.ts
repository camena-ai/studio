/**
 * @studio/ui
 *
 * Shared presentational components (D21, §13):
 * - Vendored registry items from shadcn/ui (Radix flavour) and Vercel AI Elements, each with its
 *   upstream SPDX id recorded in `REUSE.toml`. Registry items are copied, never patched beyond
 *   their `ai` type imports; if AI Elements cannot render Studio's message model, the shadcn chat
 *   components alone carry the UI.
 * - Components receive Studio's message model and atoms from the app; no data fetching, no
 *   AI SDK runtime, no state library other than Effect Atom.
 * - Never fork or vendor code from LibreChat, Open WebUI, LobeChat, Cherry Studio or any other
 *   AGPL, GPL or branding-restricted project (D12, D20).
 */
export {}
