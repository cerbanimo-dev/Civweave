#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
downloads_dir="$repo_dir/public/downloads"
seed_path="$downloads_dir/commonweave-pocket-campus.cwseed"
kit_path="$downloads_dir/Commonweave-Mobile-Install-Kit.zip"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

rm -f "$seed_path"
# The pocket seed carries the SmolLM2 adapter, prompt/fallback contract,
# tokenizer metadata, and staged Transformers.js runtime, but not the 273 MB
# ONNX graph. The graph is acquired on first onboard-model use and retained in
# the PWA cache. Model-bearing field bundles can be produced separately.
(cd "$repo_dir/public/app" && zip -q -r -9 "$seed_path" . \
  -x 'models/smollm2-360m-instruct/onnx/*.onnx' \
     'models/smollm2-360m-instruct/onnx/*.onnx_data')

unzip -q "$kit_path" -d "$work_dir/kit"
kit_root="$(find "$work_dir/kit" -mindepth 1 -maxdepth 1 -type d -print -quit)"
if [[ -z "$kit_root" ]]; then
  echo "Install kit root directory not found" >&2
  exit 1
fi

cp "$seed_path" "$kit_root/commonweave-pocket-campus.cwseed"
sha256sum "$seed_path" | sed 's#  .*/#  #' > "$kit_root/commonweave-pocket-campus.cwseed.sha256"
rm -f "$kit_path"
(cd "$work_dir/kit" && zip -q -r -9 "$kit_path" "$(basename "$kit_root")")

echo "Built $(basename "$seed_path") without the SmolLM2 graph and rebuilt $(basename "$kit_path")"
