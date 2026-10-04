/**
 * Draft attachments on Effect Atom (D22, contracts 0.14): the files picked for the next message.
 * Each is uploaded through the contracts client (`POST /v1/attachments`, the raw bytes) and then
 * polled (`GET /v1/attachments/:id`) until extraction and classification finish; only then can
 * the message be sent, so a turn never waits on a file still being checked.
 *
 * The server stores no file names, so the names live here, in memory, for the session.
 */
import {
  type AttachmentId,
  type AttachmentRejectionCode,
  attachmentRejectionMessage,
  type MessageLabel,
} from "@camena-ai/contracts"
import { Duration, Effect, Schedule } from "effect"
import { Atom } from "effect/unstable/reactivity"
import { StudioApiClient } from "../api/studio-api.ts"

/** What the gateway can read (contracts 0.14): PDF, Word, plain text, Markdown, CSV. */
export const ACCEPTED_FILES = ".pdf,.docx,.txt,.md,.markdown,.csv,text/plain,text/markdown,text/csv"

/** At most this many files per message; the gateway's own limit is far higher. */
export const MAX_DRAFT_FILES = 10

export type DraftState = "uploading" | "checking" | "ready" | "failed"

export interface DraftAttachment {
  /** Local key until the upload answers with an id. */
  readonly key: string
  readonly name: string
  readonly id: AttachmentId | null
  readonly state: DraftState
  readonly label: MessageLabel | null
  readonly rejection: AttachmentRejectionCode | null
  /** A failure before the gateway had the file (network, too large, rate limit). */
  readonly error: string | null
}

export const draftAttachmentsAtom: Atom.Writable<ReadonlyArray<DraftAttachment>> = Atom.make<
  ReadonlyArray<DraftAttachment>
>([]).pipe(Atom.keepAlive)

/** File names by attachment id, for showing sent attachments; this session only. */
export const attachmentNamesAtom: Atom.Writable<ReadonlyMap<string, string>> = Atom.make<
  ReadonlyMap<string, string>
>(new Map()).pipe(Atom.keepAlive)

export const draftBusy = (drafts: ReadonlyArray<DraftAttachment>) =>
  drafts.some((d) => d.state === "uploading" || d.state === "checking")

/** The ids a message can carry: every checked file that was not rejected. */
export const sendableIds = (drafts: ReadonlyArray<DraftAttachment>): ReadonlyArray<AttachmentId> =>
  drafts.flatMap((d) => (d.state === "ready" && d.id !== null ? [d.id] : []))

export const draftDetail = (draft: DraftAttachment): string | undefined =>
  draft.rejection !== null
    ? attachmentRejectionMessage(draft.rejection)
    : (draft.error ?? undefined)

/** Why an upload was refused, from the contract's errors; codes only, never the file. */
const uploadError = (error: unknown): string => {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : null
  switch (code) {
    case "too_large":
      return attachmentRejectionMessage("too_large")
    case "upload_limit_exceeded":
      return "Too many uploads at once. Wait a moment and try again."
    case "empty":
      return attachmentRejectionMessage("empty")
    default:
      return "The file could not be uploaded. Try again."
  }
}

export const uploadAttachmentAtom = StudioApiClient.runtime.fn(
  Effect.fnUntraced(function* (file: File, get) {
    const client = yield* StudioApiClient
    // Read and write through the registry: reading through `get` would make this atom depend on
    // the drafts, and a second upload changing them would then interrupt this one.
    const registry = get.registry
    const key = crypto.randomUUID()
    const update = (patch: Partial<DraftAttachment>) =>
      registry.set(
        draftAttachmentsAtom,
        registry
          .get(draftAttachmentsAtom)
          .map((d: DraftAttachment) => (d.key === key ? { ...d, ...patch } : d)),
      )
    registry.set(draftAttachmentsAtom, [
      ...registry.get(draftAttachmentsAtom),
      {
        key,
        name: file.name,
        id: null,
        state: "uploading",
        label: null,
        rejection: null,
        error: null,
      },
    ])

    const bytes = new Uint8Array(yield* Effect.promise(() => file.arrayBuffer()))
    const created = yield* client.attachments
      .upload({
        payload: bytes,
        headers: file.type === "" ? {} : { "studio-declared-type": file.type },
      })
      .pipe(
        Effect.tapError((error) =>
          Effect.sync(() => update({ state: "failed", error: uploadError(error) })),
        ),
      )
    update({ id: created.id, state: "checking" })
    registry.set(
      attachmentNamesAtom,
      new Map(registry.get(attachmentNamesAtom)).set(created.id, file.name),
    )

    // Extraction and classification run in the worker; poll until they settle (about 2 min max).
    const settled = yield* client.attachments.get({ params: { id: created.id } }).pipe(
      Effect.repeat({
        schedule: Schedule.spaced(Duration.seconds(1)),
        until: (attachment) => attachment.status !== "pending",
        times: 120,
      }),
      Effect.tapError(() =>
        Effect.sync(() => update({ state: "failed", error: "The file could not be checked." })),
      ),
    )
    if (settled.status === "done") update({ state: "ready", label: settled.label })
    else if (settled.status === "failed") {
      update({ state: "failed", rejection: settled.rejection?.code ?? "extraction_failed" })
    } else update({ state: "failed", error: "The file is taking too long to check." })
  }),
  { concurrent: true },
)

export const removeDraftAttachment = (
  drafts: ReadonlyArray<DraftAttachment>,
  key: string,
): ReadonlyArray<DraftAttachment> => drafts.filter((d) => d.key !== key)

/** A sent file's name: from this session if it was uploaded here, else its detected type. */
export const attachmentName = (
  names: ReadonlyMap<string, string>,
  attachment: { readonly id: string; readonly mime: string | null },
): string => {
  const known = names.get(attachment.id)
  if (known !== undefined) return known
  const mime = attachment.mime ?? ""
  if (mime.startsWith("application/pdf")) return "PDF document"
  if (mime.includes("wordprocessingml")) return "Word document"
  if (mime.startsWith("text/markdown")) return "Markdown file"
  if (mime.startsWith("text/csv")) return "CSV file"
  if (mime.startsWith("text/")) return "Text file"
  return "File"
}
