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
const gateway = process.env["STUDIO_GATEWAY_URL"] ?? "http://localhost:3000"
const forward = { target: gateway, changeOrigin: false, ws: false }

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/v1": forward,
      "/api/auth": forward,
      "/health": forward,
    },
  },
})
