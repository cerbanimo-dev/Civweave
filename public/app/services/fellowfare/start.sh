#!/usr/bin/env sh
set -eu
PORT="${PORT:-4173}"
printf '\nFellowfare is starting on http://0.0.0.0:%s\n' "$PORT"
printf 'Open http://localhost:%s on this device. For another device on your LAN, use this machine\047s local IP.\n\n' "$PORT"
if command -v node >/dev/null 2>&1; then
  exec node server.mjs "$PORT"
elif command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 0.0.0.0
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT" --bind 0.0.0.0
else
  echo "Node.js or Python 3 is required for the bundled zero-install server." >&2
  exit 1
fi
