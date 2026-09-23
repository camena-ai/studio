import { useAtomValue } from "@effect/atom-react"
import { useEffect } from "react"
import { applyTheme, resolvedThemeAtom } from "../state/theme.ts"

/** Keeps the `.dark` class on `<html>` in step with the resolved theme atom. Renders nothing. */
export function ThemeEffect() {
  const theme = useAtomValue(resolvedThemeAtom)
  useEffect(() => {
    applyTheme(theme, document.documentElement)
  }, [theme])
  return null
}
