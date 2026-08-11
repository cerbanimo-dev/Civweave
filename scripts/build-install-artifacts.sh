#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$repo_dir/scripts/apply-confidence-weighted-validation-v1-safe.mjs" ]]; then
  node "$repo_dir/scripts/apply-confidence-weighted-validation-v1-safe.mjs"
else
  echo "[Civweave] Confidence-weighted validation transform is not present on this branch; current main supplies it at merge time."
fi
node "$repo_dir/scripts/sync-release-version-assets.mjs"
node "$repo_dir/scripts/sync-release-coherence-v220.mjs"
node "$repo_dir/scripts/generate-asset-lockboard-catalog-v239.mjs"
node "$repo_dir/scripts/materialize-parity-ledger.mjs"
node "$repo_dir/scripts/build-civweave-map-v1.mjs"
node "$repo_dir/scripts/generate-prelive-metadata-v281.mjs"
node "$repo_dir/scripts/sync-core-labor-package-v1.mjs"
node "$repo_dir/scripts/smoke-installer-resume-state-v280.mjs"
node "$repo_dir/scripts/smoke-installer-hardening-v281.mjs"
node "$repo_dir/scripts/build-mobile-install-kit.mjs"
