/**
 * Skills on Effect Atom: the list (the org's and, where allowed, the reader's own), whether the
 * reader is an owner (`GET /v1/me`), the open skill's detail and its draft `SKILL.md`, and the
 * actions, each refreshing the list after. A skill is named by its scope and name (`skillKey`),
 * since a reader's own skill may share an org skill's name.
 */
import { Effect } from "effect"
import { Atom } from "effect/unstable/reactivity"
import {
  downloadSkill,
  getSkill,
  type InstallSource,
  installSkill,
  listSkills,
  removeSkill,
  SkillApiError,
  type SkillScope,
  updateSkill,
  updateSkillMd,
} from "../api/skills.ts"
import { StudioApiClient } from "../api/studio-api.ts"

const apiError = (error: unknown) =>
  error instanceof SkillApiError ? error : new SkillApiError(0, undefined)
const attempt = <A>(run: () => Promise<A>) => Effect.tryPromise({ try: run, catch: apiError })

export const skillsAtom = Atom.make(attempt(listSkills)).pipe(Atom.keepAlive)

/** The reader's seat: owners manage the org's skills. */
export const meAtom = StudioApiClient.query("me", "me", {})

/** One skill: its scope and name, as one string (names hold no `/`). */
export const skillKey = (scope: SkillScope, name: string) => `${scope}/${name}`
const parseKey = (key: string) => {
  const at = key.indexOf("/")
  return { scope: key.slice(0, at) as SkillScope, name: key.slice(at + 1) }
}

/** Which skill's files and `SKILL.md` are open (`skillKey`), if any. */
export const openSkillAtom: Atom.Writable<string | null> = Atom.make<string | null>(null).pipe(
  Atom.keepAlive,
)

export const skillDetailAtom = Atom.family((key: string) => {
  const { scope, name } = parseKey(key)
  return Atom.make(attempt(() => getSkill(scope, name)))
})

/** The `SKILL.md` being edited, by `skillKey`; null until the reader changes it. */
export const skillMdDraftAtom = Atom.family((_: string) =>
  Atom.make<string | null>(null).pipe(Atom.keepAlive),
)

/** The GitHub link being typed, per scope. */
export const githubUrlAtom = Atom.family((_: SkillScope) => Atom.make("").pipe(Atom.keepAlive))

/** An install that found the name taken, kept so it can be replaced with one click. */
export const pendingReplaceAtom = Atom.family((_: SkillScope) =>
  Atom.make<InstallSource | null>(null).pipe(Atom.keepAlive),
)

/** Installs into one scope; one per scope, so each form shows its own outcome. */
export const installSkillAtom = Atom.family((scope: SkillScope) =>
  Atom.fn(
    Effect.fnUntraced(function* (
      input: { readonly source: InstallSource; readonly replace?: boolean },
      get,
    ) {
      const installed = yield* attempt(() =>
        installSkill(scope, input.source, input.replace ?? false),
      ).pipe(
        Effect.tapError((error) =>
          Effect.sync(() => {
            if (error.code === "skill_exists") get.set(pendingReplaceAtom(scope), input.source)
          }),
        ),
      )
      get.set(pendingReplaceAtom(scope), null)
      get.set(githubUrlAtom(scope), "")
      get.refresh(skillsAtom)
      return installed
    }),
  ),
)

export const saveSkillMdAtom = Atom.fn(
  Effect.fnUntraced(function* (
    input: { readonly scope: SkillScope; readonly name: string; readonly content: string },
    get,
  ) {
    const key = skillKey(input.scope, input.name)
    yield* attempt(() => updateSkillMd(input.scope, input.name, input.content))
    get.set(skillMdDraftAtom(key), null)
    get.refresh(skillDetailAtom(key))
    get.refresh(skillsAtom)
  }),
)

export const setSkillEnabledAtom = Atom.fn(
  Effect.fnUntraced(function* (
    input: { readonly scope: SkillScope; readonly name: string; readonly enabled: boolean },
    get,
  ) {
    yield* attempt(() => updateSkill(input.scope, input.name, { enabled: input.enabled }))
    get.refresh(skillsAtom)
  }),
)

/** Sets the roles one of the org's skills is for, null for every role. */
export const setSkillRolesAtom = Atom.fn(
  Effect.fnUntraced(function* (
    input: { readonly name: string; readonly roleIds: ReadonlyArray<string> | null },
    get,
  ) {
    yield* attempt(() => updateSkill("org", input.name, { roleIds: input.roleIds }))
    get.refresh(skillsAtom)
  }),
)

export const removeSkillAtom = Atom.fn(
  Effect.fnUntraced(function* (input: { readonly scope: SkillScope; readonly name: string }, get) {
    yield* attempt(() => removeSkill(input.scope, input.name))
    if (get(openSkillAtom) === skillKey(input.scope, input.name)) get.set(openSkillAtom, null)
    get.refresh(skillsAtom)
  }),
)

/** Downloads the skill as `<name>.zip`. */
export const downloadSkillAtom = Atom.fn(
  Effect.fnUntraced(function* (input: { readonly scope: SkillScope; readonly name: string }) {
    const blob = yield* attempt(() => downloadSkill(input.scope, input.name))
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${input.name}.zip`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }),
)

export const formatSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 ** 2
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 ** 2).toFixed(1)} MB`
