import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { ModelOption } from "./model.ts"
import { PromptComposer } from "./prompt-composer.tsx"

const models: ReadonlyArray<ModelOption> = [
  { id: "online-a", label: "Aurora 2", route: "online" },
  { id: "local-b", label: "Pocket 8B", route: "local" },
]

function renderComposer(value: string) {
  const onValueChange = vi.fn()
  const onSubmit = vi.fn()
  const onModelChange = vi.fn()
  render(
    <PromptComposer
      value={value}
      onValueChange={onValueChange}
      onSubmit={onSubmit}
      model={models[0] as ModelOption}
      models={models}
      onModelChange={onModelChange}
    />,
  )
  return { onValueChange, onSubmit, onModelChange }
}

describe("PromptComposer", () => {
  it("disables send while the draft is blank", () => {
    renderComposer("   ")
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send" }).disabled).toBe(true)
  })

  it("reports typing to the owner of the draft", async () => {
    const { onValueChange } = renderComposer("")
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "h")
    expect(onValueChange).toHaveBeenCalledWith("h")
  })

  it("submits on Enter and inserts a newline on Shift+Enter", async () => {
    const { onSubmit } = renderComposer("hello")
    const textbox = screen.getByRole("textbox", { name: "Message" })
    await userEvent.type(textbox, "{Shift>}{Enter}{/Shift}")
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.type(textbox, "{Enter}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("shows the selected model with its route", () => {
    renderComposer("")
    const trigger = screen.getByRole("button", { name: "Model" })
    expect(trigger.textContent).toContain("Aurora 2")
    expect(trigger.querySelector("[data-slot=model-chip]")?.getAttribute("data-route")).toBe(
      "online",
    )
  })
})
