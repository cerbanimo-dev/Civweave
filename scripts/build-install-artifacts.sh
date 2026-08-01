#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
downloads_dir="$repo_dir/public/downloads"
seed_path="$downloads_dir/commonweave-pocket-campus.cwseed"
kit_path="$downloads_dir/Commonweave-Mobile-Install-Kit.zip"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

rm -f "$seed_path"
(cd "$repo_dir/public/app" && zip -q -r -9 "$seed_path" .)

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

echo "Built $(basename "$seed_path") and $(basename "$kit_path")"
