#!/bin/sh
set -eu

export TRACK_BINOCLE_IN_DOCKER=1
git config --global --add safe.directory /workspace 2>/dev/null || true

APP_DIR=/workspace
STAMP_DIR="$APP_DIR/node_modules/.cache"
STAMP="$STAMP_DIR/pnpm-deps.sha256"

cd "$APP_DIR"

if [ ! -f "$APP_DIR/pnpm-lock.yaml" ] && [ -f "$APP_DIR/package-lock.json" ]; then
  echo "[entrypoint] Migrating app lock file: package-lock.json → pnpm-lock.yaml ..."
  pnpm import
fi

current_hash="$({ cat package.json pnpm-lock.yaml; } | sha256sum | awk '{print $1}')"
cached_hash=""

if [ -f "$STAMP" ]; then
  cached_hash="$(cat "$STAMP")"
fi

if [ ! -d node_modules ] || [ "$cached_hash" != "$current_hash" ]; then
  echo "[entrypoint] Installing opposite-osiris dependencies in Docker volume..."
  pnpm install --frozen-lockfile --ignore-scripts
  mkdir -p "$STAMP_DIR"
  printf '%s' "$current_hash" > "$STAMP"
  echo "[entrypoint] Dependencies ready."
else
  echo "[entrypoint] Dependencies up to date."
fi

exec "$@"
