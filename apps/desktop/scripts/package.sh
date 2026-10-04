#!/usr/bin/env bash
# Packages the desktop app (unsigned; signing and notarization are the milestone-8 spike).
# electron-builder reads package.json as written, and pnpm's `catalog:` specifiers are not
# versions, so it runs on `pnpm deploy --prod` output, where they are resolved (D20).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
root="$(cd "$here/../.." && pwd)"
deploy="$here/.deploy"

pnpm --dir "$root" --filter @studio/web build
pnpm --dir "$here" build

rm -rf "$deploy"
pnpm --dir "$root" --filter @studio/desktop deploy --prod "$deploy"
cp -R "$here/dist" "$deploy/dist"
cp -R "$here/resources" "$deploy/resources"
cp -R "$root/apps/web/dist" "$deploy/web-dist"

cd "$deploy"
# The "build" config's paths are relative to the deploy directory: web-dist in it, release next to it.
# Electron is a dev dependency, so `--prod` leaves it out; pass the installed (catalog) version.
electron_version="$(node -p "require('$root/node_modules/electron/package.json').version")"
"$root/node_modules/.bin/electron-builder" --projectDir "$deploy" \
  --config.electronVersion="$electron_version" "$@"
