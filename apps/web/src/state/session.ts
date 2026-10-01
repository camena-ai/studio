/**
 * Session state on Effect Atom (D22): who is signed in and which org is active. A seat exists only
 * with an active org, so signing in also activates one when the session has none: the only org a
 * single-org user has, or the first of several (switching is an org-menu feature).
 */
import { Effect } from "effect"
import { Atom } from "effect/unstable/reactivity"
import * as Auth from "../api/auth.ts"
import { httpClientLayerAtom } from "../api/studio-api.ts"

const authRuntime = Atom.runtime((get) => get(httpClientLayerAtom))

/** The current session, or `null` when signed out. */
export const sessionAtom = authRuntime.atom(Auth.getSession).pipe(Atom.keepAlive)

/** Activates an org when the session has none; `false` when the user belongs to no org. */
const ensureActiveOrganization = Effect.gen(function* () {
  const session = yield* Auth.getSession
  if (session?.session.activeOrganizationId) return true
  const [first] = yield* Auth.listOrganizations
  if (first === undefined) return false
  yield* Auth.setActiveOrganization(first.id)
  return true
})

export interface Credentials {
  readonly email: string
  readonly password: string
}

export const signInAtom = authRuntime.fn(
  Effect.fnUntraced(function* (credentials: Credentials, get) {
    yield* Auth.signIn(credentials.email, credentials.password)
    yield* ensureActiveOrganization
    get.refresh(sessionAtom)
  }),
)

export interface SignUp extends Credentials {
  readonly name: string
}

/** Signs up; the account can sign in after following the emailed verification link. */
export const signUpAtom = authRuntime.fn(
  Effect.fnUntraced(function* (form: SignUp) {
    yield* Auth.signUp(form.name, form.email, form.password)
  }),
)

/** Lower-case, dash-separated, from the org name; Better Auth requires a unique slug. */
export const slugFor = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "org"

/** For a signed-in user who belongs to no org: create one, owned by them, and activate it. */
export const createOrganizationAtom = authRuntime.fn(
  Effect.fnUntraced(function* (name: string, get) {
    const org = yield* Auth.createOrganization(name, slugFor(name))
    yield* Auth.setActiveOrganization(org.id)
    get.refresh(sessionAtom)
  }),
)

export const signOutAtom = authRuntime.fn(
  // biome-ignore lint/suspicious/noConfusingVoidType: `void` is Atom.fn's no-argument write.
  Effect.fnUntraced(function* (_: void, get) {
    yield* Auth.signOut
    get.refresh(sessionAtom)
  }),
)
