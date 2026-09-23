import { useAtom } from "@effect/atom-react"
import { type ModelOption, PromptComposer, StudioMark } from "@studio/ui"
import { models } from "../fixtures/models.ts"
import { composerDraftAtom, selectedModelIdAtom } from "../state/composer.ts"

/** The new-chat screen: mark, composer and the sign-in hint. */
export function EmptyState() {
  const [draft, setDraft] = useAtom(composerDraftAtom)
  const [modelId, setModelId] = useAtom(selectedModelIdAtom)
  const model = models.find((option) => option.id === modelId) ?? (models[0] as ModelOption)

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        <StudioMark className="size-20" />
        <div className="flex w-full flex-col gap-3">
          <PromptComposer
            value={draft}
            onValueChange={setDraft}
            onSubmit={() => setDraft("")}
            model={model}
            models={models}
            onModelChange={setModelId}
          />
          <p className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
            <span>Choose local or sign in</span>
            <span className="size-1 rounded-full bg-muted-foreground/60" aria-hidden="true" />
          </p>
        </div>
      </div>
    </main>
  )
}
