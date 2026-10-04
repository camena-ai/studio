import { Button } from "@studio/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@studio/ui/components/ui/dropdown-menu"
import { Textarea } from "@studio/ui/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@studio/ui/components/ui/tooltip"
import { cn } from "@studio/ui/lib/utils"
import { ArrowUp, Check, Mic, Plus, ShieldCheck } from "lucide-react"
import { useRef, useState } from "react"
import type { ModelOption } from "./model.ts"
import { ModelChip } from "./model-chip.tsx"

export type PromptComposerProps = {
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly onSubmit: () => void
  readonly placeholder?: string
  readonly model: ModelOption
  readonly models: ReadonlyArray<ModelOption>
  readonly onModelChange: (id: string) => void
  readonly disabled?: boolean
  readonly className?: string
  /** Files picked with the attach button or dropped on the card; the button is inert without it. */
  readonly onAttach?: (files: ReadonlyArray<File>) => void
  /** The `accept` list for the file picker, e.g. ".pdf,.docx,.txt". */
  readonly accept?: string
  /** Attachment chips, shown above the text. */
  readonly attachments?: React.ReactNode
  /** Submit is blocked while attachments are still uploading or being checked. */
  readonly attachmentsBusy?: boolean
}

type IconActionProps = {
  readonly label: string
  readonly icon: React.ComponentType<{ className?: string }>
  readonly disabled?: boolean
  readonly onClick?: () => void
}

function IconAction({ label, icon: Icon, disabled, onClick }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={label}
          disabled={disabled ?? false}
          className="rounded-full"
          {...(onClick === undefined ? {} : { onClick })}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * The composer card from the reference screen: a growing textarea, attach and classification
 * actions on the left, the model picker, voice and send on the right. Presentational: the app
 * owns the draft, the selected model and what submit does.
 */
export function PromptComposer({
  value,
  onValueChange,
  onSubmit,
  placeholder = "Ask anything",
  model,
  models,
  onModelChange,
  disabled = false,
  className,
  onAttach,
  accept,
  attachments,
  attachmentsBusy = false,
}: PromptComposerProps) {
  const canSubmit = !disabled && !attachmentsBusy && value.trim().length > 0
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const attach = (list: FileList | null) => {
    if (onAttach && list && list.length > 0) onAttach([...list])
  }

  const submit = () => {
    if (canSubmit) onSubmit()
  }

  return (
    <TooltipProvider>
      <form
        data-slot="prompt-composer"
        className={cn(
          "flex w-full flex-col gap-2 rounded-3xl border bg-card p-3 shadow-sm",
          "focus-within:border-ring/60",
          dragging && "border-ring ring-2 ring-ring/30",
          className,
        )}
        onDragOver={(event) => {
          if (!onAttach || disabled || !event.dataTransfer.types.includes("Files")) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (!onAttach || disabled) return
          event.preventDefault()
          setDragging(false)
          attach(event.dataTransfer.files)
        }}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {attachments}
        {onAttach && (
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            {...(accept === undefined ? {} : { accept })}
            data-testid="attach-input"
            onChange={(event) => {
              attach(event.currentTarget.files)
              event.currentTarget.value = ""
            }}
          />
        )}
        <Textarea
          aria-label="Message"
          name="prompt"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="max-h-64 min-h-0 resize-none border-0 bg-transparent px-1 py-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent md:text-base"
          onChange={(event) => onValueChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
            event.preventDefault()
            submit()
          }}
        />
        <div className="flex items-center gap-2">
          <IconAction
            label="Attach"
            icon={Plus}
            disabled={disabled || !onAttach}
            onClick={() => fileInput.current?.click()}
          />
          <IconAction label="Classification" icon={ShieldCheck} disabled={disabled} />
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Model"
                  disabled={disabled}
                  className="rounded-full px-3"
                >
                  <ModelChip model={model} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {models.map((option) => (
                  <DropdownMenuItem key={option.id} onSelect={() => onModelChange(option.id)}>
                    <ModelChip model={option} className="font-normal" />
                    {option.id === model.id ? <Check className="ml-auto size-4" /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <IconAction label="Voice" icon={Mic} disabled={disabled} />
            <Button
              type="submit"
              size="icon"
              aria-label="Send"
              disabled={!canSubmit}
              className="rounded-full"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </form>
    </TooltipProvider>
  )
}
