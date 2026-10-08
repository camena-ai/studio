import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AgentSteps } from "./agent-steps.tsx"

const chart = { id: "a1", name: "figure-1.png", mime: "image/png", sizeBytes: 2048 }
const table = { id: "a2", name: "summary.csv", mime: "text/csv", sizeBytes: 120 }

describe("AgentSteps", () => {
  it("summarises the steps, renders charts inline and offers files for download", async () => {
    const onDownload = vi.fn()
    render(
      <AgentSteps
        calls={[
          {
            callId: "c1",
            tool: "run_python",
            input: "print(6*7)",
            result: { ok: true, output: "42\n" },
            artifacts: [chart, table],
          },
        ]}
        renderImage={(artifact) => <img alt={artifact.name} />}
        onDownload={onDownload}
      />,
    )
    expect(screen.getByText("Worked through 1 step")).toBeTruthy()
    expect(screen.getByAltText("figure-1.png")).toBeTruthy()
    expect(screen.getByText("print(6*7)")).toBeTruthy()
    await userEvent.click(screen.getByText("summary.csv"))
    expect(onDownload).toHaveBeenCalledWith(table)
  })

  it("shows progress while the turn runs, and nothing without calls", () => {
    const { container, rerender } = render(
      <AgentSteps
        running
        calls={[
          {
            callId: "c1",
            tool: "run_python",
            input: "a",
            result: { ok: true, output: "" },
            artifacts: [],
          },
          { callId: "c2", tool: "sales__query", input: "{}", artifacts: [] },
        ]}
        renderImage={() => null}
        onDownload={() => {}}
      />,
    )
    expect(screen.getByText("Working… 1 of 2 steps done")).toBeTruthy()
    expect(screen.getByText("2. sales · query")).toBeTruthy()
    rerender(<AgentSteps calls={[]} renderImage={() => null} onDownload={() => {}} />)
    expect(container.querySelector('[data-slot="agent-steps"]')).toBeNull()
  })
})
