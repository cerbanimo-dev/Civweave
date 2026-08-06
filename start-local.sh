#!/usr/bin/env sh
set -eu
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8787}"
export DATA_DIR="${DATA_DIR:-./data}"
echo "Starting Civweave v1.0.27 clean-slate host on http://0.0.0.0:${PORT}"
node server-v127.mjs
