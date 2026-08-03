#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
downloads_dir="$repo_dir/public/downloads"
seed_path="$downloads_dir/commonweave-pocket-campus.cwseed"
kit_path="$downloads_dir/Commonweave-Mobile-Install-Kit.zip"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

rm -f "$seed_path"
# Cabinet Mode ships the five cabinet shells and the Commonweave hub scene.
# The superseded per-room visual-location trees remain source-side archives and
# are excluded from the current seed/install payload. MiniLM ONNX graphs are
# also materialized on the user's device rather than bundled in this archive.
(cd "$repo_dir/public/app" && zip -q -r -9 "$seed_path" . \
  -x 'models/all-minilm-l6-v2/onnx/*.onnx' \
     'models/all-minilm-l6-v2/onnx/*.onnx_data' \
     'models/smollm2-360m-instruct/onnx/*.onnx' \
     'models/smollm2-360m-instruct/onnx/*.onnx_data' \
     'services/living-school/visual-assets/*' \
     'services/living-school/visual-assets/**' \
     'services/cerbanimo/assets/visual/*' \
     'services/cerbanimo/assets/visual/**' \
     'services/fellowfare/assets/mall/*' \
     'services/fellowfare/assets/mall/**' \
     'services/anarchadia/assets/screens/*' \
     'services/anarchadia/assets/screens/**')

# Guard the release boundary. The hub and cabinet shells are required, while
# no archived location-scene path may leak into the downloadable seed.
unzip -l "$seed_path" > "$work_dir/seed-files.txt"
grep -q 'assets/world/town-square-home.webp' "$work_dir/seed-files.txt"
for cabinet in commonweave living-school cerbanimo fellowfare anarchadia; do
  grep -q "assets/cabinets/${cabinet}.webp" "$work_dir/seed-files.txt"
done
if grep -Eq 'services/living-school/visual-assets/|services/cerbanimo/assets/visual/|services/fellowfare/assets/mall/|services/anarchadia/assets/screens/' "$work_dir/seed-files.txt"; then
  echo 'Archived visual-location images leaked into the Cabinet Mode seed.' >&2
  exit 1
fi

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

echo "Built $(basename "$seed_path") for Cabinet Mode without archived location scenes or optional local model graphs, then rebuilt $(basename "$kit_path")"
