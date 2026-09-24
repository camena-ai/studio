# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The public client monorepo for Studio, `camena-ai/studio`: the web SPA and the Electron desktop app. Studio is a ChatGPT-style assistant for organizations with a classification guardrail (every turn is checked by a classifier before it may reach an online model) and an org gateway that enforces role-based model access, budgets and bring-your-own provider keys. The gateway and everything server-side live in the private platform repository, `camena-ai/studio-platform`, which publishes `@camena-ai/contracts` to GitHub Packages.

**This repository is public.** Never commit anything from the platform repository, its architecture document, provider keys, org data or customer names. Sample data and screenshots must be synthetic.

## Source of truth

`docs/ARCHITECTURE.md` in `camena-ai/studio-platform` governs both repositories: scope, the numbered decisions log (D1–D22) and the build order. It is private, so it is not copied here; work from a local checkout (conventionally the sibling directory `../studio-platform`). Client-relevant decisions are D12 (build, don't fork), D16 (desktop), D20 (repositories and tooling), D21 (web client) and D22 (Effect everywhere except the Electron main process); §7 covers the desktop app and §13 the client assembly. Never silently contradict a decision. Changing one is an edit to the platform repository's decisions log, made first, and the client change cites it.

## Current state

The v0 shell exists: `apps/web` runs and renders the new-chat screen (sidebar, top bar, mark, composer, hint) in light and dark on top of `packages/ui`, which holds the design tokens, vendored shadcn/ui Radix items and Studio's own presentational components. Nothing talks to a gateway yet: the model list is a synthetic fixture and submitting clears the draft. `apps/desktop/src/index.ts` is still a placeholder whose header names the sections it owns. The clients are milestone 8 of the build order; conversation state, AI Elements and the shadcn chat components arrive once `@camena-ai/contracts` is published from the platform repository and added to the catalog as an exact pinned version. When a package gains real code, add its build, packaging or spike commands to this file in the same PR.

### Design system

`packages/ui/src/styles/tokens.css` is the source of truth for colour and radius; the root `DESIGN.md` mirrors it for Claude Design and a test keeps them in agreement. `docs/design-system.md` explains how to add a shadcn item, change a token and push to Claude Design with `/design-sync`. Vendored registry paths (`packages/ui/src/components/ui/**`, `hooks/use-mobile.ts`, `styles/shadcn-variants.css`) are excluded from Biome and annotated MIT in `REUSE.toml`; keep them byte-comparable with upstream apart from import aliases. The theme preference is an atom persisted under `studio.theme`; `apps/web/index.html` applies it inline before first paint.

### Layout (D20)

```
apps/web         Vite + React SPA: TanStack Router, Effect Atom state, shadcn/ui + shadcn chat
                 components, AI Elements (presentational), Streamdown with locked rehype-harden
apps/desktop     Electron shell: plain-Node main process, `node-llama-cpp` in a utilityProcess,
                 encrypted SQLite cache, bundles the identical web build behind an app:// scheme
packages/ui      Shared components and vendored shadcn/ui and AI Elements registry items
```

### Toolchain (D20)

- **Runtime.** Node 24 (`.node-version`); the client is Node by necessity because of Electron. No Bun here.
- **Package manager and tasks.** pnpm 12 (`packageManager` in `package.json`) workspaces plus Turborepo. Every dependency version is exact and lives in the `catalog` of `pnpm-workspace.yaml`; bump it there, one commit per upgrade. `nodeLinker: hoisted` because electron-builder needs a hoisted layout; `pnpm deploy --prod` for packaging; `pnpm -r --filter` is the no-Turborepo fallback.
- **pnpm policies.** Lifecycle scripts run only for packages listed under `allowBuilds` (pnpm fails the install on any undecided script; decide `true` or `false`, never approve blindly). `minimumReleaseAge: 1440` is set explicitly in `pnpm-workspace.yaml`, which makes the 24 h rule strict: an install that would pick a younger version fails in CI and prompts in a terminal. (pnpm's built-in default is non-strict and silently appends such versions to `minimumReleaseAgeExclude`.) Pin versions at least a day old; never approve the prompt or add exclusion entries. Set `ELECTRON_SKIP_BINARY_DOWNLOAD=1` when you do not need the Electron binary (CI does).
- **Language and tooling.** TypeScript 7; Biome for lint and format; Vitest (with `@effect/vitest`) for unit tests, jsdom for component tests; Playwright for end-to-end tests; REUSE 3.3 metadata in `REUSE.toml` and a CI license allowlist over production dependencies.
- **Effect.** Effect 4 (release candidate) pinned to an exact version, with `@effect/atom-react` and `@effect/vitest` on the same exact version as `effect`. Effect's `unstable/*` modules may break within minors: upgrade deliberately, one minor at a time.
- **Contracts.** `@camena-ai/contracts` is published by the platform repository to GitHub Packages (D20) and pinned to an exact version. Bumping it is its own commit that names the contract change it adopts. GitHub's npm registry needs a token even for a public package, and pnpm 12 no longer expands environment variables in a committed `.npmrc`. So the PR that first adds the package maps the scope under `registries` in `pnpm-workspace.yaml` (`"@camena-ai": https://npm.pkg.github.com/`), gives CI `permissions: packages: read` and passes the token through `pnpm_config__auth`, and tells contributors in `CONTRIBUTING.md` and the README to keep a personal token with `read:packages` in their user-level pnpm or npm config. Never commit a token. The workspace's own `@studio/*` names are unpublished and resolve only through `workspace:*`; the `@studio` npm scope belongs to someone else.

### Commands

```bash
pnpm install                 # --frozen-lockfile in CI; pnpm-lock.yaml is committed
pnpm typecheck               # turbo run typecheck (tsc in every package), then tsc for scripts/
pnpm lint                    # biome ci
pnpm lint:fix                # biome check --write
pnpm format                  # biome format --write (formatting only)
pnpm test                    # turbo run test (vitest run in every package)
pnpm vitest                  # all projects in one process, from the root config
pnpm e2e                     # turbo run e2e (playwright test in apps/web; no config yet)
pnpm dev                     # turbo run dev (vite in apps/web on http://localhost:5173)
pnpm build                   # turbo run build (vite build in apps/web; the desktop app will bundle it)
pnpm dlx shadcn@4.21.0 add <item> -c packages/ui   # vendor a registry item (see docs/design-system.md)
pnpm licenses:check          # production dependency license allowlist (scripts/check-licenses.ts)
pnpm reuse:lint              # REUSE 3.3 compliance via uvx
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck and test in one job and REUSE plus the license allowlist in another. `pnpm licenses` itself reports virtual-store paths that do not exist under the hoisted linker, so the allowlist script reads each production package's `package.json` from `node_modules` directly.

## Invariants that implementation must preserve

These come from the platform architecture doc (§7, §13, D16, D21, D22). Code that violates one is wrong even if tests pass.

### State and streaming (D21, D22, §13)

- **All UI state lives in Effect Atom.** `Atom`, `AtomRegistry`, `AsyncResult` and `AtomHttpApi` from `effect/unstable/reactivity`, React hooks from `@effect/atom-react`. No TanStack Query, no AI SDK runtime (`useChat` or its transports), no second state library. The admin and conversation-list surfaces use `AtomHttpApi` over the generated contracts client.
- **A turn is an Effect `Stream` of Studio SSE events** from the gateway's raw streaming route, decoded with the contract schemas and folded by one conversation atom: `classification` and `route` attach to the pending user message, `usage` to the assistant message, `route.blocked` closes the turn, and `route.local` hands the turn to the desktop `LocalEngine`, whose token stream is folded by the same atom.
- **Interrupting the atom's fiber closes the SSE connection.** That is the client side of the gateway's disconnect → abort contract. Never leave a stream running after the user navigates away or cancels.
- **Messages are a flat list.** The gateway retires edited or deleted messages together with their whole suffix, so the client stores no message tree and no branch state.
- **Replay, not resend.** A retry of a turn reuses the same `Idempotency-Key`; the gateway replays a finished turn from its stored message.
- **Every SSE frame and API payload is decoded with the contract schemas.** Nothing is parsed by hand and nothing untyped reaches an atom.

### Rendering (D21, §13)

- **Streamdown renders Markdown with an explicitly locked `rehype-harden` configuration.** Its defaults are permissive. The change that first renders Markdown with Streamdown adds a unit test asserting that an external image is blocked; keep it green from then on.
- **AI Elements are presentational only** and shadcn chat components handle scrolling and markers. If AI Elements cannot render Studio's message model without patching beyond their `ai` type imports, the shadcn chat components alone carry the UI (the ASSUMPTION in D21); do not adopt the AI SDK's state model to make them fit.
- **Taint is visible and self-serviceable (§5.5, §7).** A tainted conversation shows a persistent "classified" badge that points at the message(s) carrying the taint and offers the two exits: edit that message, or fork from before it. In a tainted conversation the model picker offers only targets from the resolved classified chain. Never hide a `classified` or `error` label or a `route.blocked` outcome.

### Desktop (D16, §7)

- **The Electron main process is plain Node/TypeScript** and consumes only contract types; no Effect there. Everything in the renderer follows the web rules above.
- **`node-llama-cpp` runs in an Electron `utilityProcess`, never in the main process.** GGML asserts and VRAM exhaustion abort the hosting process, so the worker must be disposable. The renderer reaches it over IPC; there is no loopback HTTP server. The runtime sits behind a `LocalEngine` seam: `NodeLlamaCppWorkerEngine` (v1), `OllamaEngine` (opt-in, detects a user-installed Ollama on `localhost:11434`) and `LlamaServerSidecarEngine` (only if a backend `node-llama-cpp` lacks becomes required). LM Studio is never bundled or relied on; its terms forbid redistribution.
- **The local cache holds tainted content and is encrypted at rest** with `better-sqlite3-multiple-ciphers`. The random 32-byte key is wrapped by Electron `safeStorage`; the app refuses to persist the cache when `safeStorage` reports encryption unavailable. There is no plaintext cache path.
- **The renderer never holds the seat token and never loads the hosted origin.** The desktop app serves the bundled web build over an `app://` scheme with a main-process proxy for `/v1/*`. Sign-in follows RFC 8252: system browser, PKCE S256, return over a custom reverse-DNS scheme, loopback listener only as the fallback; tokens stay in the main process, wrapped by `safeStorage`.
- **`route.local` context stays local.** The extracted attachment text and missing messages the gateway sends with `route.local` are for the local model and the encrypted cache only; they are never forwarded to any online endpoint.
- **Electron is never older than N−1.** Bump per Electron major.

### Hygiene

- **Never log or trace message content, attachment text or tokens.** Logs, error strings and telemetry carry ids, labels, routes and status only.
- **Never vendor or fork AGPL/GPL code or code under branding or derivative-work restrictions** (LibreChat, Open WebUI, LobeChat, Onyx, AnythingLLM, Jan, Cherry Studio, any LLM gateway); borrow designs, not code (D12). The dependency allowlist is MIT, Apache-2.0, BSD, ISC and MPL-2.0. Vendored registry items (shadcn/ui, AI Elements) get their own `REUSE.toml` annotation with the upstream SPDX id.
- **Hosting is same-origin.** One CloudFront distribution serves the SPA from S3 and forwards `/v1/*` and `/api/auth/*` to the gateway. The web app never needs CORS or a configurable API origin in production.

## Git workflow

`main` is protected: no direct pushes (admins included), no force-pushes. Every change is a feature branch from `main` with a pull request that must pass both CI jobs (`Lint, typecheck, test` and `REUSE and license allowlist`) on a branch up to date with `main`, and must have every conversation resolved. PRs are squash-merged with the PR title and body as the commit, and head branches are deleted on merge. Worktrees are created under `.claude/worktrees/` (git-ignored). Run git commands from the worktree you are in; operate on the primary checkout with `git -C <path>` rather than `cd`. Changes that adopt a new `@camena-ai/contracts` version or a new Electron major are their own PRs. Human-facing contribution rules, issue `[area]` prefixes and labels are in `CONTRIBUTING.md`; keep it consistent with this file.
