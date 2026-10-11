/**
 * Skills: tested instructions and helper scripts the assistant loads for a kind of task, in the
 * open Agent Skills format (agentskills.io), so a skill made for another assistant installs here.
 * Everyone lists them under `/v1/skills`; owners install, edit, turn on or off, download and remove
 * them under `/v1/admin/skills`.
 *
 * TODO(contracts): the published `@camena-ai/contracts` this app pins (0.17) predates these
 * endpoints, so their schemas are mirrored here from the public contract and fetched directly.
 * Switch to `StudioApiClient` at the next contracts bump.
 */
import { Schema } from "effect"

export const SkillSummary = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  source: Schema.Literals(["upload", "github", "builtin"]),
  sourceUrl: Schema.NullOr(Schema.String),
  enabled: Schema.Boolean,
  sizeBytes: Schema.Number,
  fileCount: Schema.Number,
  license: Schema.optionalKey(Schema.String),
  compatibility: Schema.optionalKey(Schema.String),
  roleIds: Schema.optionalKey(Schema.NullOr(Schema.Array(Schema.String))),
  updatedAt: Schema.NullOr(Schema.String),
})
export type SkillSummary = typeof SkillSummary.Type

export const SkillDetail = Schema.Struct({
  ...SkillSummary.fields,
  files: Schema.Array(Schema.Struct({ path: Schema.String, sizeBytes: Schema.Number })),
  skillMd: Schema.String,
})
export type SkillDetail = typeof SkillDetail.Type

const SkillList = Schema.Struct({ skills: Schema.Array(SkillSummary) })

/** What a skills request was refused with: its status and the gateway's code, when one came. */
export class SkillApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  constructor(status: number, code: string | undefined) {
    super(`skills ${status}${code === undefined ? "" : ` ${code}`}`)
    this.status = status
    this.code = code
  }
}

const request = async (path: string, init: { method?: string; body?: unknown } = {}) => {
  const response = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { code?: unknown } | undefined
    throw new SkillApiError(response.status, typeof body?.code === "string" ? body.code : undefined)
  }
  return response
}

const json = async (response: Response) =>
  response.status === 204 ? undefined : ((await response.json()) as unknown)

const path = (name: string) => `/v1/admin/skills/${encodeURIComponent(name)}`

export const listSkills = async () =>
  Schema.decodeUnknownSync(SkillList)(await json(await request("/v1/skills"))).skills

/** Exactly one of `archive` (base64) and `url`. */
export type InstallSource = { readonly archive: string } | { readonly url: string }

export const installSkill = async (source: InstallSource, replace = false) =>
  Schema.decodeUnknownSync(SkillSummary)(
    await json(await request("/v1/admin/skills", { body: { ...source, replace } })),
  )

export const getSkill = async (name: string) =>
  Schema.decodeUnknownSync(SkillDetail)(await json(await request(path(name))))

export const updateSkillMd = async (name: string, content: string) =>
  Schema.decodeUnknownSync(SkillSummary)(
    await json(await request(`${path(name)}/skill-md`, { method: "PUT", body: { content } })),
  )

/** Turns a skill on or off, or sets the roles it is for (null for every role). */
export const updateSkill = (
  name: string,
  change: { readonly enabled?: boolean; readonly roleIds?: ReadonlyArray<string> | null },
) => request(path(name), { method: "PATCH", body: change }).then(() => undefined)

export const removeSkill = (name: string) =>
  request(path(name), { method: "DELETE" }).then(() => undefined)

/** The skill as a zip: one folder named after it. */
export const downloadSkill = async (name: string): Promise<Blob> =>
  new Blob([await (await request(`${path(name)}/archive`)).arrayBuffer()], {
    type: "application/zip",
  })

/** A file's bytes as base64, for an install's `archive`. */
export const base64Of = async (file: Blob): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ""
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  }
  return btoa(binary)
}

/** What a person reads for a refusal. */
export const describeSkillError = (code: string | undefined): string => {
  switch (code) {
    case "not_enabled":
      return "Skills are not turned on for your organization."
    case "skill_exists":
      return "A skill with this name is already installed."
    case "invalid_request":
      return "Choose a file or paste a GitHub link."
    case "invalid_archive":
      return "That file is not a zip we can read."
    case "missing_skill_md":
      return "No SKILL.md was found. A skill is a folder with a SKILL.md at its top."
    case "invalid_frontmatter":
      return "SKILL.md must start with a --- block holding name and description."
    case "invalid_name":
      return "The name must be lower-case letters, digits and single hyphens, at most 64 characters."
    case "invalid_description":
      return "The description is missing or longer than 1,024 characters."
    case "invalid_field":
      return "One of the optional fields (license, compatibility, metadata) is malformed."
    case "too_large":
      return "The skill is too large. Keep it under 5 MB."
    case "too_many_files":
      return "The skill has too many files. Keep it under 200."
    case "unsafe_path":
      return "The archive has a file path that points outside the skill's folder."
    case "multiple_skills":
      return "The archive holds more than one skill. Upload them one at a time."
    case "not_github":
      return "Paste a public github.com link to a repository or a folder in it."
    case "fetch_failed":
      return "Could not download from GitHub. Check that the repository is public and the link is right."
    case "reserved_name":
      return "That name belongs to a built-in skill. Pick another name."
    case "name_changed":
      return "The name in SKILL.md can't change. Install it as a new skill instead."
    case "unknown_roles":
      return "One of the chosen roles no longer exists. Reload and choose again."
    case "role_access_not_enabled":
      return "Limiting skills to roles is not turned on for your organization."
    case "skill_not_found":
      return "This skill no longer exists."
    default:
      return "Something went wrong. Try again in a moment."
  }
}
