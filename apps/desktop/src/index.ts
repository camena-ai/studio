/**
 * @studio/desktop main process (D16, §7). Plain Node/TypeScript, no Effect.
 *
 * - Serves the identical `@studio/web` build behind `app://studio` and proxies the gateway's
 *   routes (`/v1/*`, `/api/auth/*`, `/health`) from the main process, so the app keeps calling its
 *   own origin as it does on the web. The renderer never loads the hosted origin.
 * - The session cookie lives in the main process only (`SessionJar`), persisted with
 *   `safeStorage`; the renderer never holds the seat token.
 * - **Interim sign-in.** Until the gateway enables Better Auth's Electron plugin, the renderer's
 *   email-and-password form signs in through the proxy. The RFC 8252 flow (system browser, PKCE
 *   S256, reverse-DNS return scheme) replaces it; the token stays in the main process either way.
 *
 * Not yet here: the `LocalEngine` seam (`node-llama-cpp` in a `utilityProcess`), the encrypted
 * SQLite cache, signing, notarization and auto-update; see the milestone-8 spike.
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { app, BrowserWindow, protocol, session, shell } from "electron"
import { contentSecurityPolicy, inlineScriptHashes } from "./csp.ts"
import { proxyToGateway } from "./proxy.ts"
import { contentTypeFor, isGatewayPath, staticFileFor } from "./routes.ts"
import { SessionJar } from "./session-jar.ts"
import { loadSession, saveSession } from "./session-store.ts"

const SCHEME = "app"
const HOST = "studio"
const ORIGIN = `${SCHEME}://${HOST}`

const { STUDIO_GATEWAY_URL } = process.env
const gateway = new URL(STUDIO_GATEWAY_URL ?? "http://localhost:3000")
const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = app.isPackaged
  ? path.join(process.resourcesPath, "web")
  : path.resolve(here, "../../../web/dist")

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

const serveStatic = async (pathname: string): Promise<Response> => {
  const file = staticFileFor(webRoot, pathname)
  if (file === null) return new Response(null, { status: 404 })
  try {
    const body = await readFile(file)
    const type = contentTypeFor(file)
    const hashes = type.startsWith("text/html") ? inlineScriptHashes(body.toString("utf8")) : []
    return new Response(body, {
      headers: { "content-type": type, "content-security-policy": contentSecurityPolicy(hashes) },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  window.once("ready-to-show", () => window.show())
  // The web build reserves room for the traffic lights when told it runs in an inset title bar.
  window.webContents.on("dom-ready", () => {
    void window.webContents.executeJavaScript(
      'document.documentElement.dataset.windowChrome = "inset"',
    )
  })

  // Links the user opens leave the app for the system browser; the window never navigates away.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: "deny" }
  })
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault()
  })
  void window.loadURL(`${ORIGIN}/`)
}

app.whenReady().then(() => {
  const jar = new SessionJar(loadSession())
  const persist = () => saveSession(jar.snapshot())

  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  )

  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url)
    if (url.host !== HOST) return new Response(null, { status: 404 })
    if (isGatewayPath(url.pathname)) {
      // Node's fetch, not `net.fetch`: Chromium's network stack keeps its own cookie store and
      // hides `Set-Cookie`, and the session must live in the jar only.
      return proxyToGateway(request, { gateway, jar, onJarChange: persist }).catch(
        () => new Response(null, { status: 503 }),
      )
    }
    return serveStatic(url.pathname)
  })

  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
