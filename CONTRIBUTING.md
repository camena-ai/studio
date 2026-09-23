# Contributing to Studio

This repository holds the public Studio clients: the web app and the Electron desktop app. Contributions are welcome: bug reports, docs fixes and code. The project is Apache-2.0 licensed; there is no CLA.

This file is the human front door. [`CLAUDE.md`](CLAUDE.md) carries the same rules in more depth, including the invariants the implementation must preserve. If the two ever disagree, `CLAUDE.md` wins and this file needs fixing.

## Before you start

Work is tracked in [issues](https://github.com/camena-ai/studio/issues). New here? Start with [`good first issue`](https://github.com/camena-ai/studio/labels/good%20first%20issue).

- **Small fixes** (typos, an obvious one-line bug): just open a PR.
- **Anything larger**: open or claim an issue first, so the approach can be agreed before you write code.

The gateway and everything server-side live in a separate private repository, which also owns the architecture decisions the clients follow. A change that would contradict one of those decisions needs that decision changed first, so raise it in an issue.

**This repository is public.** Never commit provider keys, org data or customer names. Sample data and screenshots must be synthetic.

## Development setup

You need **Node 24** (see `.node-version`) and **pnpm** (the version in `packageManager` in `package.json`; `corepack enable` picks it up).

```bash
git clone https://github.com/camena-ai/studio.git
cd studio
pnpm install
pnpm dev     # the web app on http://localhost:5173
```

Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` before installing if you don't need the Electron binary.

| Command | What it does |
| --- | --- |
| `pnpm lint` | Biome lint and format check (`pnpm lint:fix` to apply fixes) |
| `pnpm typecheck` | `tsc` in every package |
| `pnpm test` | Vitest in every package |
| `pnpm licenses:check` | production dependency license allowlist |
| `pnpm reuse:lint` | REUSE 3.3 compliance (needs `uvx`) |

**Run `pnpm lint`, `pnpm typecheck` and `pnpm test` before you push.** They mirror CI's required checks.

## How we write code

- **Test-first.** Every feature or bugfix starts with a failing test, then the implementation that makes it pass.
- **Simplicity first.** The minimum code that solves the problem: no speculative features, no abstractions for single-use code.
- **Surgical changes.** Touch only what the task requires and match the surrounding style.
- **No borrowed code from restrictively licensed projects.** Dependencies must be MIT, Apache-2.0, BSD, ISC or MPL-2.0. Designs from other chat apps may inspire; their code may not be copied.
- **Never log message content, attachment text or tokens.**

## Branches, commits, PRs

`main` is the only long-lived branch and is protected: every change lands through a pull request that passes CI, with a linear history.

1. Branch off `main`.
2. Write commit subjects as short imperative sentences (`Add the model picker`), one logical change per PR. Reference the issue: `Part of #N`.
3. Open the PR into `main`. Put `Closes #N` in the body for anything fully finished.
4. Resolve every review conversation. PRs are **squash-merged** using the PR title and body, so make those read well as the final commit.

### CI

- **Lint, typecheck, test** (required)
- **REUSE and license allowlist** (required)

Both must pass on a branch that is up to date with `main`.

## Filing issues

Every issue title starts with a lowercase `[area]` tag:

| Prefix | Surface |
| --- | --- |
| `[web]` | `apps/web`: the Vite + React SPA |
| `[desktop]` | `apps/desktop`: the Electron shell, local engine and encrypted cache |
| `[ui]` | `packages/ui`: design tokens, shadcn/ui and shared components |
| `[repo]` | governance: CI, branch protection, tooling |
| `[docs]` | docs, design, README |

Labels: a type (`bug` / `enhancement` / `documentation`), a priority (`P1`–`P3`), a size (`size/XS`–`size/XL`) and the area (`web` / `desktop` / `ui`). The issue forms apply the type label for you; maintainers set priority and size during triage.

Suspected security issues: **don't open a public issue.** Report them privately through [GitHub's advisory form](https://github.com/camena-ai/studio/security/advisories/new).
