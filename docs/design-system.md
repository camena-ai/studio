# Design system guide

How the Studio look is defined in this repository and how it reaches Claude Design.

## Source of truth

1. `packages/ui/src/styles/tokens.css` holds every colour and radius token for light (`:root`) and dark (`.dark`).
2. `packages/ui/src/styles/globals.css` bridges those tokens into Tailwind v4 (`@theme inline`), sets the system font stacks and the base layer, and defines the `titlebar-drag` utilities for the desktop app.
3. `DESIGN.md` at the repository root describes the system in the nine-section format Claude Design reads. It mirrors the tokens file; `apps/web/src/design-md.test.ts` fails when a token is missing from it.

Change a token in `tokens.css` first, update the table in `DESIGN.md`, and run `pnpm test`.

## Pushing to Claude Design

Claude Design can build a design system from a React component library. From the repository root, in Claude Code, run `/design-sync` and point it at `packages/ui`: the tokens come from `src/styles/tokens.css`, the primitives from `src/components/ui`, and Studio's own components (`StudioMark`, `ModelChip`, `PromptComposer`, `ThemeToggle`) from `src/components`. Alternatively upload `DESIGN.md` when creating a design system in Claude Design.

Keep pushes incremental: `/design-sync` writes components one at a time and never replaces a whole project.

## Adding a shadcn/ui item

```bash
pnpm dlx shadcn@4.21.0 add <item> -c packages/ui
```

Then:

- move any new dependency versions from `packages/ui/package.json` into the `catalog` of `pnpm-workspace.yaml` (exact versions, at least 24 h old, allowlisted licenses) and reference them as `catalog:`;
- rewrite `from "cn"` to `from "@studio/ui/lib/utils"` (the CLI's `cn` package is younger than the release-age policy allows; `clsx` + `tailwind-merge` provide the same API);
- if the item needs `scroll-fade` or `shimmer` utilities, copy them from `node_modules/shadcn/dist/tailwind.css` into `src/styles/shadcn-variants.css`;
- leave the file otherwise untouched. Vendored paths are excluded from Biome and annotated in `REUSE.toml` as MIT; the only local patch so far is `checked ?? false` in `dropdown-menu.tsx` for `exactOptionalPropertyTypes`.

AI Elements and the shadcn chat components are deliberately absent until `@camena-ai/contracts` ships (see CLAUDE.md).

## Themes

The theme preference is an Effect Atom (`apps/web/src/state/theme.ts`) persisted under `studio.theme`; the resolved theme is applied as the `.dark` class on `<html>`. `apps/web/index.html` applies the same rule inline before first paint. Components never read the theme; they use tokens and `dark:` variants.
