/**
 * Skills: tested instructions and helper scripts the assistant loads for a kind of task, in the
 * open Agent Skills format (agentskills.io), so a skill made for another assistant installs here.
 * Everyone lists them under `/v1/skills`; owners install, edit, turn on or off, download and remove
 * the org's under `/v1/admin/skills`, and where the org allows it any member does the same with
 * skills of their own under `/v1/skills/mine`, which only they see and use. Where the org allows it,
 * a skill installed from GitHub can be downloaded again, and owners save a GitHub token the org's
 * installs use for private repositories.
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
  /** The org's, or the reader's own. Absent from older gateways, which have only the org's. */
  scope: Schema.optionalKey(Schema.Literals(["org", "personal"])),
})
export type SkillSummary = typeof SkillSummary.Type

export const SkillDetail = Schema.Struct({
  ...SkillSummary.fields,
  files: Schema.Array(Schema.Struct({ path: Schema.String, sizeBytes: Schema.Number })),
  skillMd: Schema.String,
})
export type SkillDetail = typeof SkillDetail.Type

const SkillList = Schema.Struct({
  skills: Schema.Array(SkillSummary),
  /** Whether the reader may keep skills of their own. */
  personalSkills: Schema.optionalKey(Schema.Boolean),
  /** Whether a skill from GitHub can be downloaded again, and owners may save a token. */
  githubSkills: Schema.optionalKey(Schema.Boolean),
})

export const GitHubTokenStatus = Schema.Struct({
  set: Schema.Boolean,
  updatedAt: Schema.NullOr(Schema.String),
})
export type GitHubTokenStatus = typeof GitHubTokenStatus.Type

/** Whose skills a call acts on: the org's (owners) or the reader's own. */
export type SkillScope = "org" | "personal"

export const scopeOf = (skill: SkillSummary): SkillScope => skill.scope ?? "org"

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

const base = (scope: SkillScope) => (scope === "org" ? "/v1/admin/skills" : "/v1/skills/mine")
const path = (scope: SkillScope, name: string) => `${base(scope)}/${encodeURIComponent(name)}`

export const listSkills = async () => {
  const list = Schema.decodeUnknownSync(SkillList)(await json(await request("/v1/skills")))
  return {
    skills: list.skills,
    personalSkills: list.personalSkills ?? false,
    githubSkills: list.githubSkills ?? false,
  }
}

/** Exactly one of `archive` (base64) and `url`. */
export type InstallSource = { readonly archive: string } | { readonly url: string }

export const installSkill = async (scope: SkillScope, source: InstallSource, replace = false) =>
  Schema.decodeUnknownSync(SkillSummary)(
    await json(await request(base(scope), { body: { ...source, replace } })),
  )

export const getSkill = async (scope: SkillScope, name: string) =>
  Schema.decodeUnknownSync(SkillDetail)(await json(await request(path(scope, name))))

export const updateSkillMd = async (scope: SkillScope, name: string, content: string) =>
  Schema.decodeUnknownSync(SkillSummary)(
    await json(
      await request(`${path(scope, name)}/skill-md`, { method: "PUT", body: { content } }),
    ),
  )

/**
 * Turns a skill on or off, or sets the roles it is for (null for every role). Roles apply to the
 * org's skills only.
 */
export const updateSkill = (
  scope: SkillScope,
  name: string,
  change: { readonly enabled?: boolean; readonly roleIds?: ReadonlyArray<string> | null },
) => request(path(scope, name), { method: "PATCH", body: change }).then(() => undefined)

export const removeSkill = (scope: SkillScope, name: string) =>
  request(path(scope, name), { method: "DELETE" }).then(() => undefined)

/** The skill as a zip: one folder named after it. */
export const downloadSkill = async (scope: SkillScope, name: string): Promise<Blob> =>
  new Blob([await (await request(`${path(scope, name)}/archive`)).arrayBuffer()], {
    type: "application/zip",
  })

/** Downloads a skill installed from GitHub again, from the link it came from. */
export const refreshSkill = async (scope: SkillScope, name: string) =>
  Schema.decodeUnknownSync(SkillSummary)(
    await json(await request(`${path(scope, name)}/refresh`, { method: "POST" })),
  )

const TOKEN_PATH = "/v1/admin/skill-settings/github-token"

/** Whether the org has a GitHub token for private skills; the token itself is never read back. */
export const getGitHubToken = async () =>
  Schema.decodeUnknownSync(GitHubTokenStatus)(await json(await request(TOKEN_PATH)))

export const saveGitHubToken = (token: string) =>
  request(TOKEN_PATH, { method: "PUT", body: { token } }).then(() => undefined)

export const clearGitHubToken = () =>
  request(TOKEN_PATH, { method: "DELETE" }).then(() => undefined)

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
      return "Could not download from GitHub. Check the link, and that the repository is public or an owner saved a token that can read it."
    case "reserved_name":
      return "That name belongs to a built-in skill. Pick another name."
    case "name_changed":
      return "The name in SKILL.md can't change. Install it as a new skill instead."
    case "unknown_roles":
      return "One of the chosen roles no longer exists. Reload and choose again."
    case "role_access_not_enabled":
      return "Limiting skills to roles is not turned on for your organization."
    case "github_access_denied":
      return "GitHub refused the saved token for this repository. Check the token can read it."
    case "invalid_token":
      return "That doesn't look like a GitHub token. Paste the whole token."
    case "not_from_github":
      return "Only skills installed from GitHub can be updated this way."
    case "skill_not_found":
      return "This skill no longer exists."
    default:
      return "Something went wrong. Try again in a moment."
  }
}
