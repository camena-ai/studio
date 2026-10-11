/**
 * Skills on Effect Atom: the org's list, whether the reader is an owner (`GET /v1/me`), the open
 * skill's detail and its draft `SKILL.md`, and the actions, each refreshing the list after.
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
  setSkillEnabled,
  updateSkillMd,
} from "../api/skills.ts"
import { StudioApiClient } from "../api/studio-api.ts"

const apiError = (error: unknown) =>
  error instanceof SkillApiError ? error : new SkillApiError(0, undefined)
const attempt = <A>(run: () => Promise<A>) => Effect.tryPromise({ try: run, catch: apiError })

export const skillsAtom = Atom.make(attempt(listSkills)).pipe(Atom.keepAlive)

/** The reader's seat: owners manage skills. */
export const meAtom = StudioApiClient.query("me", "me", {})

/** Which skill's files and `SKILL.md` are open, if any. */
export const openSkillAtom: Atom.Writable<string | null> = Atom.make<string | null>(null).pipe(
  Atom.keepAlive,
)

export const skillDetailAtom = Atom.family((name: string) =>
  Atom.make(attempt(() => getSkill(name))),
)

/** The `SKILL.md` being edited, by skill; null until the owner changes it. */
export const skillMdDraftAtom = Atom.family((_: string) =>
  Atom.make<string | null>(null).pipe(Atom.keepAlive),
)

/** The GitHub link being typed. */
export const githubUrlAtom: Atom.Writable<string> = Atom.make("").pipe(Atom.keepAlive)

/** An install that found the name taken, kept so the owner can replace it with one click. */
export const pendingReplaceAtom: Atom.Writable<InstallSource | null> =
  Atom.make<InstallSource | null>(null).pipe(Atom.keepAlive)

export const installSkillAtom = Atom.fn(
  Effect.fnUntraced(function* (
    input: { readonly source: InstallSource; readonly replace?: boolean },
    get,
  ) {
    const installed = yield* attempt(() => installSkill(input.source, input.replace ?? false)).pipe(
      Effect.tapError((error) =>
        Effect.sync(() => {
          if (error.code === "skill_exists") get.set(pendingReplaceAtom, input.source)
        }),
      ),
    )
    get.set(pendingReplaceAtom, null)
    get.set(githubUrlAtom, "")
    get.refresh(skillsAtom)
    return installed
  }),
)

export const saveSkillMdAtom = Atom.fn(
  Effect.fnUntraced(function* (input: { readonly name: string; readonly content: string }, get) {
    yield* attempt(() => updateSkillMd(input.name, input.content))
    get.set(skillMdDraftAtom(input.name), null)
    get.refresh(skillDetailAtom(input.name))
    get.refresh(skillsAtom)
  }),
)

export const setSkillEnabledAtom = Atom.fn(
  Effect.fnUntraced(function* (input: { readonly name: string; readonly enabled: boolean }, get) {
    yield* attempt(() => setSkillEnabled(input.name, input.enabled))
    get.refresh(skillsAtom)
  }),
)

export const removeSkillAtom = Atom.fn(
  Effect.fnUntraced(function* (name: string, get) {
    yield* attempt(() => removeSkill(name))
    if (get(openSkillAtom) === name) get.set(openSkillAtom, null)
    get.refresh(skillsAtom)
  }),
)

/** Downloads the skill as `<name>.zip`. */
export const downloadSkillAtom = Atom.fn(
  Effect.fnUntraced(function* (name: string) {
    const blob = yield* attempt(() => downloadSkill(name))
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${name}.zip`
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
