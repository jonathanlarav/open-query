#!/usr/bin/env bash
# Fast iteration script for the packaged Mac app.
# Rebuilds only what changed, patches the installed .app in-place,
# restarts it, and tails the log — no DMG rebuild needed.
#
# Usage:
#   ./scripts/patch-mac-app.sh            # patch API bundle only (default)
#   ./scripts/patch-mac-app.sh --all      # patch API bundle + web static files

set -euo pipefail

APP="/Applications/Open Query.app"
RESOURCES="$APP/Contents/Resources"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$HOME/Library/Logs/@open-query/electron/Open Query/main.log"
ELECTRON_VERSION="$(cat "$REPO_ROOT/apps/electron/node_modules/electron/dist/version")"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found — install the app first."
  exit 1
fi

echo "==> Killing running instance..."
pkill -f "Open Query" 2>/dev/null || true
sleep 1

echo "==> Building API bundle..."
cd "$REPO_ROOT"
pnpm --filter @open-query/api build:bundle

echo "==> Rebuilding native modules for Electron $ELECTRON_VERSION..."
npx @electron/rebuild -v "$ELECTRON_VERSION" -f --arch arm64 -m apps/api

echo "==> Patching API bundle + native modules..."
cp apps/api/dist/server.bundle.js "$RESOURCES/api-bundle/server.bundle.js"
cp -r apps/api/node_modules/better-sqlite3/ "$RESOURCES/node_modules/better-sqlite3/"

echo "==> Restoring native modules for local dev (system Node.js)..."
cd "$REPO_ROOT/node_modules/.pnpm/better-sqlite3@"*/node_modules/better-sqlite3 && npm rebuild --silent
cd "$REPO_ROOT"

if [[ "${1:-}" == "--all" ]]; then
  echo "==> Building web..."
  pnpm --filter @open-query/web build
  echo "==> Patching web..."
  rsync -a --delete apps/web/.next/standalone/ "$RESOURCES/web/"
  rsync -a --delete apps/web/.next/static/    "$RESOURCES/web/apps/web/.next/static/"
  rsync -a --delete apps/web/public/          "$RESOURCES/web/apps/web/public/"
fi

echo "==> Launching app..."
open "$APP"

echo "==> Tailing log (Ctrl+C to stop)..."
sleep 3
tail -n 50 -f "$LOG"
