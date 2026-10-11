import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Button } from "@studio/ui/components/ui/button"
import { Input } from "@studio/ui/components/ui/input"
import { Textarea } from "@studio/ui/components/ui/textarea"
import { cn } from "@studio/ui/lib/utils"
import { Cause } from "effect"
import { AsyncResult } from "effect/unstable/reactivity"
import { BookOpen, Download, FileUp, Link2, Trash2 } from "lucide-react"
import { type ReactNode, useId } from "react"
import { base64Of, describeSkillError, SkillApiError, type SkillSummary } from "../api/skills.ts"
import {
  downloadSkillAtom,
  formatSize,
  githubUrlAtom,
  installSkillAtom,
  meAtom,
  openSkillAtom,
  pendingReplaceAtom,
  removeSkillAtom,
  saveSkillMdAtom,
  setSkillEnabledAtom,
  skillDetailAtom,
  skillMdDraftAtom,
  skillsAtom,
} from "../state/skills.ts"
import { TopBar } from "./top-bar.tsx"

const failureText = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause)
  return describeSkillError(error instanceof SkillApiError ? error.code : undefined)
}

function Pill({
  children,
  tone = "muted",
}: {
  readonly children: ReactNode
  readonly tone?: "muted" | "ok"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "ok"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}

function ErrorLine({ children }: { readonly children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  )
}

const SOURCE_LABEL: Record<SkillSummary["source"], string> = {
  builtin: "Built-in",
  upload: "Uploaded",
  github: "From GitHub",
}

/** Owners: add a skill from a file or a GitHub link. */
export function AddSkill() {
  const [installed, install] = useAtom(installSkillAtom)
  const [url, setUrl] = useAtom(githubUrlAtom)
  const pending = useAtomValue(pendingReplaceAtom)
  const fileId = useId()
  const urlId = useId()
  const busy = AsyncResult.isWaiting(installed)
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4">
      <h2 className="font-semibold">Add a skill</h2>
      <p className="text-sm text-muted-foreground">
        A skill is a folder with a SKILL.md, the format Claude, Codex, Gemini CLI and Cursor use.
        Upload it as a .zip or .skill file, or paste a link to it on GitHub.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor={fileId} className="font-medium">
            From a file
          </label>
          <Button asChild variant="outline" size="sm" disabled={busy}>
            <label htmlFor={fileId} className="cursor-pointer">
              <FileUp /> Choose a .zip or .skill
            </label>
          </Button>
          <input
            id={fileId}
            type="file"
            accept=".zip,.skill,application/zip"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file !== undefined) install({ source: { archive: await base64Of(file) } })
            }}
          />
        </div>
        <form
          className="flex flex-1 flex-col gap-1 text-sm"
          onSubmit={(event) => {
            event.preventDefault()
            if (url.trim() !== "") install({ source: { url: url.trim() } })
          }}
        >
          <label htmlFor={urlId} className="font-medium">
            From GitHub
          </label>
          <div className="flex gap-2">
            <Input
              id={urlId}
              value={url}
              placeholder="https://github.com/owner/repo/tree/main/skills/my-skill"
              onChange={(event) => setUrl(event.target.value)}
            />
            <Button type="submit" size="sm" disabled={busy || url.trim() === ""}>
              <Link2 /> Install
            </Button>
          </div>
        </form>
      </div>
      {busy && <p className="text-sm text-muted-foreground">Installing…</p>}
      {AsyncResult.isSuccess(installed) && !busy && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          Installed {installed.value.name}.
        </p>
      )}
      {AsyncResult.isFailure(installed) && !busy && (
        <div className="flex flex-wrap items-center gap-2">
          <ErrorLine>{failureText(installed.cause)}</ErrorLine>
          {pending !== null && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => install({ source: pending, replace: true })}
            >
              Replace it
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

/** An owner's view of one skill's files, with its SKILL.md to edit. */
function SkillDetailPanel({ skill }: { readonly skill: SkillSummary }) {
  const detail = useAtomValue(skillDetailAtom(skill.name))
  const [draft, setDraft] = useAtom(skillMdDraftAtom(skill.name))
  const [saved, save] = useAtom(saveSkillMdAtom)
  const editorId = useId()
  if (AsyncResult.isFailure(detail)) return <ErrorLine>{failureText(detail.cause)}</ErrorLine>
  if (!AsyncResult.isSuccess(detail)) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  const text = draft ?? detail.value.skillMd
  const builtin = skill.source === "builtin"
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Files</span>
        <ul className="flex flex-col gap-0.5 font-mono text-xs">
          {detail.value.files.map((file) => (
            <li key={file.path} className="flex justify-between gap-4">
              <span className="truncate">{file.path}</span>
              <span className="text-muted-foreground">{formatSize(file.sizeBytes)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={editorId} className="font-medium">
          SKILL.md
        </label>
        <Textarea
          id={editorId}
          value={text}
          rows={14}
          readOnly={builtin}
          className="font-mono text-xs"
          onChange={(event) => setDraft(event.target.value)}
        />
        {builtin && (
          <span className="text-xs text-muted-foreground">
            Built-in skills can be turned off, not edited.
          </span>
        )}
      </div>
      {AsyncResult.isFailure(saved) && <ErrorLine>{failureText(saved.cause)}</ErrorLine>}
      {!builtin && (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={draft === null || AsyncResult.isWaiting(saved)}
            onClick={() => save({ name: skill.name, content: text })}
          >
            Save SKILL.md
          </Button>
          {draft !== null && (
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Discard changes
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function SkillCard({ skill, owner }: { readonly skill: SkillSummary; readonly owner: boolean }) {
  const [open, setOpen] = useAtom(openSkillAtom)
  const [toggled, toggle] = useAtom(setSkillEnabledAtom)
  const [removed, remove] = useAtom(removeSkillAtom)
  const download = useAtomSet(downloadSkillAtom)
  const isOpen = open === skill.name
  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{skill.name}</span>
            <Pill>{SOURCE_LABEL[skill.source]}</Pill>
            {skill.enabled ? <Pill tone="ok">On</Pill> : <Pill>Off</Pill>}
            {skill.license !== undefined && <Pill>{skill.license}</Pill>}
          </div>
          <p className="text-sm text-muted-foreground">{skill.description}</p>
          <p className="text-xs text-muted-foreground">
            {skill.fileCount} {skill.fileCount === 1 ? "file" : "files"},{" "}
            {formatSize(skill.sizeBytes)}
            {skill.sourceUrl !== null && (
              <>
                {" · "}
                <a href={skill.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                  source
                </a>
              </>
            )}
          </p>
        </div>
        {owner && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={AsyncResult.isWaiting(toggled)}
              onClick={() => toggle({ name: skill.name, enabled: !skill.enabled })}
            >
              {skill.enabled ? "Turn off" : "Turn on"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(isOpen ? null : skill.name)}>
              {isOpen ? "Close" : skill.source === "builtin" ? "View" : "View and edit"}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Download ${skill.name}`}
              onClick={() => download(skill.name)}
            >
              <Download />
            </Button>
            {skill.source !== "builtin" && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${skill.name}`}
                onClick={() => {
                  if (window.confirm(`Remove ${skill.name}? The assistant stops using it.`)) {
                    remove(skill.name)
                  }
                }}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )}
      </div>
      {AsyncResult.isFailure(toggled) && <ErrorLine>{failureText(toggled.cause)}</ErrorLine>}
      {AsyncResult.isFailure(removed) && <ErrorLine>{failureText(removed.cause)}</ErrorLine>}
      {owner && isOpen && <SkillDetailPanel skill={skill} />}
    </li>
  )
}

/** The org's skills; owners also add and manage them. */
export function SkillsList() {
  const result = useAtomValue(skillsAtom)
  const me = useAtomValue(meAtom)
  const owner = AsyncResult.isSuccess(me) && me.value.orgRole === "owner"
  if (AsyncResult.isFailure(result)) return <ErrorLine>{failureText(result.cause)}</ErrorLine>
  if (!AsyncResult.isSuccess(result))
    return <p className="text-sm text-muted-foreground">Loading…</p>
  return (
    <div className="flex flex-col gap-6">
      {owner && <AddSkill />}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your organization's skills</h2>
        <ul className="flex flex-col gap-3">
          {result.value.map((skill) => (
            <SkillCard key={skill.name} skill={skill} owner={owner} />
          ))}
        </ul>
      </section>
    </div>
  )
}

/** `/skills`: what the assistant knows how to do your way. */
export function SkillsPage() {
  const result = useAtomValue(skillsAtom)
  const off =
    AsyncResult.isFailure(result) &&
    (() => {
      const error = Cause.squash(result.cause)
      return error instanceof SkillApiError && error.code === "not_enabled"
    })()
  return (
    <>
      <TopBar title="Skills" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
          <header className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <BookOpen className="size-6" aria-hidden="true" />
              Skills
            </h1>
            <p className="text-sm text-muted-foreground">
              Instructions and helper scripts that show the assistant how your team does a kind of
              task. It loads one when your question calls for it.
            </p>
          </header>
          {off ? (
            <p className="text-sm text-muted-foreground">{describeSkillError("not_enabled")}</p>
          ) : (
            <SkillsList />
          )}
        </div>
      </div>
    </>
  )
}
