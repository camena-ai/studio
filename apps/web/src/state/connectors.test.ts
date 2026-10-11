import { describe, expect, it } from "vitest"
import type { AdminConnector } from "../api/connectors.ts"
import { draftOf, EMPTY_FORM, formOf, linesOf, nameFrom, pairsOf } from "./connectors.ts"

describe("the connector form", () => {
  it("reads lines and KEY=value pairs, skipping blanks and lines without a key", () => {
    expect(linesOf(" a \n\n b\n")).toEqual(["a", "b"])
    expect(pairsOf("MODE=ro\n=x\nnope\nURL = https://a=b")).toEqual({
      MODE: "ro",
      URL: "https://a=b",
    })
  })

  it("keeps a name to what the server takes", () => {
    expect(nameFrom("Sales DB 2024")).toBe("sales_db_2024")
    expect(nameFrom("1st-crm")).toBe("st_crm")
    expect(nameFrom("a".repeat(40))).toHaveLength(24)
  })

  it("builds a remote personal connector without any secret", () => {
    const draft = draftOf(
      {
        ...EMPTY_FORM,
        name: "crm",
        description: " The CRM. ",
        url: " https://crm.example/mcp ",
        fixed: "X-Team=sales",
        secrets: { Authorization: "typed but personal" },
      },
      false,
    )
    expect(draft).toEqual({
      name: "crm",
      description: "The CRM.",
      auth: "personal",
      fields: [{ key: "Authorization", label: "API token", in: "header", prefix: "Bearer " }],
      spec: { transport: "http", url: "https://crm.example/mcp", headers: { "X-Team": "sales" } },
    })
  })

  it("builds a local shared connector with its values as env fields", () => {
    const draft = draftOf(
      {
        ...EMPTY_FORM,
        name: "sales",
        transport: "stdio",
        command: "npx",
        args: "-y\nsome-mcp-server\n",
        auth: "shared",
        fields: [{ key: "DATABASE_URL", label: "Database URL", in: "header" }],
        secrets: { DATABASE_URL: "postgres://reader@db/sales", OTHER: "dropped" },
      },
      false,
    )
    expect(draft.spec).toEqual({
      transport: "stdio",
      command: "npx",
      args: ["-y", "some-mcp-server"],
    })
    expect(draft.fields).toEqual([{ key: "DATABASE_URL", label: "Database URL", in: "env" }])
    expect(draft.secrets).toEqual({ DATABASE_URL: "postgres://reader@db/sales" })
  })

  it("sends on edit only the shared values typed, so an empty box keeps the stored one", () => {
    const draft = draftOf(
      { ...EMPTY_FORM, auth: "shared", secrets: { Authorization: "", Other: "new" } },
      true,
    )
    expect(draft.secrets).toEqual({ Other: "new" })
  })

  it("fills the edit form from a stored connector, never with a secret", () => {
    const stored: AdminConnector = {
      id: "c1",
      name: "sales",
      description: "Sales.",
      auth: "shared",
      fields: [{ key: "DATABASE_URL", label: "Database URL", in: "env" }],
      spec: { transport: "stdio", command: "bun", args: ["sql.ts"], env: { MODE: "ro" } },
      sharedSet: ["DATABASE_URL"],
      createdAt: "2026-10-11T00:00:00Z",
      updatedAt: "2026-10-11T00:00:00Z",
    }
    expect(formOf(stored)).toMatchObject({
      transport: "stdio",
      command: "bun",
      args: "sql.ts",
      fixed: "MODE=ro",
      secrets: {},
    })
  })
})
