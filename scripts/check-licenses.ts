/**
 * CI license allowlist (D20, §12.1).
 *
 * Walks the production dependency graph reported by `pnpm list --prod --depth Infinity --json`
 * and fails when any package carries a license outside the allowlist. Licenses are read from each
 * package's own `package.json` under the hoisted `node_modules` tree, because `pnpm licenses`
 * reports virtual-store paths that do not exist under `nodeLinker: hoisted` (pnpm 12.5).
 *
 * An SPDX expression passes when at least one OR-branch passes and every AND-term of that branch
 * is allowed. Reviewed exceptions live in `scripts/license-exceptions.json`, keyed by package name.
 *
 * Runs with `node scripts/check-licenses.ts` (Node 24 strips the types natively).
 */
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// D20: MIT, Apache-2.0, BSD, ISC, MPL-2.0. "BSD" covers the BSD family; a bare "BSD" string is
// what some older packages declare.
const ALLOWED = new Set([
  "MIT",
  "Apache-2.0",
  "BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "ISC",
  "MPL-2.0",
])

type ListedDependency = {
  readonly version: string
  readonly dependencies?: Record<string, ListedDependency>
}

type ListedProject = {
  readonly name: string
  readonly dependencies?: Record<string, ListedDependency>
}

type PackageManifest = {
  readonly name?: string
  readonly version?: string
  readonly license?: string | { readonly type?: string }
  readonly licenses?: ReadonlyArray<string | { readonly type?: string }>
}

const isAllowedExpression = (expression: string): boolean => {
  const cleaned = expression.replace(/[()]/g, "").trim()
  return cleaned
    .split(/\s+OR\s+/i)
    .some((branch) => branch.split(/\s+AND\s+/i).every((term) => ALLOWED.has(term.trim())))
}

const licenseOf = (manifest: PackageManifest): string => {
  const single = manifest.license
  if (typeof single === "string" && single.trim() !== "") return single.trim()
  if (single !== undefined && typeof single === "object" && single.type) return single.type
  const many = manifest.licenses ?? []
  const types = many
    .map((entry) => (typeof entry === "string" ? entry : (entry.type ?? "")))
    .filter((entry) => entry !== "")
  return types.length > 0 ? `(${types.join(" OR ")})` : "UNKNOWN"
}

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")

// Index every installed package by name@version. Under the hoisted linker the primary copy is at
// node_modules/<name> and other versions nest under a dependant's node_modules.
const installed = new Map<string, string>()
const indexNodeModules = (dir: string): void => {
  let entries: ReadonlyArray<string>
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === ".bin" || entry === ".pnpm" || entry === ".modules.yaml") continue
    const full = join(dir, entry)
    if (entry.startsWith("@")) {
      for (const scoped of readdirSync(full)) indexPackage(join(full, scoped))
    } else {
      indexPackage(full)
    }
  }
}
const indexPackage = (dir: string): void => {
  let manifest: PackageManifest
  try {
    if (!statSync(dir).isDirectory()) return
    manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
  } catch {
    return
  }
  if (manifest.name && manifest.version) {
    installed.set(`${manifest.name}@${manifest.version}`, licenseOf(manifest))
  }
  indexNodeModules(join(dir, "node_modules"))
}
indexNodeModules(join(root, "node_modules"))
for (const group of ["apps", "packages"]) {
  for (const project of readdirSync(join(root, group))) {
    indexNodeModules(join(root, group, project, "node_modules"))
  }
}

const exceptions: Record<string, string> = JSON.parse(
  readFileSync(join(here, "license-exceptions.json"), "utf8"),
).exceptions

const result = spawnSync("pnpm", ["list", "--prod", "--depth", "Infinity", "--json"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
if (result.status !== 0) {
  console.error(result.stderr)
  process.exit(result.status ?? 1)
}

const projects: ReadonlyArray<ListedProject> = JSON.parse(result.stdout)
// This workspace's own projects are walked but not checked (matched by name, not by the
// `@studio/` prefix, whose npm scope belongs to someone else). Published packages, the platform
// repository's `@camena-ai/contracts` included, are checked like any other dependency.
const workspaceNames = new Set(projects.map((project) => project.name))
const isFirstParty = (name: string): boolean => workspaceNames.has(name)
const production = new Map<string, string>()
const collect = (deps: Record<string, ListedDependency> | undefined): void => {
  for (const [name, dep] of Object.entries(deps ?? {})) {
    if (isFirstParty(name)) {
      collect(dep.dependencies)
      continue
    }
    const key = `${name}@${dep.version}`
    if (production.has(key)) continue
    production.set(key, name)
    collect(dep.dependencies)
  }
}
for (const project of projects) collect(project.dependencies)

const failures: Array<string> = []
const accepted: Array<string> = []
for (const [key, name] of production) {
  const license = installed.get(key) ?? "NOT INSTALLED"
  if (isAllowedExpression(license)) continue
  const reason = exceptions[name]
  if (reason === undefined) {
    failures.push(`${key}: ${license}`)
  } else {
    accepted.push(`${key}: ${license} (exception: ${reason})`)
  }
}

for (const line of accepted) console.log(`accepted  ${line}`)
if (failures.length > 0) {
  console.error("Production dependencies outside the license allowlist:")
  for (const line of failures.sort()) console.error(`  ${line}`)
  process.exit(1)
}
console.log(`License allowlist passed (${production.size} production packages).`)
