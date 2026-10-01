/** An assistant message's text. Plain text until Markdown rendering lands. */
export function MessageContent({ markdown }: { readonly markdown: string }) {
  return <div className="whitespace-pre-wrap leading-relaxed">{markdown}</div>
}
