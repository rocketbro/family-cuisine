#!/bin/bash
# macOS only: builds the app and (re)installs the LaunchAgent that keeps Cuisine running.
# On Linux, see the systemd unit in the README.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$(uname)" != "Darwin" ]; then
  echo "npm run service sets up a macOS LaunchAgent. On Linux, use the systemd unit in the README, or npm start." >&2
  exit 1
fi

# One setting from .env, read as data rather than run as a script. The environment wins, as it does for Node.
env_value() {
  local value
  value="$(grep -E "^$1=" "$ROOT/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)"
  value="${value%\"}"; value="${value#\"}"
  printf '%s' "$value"
}

LABEL="${CUISINE_SERVICE_LABEL:-$(env_value CUISINE_SERVICE_LABEL)}"
LABEL="${LABEL:-local.cuisine}"
PORT_SHOWN="${PORT:-$(env_value PORT)}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

# Installing under a second name would start a second copy fighting for the same port and data.
for existing in "$HOME"/Library/LaunchAgents/*.plist; do
  [ -e "$existing" ] && [ "$existing" != "$PLIST" ] || continue
  if grep -q "<string>$ROOT/scripts/serve.sh</string>" "$existing"; then
    echo "This checkout already runs as $(basename "$existing" .plist). Add CUISINE_SERVICE_LABEL=$(basename "$existing" .plist) to .env, or remove that agent first." >&2
    exit 1
  fi
done

NODE="$(command -v node || true)"
if [ -z "$NODE" ] || ! "$NODE" -e 'process.exit(parseInt(process.versions.node) >= 24 ? 0 : 1)'; then
  echo "Cuisine needs Node 24 or newer on your PATH." >&2
  exit 1
fi

cd "$ROOT" && npm run build
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$ROOT/scripts/serve.sh</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$NODE"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/cuisine.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/cuisine.log</string>
</dict>
</plist>
PLIST
# bootout returns before the old process is gone; bootstrapping too soon fails with
# "Input/output error". Wait for the unload, then retry briefly.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
for _ in $(seq 1 20); do
  launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || break
  sleep 0.5
done
for attempt in 1 2 3 4 5; do
  launchctl bootstrap "gui/$(id -u)" "$PLIST" && break
  [ "$attempt" = 5 ] && { echo "Couldn't start $LABEL; see ~/Library/Logs/cuisine.log" >&2; exit 1; }
  sleep 1
done
echo "Cuisine is running as $LABEL on http://127.0.0.1:${PORT_SHOWN:-2847} (logs: ~/Library/Logs/cuisine.log)"
