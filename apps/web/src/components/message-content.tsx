/**
 * An assistant message's Markdown, rendered by Streamdown with a locked `rehype-harden`
 * configuration (D21, §13). Streamdown's own default allows images from any origin; here no image
 * loads from anywhere (no remote fetch can leak that a message was read) and `data:` images are
 * off. Links may point anywhere, but only over http(s) or mailto, so `javascript:` and other
 * schemes are blocked (rehype-harden matches prefixes as whole URLs, so the protocol list is the
 * filter). `message-content.test.tsx` holds this in place.
 */
import { harden } from "rehype-harden"
import { defaultRehypePlugins, Streamdown } from "streamdown"
import type { Pluggable } from "unified"

export const HARDEN_OPTIONS = {
  allowedImagePrefixes: [],
  allowDataImages: false,
  allowedLinkPrefixes: ["*"],
  allowedProtocols: ["https", "http", "mailto"],
} as const satisfies Parameters<typeof harden>[0]

/** Relative URLs resolve against the app's own origin, which is never an image source either. */
const defaultOrigin = globalThis.location?.origin ?? "http://localhost"

const rehypePlugins: Array<Pluggable> = Object.entries(defaultRehypePlugins).map(
  ([name, plugin]) => (name === "harden" ? [harden, { ...HARDEN_OPTIONS, defaultOrigin }] : plugin),
)

export function MessageContent({
  markdown,
  streaming = false,
}: {
  readonly markdown: string
  readonly streaming?: boolean
}) {
  return (
    <Streamdown
      className="leading-relaxed"
      rehypePlugins={rehypePlugins}
      parseIncompleteMarkdown={streaming}
    >
      {markdown}
    </Streamdown>
  )
}
