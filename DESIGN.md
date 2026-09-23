# Studio design system

This file describes the Studio client look for Claude Design and for anyone generating new screens. It mirrors `packages/ui/src/styles/tokens.css`, which is the source of truth: change a value there, then here, and `apps/web/src/design-md.test.ts` fails if a token goes missing from this file. Components live in `packages/ui` (shadcn/ui, Radix flavour, plus Studio's own); run `/design-sync` from the repository root to push them to a Claude Design project.

## 1. Visual theme and atmosphere

Studio is a calm, chromeless assistant for people who handle sensitive material at work. The canvas is empty until the user types; a small friendly mark and one composer card carry the whole first screen. Density is low, contrast is moderate, motion is minimal. Nothing shouts except the one primary action. Dark is the default mood of the reference design (near-black canvas, one slightly lighter card); light is its exact mirror, not an afterthought.

Two things a generic chat app does not show must always be visible when present: a message's classification label and a blocked route. They use the `destructive` and `muted` roles below, never a colour outside the system.

## 2. Colour palette and roles

All values are OKLCH. Light values live in `:root`, dark values in `.dark` on `<html>`; the app toggles that class from the theme atom and `index.html` applies it before first paint.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.2 0 0)` | Page canvas |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Default text on the canvas |
| `--card` | `oklch(1 0 0)` | `oklch(0.235 0 0)` | Raised surfaces: the composer, dialogs, popovers |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Text on card |
| `--popover` | `oklch(1 0 0)` | `oklch(0.235 0 0)` | Menus and tooltips |
| `--popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Text on popover |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | The one strong action (send button), active states |
| `--primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | Text and icons on primary |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.29 0 0)` | Quiet filled controls |
| `--secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Text on secondary |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.29 0 0)` | Hover and subdued fills |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Secondary text, hints, icons at rest |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.29 0 0)` | Selected menu rows, hover on ghost buttons |
| `--accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Text on accent |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Errors and destructive actions |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Hairlines and control outlines |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | Form control outline and fill in dark |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Focus ring |
| `--chart-1` | `oklch(0.646 0.222 41.116)` | `oklch(0.488 0.243 264.376)` | Data series 1 |
| `--chart-2` | `oklch(0.6 0.118 184.704)` | `oklch(0.696 0.17 162.48)` | Data series 2 |
| `--chart-3` | `oklch(0.398 0.07 227.392)` | `oklch(0.769 0.188 70.08)` | Data series 3 |
| `--chart-4` | `oklch(0.828 0.189 84.429)` | `oklch(0.627 0.265 303.9)` | Data series 4 |
| `--chart-5` | `oklch(0.769 0.188 70.08)` | `oklch(0.645 0.246 16.439)` | Data series 5 |
| `--radius` | `0.625rem` | `0.625rem` | Base radius; the scale derives from it |
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.17 0 0)` | Sidebar canvas |
| `--sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Sidebar text |
| `--sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | Sidebar strong action |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | Text on sidebar primary |
| `--sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.27 0 0)` | Sidebar hover and active rows |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Text on sidebar accent |
| `--sidebar-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Sidebar hairlines |
| `--sidebar-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Sidebar focus ring |

Brand colours used only by the Studio mark, fixed across themes: body `oklch(0.62 0.2 300)`, cap `oklch(0.86 0.17 92)`, base `oklch(0.68 0.2 25)`.

Rules: text on any surface uses that surface's `-foreground` pair. `primary` appears once per screen. Hints and metadata use `muted-foreground`. Hairlines use `border`; in dark they are 10% white, so never draw a border in a fixed grey.

## 3. Typography

System stack only, because font packages are OFL-licensed and off the dependency allowlist: `--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` and `--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`. Headings use the sans stack (`--font-heading`).

| Use | Size / weight | Notes |
|---|---|---|
| Composer text and placeholder | 16px / 400 | `text-base`; never smaller, to avoid mobile zoom |
| Body and menu rows | 14px / 400 | `text-sm` |
| Section labels, hints, footer | 12px / 400 | `text-xs`, `muted-foreground` |
| Tab title, sidebar app name | 14px / 500–600 | `font-medium` or `font-semibold` |

Line height follows Tailwind defaults. No letter-spacing changes, no uppercase labels.

## 4. Component stylings

- **Buttons** (`components/ui/button.tsx`): variants `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes `xs`, `sm`, `default`, `lg`, `icon-xs`, `icon-sm`, `icon`, `icon-lg`. Composer icon actions are `outline` + `icon` + `rounded-full`; the send button is `default` + `icon` + `rounded-full` and is disabled while the draft is blank.
- **Prompt composer** (`components/prompt-composer.tsx`): `rounded-3xl border bg-card p-3 shadow-sm`; a borderless growing textarea on top, actions row below: attach and classification on the left, model chip, voice and send on the right. Enter submits, Shift+Enter breaks the line.
- **Model chip** (`components/model-chip.tsx`): route icon (cloud = gateway, chip = on-device) plus label inside an `outline` pill button; the menu lists every model with the same chip and a check on the current one.
- **Sidebar** (`components/ui/sidebar.tsx`): offcanvas, 16rem wide, `sidebar` tokens; header with mark and name, a "New chat" row, a "Recent" group, footer with sign-in state and the theme toggle. Keyboard shortcut ⌘/Ctrl+B.
- **Top bar** (`apps/web/src/components/top-bar.tsx`): 44px strip, sidebar trigger and new-chat as `ghost icon-sm`, tab title at 14px. The strip is a window drag region for the desktop app.
- **Theme toggle** (`components/theme-toggle.tsx`): ghost icon button opening Light / Dark / System.
- **Tooltips** are `bg-foreground text-background` at 12px. **Menus** use `popover` tokens with a 1px `border` and `rounded-lg`.
- **Classification badge and blocked-route marker** (not built yet): persistent, `destructive/10` fill with `destructive` text, pointing at the offending message; never hidden.

## 5. Layout principles

Spacing scale is Tailwind's 4px grid. The empty state centres a 672px (`max-w-2xl`) column with 32px between mark and composer and 12px between composer and hint. Page gutters are 16px. The composer has 12px inner padding and 8px between rows. Conversation content, when it exists, shares the 672px column. Generous whitespace above the fold is intentional: do not fill the canvas with tips or cards.

## 6. Depth and elevation

Three levels only. Canvas (`background`) is flat. Cards and the composer sit one step up with a 1px `border` and `shadow-sm`. Menus and tooltips float with the same border and Tailwind's `shadow-md`. In dark, elevation is expressed by lightness (canvas 0.20, card 0.235) more than by shadow. No glows, no gradients on surfaces.

## 7. Do's and don'ts

- Do keep exactly one `primary` action per screen.
- Do show classification labels, `error` labels and blocked routes; never hide or soften them.
- Do use tokens for every colour; do not introduce hex values in components.
- Do keep the mark's brand colours fixed across themes.
- Don't add a second accent colour, gradients or glass effects.
- Don't use web fonts.
- Don't render icons above 20px in controls; the mark is the only large graphic.
- Don't copy layouts or code from LibreChat, Open WebUI, LobeChat or other restricted projects; borrow ideas only.

## 8. Responsive behaviour

The sidebar becomes a sheet below 768px (`useIsMobile`). The composer column is fluid with 16px gutters and the actions row wraps only if narrower than 360px. Touch targets are at least 32px (icon buttons) and the composer text stays 16px on phones. The top bar height does not change.

## 9. Agent prompt guide

Use these when asking Claude Design or a coding agent for new Studio screens:

- "Build this screen with the Studio tokens from `packages/ui/src/styles/tokens.css`; use shadcn/ui Radix components from `packages/ui/src/components/ui`; light and dark via the `.dark` class."
- "One primary action per screen. Hints in `muted-foreground`. Cards are `bg-card` with a 1px `border`, radius `rounded-3xl` for the composer and `rounded-lg` elsewhere."
- "If the screen shows a conversation, add the persistent classification badge that points at the flagged message and offers Edit and Fork."
- "System font stack only; no new colours; no gradients."
