# v0 shell, light/dark themes and Claude Design readiness

Date: 2026-09-23. Status: approved in conversation (mascot, scope and kit choices below were confirmed by the user).

## Goal

Turn the empty skeleton into a runnable web app whose first screen matches the reference screenshot: a chromeless top bar, a centered mascot, a composer card (placeholder, attach, classification shield, model chip, mic, send) and a "Choose local or sign in" hint, in a light and a dark theme. At the same time make the repository something Claude Design can ingest, either by `/design-sync` from `packages/ui` or by uploading the root `DESIGN.md`.

Nothing here talks to a gateway. `@studio/contracts` is not published yet, so v0 is a presentational shell with the state plumbing (Effect Atom) in place and no fake data flowing through it.

## Constraints carried over from the architecture (D12, D20, D21, D22, §13)

- shadcn/ui in the Radix flavour (`shadcn init -b radix` semantics), vendored into `packages/ui` with a REUSE annotation (MIT, shadcn). No AI Elements and no shadcn chat components yet; they join with the milestone-8 spike once contracts exist.
- All UI state in Effect Atom: the theme override and the composer draft are atoms, read with `@effect/atom-react` hooks. No context-based theme provider, no second state library.
- No dependency outside MIT, Apache-2.0, BSD, ISC and MPL-2.0. Fonts therefore come from the system stack (OFL is not on the allowlist). Every version is exact, lives in the catalog and is at least 24 h old.
- Nothing copied from LibreChat, Open WebUI, LobeChat, Cherry Studio or any AGPL/GPL project. The mascot is an original mark.
- No message content, no logging, no telemetry.

## Decisions

| Topic | Decision |
|---|---|
| Mascot | An original geometric SVG mark (`StudioMark`) rendered with theme tokens. A placeholder to swap for final art. |
| Scope | The empty-state screen plus a collapsible sidebar that holds a placeholder conversation list. No conversation view. |
| Kit | shadcn/ui Radix flavour, vendored: `button`, `textarea`, `tooltip`, `dropdown-menu`, `separator`, `sheet`, `skeleton`, `input`, `kbd`, `sidebar` and the `use-mobile` hook. Icons from `lucide-react`. |
| Theme mechanism | Class-based: `.dark` on `<html>`, `@custom-variant dark (&:is(.dark *))`. Resolved theme = override if set, otherwise `prefers-color-scheme`. Override persisted in `localStorage` under `studio.theme`. An inline script in `index.html` applies the class before first paint. |
| Tokens | The shadcn/ui neutral base set (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, chart-1..5, sidebar-*), in OKLCH, in `:root` and `.dark`, plus `--radius`. Dark values are tuned toward the screenshot: near-black canvas, a slightly lighter composer card. |
| Fonts | `system-ui` stack for text, `ui-monospace` stack for code. |
| Model chip | Shows a route icon (cloud for an online model, chip for an on-device model) and the model label. Backed by a synthetic fixture in the web app; the chip is presentational. |
| Window chrome | The top bar carries a `titlebar-drag` region class so the desktop app can use `titleBarStyle: hiddenInset` later without a layout change. |

## Packages

### `packages/ui`

```
src/
  styles/globals.css        @import "tailwindcss", tw-animate-css, tokens, @theme inline, base layer
  styles/tokens.css         :root and .dark variable sets (the single source of design tokens)
  lib/utils.ts              cn()
  hooks/use-mobile.ts       shadcn hook (vendored)
  components/ui/*.tsx       vendored shadcn registry items (unchanged)
  components/studio-mark.tsx        the mascot
  components/model-chip.tsx         route icon + label, used inside the composer
  components/prompt-composer.tsx    the composer card
  components/theme-toggle.tsx       light / dark / system menu
  index.ts                  re-exports
components.json             shadcn config (style radix, cssVariables, aliases)
```

`package.json` exports `.`, `./styles.css` (→ `src/styles/globals.css`) and `./components/*`. Runtime dependencies: `radix-ui`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `react`, `react-dom`, `effect`, `@effect/atom-react`.

`PromptComposer` is presentational. Props:

```ts
type PromptComposerProps = {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  model: { id: string; label: string; route: "online" | "local" }
  models: ReadonlyArray<{ id: string; label: string; route: "online" | "local" }>
  onModelChange: (id: string) => void
  disabled?: boolean
}
```

The submit button is disabled while the trimmed value is empty; Enter submits, Shift+Enter inserts a newline. Attach, shield and mic are icon buttons with tooltips and no behaviour in v0.

### `apps/web`

```
index.html                  theme bootstrap script, #root
src/main.tsx                RegistryProvider + RouterProvider
src/router.tsx              TanStack Router from routeTree.gen.ts (file routes via the router plugin)
src/routes/__root.tsx       AppShell: SidebarProvider, AppSidebar, TopBar, <Outlet/>
src/routes/index.tsx        EmptyState: StudioMark, PromptComposer, hint
src/state/theme.ts          themeOverrideAtom (persisted), resolvedThemeAtom, applyTheme effect
src/state/composer.ts       composerDraftAtom, selectedModelAtom
src/fixtures/models.ts      synthetic model list
src/components/app-sidebar.tsx, top-bar.tsx, empty-state.tsx
vite.config.ts              @vitejs/plugin-react, @tailwindcss/vite, TanStack router plugin
```

Tailwind sees `packages/ui` through `@source "../../packages/ui/src"` in the app's stylesheet.

### Repository root

- `DESIGN.md`: the nine-section format Claude Design reads (theme, colour roles, typography, components, layout, depth, do's and don'ts, responsive, agent prompt guide). Token values are copied from `tokens.css`; a unit test asserts the two agree on every variable name.
- `docs/design-system.md`: how to run `/design-sync` against `packages/ui`, how to add a registry item, and the rule that `tokens.css` is the source and `DESIGN.md` mirrors it.
- `CLAUDE.md`: commands that now exist (`pnpm dev`, `pnpm build`), the `packages/ui` conventions, and the token/DESIGN.md rule.
- `REUSE.toml`: annotation for `packages/ui/src/components/ui/**` and `packages/ui/src/hooks/use-mobile.ts` (MIT, shadcn).
- `pnpm-workspace.yaml`: new catalog entries.

## Error handling

There is nothing that can fail at runtime in v0 except storage access: reading or writing `localStorage` is wrapped and a failure falls back to the system theme.

## Testing

- `packages/ui`: `tokens.test.ts` parses `tokens.css` and asserts `:root` and `.dark` declare the same variable names; `prompt-composer.test.tsx` (jsdom) asserts submit is disabled when empty, Enter submits, Shift+Enter does not.
- `apps/web`: `theme.test.ts` asserts resolution order (override beats system) and that the `.dark` class follows the resolved theme; `design-md.test.ts` asserts every token in `tokens.css` appears in `DESIGN.md`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm licenses:check` pass. The dev server renders both themes; verified in the browser.

## Out of scope

AI Elements, shadcn chat components, Streamdown wiring, any route other than `/`, the desktop app, sign-in, attachments, voice, a real model list.
