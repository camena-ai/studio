/**
 * The organization's roles, for an owner choosing who may use a connector or a skill.
 *
 * TODO(contracts): `GET /v1/admin/roles` is in a contracts release newer than the 0.17 this app
 * pins, so its shape is mirrored here and fetched directly. Switch to `StudioApiClient` at the next
 * contracts bump.
 */
import { Schema } from "effect"

export const Role = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  isDefault: Schema.Boolean,
  members: Schema.Number,
})
export type Role = typeof Role.Type

const Roles = Schema.Struct({ roles: Schema.Array(Role) })

/** The org's roles; none for anyone who is not an owner. */
export const listRoles = async (): Promise<ReadonlyArray<Role>> => {
  const response = await fetch("/v1/admin/roles", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  })
  if (!response.ok) return []
  return Schema.decodeUnknownSync(Roles)(await response.json()).roles
}
