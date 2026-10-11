import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Button } from "@studio/ui/components/ui/button"
import { Input } from "@studio/ui/components/ui/input"
import { Textarea } from "@studio/ui/components/ui/textarea"
import { cn } from "@studio/ui/lib/utils"
import { Cause } from "effect"
import { AsyncResult } from "effect/unstable/reactivity"
import { CircleCheck, CircleDashed, Plug, Plus, Trash2, X } from "lucide-react"
import { type ReactNode, useId } from "react"
import {
  type AdminConnector,
  ConnectorApiError,
  type ConnectorField,
  type ConnectorTestResult,
  describeError,
  type MemberConnector,
  type OperatorConnector,
} from "../api/connectors.ts"
import {
  type ConnectorForm,
  connectingIdAtom,
  connectorFormAtom,
  credentialDraftAtom,
  EMPTY_FORM,
  type FormState,
  formOf,
  myConnectorsAtom,
  nameFrom,
  orgConnectorsAtom,
  removeConnectorAtom,
  removeCredentialAtom,
  saveConnectorAtom,
  saveCredentialAtom,
  testConnectorAtom,
} from "../state/connectors.ts"
import { TopBar } from "./top-bar.tsx"

/** The refusal's words, from an `AsyncResult` failure. */
const failureText = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause)
  return describeError(error instanceof ConnectorApiError ? error.code : undefined)
}

function Pill({
  children,
  tone = "muted",
}: {
  readonly children: ReactNode
  readonly tone?: "muted" | "ok"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "ok"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}

/** A labelled control: the label points at the control by id, with an optional hint below. */
function Field({
  label,
  hint,
  small = false,
  className,
  children,
}: {
  readonly label: string
  readonly hint?: string
  readonly small?: boolean
  readonly className?: string
  readonly children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className={cn("flex flex-col gap-1", small ? "text-xs" : "text-sm", className)}>
      <label htmlFor={id} className={small ? undefined : "font-medium"}>
        {label}
      </label>
      {children(id)}
      {hint !== undefined && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function ErrorLine({ children }: { readonly children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  )
}

/** A test's outcome: the server's tools, or why it could not connect. */
function TestOutcome({ testKey }: { readonly testKey: string }) {
  const result = useAtomValue(testConnectorAtom(testKey))
  if (AsyncResult.isInitial(result)) return null
  if (AsyncResult.isWaiting(result)) {
    return <p className="text-sm text-muted-foreground">Connecting…</p>
  }
  if (AsyncResult.isFailure(result)) return <ErrorLine>{failureText(result.cause)}</ErrorLine>
  const outcome: ConnectorTestResult = result.value
  if (!outcome.ok) return <ErrorLine>{describeError(outcome.error)}</ErrorLine>
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
        <CircleCheck className="size-4" aria-hidden="true" />
        Connected. {outcome.tools.length} {outcome.tools.length === 1 ? "tool" : "tools"} available.
      </p>
      <ul className="flex flex-wrap gap-1">
        {outcome.tools.map((tool) => (
          <li key={tool.name}>
            <Pill>{tool.name}</Pill>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TestButton({ testKey }: { readonly testKey: string }) {
  const run = useAtomSet(testConnectorAtom(testKey))
  return (
    <Button variant="outline" size="sm" onClick={() => run()}>
      Test
    </Button>
  )
}

/** The values a member types to connect their own account. */
function ConnectForm({
  connector,
}: {
  readonly connector: MemberConnector & { readonly id: string }
}) {
  const [draft, setDraft] = useAtom(credentialDraftAtom(connector.id))
  const [saved, save] = useAtom(saveCredentialAtom)
  const setConnecting = useAtomSet(connectingIdAtom)
  const complete = connector.fields.every((field) => (draft[field.key] ?? "").trim() !== "")
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (complete) save({ id: connector.id })
      }}
    >
      {connector.fields.map((field) => (
        <Field key={field.key} label={field.label}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="off"
              value={draft[field.key] ?? ""}
              onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
            />
          )}
        </Field>
      ))}
      <p className="text-xs text-muted-foreground">
        Stored encrypted and used only when you ask the assistant something. Nobody else's chats use
        it.
      </p>
      {AsyncResult.isFailure(saved) && <ErrorLine>{failureText(saved.cause)}</ErrorLine>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!complete || AsyncResult.isWaiting(saved)}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConnecting(null)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ConnectionCard({ connector }: { readonly connector: MemberConnector }) {
  const [connecting, setConnecting] = useAtom(connectingIdAtom)
  const disconnect = useAtomSet(removeCredentialAtom)
  const id = connector.id
  const personal = connector.auth === "personal" && id !== undefined
  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{connector.name}</span>
            <Pill>{connector.transport === "stdio" ? "Local" : "Remote"}</Pill>
            {connector.connected ? (
              <Pill tone="ok">
                <CircleCheck className="size-3" aria-hidden="true" />
                {personal ? "Connected" : "Shared"}
              </Pill>
            ) : (
              <Pill>
                <CircleDashed className="size-3" aria-hidden="true" />
                Not connected
              </Pill>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{connector.description}</p>
        </div>
        {personal && (
          <div className="flex gap-2">
            {connector.connected && <TestButton testKey={`me:${id}`} />}
            <Button
              variant={connector.connected ? "ghost" : "default"}
              size="sm"
              onClick={() => setConnecting(connecting === id ? null : id)}
            >
              {connector.connected ? "Update" : "Connect"}
            </Button>
            {connector.connected && (
              <Button variant="ghost" size="sm" onClick={() => disconnect(id)}>
                Disconnect
              </Button>
            )}
          </div>
        )}
      </div>
      {personal && connecting === id && <ConnectForm connector={{ ...connector, id }} />}
      {personal && <TestOutcome testKey={`me:${id}`} />}
    </li>
  )
}

export function MyConnections() {
  const result = useAtomValue(myConnectorsAtom)
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Your connections</h2>
      {AsyncResult.isSuccess(result) ? (
        result.value.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No connectors yet. An owner of your organization can add one.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {result.value.map((connector) => (
              <ConnectionCard key={connector.id ?? connector.name} connector={connector} />
            ))}
          </ul>
        )
      ) : AsyncResult.isFailure(result) ? (
        <ErrorLine>{failureText(result.cause)}</ErrorLine>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </section>
  )
}

/** One credential field's row in the owner's form. */
function FieldRow({
  field,
  transport,
  onChange,
  onRemove,
}: {
  readonly field: ConnectorField
  readonly transport: ConnectorForm["transport"]
  readonly onChange: (field: ConnectorField) => void
  readonly onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
      <Field small label={transport === "stdio" ? "Variable" : "Header"}>
        {(id) => (
          <Input
            id={id}
            value={field.key}
            onChange={(e) => onChange({ ...field, key: e.target.value })}
          />
        )}
      </Field>
      <Field small label="Shown as">
        {(id) => (
          <Input
            id={id}
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
          />
        )}
      </Field>
      {transport === "http" && (
        <Field small label="Prefix" className="hidden sm:flex">
          {(id) => (
            <Input
              id={id}
              value={field.prefix ?? ""}
              placeholder="Bearer "
              onChange={(e) => onChange({ ...field, prefix: e.target.value })}
            />
          )}
        </Field>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Remove field"
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  )
}

function Choice<A extends string>({
  value,
  options,
  onChange,
}: {
  readonly value: A
  readonly options: ReadonlyArray<readonly [A, string]>
  readonly onChange: (value: A) => void
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={cn(
            "rounded-md px-3 py-1 text-sm",
            value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
          onClick={() => onChange(option)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** The owner's add or edit form. */
function ConnectorFormPanel({
  state,
  stored,
}: {
  readonly state: Exclude<FormState, { mode: "closed" }>
  readonly stored: AdminConnector | undefined
}) {
  const setState = useAtomSet(connectorFormAtom)
  const [saved, save] = useAtom(saveConnectorAtom)
  const form = state.form
  const set = (patch: Partial<ConnectorForm>) => setState({ ...state, form: { ...form, ...patch } })
  const setField = (index: number, field: ConnectorField) =>
    set({ fields: form.fields.map((current, i) => (i === index ? field : current)) })
  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border bg-card px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault()
        save(state)
      }}
    >
      <h3 className="font-semibold">
        {state.mode === "add" ? "Add a connector" : `Edit ${form.name}`}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" hint="Lower-case letters, digits and _.">
          {(id) => (
            <Input
              id={id}
              value={form.name}
              placeholder="sales_db"
              onChange={(e) => set({ name: nameFrom(e.target.value) })}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Runs as</span>
          <Choice
            value={form.transport}
            options={[
              ["http", "Remote URL"],
              ["stdio", "Local command"],
            ]}
            onChange={(transport) => set({ transport })}
          />
        </div>
      </div>
      <Field
        label="What it holds"
        hint="The assistant reads this to decide when to use the connector."
      >
        {(id) => (
          <Textarea
            id={id}
            value={form.description}
            rows={2}
            placeholder="The sales database: orders, customers and products since 2020."
            onChange={(e) => set({ description: e.target.value })}
          />
        )}
      </Field>
      {form.transport === "http" ? (
        <Field label="Server URL">
          {(id) => (
            <Input
              id={id}
              value={form.url}
              placeholder="https://mcp.example.com/mcp"
              onChange={(e) => set({ url: e.target.value })}
            />
          )}
        </Field>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Command">
            {(id) => (
              <Input
                id={id}
                value={form.command}
                placeholder="npx"
                onChange={(e) => set({ command: e.target.value })}
              />
            )}
          </Field>
          <Field label="Arguments, one per line">
            {(id) => (
              <Textarea
                id={id}
                value={form.args}
                rows={2}
                onChange={(e) => set({ args: e.target.value })}
              />
            )}
          </Field>
        </div>
      )}
      <Field
        label={`${form.transport === "http" ? "Fixed headers" : "Fixed environment"}, KEY=value per line`}
        hint="Put secrets in the credential fields below instead."
      >
        {(id) => (
          <Textarea
            id={id}
            value={form.fixed}
            rows={2}
            onChange={(e) => set({ fixed: e.target.value })}
          />
        )}
      </Field>
      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Credentials</span>
        <Choice
          value={form.auth}
          options={[
            ["personal", "Each person connects their own"],
            ["shared", "One for everyone"],
          ]}
          onChange={(auth) => set({ auth })}
        />
        <span className="text-xs text-muted-foreground">
          {form.auth === "personal"
            ? "Each member enters their own values, so the service sees who is asking and applies their permissions."
            : "You enter the values once, and everyone's chats use them."}
        </span>
        {form.fields.map((field, index) => (
          <FieldRow
            key={index}
            field={field}
            transport={form.transport}
            onChange={(next) => setField(index, next)}
            onRemove={() => set({ fields: form.fields.filter((_, i) => i !== index) })}
          />
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              set({
                fields: [
                  ...form.fields,
                  { key: "", label: "", in: form.transport === "stdio" ? "env" : "header" },
                ],
              })
            }
          >
            <Plus /> Add field
          </Button>
        </div>
        {form.auth === "shared" &&
          form.fields
            .filter((field) => field.key.trim() !== "")
            .map((field) => (
              <Field
                key={field.key}
                small
                label={`${field.label || field.key}${stored?.sharedSet.includes(field.key) ? " (set; leave empty to keep)" : ""}`}
              >
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="off"
                    value={form.secrets[field.key] ?? ""}
                    onChange={(e) =>
                      set({ secrets: { ...form.secrets, [field.key]: e.target.value } })
                    }
                  />
                )}
              </Field>
            ))}
      </div>
      {AsyncResult.isFailure(saved) && <ErrorLine>{failureText(saved.cause)}</ErrorLine>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={AsyncResult.isWaiting(saved)}>
          {state.mode === "add" ? "Add connector" : "Save"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setState({ mode: "closed" })}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

function OrgConnectorRow({ connector }: { readonly connector: AdminConnector }) {
  const setState = useAtomSet(connectorFormAtom)
  const [removed, remove] = useAtom(removeConnectorAtom)
  return (
    <li className="flex flex-col gap-2 rounded-2xl border bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{connector.name}</span>
            <Pill>{connector.spec.transport === "stdio" ? "Local" : "Remote"}</Pill>
            <Pill>{connector.auth === "personal" ? "Each person's own" : "Shared"}</Pill>
          </div>
          <p className="text-sm text-muted-foreground">{connector.description}</p>
        </div>
        <div className="flex gap-2">
          <TestButton testKey={`org:${connector.id}`} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setState({ mode: "edit", id: connector.id, form: formOf(connector) })}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${connector.name}`}
            onClick={() => {
              if (
                window.confirm(
                  `Remove ${connector.name}? Everyone's saved credentials for it are deleted too.`,
                )
              ) {
                remove(connector.id)
              }
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {AsyncResult.isFailure(removed) && <ErrorLine>{failureText(removed.cause)}</ErrorLine>}
      <TestOutcome testKey={`org:${connector.id}`} />
    </li>
  )
}

function OperatorRow({ connector }: { readonly connector: OperatorConnector }) {
  return (
    <li className="flex flex-col gap-1 rounded-2xl border border-dashed px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{connector.name}</span>
        <Pill>Set up by the server's operator</Pill>
      </div>
      <p className="text-sm text-muted-foreground">{connector.description}</p>
    </li>
  )
}

/** Owners only: the organization's connectors. Hidden for everyone else. */
export function ManageConnectors() {
  const result = useAtomValue(orgConnectorsAtom)
  const [state, setState] = useAtom(connectorFormAtom)
  if (!AsyncResult.isSuccess(result) || result.value === null) return null
  const { connectors, operator } = result.value
  const editing = state.mode === "edit" ? connectors.find((c) => c.id === state.id) : undefined
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Manage connectors</h2>
        {state.mode === "closed" && (
          <Button size="sm" onClick={() => setState({ mode: "add", form: EMPTY_FORM })}>
            <Plus /> Add connector
          </Button>
        )}
      </div>
      {state.mode !== "closed" && <ConnectorFormPanel state={state} stored={editing} />}
      <ul className="flex flex-col gap-3">
        {connectors.map((connector) => (
          <OrgConnectorRow key={connector.id} connector={connector} />
        ))}
        {operator.map((connector) => (
          <OperatorRow key={connector.name} connector={connector} />
        ))}
      </ul>
    </section>
  )
}

/** `/connectors`: the data sources the assistant can use, and your own access to them. */
export function ConnectorsPage() {
  const mine = useAtomValue(myConnectorsAtom)
  const off =
    AsyncResult.isFailure(mine) &&
    (() => {
      const error = Cause.squash(mine.cause)
      return error instanceof ConnectorApiError && error.code === "not_enabled"
    })()
  return (
    <>
      <TopBar title="Connectors" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
          <header className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Plug className="size-6" aria-hidden="true" />
              Connectors
            </h1>
            <p className="text-sm text-muted-foreground">
              The databases and services the assistant can look things up in. Some ask you to
              connect your own account, so you only ever see what you are allowed to see.
            </p>
          </header>
          {off ? (
            <p className="text-sm text-muted-foreground">{describeError("not_enabled")}</p>
          ) : (
            <>
              <MyConnections />
              <ManageConnectors />
            </>
          )}
        </div>
      </div>
    </>
  )
}
