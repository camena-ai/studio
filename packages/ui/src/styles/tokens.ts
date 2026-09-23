/**
 * Parses `tokens.css` into its light (`:root`) and dark (`.dark`) variable maps. Used by tests
 * that keep the two blocks and `DESIGN.md` in agreement; not shipped to the browser.
 */
export type TokenMap = Readonly<Record<string, string>>

export type Tokens = {
  readonly light: TokenMap
  readonly dark: TokenMap
}

const blockPattern = (selector: string) =>
  new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "m")

const declarationPattern = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi

function parseBlock(css: string, selector: string): TokenMap {
  const match = css.match(blockPattern(selector))
  if (!match?.[1]) return {}
  const out: Record<string, string> = {}
  for (const declaration of match[1].matchAll(declarationPattern)) {
    const name = declaration[1]
    const value = declaration[2]
    if (name && value) out[name] = value.trim()
  }
  return out
}

export function parseTokens(css: string): Tokens {
  return { light: parseBlock(css, ":root"), dark: parseBlock(css, ".dark") }
}
