#!/bin/bash
# macOS, optional: gives Cuisine its own name on your tailnet, such as cuisine.<tailnet>.ts.net.
# Only needed when the server's machine also runs other web apps. Safari seems to keep one home
# screen icon per hostname whatever the port, so apps sharing a name end up with each other's icons.
#
# It runs a second Tailscale node as your own user, in its own folder with its own socket. Your main
# Tailscale and the `tailscale` command are left alone. Run it again after signing in, to finish.
#   scripts/install-own-address.sh [name]    (default: cuisine)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="${1:-cuisine}"
HOME_DIR="$HOME/Library/Application Support/Cuisine Tailnet"
SOCKET="$HOME_DIR/tailscaled.sock"
BIN="$HOME_DIR/bin"

env_value() { grep -E "^$1=" "$ROOT/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- || true; }
BASE="$(env_value CUISINE_SERVICE_LABEL)"
LABEL="${BASE:-local.cuisine}-tailnet"
PORT="$(env_value PORT)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$BIN" "$HOME_DIR/state"
if [ ! -x "$BIN/tailscaled" ]; then
  # The bottle's binaries, unpacked here: `brew install` would put a second `tailscale` on the PATH.
  brew fetch --formula tailscale >/dev/null
  tar xzf "$(brew --cache --formula tailscale)" -C "$BIN" --strip-components=3 '*/bin/tailscale' '*/bin/tailscaled'
fi

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$BIN/tailscaled</string>
    <string>--tun=userspace-networking</string>
    <string>--statedir=$HOME_DIR/state</string>
    <string>--socket=$SOCKET</string>
    <string>--port=0</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/cuisine-tailnet.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/cuisine-tailnet.log</string>
</dict>
</plist>
PLIST
launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || launchctl bootstrap "gui/$(id -u)" "$PLIST"

ts() { "$BIN/tailscale" --socket="$SOCKET" "$@"; }
for _ in $(seq 1 20); do [ -S "$SOCKET" ] && break; sleep 0.5; done

# Prints a sign-in link until someone has used it, then returns.
if ! ts up --hostname="$NAME" --accept-dns=false --accept-routes=false --timeout=20s; then
  echo "Sign in with the link above, then run this again." >&2
  exit 1
fi
ts serve --bg --https=443 "http://127.0.0.1:${PORT:-2847}"
ADDRESS="$(ts status --json | python3 -c "import json,sys; print(json.load(sys.stdin)['Self']['DNSName'].rstrip('.'))")"
echo "Cuisine's own address: https://$ADDRESS"
echo "Set PUBLIC_URL=https://$ADDRESS in .env, then run npm run service."
