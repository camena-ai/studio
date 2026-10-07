/**
 * Where the desktop app finds the gateway and the local inference supervisor. The environment wins
 * (`STUDIO_GATEWAY_URL`, `LOCAL_INFERENCE_URL`), then `config.json` in the profile directory, then
 * this machine. The file lets a packaged app reach a gateway on another machine on the network
 * without a launch environment: `{ "gatewayUrl": "http://studio-host.local:3000" }`.
 */
export interface DesktopConfig {
  readonly gateway: URL
  readonly localInference: URL
}

const DEFAULT_GATEWAY = "http://127.0.0.1:3000"
const DEFAULT_LOCAL_INFERENCE = "http://127.0.0.1:8084"

const httpUrl = (value: unknown): URL | null => {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url : null
  } catch {
    return null
  }
}

/** `file` is `config.json`'s text, or null when there is none; a malformed file is ignored. */
export const resolveConfig = (
  env: Readonly<Record<string, string | undefined>>,
  file: string | null,
): DesktopConfig => {
  let parsed: Record<string, unknown> = {}
  if (file !== null) {
    try {
      const value: unknown = JSON.parse(file)
      if (typeof value === "object" && value !== null) parsed = value as Record<string, unknown>
    } catch {}
  }
  return {
    gateway:
      httpUrl(env["STUDIO_GATEWAY_URL"]) ??
      httpUrl(parsed["gatewayUrl"]) ??
      new URL(DEFAULT_GATEWAY),
    localInference:
      httpUrl(env["LOCAL_INFERENCE_URL"]) ??
      httpUrl(parsed["localInferenceUrl"]) ??
      new URL(DEFAULT_LOCAL_INFERENCE),
  }
}
