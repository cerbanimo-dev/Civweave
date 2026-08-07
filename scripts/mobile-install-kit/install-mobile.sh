#!/usr/bin/env bash
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_URL="${CIVWEAVE_SOURCE_URL:-https://civweave-host-node.onrender.com}"
SOURCE_URL="${SOURCE_URL%/}"
PORT="${CIVWEAVE_PORT:-8790}"
PREFIX_DIR="${PREFIX:-$HOME/.local}"
INSTALL_ROOT="${CIVWEAVE_HOME:-$PREFIX_DIR/var/lib/civweave}"
SITE_DIR="$INSTALL_ROOT/site"
STAGE_DIR="$INSTALL_ROOT/site.next.$$"
BACKUP_DIR="$INSTALL_ROOT/site.previous"
ASSET_LIST="$KIT_DIR/core-assets.txt"
WORKER_CORE_LIST="$KIT_DIR/service-worker-core.txt"
SERVER_SOURCE="$KIT_DIR/serve-civweave.py"

fail() { printf 'Civweave install failed: %s\n' "$*" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || fail 'curl is required. In Termux run: pkg install -y curl'
command -v python3 >/dev/null 2>&1 || fail 'python3 is required. In Termux run: pkg install -y python'
[[ -f "$ASSET_LIST" ]] || fail 'core-assets.txt is missing from the install kit.'
[[ -f "$WORKER_CORE_LIST" ]] || fail 'service-worker-core.txt is missing from the install kit.'
[[ -f "$SERVER_SOURCE" ]] || fail 'serve-civweave.py is missing from the install kit.'
[[ "$PORT" =~ ^[0-9]+$ ]] || fail 'CIVWEAVE_PORT must be a number.'

mkdir -p "$INSTALL_ROOT"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cleanup() { rm -rf "$STAGE_DIR"; }
trap cleanup EXIT

printf 'Installing the current Civweave core from %s\n' "$SOURCE_URL"
count=0
while IFS= read -r asset || [[ -n "$asset" ]]; do
  [[ -z "$asset" || "$asset" == \#* ]] && continue
  [[ "$asset" == /* ]] || fail "Invalid asset path: $asset"
  [[ "$asset" != *'..'* ]] || fail "Unsafe asset path: $asset"
  target="$STAGE_DIR$asset"
  mkdir -p "$(dirname "$target")"
  curl --fail --location --silent --show-error --retry 3 --retry-delay 1 \
    -H 'x-civweave-package: mobile-install-kit' \
    "$SOURCE_URL$asset" -o "$target"
  [[ -s "$target" ]] || fail "Downloaded an empty asset: $asset"
  count=$((count + 1))
done < "$ASSET_LIST"

python3 - "$STAGE_DIR/service-worker.js" "$WORKER_CORE_LIST" <<'PY'
import ast
import pathlib
import re
import sys

worker = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
expected = [line.strip() for line in pathlib.Path(sys.argv[2]).read_text(encoding='utf-8').splitlines() if line.strip() and not line.startswith('#')]
match = re.search(r"const CORE=\[(.*?)\];", worker, flags=re.S)
if not match:
    raise SystemExit('Downloaded service worker does not expose the current CORE asset list.')
actual = ast.literal_eval('[' + match.group(1).replace("'", '"') + ']')
if actual != expected:
    missing = [item for item in actual if item not in expected]
    stale = [item for item in expected if item not in actual]
    raise SystemExit(f'Install kit asset list no longer matches the source release. Missing from kit: {missing}; retired in source: {stale}. Download the newest install kit.')
PY

cp "$SERVER_SOURCE" "$INSTALL_ROOT/serve-civweave.py"
printf '%s\n' "$SOURCE_URL" > "$INSTALL_ROOT/source-url"
printf '%s\n' "$PORT" > "$INSTALL_ROOT/port"

cat > "$INSTALL_ROOT/start-civweave.sh" <<'START'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${CIVWEAVE_PORT:-$(cat "$ROOT/port" 2>/dev/null || printf '8790')}"
SOURCE_URL="${CIVWEAVE_SOURCE_URL:-$(cat "$ROOT/source-url" 2>/dev/null || printf 'https://civweave-host-node.onrender.com')}"
PID_FILE="$ROOT/civweave.pid"
LOG_FILE="$ROOT/civweave.log"
if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    printf 'Civweave is already running at http://127.0.0.1:%s/\n' "$PORT"
    exit 0
  fi
  rm -f "$PID_FILE"
fi
nohup python3 "$ROOT/serve-civweave.py" --root "$ROOT/site" --host 127.0.0.1 --port "$PORT" --source "$SOURCE_URL" >> "$LOG_FILE" 2>&1 &
printf '%s\n' "$!" > "$PID_FILE"
sleep 0.4
if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  cat "$LOG_FILE" >&2 || true
  exit 1
fi
printf 'Civweave is running at http://127.0.0.1:%s/app/installed-entry-v146.html\n' "$PORT"
START

cat > "$INSTALL_ROOT/stop-civweave.sh" <<'STOP'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT/civweave.pid"
if [[ ! -f "$PID_FILE" ]]; then
  printf 'Civweave is not running.\n'
  exit 0
fi
pid="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
fi
rm -f "$PID_FILE"
printf 'Civweave stopped.\n'
STOP
chmod +x "$INSTALL_ROOT/start-civweave.sh" "$INSTALL_ROOT/stop-civweave.sh"

rm -rf "$BACKUP_DIR"
if [[ -d "$SITE_DIR" ]]; then mv "$SITE_DIR" "$BACKUP_DIR"; fi
mv "$STAGE_DIR" "$SITE_DIR"
trap - EXIT

"$INSTALL_ROOT/start-civweave.sh"
APP_URL="http://127.0.0.1:$PORT/app/installed-entry-v146.html"
if command -v termux-open-url >/dev/null 2>&1; then termux-open-url "$APP_URL" >/dev/null 2>&1 || true; fi
printf '\nInstalled %s current core files.\nOpen: %s\n' "$count" "$APP_URL"
printf 'Rerun this installer to update. Optional MiniLM model files remain deferred until enabled.\n'
