import { RegistryProvider } from "@effect/atom-react"
import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RolePicker } from "./role-picker.tsx"

afterEach(() => {
  vi.unstubAllGlobals()
})

const roles = [
  { id: "r-analysts", name: "Analysts", isDefault: false, members: 2 },
  { id: "r-sales", name: "Sales", isDefault: true, members: 5 },
]

function Harness({ onValue }: { readonly onValue: (value: ReadonlyArray<string> | null) => void }) {
  const [value, setValue] = useState<ReadonlyArray<string> | null>(null)
  return (
    <RolePicker
      value={value}
      onChange={(next) => {
        setValue(next)
        onValue(next)
      }}
    />
  )
}

describe("RolePicker", () => {
  it("chooses roles, and goes back to everyone when none is left or Everyone is pressed", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ roles }))
    const values: Array<ReadonlyArray<string> | null> = []
    render(
      <RegistryProvider>
        <Harness onValue={(value) => values.push(value)} />
      </RegistryProvider>,
    )
    fireEvent.click(await screen.findByLabelText("Analysts"))
    fireEvent.click(screen.getByLabelText("Sales"))
    expect(screen.getByText(/Only members on the chosen roles/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Analysts"))
    fireEvent.click(screen.getByLabelText("Sales"))
    fireEvent.click(screen.getByLabelText("Analysts"))
    fireEvent.click(screen.getByRole("button", { name: "Everyone" }))
    expect(values).toEqual([
      ["r-analysts"],
      ["r-analysts", "r-sales"],
      ["r-sales"],
      null,
      ["r-analysts"],
      null,
    ])
  })
})
