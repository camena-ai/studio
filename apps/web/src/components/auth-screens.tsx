import { useAtom } from "@effect/atom-react"
import { StudioMark } from "@studio/ui"
import { Button } from "@studio/ui/components/ui/button"
import { Input } from "@studio/ui/components/ui/input"
import { Option } from "effect"
import { AsyncResult } from "effect/unstable/reactivity"
import { type FormEvent, type ReactNode, useId, useState } from "react"
import { AuthFailed } from "../api/auth.ts"
import { createOrganizationAtom, signInAtom, signUpAtom } from "../state/session.ts"

/** A short, credential-free explanation of a failed auth call. */
export function authErrorMessage(result: AsyncResult.AsyncResult<unknown, unknown>): string | null {
  if (!AsyncResult.isFailure(result)) return null
  const error = Option.getOrUndefined(AsyncResult.error(result))
  if (!(error instanceof AuthFailed)) return "Studio could not be reached. Try again."
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Wrong email or password."
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email first: follow the link we sent you."
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Sign in instead."
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters."
    case "ORGANIZATION_ALREADY_EXISTS":
      return "That name is taken. Try another."
    default:
      return error.status === 429
        ? "Too many attempts. Wait a minute."
        : "That did not work. Try again."
  }
}

function Field({
  label,
  ...props
}: { readonly label: string } & React.ComponentProps<typeof Input>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input id={id} {...props} />
    </div>
  )
}

function Card({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <StudioMark className="size-14" />
        <h1 className="text-xl font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  )
}

function ErrorLine({ message }: { readonly message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

/** Sign in, or sign up and wait for the verification email. */
export function SignInScreen() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [signInResult, signIn] = useAtom(signInAtom)
  const [signUpResult, signUp] = useAtom(signUpAtom)

  const signingUp = mode === "sign-up"
  const result = signingUp ? signUpResult : signInResult
  const waiting = AsyncResult.isWaiting(result)

  if (signingUp && AsyncResult.isSuccess(signUpResult) && !waiting) {
    return (
      <Card title="Check your inbox">
        <p className="text-center text-sm text-muted-foreground">
          We sent a verification link to {email}. Follow it, then sign in.
        </p>
        <Button type="button" variant="outline" onClick={() => setMode("sign-in")}>
          Back to sign in
        </Button>
      </Card>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (signingUp) signUp({ name, email, password })
    else signIn({ email, password })
  }
  return (
    <Card title={signingUp ? "Create your account" : "Sign in to Studio"}>
      <form onSubmit={submit} className="flex w-full flex-col gap-4">
        {signingUp && (
          <Field
            label="Name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ErrorLine message={authErrorMessage(result)} />
        <Button type="submit" disabled={waiting}>
          {waiting ? "One moment…" : signingUp ? "Create account" : "Sign in"}
        </Button>
      </form>
      <button
        type="button"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setMode(signingUp ? "sign-in" : "sign-up")}
      >
        {signingUp ? "Have an account? Sign in" : "New here? Create an account"}
      </button>
    </Card>
  )
}

/** A signed-in user who belongs to no org creates one and becomes its owner. */
export function CreateOrganizationScreen() {
  const [name, setName] = useState("")
  const [result, create] = useAtom(createOrganizationAtom)
  const waiting = AsyncResult.isWaiting(result)
  return (
    <Card title="Name your organization">
      <p className="text-center text-sm text-muted-foreground">
        You are not in an organization yet. Create one, or ask an owner to invite you.
      </p>
      <form
        className="flex w-full flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          create(name.trim())
        }}
      >
        <Field
          label="Organization name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <ErrorLine message={authErrorMessage(result)} />
        <Button type="submit" disabled={waiting || name.trim() === ""}>
          {waiting ? "One moment…" : "Create organization"}
        </Button>
      </form>
    </Card>
  )
}
