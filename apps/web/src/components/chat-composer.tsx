import type { AttachmentId } from "@camena-ai/contracts"
import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { AttachmentChip, type ModelOption, PromptComposer } from "@studio/ui"
import { AsyncResult } from "effect/unstable/reactivity"
import { APP_NAME } from "../brand.ts"
import {
  ACCEPTED_FILES,
  type DraftAttachment,
  draftAttachmentsAtom,
  draftBusy,
  draftDetail,
  MAX_DRAFT_FILES,
  removeDraftAttachment,
  uploadAttachmentAtom,
} from "../state/attachments.ts"
import { composerDraftAtom, effectiveModel, selectedModelIdAtom } from "../state/composer.ts"
import { modelsAtom } from "../state/conversations.ts"
import type { ChatAttachment } from "../state/turn.ts"

const NO_MODEL: ModelOption = { id: "", label: "No model available", route: "online" }

export type SentAttachment = ChatAttachment & { readonly id: AttachmentId }

/** The checked, accepted drafts a message carries. */
const toSend = (drafts: ReadonlyArray<DraftAttachment>): ReadonlyArray<SentAttachment> =>
  drafts.flatMap((d) =>
    d.state === "ready" && d.id !== null ? [{ id: d.id, label: d.label, mime: null }] : [],
  )

/**
 * The composer over `GET /v1/models`: the role's allowlisted models, each routed through the
 * gateway, and the files picked for the message. Sending waits until every file is checked,
 * passes the draft, the model id and the accepted files up, and clears the draft and the files.
 */
export function ChatComposer({
  onSend,
  busy = false,
}: {
  readonly onSend: (text: string, model: string, attachments: ReadonlyArray<SentAttachment>) => void
  readonly busy?: boolean
}) {
  const [draft, setDraft] = useAtom(composerDraftAtom)
  const [selectedId, setSelectedId] = useAtom(selectedModelIdAtom)
  const [drafts, setDrafts] = useAtom(draftAttachmentsAtom)
  const upload = useAtomSet(uploadAttachmentAtom)
  const models = useAtomValue(modelsAtom)
  const list = AsyncResult.isSuccess(models) ? models.value.models : []
  const model = effectiveModel(list, selectedId)
  const options: ReadonlyArray<ModelOption> = list.map((m) => ({
    id: m.id,
    label: m.displayName,
    route: "online",
  }))
  const current = options.find((o) => o.id === model?.id) ?? NO_MODEL

  return (
    <PromptComposer
      value={draft}
      onValueChange={setDraft}
      onSubmit={() => {
        const text = draft.trim()
        if (text === "" || model === undefined || busy || draftBusy(drafts)) return
        setDraft("")
        setDrafts([])
        onSend(text, model.id, toSend(drafts))
      }}
      placeholder={`Ask ${APP_NAME} anything…`}
      model={current}
      models={options}
      onModelChange={setSelectedId}
      disabled={busy || model === undefined}
      accept={ACCEPTED_FILES}
      onAttach={(files) => {
        for (const file of files.slice(0, Math.max(0, MAX_DRAFT_FILES - drafts.length)))
          upload(file)
      }}
      attachmentsBusy={draftBusy(drafts)}
      attachments={
        drafts.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1" data-testid="draft-attachments">
            {drafts.map((d) => (
              <AttachmentChip
                key={d.key}
                name={d.name}
                state={d.state}
                label={d.label}
                {...(draftDetail(d) === undefined ? {} : { detail: draftDetail(d) as string })}
                onRemove={() => setDrafts(removeDraftAttachment(drafts, d.key))}
              />
            ))}
          </div>
        )
      }
    />
  )
}
