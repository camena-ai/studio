# Consuming `@camena-ai/contracts` implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `apps/web` installs `@camena-ai/contracts` 0.1.0 from GitHub Packages, locally and in
CI, and calls `GET /health` through an `AtomHttpApi` client, with tests for the `200` and `503`
paths and a lockfile test that proves there is exactly one `effect`.

**Architecture:** `pnpm-workspace.yaml` routes the `@camena-ai` scope to
`https://npm.pkg.github.com/` and pins the package in the catalog. The token never enters the
repository:
- CI passes `GITHUB_TOKEN` through `pnpm_config__auth` on the install step;
- contributors keep a personal token in their user-level `~/.npmrc`.

`apps/web/src/api/studio-api.ts` defines an `AtomHttpApi.Service` over `StudioApi`, whose HTTP
client layer comes from an atom so tests can inject `fetch` per registry.

**Tech Stack:**
- pnpm 12.5.1 workspaces, Node 24, Turborepo;
- Effect 4.0.0-rc.117 (`effect/unstable/reactivity`, `effect/unstable/http`,
  `effect/unstable/httpapi`);
- Vitest 5 with `@effect/vitest`, jsdom;
- Biome 2.5, actionlint, GitHub Actions.

Spec: `docs/superpowers/specs/2026-09-24-contracts-consumption-design.md`.

## Global Constraints

- **Node 24.** This machine's default shell Node is 22 and `engineStrict: true` is set. Begin
  every shell with `export PATH=$HOME/.nvm/versions/node/v24.21.0/bin:$PATH ELECTRON_SKIP_BINARY_DOWNLOAD=1`.
  `pnpm` resolves to 12.5.1 through corepack and the `packageManager` field; check with
  `pnpm --version`.
- **Pinning.** `@camena-ai/contracts` is pinned to exactly `0.1.0` in the pnpm `catalog`, and
  `apps/web` references it as `"catalog:"`. No other package depends on it.
- **Release age.** `0.1.0` was published 2026-09-24 06:19:21 UTC. Do not install it in the
  repository before **2026-09-25 06:19:21 UTC**. Never add a `minimumReleaseAgeExclude` entry,
  never answer yes to pnpm's release-age prompt, never pass `--config.minimum-release-age` in the
  repository.
- **Tokens.** Never commit a token or a `.npmrc`. Never print a token: use `$(gh auth token)`
  inside a command only. The `gh` CLI token has `read:packages`.
- **Stale token in `~/.npmrc`.** `~/.npmrc` holds a `//npm.pkg.github.com/:_authToken` that is
  stale (401). `pnpm_config__auth` in the environment overrides it (verified), so local installs
  pass the token that way.
- **Lockfile re-verification.** pnpm re-verifies the lockfile against the registry ("Verifying
  lockfile against supply-chain policies") before `run`/`exec` when the settings differ from the
  last install's. If that fails with `ERR_PNPM_META_FETCH_FAIL`, prefix the command with the same
  `pnpm_config__auth=…` used for installs. CI is unaffected: install and run share settings, so
  lint, typecheck, test and licenses ran without the token in the prototype.
- **Export conditions.** Do not enable the package's `bun` or `@studio/source` export conditions
  (no `customConditions`, no Vite `resolve.conditions`).
- **Hygiene.** No UI changes. No message content, attachment text or tokens in logs or errors.
- **Formatting.** Biome: double quotes, no semicolons, trailing commas, 100 columns. Run
  `pnpm lint:fix` before each commit.
- **Commits.** Commit subjects are short imperative sentences. Every commit message ends with
  the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **CI checks.** Every check CI runs stays green after each task: `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm licenses:check`, `pnpm reuse:lint`.

## File structure

| File | Change | Responsibility |
| --- | --- | --- |
| `pnpm-workspace.yaml` | modify | strict release age; `@camena-ai` registry route; catalog pin |
| `scripts/check-licenses.ts` | modify | stop exempting `@camena-ai/*` from the allowlist |
| `.github/workflows/ci.yml` | modify | `packages: read`; token on the install steps |
| `apps/web/package.json` | modify | depend on `@camena-ai/contracts` |
| `pnpm-lock.yaml` | regenerate | the resolved package and its `effect` peer |
| `apps/web/src/effect-instance.test.ts` | create | lockfile proof of one `effect` |
| `apps/web/src/api/studio-api.ts` | create | `httpClientLayerAtom`, `StudioApiClient`, `healthAtom` |
| `apps/web/src/api/studio-api.test.ts` | create | `200` and `503` decoding |
| `CLAUDE.md`, `CONTRIBUTING.md`, `README.md` | modify | policy, setup and current state |

Tasks 1 and 2 can run at any time. Tasks 3–5 start after 2026-09-25 06:19:21 UTC.

---

### Task 1: Make pnpm's release-age rule strict

pnpm 12.5.1's built-in 24 h default is non-strict. It silently appends young versions to
`minimumReleaseAgeExclude` and succeeds. Configuring the age explicitly makes pnpm strict: it
fails in CI and prompts in a terminal.

**Files:**
- Modify: `pnpm-workspace.yaml` (after `saveExact: true`)
- Modify: `CLAUDE.md` (the "pnpm policies" bullet under "Toolchain (D20)")

**Interfaces:**
- Consumes: nothing.
- Produces: `minimumReleaseAge: 1440` in `pnpm-workspace.yaml`. Task 3 relies on it to refuse
  an early install.

- [ ] **Step 1: Record the non-strict baseline**

Run: `pnpm config get minimumReleaseAge`
Expected: `undefined` (the built-in default is in force, which is non-strict)

- [ ] **Step 2: Set the age explicitly**

In `pnpm-workspace.yaml`, replace

```yaml
nodeLinker: hoisted
saveExact: true
engineStrict: true
```

with

```yaml
nodeLinker: hoisted
saveExact: true
# Set explicitly so the rule is strict: an install that would pick a version younger than 24 h
# fails in CI and prompts in a terminal. pnpm's built-in default is non-strict and silently
# appends such versions to minimumReleaseAgeExclude instead. Never add exclusions; wait.
minimumReleaseAge: 1440
engineStrict: true
```

- [ ] **Step 3: Verify the setting and that the current lockfile still installs**

Run: `pnpm config get minimumReleaseAge && pnpm install --frozen-lockfile </dev/null`
Expected: `1440`, then `Done in …` with no release-age error (every current dependency is older
than 24 h).

- [ ] **Step 4: Correct CLAUDE.md**

In `CLAUDE.md`, replace this sentence in the **pnpm policies** bullet:

```
pnpm's default minimum release age (24 h) applies: pin versions at least a day old rather than adding `minimumReleaseAgeExclude` entries.
```

with

```
`minimumReleaseAge: 1440` is set explicitly in `pnpm-workspace.yaml`, which makes the 24 h rule strict: an install that would pick a younger version fails in CI and prompts in a terminal. (pnpm's built-in default is non-strict and silently appends such versions to `minimumReleaseAgeExclude`.) Pin versions at least a day old; never approve the prompt or add exclusion entries.
```

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint
git add pnpm-workspace.yaml CLAUDE.md
git commit -m "Make the 24 h minimum release age strict

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Check `@camena-ai/*` against the license allowlist

**Files:**
- Modify: `scripts/check-licenses.ts:125-130` (the first-party comment and `isFirstParty`)

**Interfaces:**
- Consumes: nothing.
- Produces: `isFirstParty(name)`, which is `true` only for this workspace's own projects. From
  Task 3 on, `@camena-ai/contracts` is license-checked.

- [ ] **Step 1: Replace the exemption**

In `scripts/check-licenses.ts`, replace

```ts
// First-party packages are walked but not checked: this workspace's own projects (matched by name,
// not by the `@studio/` prefix, whose npm scope belongs to someone else) and the contracts package
// published under the `camena-ai` organization's GitHub Packages scope (D20).
const workspaceNames = new Set(projects.map((project) => project.name))
const isFirstParty = (name: string): boolean =>
  workspaceNames.has(name) || name.startsWith("@camena-ai/")
```

with

```ts
// This workspace's own projects are walked but not checked (matched by name, not by the
// `@studio/` prefix, whose npm scope belongs to someone else). Published packages, the platform
// repository's `@camena-ai/contracts` included, are checked like any other dependency.
const workspaceNames = new Set(projects.map((project) => project.name))
const isFirstParty = (name: string): boolean => workspaceNames.has(name)
```

- [ ] **Step 2: Run the allowlist and typecheck**

Run: `pnpm licenses:check && pnpm typecheck`
Expected: `License allowlist passed (231 production packages).` (231 before Task 3 adds the
contracts package; the exact count may differ by one or two, but it must pass), then the
typecheck succeeds.

- [ ] **Step 3: Lint and commit**

```bash
pnpm lint
git add scripts/check-licenses.ts
git commit -m "Check @camena-ai packages against the license allowlist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Install `@camena-ai/contracts` 0.1.0 from GitHub Packages

**Start only after 2026-09-25 06:19:21 UTC.**

**Files:**
- Create: `apps/web/src/effect-instance.test.ts`
- Modify: `pnpm-workspace.yaml` (`registries`, `catalog`), `apps/web/package.json`,
  `pnpm-lock.yaml`
- Modify: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md` (Contracts bullet, Commands block), `CONTRIBUTING.md`
  (Development setup), `README.md` (Running it)

**Interfaces:**
- Consumes: `minimumReleaseAge: 1440` (Task 1). `isFirstParty` without the `@camena-ai`
  exemption (Task 2).
- Produces: `@camena-ai/contracts` importable from `apps/web` with the exports `StudioApi`,
  `SystemGroup`, `Health`, `API_VERSION`, `API_VERSION_HEADER`, `OrgId`, `MessageId`,
  `TurnEvent`, `TurnEventFrame`, `encodeTurnEvent`, `decodeTurnEvents`, `HEARTBEAT_FRAME`.

- [ ] **Step 1: Check the clock**

Run: `date -u +%Y-%m-%dT%H:%M:%SZ`
Expected: later than `2026-09-25T06:19:21Z`. If not, stop and wait.

- [ ] **Step 2: Write the failing lockfile test**

Create `apps/web/src/effect-instance.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// `@camena-ai/contracts` takes `effect` as an exact peer so the app has one `effect` instance
// (a second copy breaks `Redacted` and every other identity check). The lockfile proves it.
const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")

const lockfile = read("../../../pnpm-lock.yaml")
const catalogEffect = /^ {2}effect: (\S+)$/m.exec(read("../../../pnpm-workspace.yaml"))?.[1]

describe("the effect instance", () => {
  it("resolves exactly one effect version, the catalog's", () => {
    const versions = new Set(
      [...lockfile.matchAll(/^ {2}'?effect@([^:'(]+)/gm)].map((match) => match[1]),
    )
    expect(catalogEffect).toBeDefined()
    expect([...versions]).toEqual([catalogEffect])
  })

  it("resolves the contracts peer to that version", () => {
    const snapshot = /^ {2}'@camena-ai\/contracts@[^(]+\(effect@([^)]+)\)':$/m.exec(lockfile)
    expect(snapshot?.[1]).toBe(catalogEffect)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @studio/web exec vitest run src/effect-instance.test.ts`
Expected: 1 passed, 1 failed. `resolves the contracts peer to that version` fails with
`expected undefined to be '4.0.0-rc.117'`.

- [ ] **Step 4: Route the scope and pin the package**

In `pnpm-workspace.yaml`, insert before the `# pnpm runs no lifecycle scripts …` comment:

```yaml
# @camena-ai/* comes from GitHub Packages (D20). The token is never committed: CI passes
# GITHUB_TOKEN through pnpm_config__auth, contributors keep one in their user-level ~/.npmrc
# (CONTRIBUTING.md). pnpm 12 does not expand variables in a project .npmrc, so there is none.
registries:
  "@camena-ai": https://npm.pkg.github.com/

```

In the same file, under the Effect lines of the catalog, replace

```yaml
  "@effect/vitest": 4.0.0-rc.117
```

with

```yaml
  "@effect/vitest": 4.0.0-rc.117
  # Contracts (D20): published by the platform repository; `effect` is its exact peer, so it
  # must match the version above. Bumping it is its own commit naming the contract change.
  "@camena-ai/contracts": 0.1.0
```

In `apps/web/package.json`, add to `dependencies` (keep the keys sorted):

```json
    "@camena-ai/contracts": "catalog:",
```

- [ ] **Step 5: Install with the token from the environment**

```bash
pnpm_config__auth="{\"https://npm.pkg.github.com/\":{\"@camena-ai\":{\"authToken\":\"$(gh auth token)\"}}}" pnpm install </dev/null
```

Expected: `Done in …`. No release-age error.

Then run: `grep -c minimumReleaseAgeExclude pnpm-workspace.yaml; git diff --stat`
Expected:
- `0` (no exclusion was written);
- changes only in `pnpm-workspace.yaml`, `apps/web/package.json` and `pnpm-lock.yaml`.

- [ ] **Step 6: Verify one `effect` and the `dist/` resolution**

Run: `pnpm --filter @studio/web exec vitest run src/effect-instance.test.ts`
Expected: 2 passed.

Run: `grep -nE "^  '?(effect|@camena-ai/contracts)@" pnpm-lock.yaml`
Expected, exactly these four lines (line numbers vary):

```
  '@camena-ai/contracts@0.1.0':
  effect@4.0.0-rc.117:
  '@camena-ai/contracts@0.1.0(effect@4.0.0-rc.117)':
  effect@4.0.0-rc.117: {}
```

Run: `find . -path '*node_modules/effect/package.json' -not -path './node_modules/.pnpm/*'`
Expected: only `./node_modules/effect/package.json`.

- [ ] **Step 7: Give CI the token**

In `.github/workflows/ci.yml`, replace

```yaml
env:
  # CI never needs the Electron binary until packaging exists.
```

with

```yaml
permissions:
  contents: read
  # GitHub's npm registry needs a token even for the public @camena-ai/contracts (D20).
  packages: read

env:
  # CI never needs the Electron binary until packaging exists.
```

In **both** jobs, replace

```yaml
      - run: pnpm install --frozen-lockfile
```

with

```yaml
      - run: pnpm install --frozen-lockfile
        env:
          # Routes the token to the @camena-ai scope only; pnpm 12 does not expand variables in a
          # committed .npmrc, so there is none.
          pnpm_config__auth: '{"https://npm.pkg.github.com/":{"@camena-ai":{"authToken":"${{ secrets.GITHUB_TOKEN }}"}}}'
```

Run: `actionlint .github/workflows/ci.yml && grep -c pnpm_config__auth .github/workflows/ci.yml`
Expected: no actionlint output, then `2`.

- [ ] **Step 8: Contributor docs**

In `CONTRIBUTING.md`, under "## Development setup", insert after the Node/pnpm sentence and
before the clone block:

````markdown
You also need a **GitHub token with `read:packages`**. The web app depends on
`@camena-ai/contracts`, which is published to GitHub Packages. GitHub's npm registry asks for a
token on every install, even for a public package, so every contributor needs one; the project
accepts that cost for now. Use a classic personal access token with only the `read:packages`
scope ([create one](https://github.com/settings/tokens/new?scopes=read:packages)), or, with the
GitHub CLI, run `gh auth refresh -h github.com -s read:packages` and use `gh auth token`. Put it
in your **user-level** `~/.npmrc`, never in the repository:

```ini
//npm.pkg.github.com/:_authToken=<your token>
```

A `${VARIABLE}` reference works there too if you keep the token in your shell environment. The
scope's registry is already set in `pnpm-workspace.yaml`. Without the token, `pnpm install`
fails with a 401 from `npm.pkg.github.com`.
````

In `README.md`, under "## Running it", insert after the nvm paragraph and before the clone
block:

```markdown
Installing needs a GitHub token with `read:packages` in your user-level `~/.npmrc`, because the API contracts package comes from GitHub Packages, which requires authentication even for public packages. [CONTRIBUTING.md](CONTRIBUTING.md#development-setup) shows how to create one.
```

- [ ] **Step 9: CLAUDE.md Contracts bullet and Commands**

In `CLAUDE.md`, replace the whole **Contracts** bullet under "Toolchain (D20)" with:

```markdown
- **Contracts.** `@camena-ai/contracts` is published by the platform repository to GitHub Packages (D20) and pinned to an exact version in the catalog; only `apps/web` depends on it, and it resolves to the package's `dist/` (never enable its `bun` or `@studio/source` export conditions). Bumping it is its own commit that names the contract change it adopts. GitHub's npm registry needs a token even for a public package, and pnpm 12 does not expand environment variables in a project `.npmrc` (checked on 12.5.1), so there is no committed `.npmrc`: `registries` in `pnpm-workspace.yaml` routes the scope (`"@camena-ai": https://npm.pkg.github.com/`), CI's install steps pass `GITHUB_TOKEN` (with `permissions: packages: read`) through `pnpm_config__auth`, and contributors keep a classic token with `read:packages` in their user-level `~/.npmrc` (`CONTRIBUTING.md`). Locally, `pnpm_config__auth` in the environment overrides `~/.npmrc`. Never commit a token. `effect` is the package's exact peer, and `apps/web/src/effect-instance.test.ts` asserts from the lockfile that the workspace resolves one `effect`. The license allowlist checks the package like any other dependency. The workspace's own `@studio/*` names are unpublished and resolve only through `workspace:*`; the `@studio` npm scope belongs to someone else.
```

In the Commands block, replace

```
pnpm install                 # --frozen-lockfile in CI; pnpm-lock.yaml is committed
```

with

```
pnpm install                 # needs a read:packages token in ~/.npmrc; --frozen-lockfile in CI
```

- [ ] **Step 10: Run every CI check**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm licenses:check && pnpm reuse:lint`
Expected: all pass. `licenses:check` ends with `License allowlist passed (232 production
packages).`

- [ ] **Step 11: Commit**

```bash
git add pnpm-workspace.yaml apps/web/package.json pnpm-lock.yaml apps/web/src/effect-instance.test.ts .github/workflows/ci.yml CLAUDE.md CONTRIBUTING.md README.md
git commit -m "Install @camena-ai/contracts 0.1.0 from GitHub Packages

Routes the @camena-ai scope to npm.pkg.github.com in pnpm-workspace.yaml,
gives CI packages: read and the token on the install steps, documents the
contributor token, and asserts from the lockfile that there is one effect.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `healthAtom` over `AtomHttpApi`

**Files:**
- Create: `apps/web/src/api/studio-api.test.ts`
- Create: `apps/web/src/api/studio-api.ts`
- Modify: `CLAUDE.md` ("Current state")

**Interfaces:**
- Consumes: `StudioApi` from `@camena-ai/contracts` (Task 3). `StudioApi` has group `"system"`
  and endpoint `"health"`: `GET /health`, success `{ status: "ok" }`, error
  `HttpApiError.ServiceUnavailableNoContent`.
- Produces, from `apps/web/src/api/studio-api.ts`:
  - `httpClientLayerAtom: Atom.Writable<Layer.Layer<HttpClient.HttpClient>>`, defaulting to
    `FetchHttpClient.layer`;
  - `class StudioApiClient`, an `AtomHttpApi.Service` over `StudioApi` with the same-origin base
    URL;
  - `healthAtom: Atom<AsyncResult<{ readonly status: "ok" }, HttpApiError.ServiceUnavailable>>`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/api/studio-api.test.ts`:

```ts
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiError } from "effect/unstable/httpapi"
import { AtomRegistry } from "effect/unstable/reactivity"
import { healthAtom, httpClientLayerAtom } from "./studio-api.ts"

/** A registry whose `StudioApiClient` answers every request with `respond()`. */
function registryAnswering(respond: () => Response) {
  const urls: Array<string> = []
  const fetch: typeof globalThis.fetch = async (input) => {
    urls.push(String(input))
    return respond()
  }
  const layer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
  )
  return { registry: AtomRegistry.make({ initialValues: [[httpClientLayerAtom, layer]] }), urls }
}

describe("healthAtom", () => {
  it.effect("decodes { status: ok } from GET /health", () =>
    Effect.gen(function* () {
      const { registry, urls } = registryAnswering(() => Response.json({ status: "ok" }))
      const health = yield* AtomRegistry.getResult(registry, healthAtom)
      assert.deepStrictEqual(health, { status: "ok" })
      assert.deepStrictEqual(urls, [`${globalThis.location.origin}/health`])
    }),
  )

  it.effect("decodes an empty 503 as ServiceUnavailable, not a defect", () =>
    Effect.gen(function* () {
      const { registry } = registryAnswering(() => new Response(null, { status: 503 }))
      const error = yield* Effect.flip(AtomRegistry.getResult(registry, healthAtom))
      assert.instanceOf(error, HttpApiError.ServiceUnavailable)
    }),
  )
})
```

Why `Effect.flip` and not `Effect.exit`: if the 503 crashed decoding (a defect), `flip` would
die and fail the test. The test passes only on a typed failure.

Why each test injects its own layer: atom runtimes memoize built layers across registries, and
`FetchHttpClient` reads `fetch` when its layer is built. Stubbing `globalThis.fetch` per test
leaks the first test's client into the second. The prototype did exactly that: a `503` decoded
as `{ status: "ok" }`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @studio/web exec vitest run src/api`
Expected: FAIL with `Failed to resolve import "./studio-api.ts" from "src/api/studio-api.test.ts"`.

- [ ] **Step 3: Implement**

Create `apps/web/src/api/studio-api.ts`:

```ts
/**
 * The typed client for the gateway's `StudioApi` (D21, D22): `AtomHttpApi` over the published
 * `@camena-ai/contracts`, so every response is decoded with the contract schemas.
 *
 * The HTTP client layer is an atom so tests can swap `fetch` per registry. Atom runtimes memoize
 * layers across registries and `FetchHttpClient` reads `fetch` when its layer is built, so
 * stubbing `globalThis.fetch` is not enough.
 */
import { StudioApi } from "@camena-ai/contracts"
import type { Layer } from "effect"
import { FetchHttpClient, type HttpClient } from "effect/unstable/http"
import { Atom, AtomHttpApi } from "effect/unstable/reactivity"

export const httpClientLayerAtom = Atom.make<Layer.Layer<HttpClient.HttpClient>>(
  FetchHttpClient.layer,
)

/** Same-origin: CloudFront on the web, the `app://` proxy on the desktop. */
export class StudioApiClient extends AtomHttpApi.Service<StudioApiClient>()("StudioApiClient", {
  api: StudioApi,
  httpClient: (get) => get(httpClientLayerAtom),
  baseUrl: globalThis.location?.origin,
}) {}

/** `GET /health`: `{ status: "ok" }`, or `ServiceUnavailable` while the gateway drains. */
export const healthAtom = StudioApiClient.query("system", "health", {})
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @studio/web exec vitest run src/api && pnpm --filter @studio/web typecheck`
Expected: 2 passed, then no type errors.

- [ ] **Step 5: Update "Current state" in CLAUDE.md**

In `CLAUDE.md` under "## Current state", replace

```
Nothing talks to a gateway yet: the model list is a synthetic fixture and submitting clears the draft. `apps/desktop/src/index.ts` is still a placeholder whose header names the sections it owns. The clients are milestone 8 of the build order; conversation state, AI Elements and the shadcn chat components arrive once `@camena-ai/contracts` is published from the platform repository and added to the catalog as an exact pinned version.
```

with

```
`apps/web` consumes `@camena-ai/contracts` 0.1.0: `src/api/studio-api.ts` holds the `AtomHttpApi` client for `StudioApi` and `healthAtom` (`GET /health`, tested for `200` and `503`), which nothing renders yet; in production CloudFront forwards only `/v1/*` and `/api/auth/*`, so `/health` is plumbing, not a feature. The model list is still a synthetic fixture and submitting clears the draft. `apps/desktop/src/index.ts` is still a placeholder whose header names the sections it owns. The clients are milestone 8 of the build order; conversation state, AI Elements and the shadcn chat components arrive with the turn endpoints of later contract versions.
```

- [ ] **Step 6: Run every CI check, then commit**

Run: `pnpm lint:fix && pnpm lint && pnpm typecheck && pnpm test`
Expected: all pass.

```bash
git add apps/web/src/api/studio-api.ts apps/web/src/api/studio-api.test.ts CLAUDE.md
git commit -m "Add the StudioApi client and the health atom

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Final verification and pull request

**Files:** none changed unless a check fails.

**Interfaces:**
- Consumes: everything above.
- Produces: an open PR into `main`.

- [ ] **Step 1: Bring the branch up to date with `main`**

Run: `git fetch origin && git log --oneline HEAD..origin/main`
Expected: empty. If not, `git merge origin/main`, resolve any conflicts, and re-run Step 2.

- [ ] **Step 2: Run every CI check from a clean install**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm_config__auth="{\"https://npm.pkg.github.com/\":{\"@camena-ai\":{\"authToken\":\"$(gh auth token)\"}}}" pnpm install --frozen-lockfile </dev/null
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm licenses:check && pnpm reuse:lint
git status --short
```

Expected:
- every command passes;
- `git status --short` prints nothing (no generated file changed, no exclusion written).

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --base main --title "Consume @camena-ai/contracts 0.1.0 from GitHub Packages" --body-file <scratchpad>/pr-body.md
```

Write `<scratchpad>/pr-body.md` first. It summarizes:
- the registry route and why there is no committed `.npmrc` (pnpm 12.5.1 ignores `${VAR}` in a
  project `.npmrc`);
- the strict release age and why (the default is non-strict);
- the CI token;
- the `healthAtom` and its tests;
- the lockfile proof of one `effect`;
- the license allowlist change;
- the known limitations from the spec.

It links the spec and this plan, and ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 4: Watch CI**

Use the PR status tools to read both jobs: `Lint, typecheck, test` and `REUSE and license
allowlist`. If the install step fails with a 401 or 403, check that the repository still has
Actions read access to the package (package settings → *Manage Actions access*) before changing
any code.
