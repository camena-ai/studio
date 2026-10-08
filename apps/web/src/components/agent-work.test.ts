import { describe, expect, it } from "vitest"
import type { AgentStep } from "../api/agent.ts"
import { callsOf } from "./agent-work.tsx"

const step = (overrides: Partial<AgentStep> & Pick<AgentStep, "kind" | "callId">): AgentStep => ({
  id: `${overrides.kind}-${overrides.callId}`,
  seq: 1,
  tool: "run_python",
  artifacts: [],
  ...overrides,
})

describe("callsOf", () => {
  it("pairs each call with its result and keeps the result's artifacts", () => {
    const chart = { id: "a1", name: "figure-1.png", mime: "image/png", sizeBytes: 10 }
    const calls = callsOf([
      step({ kind: "tool_call", callId: "c1", code: "print(1)" }),
      step({ kind: "tool_result", callId: "c1", ok: true, output: "1\n", artifacts: [chart] }),
      step({ kind: "tool_call", callId: "c2", code: "1/0" }),
    ])
    expect(calls).toEqual([
      {
        callId: "c1",
        tool: "run_python",
        input: "print(1)",
        result: { ok: true, output: "1\n" },
        artifacts: [chart],
      },
      { callId: "c2", tool: "run_python", input: "1/0", artifacts: [] },
    ])
  })

  it("shows another tool's arguments, and a result whose call it never saw", () => {
    const calls = callsOf([
      step({
        kind: "tool_call",
        callId: "c1",
        tool: "sales__query",
        arguments: '{"sql":"select 1"}',
      }),
      step({ kind: "tool_result", callId: "orphan", ok: false, output: "boom" }),
    ])
    expect(calls.map((call) => [call.tool, call.input, call.result?.ok])).toEqual([
      ["sales__query", '{"sql":"select 1"}', undefined],
      ["run_python", "", false],
    ])
  })
})
