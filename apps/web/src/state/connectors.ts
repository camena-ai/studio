/**
 * Connectors on Effect Atom: the member's list and, for an owner, the organization's list, each
 * refreshed after a change. The form's draft is the page's own; `draftOf` and `formOf` turn it into
 * what the gateway takes and back.
 */
import { Effect } from "effect"
import { Atom } from "effect/unstable/reactivity"
import {
  type AdminConnector,
  type AdminList,
  ConnectorApiError,
  type ConnectorAuth,
  type ConnectorDraft,
  type ConnectorField,
  createConnector,
  listMyConnectors,
  listOrgConnectors,
  type MemberConnector,
  removeConnector,
  removeMyCredential,
  saveMyCredential,
  startOAuth,
  testMyConnector,
  testOrgConnector,
  updateConnector,
} from "../api/connectors.ts"

/** The member's connectors, or why they could not be read. */
export const myConnectorsAtom = Atom.make(
  Effect.tryPromise({
    try: listMyConnectors,
    catch: (error) =>
      error instanceof ConnectorApiError ? error : new ConnectorApiError(0, undefined),
  }),
).pipe(Atom.keepAlive)

/** The organization's connectors for an owner; `null` for anyone else (`403`) or when off. */
export const orgConnectorsAtom = Atom.make(
  Effect.tryPromise({
    try: async (): Promise<AdminList | null> => {
      try {
        return await listOrgConnectors()
      } catch (error) {
        if (error instanceof ConnectorApiError && (error.status === 403 || error.status === 404)) {
          return null
        }
        throw error
      }
    },
    catch: (error) =>
      error instanceof ConnectorApiError ? error : new ConnectorApiError(0, undefined),
  }),
).pipe(Atom.keepAlive)

export type { MemberConnector }

/** The add or edit form, as text the person types. */
export interface ConnectorForm {
  readonly name: string
  readonly description: string
  readonly transport: "stdio" | "http"
  /** The command (stdio). */
  readonly command: string
  /** One argument per line (stdio). */
  readonly args: string
  /** The URL (http). */
  readonly url: string
  /** Fixed `KEY=value` lines: environment values (stdio) or headers (http). */
  readonly fixed: string
  readonly auth: ConnectorAuth
  readonly fields: ReadonlyArray<ConnectorField>
  /** A shared connector's values by field key; an empty one keeps (on edit) or leaves unset. */
  readonly secrets: Readonly<Record<string, string>>
  /** An OAuth connector's own client at the service, when given. */
  readonly oauthClientId: string
  readonly oauthClientSecret: string
  /** The roles it is for; null for every role. */
  readonly roleIds: ReadonlyArray<string> | null
}

export const EMPTY_FORM: ConnectorForm = {
  name: "",
  description: "",
  transport: "http",
  command: "",
  args: "",
  url: "",
  fixed: "",
  auth: "personal",
  fields: [{ key: "Authorization", label: "API token", in: "header", prefix: "Bearer " }],
  secrets: {},
  oauthClientId: "",
  oauthClientSecret: "",
  roleIds: null,
}

/** Non-empty lines, trimmed. */
export const linesOf = (text: string): ReadonlyArray<string> =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")

/** `KEY=value` lines as a record; a line without `=` is skipped. */
export const pairsOf = (text: string): Readonly<Record<string, string>> =>
  Object.fromEntries(
    linesOf(text).flatMap((line) => {
      const at = line.indexOf("=")
      return at <= 0 ? [] : [[line.slice(0, at).trim(), line.slice(at + 1).trim()] as const]
    }),
  )

export const pairsText = (record: Readonly<Record<string, string>> | undefined): string =>
  Object.entries(record ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")

/**
 * What the gateway takes. A field's prefix is sent only when it has one; shared values only for a
 * shared connector, and on an edit only those typed (an empty one would clear the stored value).
 */
export const draftOf = (form: ConnectorForm, editing: boolean): ConnectorDraft => {
  const fixed = pairsOf(form.fixed)
  const oauth = form.auth === "oauth"
  const fields = (oauth ? [] : form.fields).map((field) => ({
    key: field.key.trim(),
    label: field.label.trim(),
    in: form.transport === "stdio" ? ("env" as const) : field.in,
    ...(field.prefix === undefined || field.prefix === "" ? {} : { prefix: field.prefix }),
  }))
  const typed = Object.fromEntries(
    Object.entries(form.secrets).filter(([key, value]) =>
      editing ? value !== "" : value !== "" && fields.some((field) => field.key === key),
    ),
  )
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    auth: form.auth,
    fields,
    spec:
      form.transport === "stdio"
        ? {
            transport: "stdio",
            command: form.command.trim(),
            ...(linesOf(form.args).length === 0 ? {} : { args: linesOf(form.args) }),
            ...(Object.keys(fixed).length === 0 ? {} : { env: fixed }),
          }
        : {
            transport: "http",
            url: form.url.trim(),
            ...(Object.keys(fixed).length === 0 ? {} : { headers: fixed }),
          },
    ...(form.auth === "shared" && Object.keys(typed).length > 0 ? { secrets: typed } : {}),
    // On an edit the list is always sent, so clearing it to everyone sticks.
    ...(editing || form.roleIds !== null ? { roleIds: form.roleIds } : {}),
    ...(oauth && form.oauthClientId.trim() !== ""
      ? {
          oauthClient: {
            clientId: form.oauthClientId.trim(),
            ...(form.oauthClientSecret === "" ? {} : { clientSecret: form.oauthClientSecret }),
          },
        }
      : {}),
  }
}

/** A stored connector as the edit form shows it; secrets are never sent back, so none are filled. */
export const formOf = (connector: AdminConnector): ConnectorForm => ({
  name: connector.name,
  description: connector.description,
  transport: connector.spec.transport,
  command: connector.spec.transport === "stdio" ? connector.spec.command : "",
  args: connector.spec.transport === "stdio" ? (connector.spec.args ?? []).join("\n") : "",
  url: connector.spec.transport === "http" ? connector.spec.url : "",
  fixed: pairsText(
    connector.spec.transport === "stdio" ? connector.spec.env : connector.spec.headers,
  ),
  auth: connector.auth,
  fields: connector.fields,
  secrets: {},
  oauthClientId: "",
  oauthClientSecret: "",
  roleIds: connector.roleIds ?? null,
})

/** A name the gateway takes: lower-case, starting with a letter, at most 24 characters. */
export const nameFrom = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .slice(0, 24)

const apiError = (error: unknown) =>
  error instanceof ConnectorApiError ? error : new ConnectorApiError(0, undefined)

const attempt = <A>(run: () => Promise<A>) => Effect.tryPromise({ try: run, catch: apiError })

/** The add or edit form: closed, adding, or editing the connector with this id. */
export type FormState =
  | { readonly mode: "closed" }
  | { readonly mode: "add"; readonly form: ConnectorForm }
  | { readonly mode: "edit"; readonly id: string; readonly form: ConnectorForm }

export const connectorFormAtom: Atom.Writable<FormState> = Atom.make<FormState>({
  mode: "closed",
}).pipe(Atom.keepAlive)

/** The values a member is typing to connect one connector, by connector id. */
export const credentialDraftAtom = Atom.family((_: string) =>
  Atom.make<Readonly<Record<string, string>>>({}).pipe(Atom.keepAlive),
)

/** Which connector's connect form is open, if any. */
export const connectingIdAtom: Atom.Writable<string | null> = Atom.make<string | null>(null).pipe(
  Atom.keepAlive,
)

/** Saves the owner's form, then refreshes both lists and closes it. */
export const saveConnectorAtom = Atom.fn(
  Effect.fnUntraced(function* (state: FormState, get) {
    if (state.mode === "closed") return
    const draft = draftOf(state.form, state.mode === "edit")
    yield* attempt(() =>
      state.mode === "add" ? createConnector(draft) : updateConnector(state.id, draft),
    )
    get.set(connectorFormAtom, { mode: "closed" })
    get.refresh(orgConnectorsAtom)
    get.refresh(myConnectorsAtom)
  }),
)

export const removeConnectorAtom = Atom.fn(
  Effect.fnUntraced(function* (id: string, get) {
    yield* attempt(() => removeConnector(id))
    get.refresh(orgConnectorsAtom)
    get.refresh(myConnectorsAtom)
  }),
)

/** Saves the member's own values for one connector, then refreshes their list. */
export const saveCredentialAtom = Atom.fn(
  Effect.fnUntraced(function* (input: { readonly id: string }, get) {
    const values = get(credentialDraftAtom(input.id))
    yield* attempt(() => saveMyCredential(input.id, values))
    get.set(credentialDraftAtom(input.id), {})
    get.set(connectingIdAtom, null)
    get.refresh(myConnectorsAtom)
  }),
)

/** Sends the browser to an OAuth connector's sign-in at the service. */
export const startOAuthAtom = Atom.fn(
  Effect.fnUntraced(function* (id: string) {
    const url = yield* attempt(() => startOAuth(id))
    window.location.assign(url)
  }),
)

export const removeCredentialAtom = Atom.fn(
  Effect.fnUntraced(function* (id: string, get) {
    yield* attempt(() => removeMyCredential(id))
    get.refresh(myConnectorsAtom)
  }),
)

/** A connection test, by `<scope>:<id>`: the member's own (`me`) or the owner's view (`org`). */
export const testConnectorAtom = Atom.family((key: string) =>
  Atom.fn(
    // biome-ignore lint/suspicious/noConfusingVoidType: `void` is Atom.fn's no-argument write.
    Effect.fnUntraced(function* (_: void) {
      const [scope, id = ""] = key.split(":")
      return yield* attempt(() => (scope === "org" ? testOrgConnector(id) : testMyConnector(id)))
    }),
  ).pipe(Atom.keepAlive),
)
