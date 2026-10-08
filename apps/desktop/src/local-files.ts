/**
 * The agent's local tools over the folders the user granted (main process only). Every path the
 * model names is resolved against a granted folder and checked after resolving symbolic links, so
 * nothing outside the grants is listed, searched or read. Paths are shown to the model as
 * `<folder>/<relative path>`, the folder named by its last segment.
 *
 * A text file under `MAX_TEXT_BYTES` comes back as text; a spreadsheet, a Word document, a PDF or
 * a CSV file is handed back as bytes for the app to upload, so the gateway checks and frames it
 * like any attachment. Hidden entries and dependency folders are skipped.
 */
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises"
import path from "node:path"

export const MAX_LIST_ENTRIES = 500
export const MAX_SEARCH_HITS = 100
export const MAX_SEARCH_FILES = 20_000
export const MAX_SEARCH_DEPTH = 8
export const MAX_TEXT_BYTES = 2 * 1024 * 1024
export const MAX_CONTENT_SEARCH_BYTES = 1024 * 1024
export const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".html",
  ".log",
  ".ini",
  ".toml",
  ".sql",
  ".py",
  ".ts",
  ".js",
  ".tsx",
  ".jsx",
  ".java",
  ".go",
  ".rs",
  ".rb",
  ".sh",
])
const DOCUMENT_TYPES: Record<string, string> = {
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
}
const SKIPPED = new Set(["node_modules", "__pycache__", ".git"])

export interface Root {
  readonly label: string
  readonly real: string
}

/** The granted folders that exist, each labelled by its last segment (made unique). */
export const rootsOf = async (folders: ReadonlyArray<string>): Promise<ReadonlyArray<Root>> => {
  const roots: Array<Root> = []
  for (const folder of folders) {
    try {
      const real = await realpath(folder)
      if (!(await stat(real)).isDirectory()) continue
      let label = path.basename(real) || real
      for (let n = 2; roots.some((root) => root.label === label); n++) {
        label = `${path.basename(real)}-${n}`
      }
      roots.push({ label, real })
    } catch {
      // A folder that is gone is skipped.
    }
  }
  return roots
}

const shown = (root: Root, real: string) =>
  real === root.real
    ? root.label
    : `${root.label}/${path.relative(root.real, real).split(path.sep).join("/")}`

/** The real path `requested` names inside a granted folder, or why it names none. */
export const resolveInside = async (
  roots: ReadonlyArray<Root>,
  requested: string,
): Promise<{ readonly root: Root; readonly real: string } | { readonly error: string }> => {
  const parts = requested
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part !== "" && part !== ".")
  if (parts.includes("..")) return { error: "paths may not contain .." }
  const [first, ...rest] = parts
  const root = roots.find((candidate) => candidate.label === first)
  if (root === undefined) {
    return { error: `no granted folder named ${first ?? "(empty)"}; call local_list_files first` }
  }
  try {
    const real = await realpath(path.join(root.real, ...rest))
    if (real !== root.real && !real.startsWith(root.real + path.sep)) {
      return { error: "that path leads outside the granted folder" }
    }
    return { root, real }
  } catch {
    return { error: `${requested} does not exist` }
  }
}

const sizeText = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const visible = (name: string) => !name.startsWith(".") && !SKIPPED.has(name)

export const listFiles = async (
  roots: ReadonlyArray<Root>,
  requested?: string,
): Promise<string> => {
  if (roots.length === 0)
    return "No folders are granted. Ask the user to grant one (Folders → Grant Folder…)."
  if (requested === undefined || requested.trim() === "") {
    return roots.map((root) => `${root.label}/`).join("\n")
  }
  const target = await resolveInside(roots, requested)
  if ("error" in target) return `Error: ${target.error}.`
  const entries = (await readdir(target.real, { withFileTypes: true })).filter((entry) =>
    visible(entry.name),
  )
  const lines: Array<string> = []
  for (const entry of entries.slice(0, MAX_LIST_ENTRIES)) {
    const full = path.join(target.real, entry.name)
    const info = await lstat(full).catch(() => null)
    if (info === null || info.isSymbolicLink()) continue
    lines.push(
      info.isDirectory()
        ? `${shown(target.root, full)}/`
        : `${shown(target.root, full)}  ${sizeText(info.size)}  ${info.mtime.toISOString().slice(0, 10)}`,
    )
  }
  if (entries.length > MAX_LIST_ENTRIES)
    lines.push(`[${entries.length - MAX_LIST_ENTRIES} more not listed]`)
  return lines.length === 0 ? "(empty folder)" : lines.join("\n")
}

export const searchFiles = async (roots: ReadonlyArray<Root>, query: string): Promise<string> => {
  const needle = query.trim().toLowerCase()
  if (needle === "") return "Error: an empty query."
  const hits: Array<string> = []
  let seen = 0
  const walk = async (root: Root, dir: string, depth: number): Promise<void> => {
    if (depth > MAX_SEARCH_DEPTH || hits.length >= MAX_SEARCH_HITS || seen >= MAX_SEARCH_FILES)
      return
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!visible(entry.name) || hits.length >= MAX_SEARCH_HITS || seen >= MAX_SEARCH_FILES)
        continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(root, full, depth + 1)
        continue
      }
      if (!entry.isFile()) continue
      seen += 1
      if (entry.name.toLowerCase().includes(needle)) {
        hits.push(`${shown(root, full)}  (name)`)
        continue
      }
      const extension = path.extname(entry.name).toLowerCase()
      if (!TEXT_EXTENSIONS.has(extension) && extension !== ".csv") continue
      const info = await stat(full).catch(() => null)
      if (info === null || info.size > MAX_CONTENT_SEARCH_BYTES) continue
      const text = await readFile(full, "utf8").catch(() => "")
      const at = text.toLowerCase().indexOf(needle)
      if (at >= 0) {
        const line = text.slice(
          text.lastIndexOf("\n", at) + 1,
          text.indexOf("\n", at) === -1 ? undefined : text.indexOf("\n", at),
        )
        hits.push(`${shown(root, full)}: ${line.trim().slice(0, 160)}`)
      }
    }
  }
  for (const root of roots) await walk(root, root.real, 0)
  if (hits.length === 0) return `No file name or text file contains "${query}".`
  return (
    hits.join("\n") +
    (hits.length >= MAX_SEARCH_HITS ? `\n[stopped at ${MAX_SEARCH_HITS} hits]` : "")
  )
}

export type ReadResult =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "document"
      readonly name: string
      readonly mime: string
      readonly bytes: Uint8Array
    }
  | { readonly kind: "error"; readonly message: string }

export const readLocal = async (
  roots: ReadonlyArray<Root>,
  requested: string,
): Promise<ReadResult> => {
  const target = await resolveInside(roots, requested)
  if ("error" in target) return { kind: "error", message: target.error }
  const info = await stat(target.real)
  if (info.isDirectory())
    return { kind: "error", message: "that is a folder; use local_list_files" }
  const extension = path.extname(target.real).toLowerCase()
  const mime = DOCUMENT_TYPES[extension]
  if (mime !== undefined) {
    if (info.size > MAX_DOCUMENT_BYTES) {
      return {
        kind: "error",
        message: `the file is ${sizeText(info.size)}, over the ${sizeText(MAX_DOCUMENT_BYTES)} upload limit`,
      }
    }
    return {
      kind: "document",
      name: shown(target.root, target.real),
      mime,
      bytes: new Uint8Array(await readFile(target.real)),
    }
  }
  if (!TEXT_EXTENSIONS.has(extension)) {
    return {
      kind: "error",
      message: `${extension || "this kind of"} file cannot be opened (text, CSV, Excel, Word and PDF can)`,
    }
  }
  if (info.size > MAX_TEXT_BYTES) {
    return {
      kind: "error",
      message: `the file is ${sizeText(info.size)}, over the ${sizeText(MAX_TEXT_BYTES)} text limit`,
    }
  }
  return { kind: "text", text: await readFile(target.real, "utf8") }
}
