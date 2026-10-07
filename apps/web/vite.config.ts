import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/**
 * The gateway the dev server forwards to. Production is same-origin through CloudFront, which
 * forwards only `/v1/*` and `/api/auth/*`; the dev proxy mirrors that so the app, its cookies and
 * the gateway's Origin check see one origin locally too (`/health` is forwarded for plumbing).
 * The Origin header is kept as the browser sent it, so the dev server's origin must be in the
 * gateway's `TRUSTED_ORIGINS`.
 */
const { STUDIO_GATEWAY_URL, LOCAL_INFERENCE_URL } = process.env
const gateway = STUDIO_GATEWAY_URL ?? "http://127.0.0.1:3000"
/** A self-hosted model's supervisor; `/local-inference/*` maps to its `/control/*`. */
const localInference = LOCAL_INFERENCE_URL ?? "http://127.0.0.1:8084"
const forward = { target: gateway, changeOrigin: false, ws: false }

const isLoopback = (address: string | undefined) =>
  address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1"

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/v1": forward,
      "/api/auth": forward,
      "/health": forward,
      "/local-inference": {
        target: localInference,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/local-inference/, "/control"),
        // The model runs on this machine: other devices served over the network may read its
        // status, but only this machine starts or pauses it (Vite answers 404 for `false`).
        bypass: (req) =>
          req.method === "GET" || isLoopback(req.socket.remoteAddress) ? undefined : false,
      },
    },
  },
})
