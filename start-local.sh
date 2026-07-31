#!/usr/bin/env sh
set -eu
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8787}"
export DATA_DIR="${DATA_DIR:-./data}"
echo "Starting Commonweave Host Node on http://0.0.0.0:${PORT}"
node server.mjs
