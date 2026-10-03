import { useAtom, useAtomValue } from "@effect/atom-react"
import { type ModelOption, PromptComposer } from "@studio/ui"
import { AsyncResult } from "effect/unstable/reactivity"
import { composerDraftAtom, effectiveModel, selectedModelIdAtom } from "../state/composer.ts"
import { modelsAtom } from "../state/conversations.ts"

const NO_MODEL: ModelOption = { id: "", label: "No model available", route: "online" }

/**
 * The composer over `GET /v1/models`: the role's allowlisted models, each routed through the
 * gateway. Submitting passes the draft and the model id up and clears the draft.
 */
export function ChatComposer({
  onSend,
  busy = false,
}: {
  readonly onSend: (text: string, model: string) => void
  readonly busy?: boolean
}) {
  const [draft, setDraft] = useAtom(composerDraftAtom)
  const [selectedId, setSelectedId] = useAtom(selectedModelIdAtom)
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
        if (text === "" || model === undefined || busy) return
        setDraft("")
        onSend(text, model.id)
      }}
      model={current}
      models={options}
      onModelChange={setSelectedId}
      disabled={busy || model === undefined}
    />
  )
}
