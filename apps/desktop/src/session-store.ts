/**
 * Persists the session jar encrypted with Electron `safeStorage` (the OS keychain on macOS). When
 * encryption is unavailable the session lives in memory only: there is no plaintext path, so the
 * user signs in again after a restart.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { app, safeStorage } from "electron"
import type { JarSnapshot } from "./session-jar.ts"

const file = () => path.join(app.getPath("userData"), "session.bin")

export const loadSession = (): JarSnapshot => {
  if (!safeStorage.isEncryptionAvailable() || !existsSync(file())) return {}
  try {
    return JSON.parse(safeStorage.decryptString(readFileSync(file()))) as JarSnapshot
  } catch {
    // Unreadable (a different keychain, a corrupt file): start signed out.
    rmSync(file(), { force: true })
    return {}
  }
}

export const saveSession = (snapshot: JarSnapshot): void => {
  if (!safeStorage.isEncryptionAvailable()) return
  if (Object.keys(snapshot).length === 0) {
    rmSync(file(), { force: true })
    return
  }
  writeFileSync(file(), safeStorage.encryptString(JSON.stringify(snapshot)), { mode: 0o600 })
}
