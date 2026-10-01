/**
 * The gateway's identity routes under `/api/auth/*` (D17): Better Auth's email-and-password
 * session plus its organization plugin. They are not part of `StudioApi`, so the few fields the
 * client reads are decoded with the schemas below; everything else in a response is ignored.
 *
 * The session is the `better-auth.session_token` cookie (`SESSION_COOKIE` in the contracts),
 * set and read by the browser on the app's own origin; the client never holds the token.
 */
import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/unstable/http"

export const Session = Schema.Struct({
  session: Schema.Struct({ activeOrganizationId: Schema.NullOr(Schema.String) }),
  user: Schema.Struct({ id: Schema.String, email: Schema.String, name: Schema.String }),
})
export type Session = typeof Session.Type

export const Organization = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
})
export type Organization = typeof Organization.Type

/** Why an auth call failed; the message is safe to show and never carries a credential. */
export class AuthFailed extends Schema.TaggedError<AuthFailed>()("AuthFailed", {
  status: Schema.Int,
  code: Schema.optionalKey(Schema.String),
}) {}

const ErrorBody = Schema.Struct({ code: Schema.optionalKey(Schema.String) })

const decodeOk =
  <S extends Schema.Top>(schema: S) =>
  (response: HttpClientResponse.HttpClientResponse) =>
    response.status >= 200 && response.status < 300
      ? Effect.flatMap(response.json, Schema.decodeUnknownEffect(schema))
      : Effect.flatMap(
          Effect.orElseSucceed(
            Effect.flatMap(response.json, Schema.decodeUnknownEffect(ErrorBody)),
            (): { readonly code?: string } => ({}),
          ),
          (body) =>
            Effect.fail(
              new AuthFailed({
                status: response.status,
                ...(body.code === undefined ? {} : { code: body.code }),
              }),
            ),
        )

const base = () => globalThis.location?.origin ?? ""

const send = <S extends Schema.Top>(request: HttpClientRequest.HttpClientRequest, schema: S) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const response = yield* client.execute(request)
    return yield* decodeOk(schema)(response)
  })

const post = <S extends Schema.Top>(path: string, body: unknown, schema: S) =>
  send(
    HttpClientRequest.post(`${base()}/api/auth${path}`).pipe(
      HttpClientRequest.bodyJsonUnsafe(body),
    ),
    schema,
  )

const get = <S extends Schema.Top>(path: string, schema: S) =>
  send(HttpClientRequest.get(`${base()}/api/auth${path}`), schema)

/** The current session, or `null` when signed out (Better Auth answers `null` with a 200). */
export const getSession = Effect.suspend(() => get("/get-session", Schema.NullOr(Session)))

export const signIn = (email: string, password: string) =>
  post("/sign-in/email", { email, password }, Schema.Unknown)

/** Better Auth sends a verification link; the account can sign in once it is followed. */
export const signUp = (name: string, email: string, password: string) =>
  post("/sign-up/email", { name, email, password }, Schema.Unknown)

export const signOut = Effect.suspend(() => post("/sign-out", {}, Schema.Unknown))

export const listOrganizations = Effect.suspend(() =>
  get("/organization/list", Schema.Array(Organization)),
)

export const setActiveOrganization = (organizationId: string) =>
  post("/organization/set-active", { organizationId }, Schema.Unknown)

/** Creates an org with the caller as its owner and makes it active. */
export const createOrganization = (name: string, slug: string) =>
  post("/organization/create", { name, slug }, Organization)
