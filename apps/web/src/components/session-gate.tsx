import { useAtomRefresh, useAtomValue } from "@effect/atom-react"
import { Button } from "@studio/ui/components/ui/button"
import { AsyncResult } from "effect/unstable/reactivity"
import type { ReactNode } from "react"
import { sessionAtom } from "../state/session.ts"
import { CreateOrganizationScreen, SignInScreen } from "./auth-screens.tsx"

/**
 * Renders `children` only for a seat: a signed-in user with an active org. Everything under it may
 * call `/v1/*`, which answers `403 no_active_org` without one.
 */
export function SessionGate({ children }: { readonly children: ReactNode }) {
  const session = useAtomValue(sessionAtom)
  const retry = useAtomRefresh(sessionAtom)
  return AsyncResult.match(session, {
    onInitial: () => <main className="min-h-svh flex-1" aria-busy="true" />,
    onFailure: () => (
      <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">Studio could not be reached.</p>
        <Button type="button" variant="outline" onClick={retry}>
          Try again
        </Button>
      </main>
    ),
    onSuccess: ({ value }) => {
      if (value === null) return <SignInScreen />
      if (!value.session.activeOrganizationId) return <CreateOrganizationScreen />
      return children
    },
  })
}
