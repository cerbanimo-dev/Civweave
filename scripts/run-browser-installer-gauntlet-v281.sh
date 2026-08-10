#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

node scripts/sync-release-version-assets.mjs
node scripts/sync-release-coherence-v220.mjs
node scripts/generate-prelive-metadata-v281.mjs
node scripts/smoke-installer-resume-state-v280.mjs
node scripts/smoke-installer-hardening-v281.mjs

if ! node -e "import('playwright').catch(()=>process.exit(1))" >/dev/null 2>&1; then
  npm install --no-save --ignore-scripts playwright@1.55.0
fi
npx playwright install chromium
node scripts/browser-installer-gauntlet-v281.mjs
