#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${POCKET_CONSTELLARY_HOME:-$HOME/.local/share/pocket-constellary}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/pocket-constellary"
CONFIG="$CONFIG_DIR/config.json"
BIN_DIR="${PREFIX:-$HOME/.local/bin}/bin"
if [[ -n "${PREFIX:-}" ]]; then BIN_DIR="$PREFIX/bin"; fi
umask 077
[[ -n "$BASE" && "$BASE" != "/" && "$BASE" != "$HOME" ]] || { echo "Unsafe Field Kit home: $BASE" >&2; exit 2; }

if ! command -v pkg >/dev/null 2>&1; then
  echo "This installer is designed for Termux on Android." >&2
  echo "Desktop users can run: python tools/field_server.py" >&2
  exit 1
fi

printf '\nCERBANIMO FIELD KIT 1.5.0 · INTENTION STUDIO\n'
printf '===================================\n'
printf 'Installing the local PWA origin and provider relay.\n\n'

pkg install -y python curl unzip >/dev/null
if ! python -c 'import argon2' >/dev/null 2>&1; then
  echo "Installing Argon2id support for Passport Vaults…"
  python -m pip install --quiet argon2-cffi || echo "Warning: Argon2id install failed; Passport Vaults will use the slower browser PBKDF2 fallback." >&2
fi
if ! command -v llama-server >/dev/null 2>&1; then
  echo "Installing llama.cpp so imported GGUF model packs can run locally…"
  if ! pkg install -y llama-cpp >/dev/null; then
    echo "Warning: llama-cpp could not be installed. The PWA will still work with Ollama and remote providers." >&2
    echo "You can retry later with: pkg install llama-cpp" >&2
  fi
fi
if command -v termux-setup-storage >/dev/null 2>&1 && [[ ! -d "$HOME/storage/downloads" ]]; then
  echo "Android may ask for shared-storage permission. Approve it to simplify updates and backups."
  termux-setup-storage || true
fi

valid_kit_root() {
  local root="$1"
  [[ -f "$root/pwa/index.html" && -f "$root/tools/field_server.py" && -f "$root/tools/party_relay.py" && -f "$root/tools/invite_portal.py" && ( -f "$root/tools/cerbanimo" || -f "$root/tools/constellary" ) ]]
}

safe_extract_zip() {
  python - "$1" "$2" <<'PY'
import pathlib, stat, sys, zipfile
source=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2]).resolve(); total=0
with zipfile.ZipFile(source) as archive:
    members=archive.infolist()
    if len(members)>20000: raise SystemExit("Archive has too many entries")
    for item in members:
        name=item.filename.replace("\\","/")
        dest=(target/name).resolve()
        mode=(item.external_attr>>16)&0o170000
        if not name or name.startswith("/") or (dest != target and target not in dest.parents):
            raise SystemExit("Unsafe archive path")
        if mode==stat.S_IFLNK or item.file_size>512*1024*1024:
            raise SystemExit("Unsafe archive entry")
        total+=item.file_size
        if total>2*1024*1024*1024: raise SystemExit("Archive is too large")
    archive.extractall(target)
PY
}

locate_kit_root() {
  local explicit="${POCKET_CONSTELLARY_SOURCE_DIR:-}"
  local candidate marker root search_base zip temp

  if [[ -n "$explicit" ]] && valid_kit_root "$explicit"; then
    printf '%s\n' "$explicit"
    return 0
  fi

  for candidate in "$SCRIPT_DIR" "$PWD" "$HOME/storage/downloads" "$HOME/downloads"; do
    [[ -d "$candidate" ]] || continue
    if valid_kit_root "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
    marker="$(find "$candidate" -maxdepth 4 -type f -path '*/pwa/index.html' -print -quit 2>/dev/null || true)"
    if [[ -n "$marker" ]]; then
      root="${marker%/pwa/index.html}"
      if valid_kit_root "$root"; then
        printf '%s\n' "$root"
        return 0
      fi
    fi
  done

  for search_base in "$SCRIPT_DIR" "$PWD" "$HOME/storage/downloads" "$HOME/downloads"; do
    [[ -d "$search_base" ]] || continue
    zip="$(find "$search_base" -maxdepth 3 -type f \( -name 'cerbanimo-field-kit-v*.zip' -o -name 'cerbanimo-pocket-constellary-field-kit-v*.zip' \) -print 2>/dev/null | sort -V | tail -n 1)"
    [[ -n "$zip" ]] || continue
    temp="$(mktemp -d "${TMPDIR:-$PREFIX/tmp}/pocket-constellary-install.XXXXXX")"
    safe_extract_zip "$zip" "$temp"
    marker="$(find "$temp" -maxdepth 4 -type f -path '*/pwa/index.html' -print -quit 2>/dev/null || true)"
    if [[ -n "$marker" ]]; then
      root="${marker%/pwa/index.html}"
      if valid_kit_root "$root"; then
        printf '%s\n' "$root"
        return 0
      fi
    fi
    rm -rf "$temp"
  done

  return 1
}

SOURCE_DIR="$(locate_kit_root || true)"
if [[ -z "$SOURCE_DIR" ]]; then
  cat >&2 <<EOF

FIELD KIT FILES NOT FOUND

The installer could not find a complete extracted kit containing:
  pwa/index.html
  tools/field_server.py
  tools/party_relay.py
  tools/cerbanimo
  tools/invite_portal.py

Keep the entire extracted folder together, then run the installer from it:
  cd ~/storage/downloads/cerbanimo-field-kit-v1.7.0-unbroken-thread
  bash install-cerbanimo.sh

You may also point directly to the extracted folder:
  POCKET_CONSTELLARY_SOURCE_DIR=/full/path/to/the/folder bash "$SCRIPT_DIR/$(basename "${BASH_SOURCE[0]}")"
EOF
  exit 1
fi

echo "Using Field Kit files from: $SOURCE_DIR"
mkdir -p "$BASE/app" "$BASE/releases" "$BASE/models" "$BASE/seed" "$CONFIG_DIR" "$BIN_DIR"
rm -rf "$BASE/app"/*
cp -R "$SOURCE_DIR/pwa/." "$BASE/app/"
cp "$SOURCE_DIR/tools/field_server.py" "$BASE/field_server.py"
cp "$SOURCE_DIR/tools/party_relay.py" "$BASE/party_relay.py"
cp "$SOURCE_DIR/tools/invite_portal.py" "$BASE/invite_portal.py"
if [[ -f "$SOURCE_DIR/tools/cerbanimo" ]]; then cp "$SOURCE_DIR/tools/cerbanimo" "$BASE/cerbanimo"; else cp "$SOURCE_DIR/tools/constellary" "$BASE/cerbanimo"; fi
cp "$BASE/cerbanimo" "$BASE/constellary"
[[ -d "$SOURCE_DIR/tools/vendor" ]] && { rm -rf "$BASE/vendor"; cp -R "$SOURCE_DIR/tools/vendor" "$BASE/vendor"; }
if [[ -d "$SOURCE_DIR/seed" ]]; then
  rm -rf "$BASE/seed"
  mkdir -p "$BASE/seed"
  cp -R "$SOURCE_DIR/seed/." "$BASE/seed/"
fi
cp "${BASH_SOURCE[0]}" "$BASE/install-cerbanimo.sh"
for model_source in "$SOURCE_DIR/models" "$SOURCE_DIR/model-pack/models"; do
  if [[ -d "$model_source" ]]; then
    find "$model_source" -maxdepth 1 -type f -name '*.gguf' -exec cp -f {} "$BASE/models/" \;
  fi
done
chmod +x "$BASE/field_server.py" "$BASE/party_relay.py" "$BASE/invite_portal.py" "$BASE/cerbanimo" "$BASE/constellary" "$BASE/install-cerbanimo.sh"

DEFAULT_OLLAMA="${OLLAMA_UPSTREAM:-http://127.0.0.1:11434}"
OLLAMA_VALUE="$DEFAULT_OLLAMA"
if [[ -t 0 && -z "${POCKET_CONSTELLARY_NONINTERACTIVE:-}" ]]; then
  echo
  echo "Ollama endpoint visible from this device."
  echo "Examples: http://127.0.0.1:11434 or http://192.168.1.243:12434"
  read -r -p "Ollama endpoint [$DEFAULT_OLLAMA]: " entered || true
  [[ -n "${entered:-}" ]] && OLLAMA_VALUE="$entered"
fi

python - "$CONFIG" "$OLLAMA_VALUE" "$BASE/models" <<'PY'
import json, pathlib, sys
path=pathlib.Path(sys.argv[1]); ollama=sys.argv[2].rstrip('/'); model_dir=pathlib.Path(sys.argv[3])
existing={}
if path.exists():
    try: existing=json.loads(path.read_text())
    except Exception: existing={}
routes={
    "/ollama": ollama,
    "/compatible": (existing.get("routes") or {}).get("/compatible", ""),
    "/bigmoe": (existing.get("routes") or {}).get("/bigmoe", "http://127.0.0.1:39281"),
    "/gemini": (existing.get("routes") or {}).get("/gemini", "https://generativelanguage.googleapis.com"),
    "/party": (existing.get("routes") or {}).get("/party", "http://127.0.0.1:8790"),
    "/packaged": (existing.get("routes") or {}).get("/packaged", "http://127.0.0.1:8788"),
}
runner=existing.get("model_runner") or {}
models=sorted(model_dir.glob("*.gguf"),key=lambda p:p.name.lower())
default_model_id=models[0].stem if models else runner.get("default_model_id")
config={
    "host": existing.get("host", "127.0.0.1"),
    "port": int(existing.get("port", 8787)),
    "request_timeout_seconds": max(420, int(existing.get("request_timeout_seconds", 420))),
    "party_relay_host": existing.get("party_relay_host", "127.0.0.1"),
    "party_relay_port": int(existing.get("party_relay_port", 8790)),
    "invite_portal_port": int(existing.get("invite_portal_port", 8792)),
    "routes": routes,
    "model_runner": {
        "binary": runner.get("binary", "llama-server"),
        "host": runner.get("host", "127.0.0.1"),
        "port": int(runner.get("port", 8788)),
        "models_dir": runner.get("models_dir", str(pathlib.Path.home()/".local/share/pocket-constellary/models")),
        "startup_timeout_seconds": max(300, int(runner.get("startup_timeout_seconds", 300))),
        "auto_start": True,
        "default_model_id": default_model_id,
        "context": int(runner.get("context", 4096)),
        "extra_args": runner.get("extra_args", []),
    },
}
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps(config,indent=2)+"\n")
PY

if [[ -n "${CERBANIMO_PENDING_INVITE:-}" && -f "${CERBANIMO_PENDING_INVITE}" ]]; then
  cp "${CERBANIMO_PENDING_INVITE}" "$CONFIG_DIR/pending-invite.json"
  echo "Signed invitation staged for first launch."
fi

for name in start stop restart status doctor open url logs backup update relay-start relay-lan relay-connect relay-stop relay-status relay-url model-status model-wake model-logs model-stop model-runtime-install; do
  ln -sf "$BASE/cerbanimo" "$BIN_DIR/cerbanimo-$name"
  ln -sf "$BASE/cerbanimo" "$BIN_DIR/constellary-$name"
done
ln -sf "$BASE/cerbanimo" "$BIN_DIR/cerbanimo"
ln -sf "$BASE/cerbanimo" "$BIN_DIR/constellary"

"$BASE/cerbanimo" stop >/dev/null 2>&1 || true
"$BASE/cerbanimo" start
FIELD_URL="$("$BASE/cerbanimo" url)"

echo
echo "FIELD KIT READY"
echo "Open $FIELD_URL in Chrome, then choose Install app."
echo "For Ollama inside Cerbanimo, use endpoint: /ollama"
echo "Embedded GGUF packs are registered, started, and selected automatically. Imported packs can still be activated in Model Vault."
echo "Shared-project relays are now formed and joined inside Mesh Exchange → Party Link."
echo
echo "Useful recovery and diagnostic commands:"
echo "  cerbanimo-open"
echo "  cerbanimo-doctor"
echo "  cerbanimo-status"
echo "  cerbanimo-stop"
echo "  cerbanimo-relay-start   # advanced fallback; normal relay setup is in the PWA"
echo "  cerbanimo-relay-lan     # advanced trusted-Wi-Fi fallback"
echo "  cerbanimo-relay-connect # advanced manual route override"
echo "  cerbanimo-model-status   # inspect loading stage and readiness"
echo "  cerbanimo-model-wake     # wait for the configured GGUF to become ready"
echo "  cerbanimo-model-logs     # inspect llama-server startup and memory output"
echo "  cerbanimo-model-stop     # unload the packaged model"
echo
echo "Before clearing browser data, use Passport → Export Passport Vault. Store the separate recovery document elsewhere."

if command -v termux-open-url >/dev/null 2>&1 && [[ -t 0 && -z "${POCKET_CONSTELLARY_NO_OPEN:-}" ]]; then
  read -r -p "Open Cerbanimo now? [Y/n]: " answer || true
  if [[ ! "${answer:-}" =~ ^[Nn]$ ]]; then termux-open-url "http://127.0.0.1:8787"; fi
fi
