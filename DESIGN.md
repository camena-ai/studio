# Yel design system

This file describes the Yel client look for Claude Design and for anyone generating new screens. It mirrors `packages/ui/src/styles/tokens.css`, which is the source of truth: change a value there, then here, and `apps/web/src/design-md.test.ts` fails if a token goes missing from this file. Components live in `packages/ui` (shadcn/ui, Radix flavour, plus Studio's own); run `/design-sync` from the repository root to push them to a Claude Design project.

## 1. Visual theme and atmosphere

Yel takes its name from the Turkish word for wind and from the *yelmo*, the barber's basin Don Quixote wore as Mambrino's helmet; the look is La Mancha in an old engraving. By day the canvas is parchment and the text sepia ink, with one terracotta primary; by night it is candle-lit umber with an ochre primary. Illustrations are line engravings in the text colour: a windmill for the mark, the knight in profile as the assistant's avatar, and the charge at the windmills on the new-chat screen. They ink themselves in `currentColor`, so they follow the theme and never introduce a colour of their own. Density stays low and motion minimal: the only movement is the status page's windmill turning while the model runs (still under `prefers-reduced-motion`).

Two things a generic chat app does not show must always be visible when present: a message's classification label and a blocked route. They use the `destructive` and `muted` roles below, never a colour outside the system.

## 2. Colour palette and roles

All values are OKLCH. Light values live in `:root`, dark values in `.dark` on `<html>`; the app toggles that class from the theme atom and `index.html` applies it before first paint.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `oklch(0.972 0.016 84)` | `oklch(0.2 0.016 62)` | Page canvas |
| `--foreground` | `oklch(0.27 0.03 55)` | `oklch(0.93 0.025 84)` | Default text on the canvas |
| `--card` | `oklch(0.988 0.01 84)` | `oklch(0.24 0.018 62)` | Raised surfaces: the composer, dialogs, popovers |
| `--card-foreground` | `oklch(0.27 0.03 55)` | `oklch(0.93 0.025 84)` | Text on card |
| `--popover` | `oklch(0.988 0.01 84)` | `oklch(0.24 0.018 62)` | Menus and tooltips |
| `--popover-foreground` | `oklch(0.27 0.03 55)` | `oklch(0.93 0.025 84)` | Text on popover |
| `--primary` | `oklch(0.47 0.12 38)` | `oklch(0.76 0.12 72)` | The one strong action (send button), active states |
| `--primary-foreground` | `oklch(0.975 0.014 84)` | `oklch(0.2 0.02 60)` | Text and icons on primary |
| `--secondary` | `oklch(0.935 0.022 82)` | `oklch(0.29 0.02 62)` | Quiet filled controls |
| `--secondary-foreground` | `oklch(0.3 0.03 55)` | `oklch(0.93 0.025 84)` | Text on secondary |
| `--muted` | `oklch(0.935 0.022 82)` | `oklch(0.29 0.02 62)` | Hover and subdued fills |
| `--muted-foreground` | `oklch(0.5 0.035 62)` | `oklch(0.72 0.035 78)` | Secondary text, hints, icons at rest |
| `--accent` | `oklch(0.92 0.028 80)` | `oklch(0.3 0.024 62)` | Selected menu rows, hover on ghost buttons |
| `--accent-foreground` | `oklch(0.3 0.03 55)` | `oklch(0.93 0.025 84)` | Text on accent |
| `--destructive` | `oklch(0.53 0.19 28)` | `oklch(0.68 0.17 28)` | Errors and destructive actions |
| `--border` | `oklch(0.875 0.03 78)` | `oklch(0.93 0.025 84 / 12%)` | Hairlines and control outlines |
| `--input` | `oklch(0.875 0.03 78)` | `oklch(0.93 0.025 84 / 16%)` | Form control outline and fill in dark |
| `--ring` | `oklch(0.62 0.09 62)` | `oklch(0.6 0.08 70)` | Focus ring |
| `--chart-1` | `oklch(0.47 0.12 38)` | `oklch(0.76 0.12 72)` | Data series 1 |
| `--chart-2` | `oklch(0.66 0.13 75)` | `oklch(0.66 0.13 38)` | Data series 2 |
| `--chart-3` | `oklch(0.52 0.08 125)` | `oklch(0.68 0.09 125)` | Data series 3 |
| `--chart-4` | `oklch(0.48 0.06 240)` | `oklch(0.68 0.07 240)` | Data series 4 |
| `--chart-5` | `oklch(0.42 0.1 10)` | `oklch(0.62 0.12 10)` | Data series 5 |
| `--radius` | `0.5rem` | `0.5rem` | Base radius; the scale derives from it |
| `--sidebar` | `oklch(0.952 0.022 82)` | `oklch(0.175 0.015 62)` | Sidebar canvas |
| `--sidebar-foreground` | `oklch(0.27 0.03 55)` | `oklch(0.93 0.025 84)` | Sidebar text |
| `--sidebar-primary` | `oklch(0.47 0.12 38)` | `oklch(0.76 0.12 72)` | Sidebar strong action |
| `--sidebar-primary-foreground` | `oklch(0.975 0.014 84)` | `oklch(0.2 0.02 60)` | Text on sidebar primary |
| `--sidebar-accent` | `oklch(0.915 0.03 80)` | `oklch(0.27 0.022 62)` | Sidebar hover and active rows |
| `--sidebar-accent-foreground` | `oklch(0.27 0.03 55)` | `oklch(0.93 0.025 84)` | Text on sidebar accent |
| `--sidebar-border` | `oklch(0.87 0.03 78)` | `oklch(0.93 0.025 84 / 12%)` | Sidebar hairlines |
| `--sidebar-ring` | `oklch(0.62 0.09 62)` | `oklch(0.6 0.08 70)` | Sidebar focus ring |

The mark has no colours of its own: the windmill, the knight and the scene are drawn in `currentColor` with engraving hatches (`packages/ui/src/components/quixote`).

Rules: text on any surface uses that surface's `-foreground` pair. `primary` appears once per screen. Hints and metadata use `muted-foreground`. Hairlines use `border`; in dark they are 10% white, so never draw a border in a fixed grey.

## 3. Typography

System stacks only, because font packages are OFL-licensed and off the dependency allowlist: `--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`, `--font-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Baskerville, Georgia, serif` and `--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`. Headings, the wordmark and the assistant's prose use the serif (`--font-heading`, `font-serif`); controls, menus and the user's own messages stay sans.

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
