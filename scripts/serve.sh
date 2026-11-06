#!/bin/bash
# Runs Cuisine as an always-on service, from the LaunchAgent (`npm run service`) or a systemd unit
# (see the README). Services start with a bare PATH, so this finds Node 24 or newer itself.
set -euo pipefail
cd "$(dirname "$0")/.."

new_enough() { "$1" -e 'process.exit(parseInt(process.versions.node) >= 24 ? 0 : 1)' 2>/dev/null; }

NODE=""
for candidate in "$(command -v node || true)" /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.nvm/versions/node/v*/bin/node; do
  if [ -x "$candidate" ] && new_enough "$candidate"; then NODE="$candidate"; break; fi
done
if [ -z "$NODE" ]; then echo "Cuisine needs Node 24 or newer, and none was found." >&2; exit 1; fi

# The usual Homebrew folders too, for ffmpeg.
export PATH="$(dirname "$NODE"):$PATH:/opt/homebrew/bin:/usr/local/bin"
export NODE_ENV=production
exec "$NODE" --env-file-if-exists=.env src/server/main.ts
