/**
 * Connectors: the MCP servers the assistant can use. Owners manage the organization's connectors
 * under `/v1/admin/connectors`; every member sees the ones they can use under `/v1/connectors` and
 * connects their own account where a connector asks each person for their own credential.
 *
 * TODO(contracts): the published `@camena-ai/contracts` this app pins (0.17) predates these
 * endpoints, so their schemas are mirrored here from the public contract and fetched directly.
 * Switch to `StudioApiClient` at the next contracts bump.
 */
import { Schema } from "effect"

export const ConnectorField = Schema.Struct({
  key: Schema.String,
  label: Schema.String,
  in: Schema.Literals(["env", "header"]),
  prefix: Schema.optionalKey(Schema.String),
})
export type ConnectorField = typeof ConnectorField.Type

export const ConnectorSpec = Schema.Union([
  Schema.Struct({
    transport: Schema.Literal("stdio"),
    command: Schema.String,
    args: Schema.optionalKey(Schema.Array(Schema.String)),
    env: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  }),
  Schema.Struct({
    transport: Schema.Literal("http"),
    url: Schema.String,
    headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  }),
])
export type ConnectorSpec = typeof ConnectorSpec.Type

export const ConnectorAuth = Schema.Literals(["shared", "personal"])
export type ConnectorAuth = typeof ConnectorAuth.Type

export const MemberConnector = Schema.Struct({
  id: Schema.optionalKey(Schema.String),
  name: Schema.String,
  description: Schema.String,
  transport: Schema.Literals(["stdio", "http"]),
  auth: ConnectorAuth,
  fields: Schema.Array(ConnectorField),
  connected: Schema.Boolean,
  source: Schema.Literals(["org", "operator"]),
})
export type MemberConnector = typeof MemberConnector.Type

export const AdminConnector = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  auth: ConnectorAuth,
  fields: Schema.Array(ConnectorField),
  spec: ConnectorSpec,
  sharedSet: Schema.Array(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type AdminConnector = typeof AdminConnector.Type

export const OperatorConnector = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  transport: Schema.Literals(["stdio", "http"]),
})
export type OperatorConnector = typeof OperatorConnector.Type

export const ConnectorTestResult = Schema.Struct({
  ok: Schema.Boolean,
  tools: Schema.Array(Schema.Struct({ name: Schema.String, description: Schema.String })),
  error: Schema.optionalKey(Schema.String),
})
export type ConnectorTestResult = typeof ConnectorTestResult.Type

const MemberList = Schema.Struct({ connectors: Schema.Array(MemberConnector) })
const AdminList = Schema.Struct({
  connectors: Schema.Array(AdminConnector),
  operator: Schema.Array(OperatorConnector),
})
export type AdminList = typeof AdminList.Type

/** What a connector request was refused with: its status and the gateway's code, when one came. */
export class ConnectorApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  constructor(status: number, code: string | undefined) {
    super(`connectors ${status}${code === undefined ? "" : ` ${code}`}`)
    this.status = status
    this.code = code
  }
}

/** A connector that is a draft in a form: what create and update send. */
export interface ConnectorDraft {
  readonly name: string
  readonly description: string
  readonly auth: ConnectorAuth
  readonly fields: ReadonlyArray<ConnectorField>
  readonly spec: ConnectorSpec
  /** A shared connector's values; an empty one clears a stored value on update. */
  readonly secrets?: Readonly<Record<string, string>>
}

const request = async (path: string, init: { method?: string; body?: unknown } = {}) => {
  const response = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      ...(init.body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { code?: unknown } | undefined
    throw new ConnectorApiError(
      response.status,
      typeof body?.code === "string" ? body.code : undefined,
    )
  }
  return response.status === 204 ? undefined : ((await response.json()) as unknown)
}

const decode =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (value: unknown): S["Type"] =>
    Schema.decodeUnknownSync(schema)(value)

export const listMyConnectors = async () =>
  decode(MemberList)(await request("/v1/connectors")).connectors

export const saveMyCredential = (id: string, values: Readonly<Record<string, string>>) =>
  request(`/v1/connectors/${id}/credential`, { method: "PUT", body: { values } })

export const removeMyCredential = (id: string) =>
  request(`/v1/connectors/${id}/credential`, { method: "DELETE" })

export const testMyConnector = async (id: string) =>
  decode(ConnectorTestResult)(await request(`/v1/connectors/${id}/test`, { body: {} }))

export const listOrgConnectors = async () =>
  decode(AdminList)(await request("/v1/admin/connectors"))

export const createConnector = async (draft: ConnectorDraft) =>
  decode(AdminConnector)(await request("/v1/admin/connectors", { body: draft }))

export const updateConnector = async (id: string, draft: Partial<ConnectorDraft>) =>
  decode(AdminConnector)(
    await request(`/v1/admin/connectors/${id}`, { method: "PATCH", body: draft }),
  )

export const removeConnector = (id: string) =>
  request(`/v1/admin/connectors/${id}`, { method: "DELETE" })

export const testOrgConnector = async (id: string) =>
  decode(ConnectorTestResult)(await request(`/v1/admin/connectors/${id}/test`, { body: {} }))

/** What a person reads for a refusal or a failed test. */
export const describeError = (code: string | undefined): string => {
  switch (code) {
    case "not_enabled":
      return "Connectors are not turned on for your organization."
    case "name_taken":
      return "Another connector already uses this name."
    case "invalid_description":
      return "The description is too long. Keep it under 1,000 characters."
    case "invalid_spec":
      return "Check the command or the URL. A URL must start with http:// or https://."
    case "invalid_fields":
      return "Check the credential fields: each needs a unique name made of letters, digits, - or _."
    case "invalid_values":
      return "Fill in every credential field, and only those."
    case "stdio_not_allowed":
      return "Local commands are not allowed on this server. Use a remote URL instead."
    case "missing_credentials":
      return "Connect your account first."
    case "connect_failed":
      return "Could not reach the server. Check the command or URL and the credentials."
    case "timeout":
      return "The server did not answer in time."
    case "connector_not_found":
      return "This connector no longer exists."
    default:
      return "Something went wrong. Try again in a moment."
  }
}
