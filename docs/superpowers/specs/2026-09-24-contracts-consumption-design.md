# Consuming `@camena-ai/contracts` design

The last milestone-1 slice on the client side: this repository installs the published
`@camena-ai/contracts` 0.1.0 from GitHub Packages and makes one real call through it.

## Goal

- The `@camena-ai` scope resolves from GitHub Packages, locally and in CI, without a committed
  token.
- `@camena-ai/contracts` is pinned to `0.1.0` in the catalog and used by `apps/web`.
- `apps/web` has an `AtomHttpApi` client for `StudioApi` and a `healthAtom` for `GET /health`,
  with tests for the success and the `503` paths.
- The workspace has exactly one `effect` instance, and a test keeps it that way.
- Both CI jobs stay green: lint, typecheck, test; REUSE and the license allowlist.

Out of scope: the turn SSE stream and its atom, auth, every endpoint other than `/health`, any UI.

## Decisions

### 1. Scope routing lives in `pnpm-workspace.yaml`; there is no committed `.npmrc`

The request was for a committed `.npmrc` that reads the token from an environment variable. pnpm
12.5.1 does not support that. Probed against a local registry that echoes the `Authorization`
header (2026-09-24):

| Configuration | Header received |
| --- | --- |
| project `.npmrc` `//host/:_authToken=literal000` | `Bearer literal000` |
| project `.npmrc` `//host/:_authToken=${FAKE_TOKEN}` (quoted or not) | none |
| user-level npmrc (`NPM_CONFIG_USERCONFIG`) `//host/:_authToken=${FAKE_TOKEN}` | `Bearer sekrit123` |
| `pnpm_config__auth='{"http://host/":{"@camena-ai":{"authToken":"t2"}}}'` | `Bearer t2` |

`registries` in `pnpm-workspace.yaml` routes the scope in both the `"@scope": url` shape and the
`url: { scopes: [...] }` shape. So:

- `pnpm-workspace.yaml` declares `registries: { "@camena-ai": https://npm.pkg.github.com/ }`.
- CI passes the token through `pnpm_config__auth` on the install step only.
- Contributors keep a token in their user-level `~/.npmrc`.

A committed `.npmrc` holding only the scope route would work too. It would put the route in a
second file for no gain, so this design doesn't use one.

### 2. No release-age exclusion, and the age rule is made strict

`0.1.0` was published 2026-09-24 06:19:21 UTC. No `minimumReleaseAgeExclude` entry is added. The
PR merges into `main` after 2026-09-25 06:19:21 UTC, with the temporary exclusion described below
reverted first.

pnpm 12.5.1's built-in 24 h default is **non-strict**. A plain `pnpm install` on 2026-09-24
succeeded and silently appended `'@camena-ai/contracts@0.1.0'` to `minimumReleaseAgeExclude` in
`pnpm-workspace.yaml`. Setting `minimumReleaseAge: 1440` explicitly makes pnpm strict
(`minimumReleaseAgeStrict` defaults to `true` when the age is configured). A non-interactive
install then fails with "1 version does not meet the minimumReleaseAge constraint", and an
interactive one prompts. So `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440`, and CLAUDE.md
stops describing the default as if it enforced anything.

The project owner chose to implement before that cutoff rather than wait a day, adding a
temporary `minimumReleaseAgeExclude` entry for `@camena-ai/contracts@0.1.0` in its own commit
(`a340f12`). That commit is reverted after 2026-09-25 06:19:21 UTC and before the pull request
merges, so `main` never carries an exclusion.

Prototypes before the cutoff run in a scratch directory with `--config.minimum-release-age=0`,
never in the repository.

Why: the cooldown also protects against a leaked publish credential in the platform repository.
The cost is that every contracts bump waits a day before the client can adopt it. The gateway
already has to wait for a client release before it emits a new event, so a day of latency on the
client side is acceptable.

### 3. Only `apps/web` depends on the package

- The catalog gets `"@camena-ai/contracts": 0.1.0`, and `apps/web` gets `"catalog:"`.
- `apps/desktop` has no main-process code yet. When it does, it consumes contract types only
  (D16, D22).
- `packages/ui` is presentational and never talks to the API.

The package's `bun` and `@studio/source` export conditions are not enabled here. The client
resolves `types` → `dist/*.d.ts` and `default` → `dist/*.js`. `tsconfig.base.json` sets no
`customConditions`, and Vite's defaults don't include those conditions.

The published tarball ships `src/` as well. With it renamed away in a scratch install, Vitest,
`tsc` and `vite build` still passed, so nothing here resolves the source.

### 4. `apps/web/src/api/studio-api.ts`

```ts
export const httpClientLayerAtom = Atom.make<Layer.Layer<HttpClient.HttpClient>>(FetchHttpClient.layer)

export class StudioApiClient extends AtomHttpApi.Service<StudioApiClient>()("StudioApiClient", {
  api: StudioApi,
  httpClient: (get) => get(httpClientLayerAtom),
  baseUrl: globalThis.location?.origin,
}) {}

export const healthAtom = StudioApiClient.query("system", "health", {})
```

- **`AtomHttpApi` fits** (D21, D22). `query` returns an
  `Atom<AsyncResult<{ status: "ok" }, ServiceUnavailable | …>>`, and `AtomRegistry.getResult`
  reads it as an `Effect`.
- **The HTTP client layer is itself an atom.** That is the only reliable test seam:
  - atom runtimes build their layer through a shared memo map, so a layer built for one registry
    is reused by the next;
  - `FetchHttpClient` reads `fetch` when its layer is built.

  The first prototype stubbed `globalThis.fetch` per test. Its second test silently received the
  first test's client, and a `503` decoded as `{ status: "ok" }`. Injecting a distinct layer per
  registry through `initialValues` avoids that, and the real `FetchHttpClient` code still runs.
- **Base URL is same-origin.** Hosting is same-origin in production and in the desktop `app://`
  scheme, so the base URL is the page's origin and nothing is configurable.

### 5. Tests (`apps/web/src/api/studio-api.test.ts`, `@effect/vitest`)

Each test builds `AtomRegistry.make({ initialValues: [[httpClientLayerAtom, layer]] })`, where
`layer` is `FetchHttpClient.layer` provided with a stub `FetchHttpClient.Fetch`.

- **Success:** a `200` with `{ "status": "ok" }` yields `{ status: "ok" }`, and the request URL is
  `<origin>/health`.
- **503:** an empty `503` fails with `HttpApiError.ServiceUnavailable`. The test uses
  `Effect.flip` and asserts `instanceOf`, so a defect (a crash) fails the test instead of passing
  it. Prototyped, the cause is `Fail(ServiceUnavailable)`.

### 6. One `effect` instance

`effect` is an exact peer dependency of the contracts package (`4.0.0-rc.117`), and the catalog
pins the same version. `apps/web/src/effect-instance.test.ts` reads `pnpm-lock.yaml` and asserts
two things:

- every resolved `effect@<version>` key has the catalog version, and there is only one version;
- the `@camena-ai/contracts@0.1.0` snapshot resolves its `effect` peer to that version.

The scratch install from GitHub Packages resolves as follows:

```yaml
packages:
  '@camena-ai/contracts@0.1.0':
    resolution: {integrity: sha512-+FLQ…, tarball: https://npm.pkg.github.com/download/@camena-ai/contracts/0.1.0/82d5…}
    peerDependencies:
      effect: 4.0.0-rc.117
  effect@4.0.0-rc.117: …
snapshots:
  '@camena-ai/contracts@0.1.0(effect@4.0.0-rc.117)':
    dependencies:
      effect: 4.0.0-rc.117
  effect@4.0.0-rc.117: {}
```

That is one `effect` key in each section, and one `node_modules/effect` on disk. The test fails
when a second `effect` version is written into the lockfile (checked by mutating it).

### 7. Licenses and REUSE

- `scripts/check-licenses.ts` stops exempting `@camena-ai/*` from the allowlist. Only this
  workspace's own projects stay exempt, so the contracts package's `Apache-2.0` is checked like
  any other production dependency.
- No new file needs a REUSE annotation; the aggregate `Apache-2.0` entry covers them.

### 8. CI

Both jobs in `.github/workflows/ci.yml`:

```yaml
permissions:
  contents: read
  packages: read
...
      - run: pnpm install --frozen-lockfile
        env:
          pnpm_config__auth: '{"https://npm.pkg.github.com/":{"@camena-ai":{"authToken":"${{ secrets.GITHUB_TOKEN }}"}}}'
```

GitHub masks `GITHUB_TOKEN` in logs. The token is scoped to the install step, and no other step
needs the registry.

Checked locally with a fresh store (`--store-dir`), so the tarball had to be downloaded:

- without a token, `pnpm install --frozen-lockfile` fails with
  `ERR_PNPM_TARBALL_HTTP_STATUS … 401`;
- with `pnpm_config__auth` it installs;
- a user-level npmrc holding `//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}` also
  installs.

With the `@camena-ai/` exemption removed, the license allowlist passes over 232 production
packages, `@camena-ai/contracts@0.1.0` among them.

### 9. Docs

- **`CLAUDE.md`:**
  - "Current state" says contracts are consumed and `/health` is the one call.
  - The Contracts toolchain bullet states the mechanism as built.
  - The commands block notes the token prerequisite.
- **`CONTRIBUTING.md`, under "Development setup":**
  - Every contributor needs a classic personal access token with `read:packages`, even though the
    package is public. GitHub's npm registry requires authentication for every install, and D20
    accepts this cost.
  - The token goes in the user-level `~/.npmrc` as `//npm.pkg.github.com/:_authToken=<token>` (a
    `${VAR}` reference works there), never in the repository.
- **README, "Running it":** a short pointer to the same requirement.

## Known limitations

- **`/health` is not routed in production.** The distribution forwards only `/v1/*` and
  `/api/auth/*` to the gateway, so a production `GET /health` from the SPA would receive
  `index.html`. The prototype shows that response decodes as a defect (`Die(SchemaError)`), not a
  typed error. `healthAtom` proves the plumbing and is not rendered. A versioned endpoint is the
  first real UI consumer.
- **Fork PRs are unverified.** Whether a fork PR's `GITHUB_TOKEN` can read the package with
  `packages: read` can't be checked until a fork opens a PR. If it can't, outside contributors'
  PRs fail at install, and publishing the package to the public npm registry would be the fix.
- **No version header check.** The client does not send or check `studio-api-version`
  (`API_VERSION_HEADER`) yet. That belongs with the first versioned endpoint.
