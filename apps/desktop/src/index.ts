/**
 * @studio/desktop
 *
 * The Electron shell (D16, §7):
 * - Main process in plain Node/TypeScript (no Effect), consuming only contract types. Electron
 *   is never older than N−1; one bump per Electron major.
 * - Serves the identical `@studio/web` build behind an `app://` scheme with a main-process proxy
 *   for `/v1/*`; the renderer never loads the hosted origin and never holds the seat token.
 * - Sign-in per RFC 8252: system browser, PKCE S256, return over a custom reverse-DNS scheme
 *   (Better Auth's Electron plugin), loopback listener only as the fallback; tokens stay in the
 *   main process wrapped by `safeStorage`.
 * - `LocalEngine` seam with `NodeLlamaCppWorkerEngine` (v1, `node-llama-cpp` in a
 *   `utilityProcess`, never the main process, reached over IPC, no loopback HTTP server),
 *   `OllamaEngine` (opt-in) and `LlamaServerSidecarEngine` (only if a missing backend requires it).
 *   The device descriptor comes from `node-llama-cpp`'s GPU and VRAM probe.
 * - Local cache in SQLite encrypted with `better-sqlite3-multiple-ciphers`; the random 32-byte
 *   key is wrapped by `safeStorage`, and the cache is not persisted when encryption is unavailable.
 * - `route.local` context (missing messages, extracted attachment text) goes to the local model
 *   and the encrypted cache only; never to an online endpoint. Never log content.
 * - Packaging with electron-builder (hoisted layout, `pnpm deploy --prod`) and electron-updater
 *   to S3; signing and notarization are part of the milestone-8 spike, together with adding
 *   `node-llama-cpp` and `better-sqlite3-multiple-ciphers` to the catalog.
 */
export {}
