/**
 * @studio/web
 *
 * The web SPA (D21, D22, §13):
 * - Vite + React with TanStack Router; the same static build is bundled into the desktop app.
 * - All state on Effect Atom (`@effect/atom-react`): admin and conversation-list surfaces through
 *   `AtomHttpApi` over the generated `@studio/contracts` client; a turn is an Effect `Stream` of
 *   Studio SSE events from the raw streaming route, decoded with the contract schemas and folded
 *   by one conversation atom. Interrupting that atom's fiber closes the SSE connection.
 * - Messages are a flat list (suffix retirement); no message tree.
 * - shadcn/ui (Radix) plus the shadcn chat components for scrolling and markers; AI Elements as
 *   presentational components only; Streamdown with an explicitly locked `rehype-harden`
 *   configuration and a test that an external image is blocked.
 * - Persistent "classified" badge pointing at the tainted message(s), with edit and fork as the
 *   self-service exits; the model picker offers only chain targets in a tainted conversation.
 * - Same-origin hosting: the SPA from S3 behind CloudFront, `/v1/*` and `/api/auth/*` forwarded
 *   to the gateway. Never log message content.
 *
 * `@studio/contracts` is added as an exact pinned dependency once the platform repo publishes it.
 */
export {}
