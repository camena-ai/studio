import { defineConfig } from "vitest/config"

// Root config aggregates every workspace project for local runs (`pnpm vitest`).
// CI runs `turbo run test`, one Vitest process per package, so results are cacheable.
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    passWithNoTests: true,
  },
})
