import { useAtomValue } from "@effect/atom-react"
import { cn } from "@studio/ui/lib/utils"
import { Effect } from "effect"
import { AsyncResult, Atom } from "effect/unstable/reactivity"
import { useId } from "react"
import { listRoles, type Role } from "../api/roles.ts"

/** The org's roles, read once for the owner's screens. */
export const rolesAtom = Atom.make(
  Effect.tryPromise({ try: listRoles, catch: () => new Error("roles unavailable") }),
).pipe(Atom.keepAlive)

/**
 * Who may use a connector or a skill: everyone (`null`), or only members on the chosen roles. An
 * empty choice means everyone, as the gateway reads it.
 */
export function RolePicker({
  value,
  onChange,
}: {
  readonly value: ReadonlyArray<string> | null
  readonly onChange: (value: ReadonlyArray<string> | null) => void
}) {
  const roles = useAtomValue(rolesAtom)
  const groupId = useId()
  const list: ReadonlyArray<Role> = AsyncResult.isSuccess(roles) ? roles.value : []
  const limited = value !== null
  const toggle = (id: string) => {
    const chosen = new Set(value ?? [])
    if (chosen.has(id)) chosen.delete(id)
    else chosen.add(id)
    onChange(chosen.size === 0 ? null : [...chosen])
  }
  return (
    <fieldset className="flex flex-col gap-2 text-sm" aria-labelledby={groupId}>
      <span id={groupId} className="font-medium">
        Who can use it
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!limited}
          className={cn(
            "rounded-full border px-3 py-1 text-xs",
            !limited ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
          onClick={() => onChange(null)}
        >
          Everyone
        </button>
        {list.map((role) => (
          <label
            key={role.id}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
              value?.includes(role.id) ? "border-primary bg-primary/10" : "text-muted-foreground",
            )}
          >
            <input
              type="checkbox"
              className="size-3"
              checked={value?.includes(role.id) ?? false}
              onChange={() => toggle(role.id)}
            />
            {role.name}
          </label>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {limited
          ? "Only members on the chosen roles see it and can use it in chats."
          : "Every member sees it and can use it in chats."}
      </span>
    </fieldset>
  )
}
