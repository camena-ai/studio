# Studio

This is `camena-ai/studio`, the public repository for the Studio clients: the web app and the desktop app. The gateway, worker, shared packages and infrastructure live in the private platform repository, `camena-ai/studio-platform`, which publishes the `@studio/contracts` package that these clients consume.

Studio is a ChatGPT-style assistant for organizations, delivered as a browser app and a desktop app, with two things a normal chat app does not have:

- **A classification guardrail.** Every turn is checked by a fast classifier before it reaches any online model. Content judged *classified* never goes to an ordinary online model. It is routed by an org-defined chain: an approved model, the user's on-device model, or blocked.
- **An org gateway with bring-your-own-keys.** Org owners supply provider API keys. Seats use them through Studio's gateway, which enforces which roles may use which models and within what budget.

The clients are public because they are what customers run and audit. The desktop app bundles the web build, and this repository lets anyone read what it does with classified content, the local model runtime and the encrypted local cache.

## Status

v0 shell. The web app runs and shows the new-chat screen in light and dark, built on the design tokens and shadcn/ui components in `packages/ui`; the desktop app is still a placeholder. Nothing talks to a gateway yet. The clients are milestone 8 of the build order in the platform architecture doc, so conversation features start once the gateway's contracts package is published. Commands and layout are listed in [CLAUDE.md](CLAUDE.md); the design system is described in [DESIGN.md](DESIGN.md) and [docs/design-system.md](docs/design-system.md).

## Layout

```
apps/web        Vite + React SPA
apps/desktop    Electron shell that bundles the web build
packages/ui     Shared UI components and vendored registry items
```

The header of each package's entry file (`apps/web/src/main.tsx`, `apps/desktop/src/index.ts`, `packages/ui/src/index.ts`) names the architecture sections it owns. How to contribute is described in [CONTRIBUTING.md](CONTRIBUTING.md); tooling and invariants in [CLAUDE.md](CLAUDE.md).

## Stack

TypeScript on Effect 4 everywhere except the Electron main process, which is plain Node. The web app is a Vite + React single-page application with TanStack Router, all state on Effect Atom, shadcn/ui and its chat components, Vercel AI Elements as presentational components, and Streamdown with a locked hardening configuration for Markdown. The desktop app is Electron on the current major with `node-llama-cpp` in a utility process for on-device models, an encrypted SQLite cache and OS-native secret storage. The monorepo runs on pnpm workspaces and Turborepo. Nothing is forked from existing chat applications; designs are borrowed, code is not.

## Relationship to the platform repository

- `@studio/contracts` (Effect Schema definitions, the server-sent event union and the generated OpenAPI document) is owned by the platform repository and published to npm. The clients pin a version. The API carries a version header with a one-minor compatibility window.
- The architecture document that governs both repositories lives in the platform repository and is the source of truth for scope and design.

## License

Apache-2.0. See [LICENSE](LICENSE). Licensing metadata follows the [REUSE](https://reuse.software) specification; vendored components keep their upstream license in `REUSE.toml`.
