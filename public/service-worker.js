'use strict';

// Root-scope compatibility entry for devices that installed Civweave before
// the lightweight v203 worker became canonical. Android can retain a site's
// service-worker registration and CacheStorage after the PWA icon is removed,
// so this path must never contain a frozen historical app shell.
const CIVWEAVE_ROOT_WORKER_BRIDGE='root-worker-bridge-v14-kamiya-transient-provider-failover';

// Compatibility-only package metadata consumed by build-mobile-install-kit.mjs.
// Runtime ownership belongs entirely to service-worker-v203.js below.
const MAP_CORE=[
  '/finder/index.html',
  '/app/hub-map-v1.html',
  '/app/federation-finder-map-v275.html',
  '/app/civweave-hub-map-v1.js',
  '/app/civweave-guild-map-runtime-v2.js',
  '/app/civweave-locality-gossip-v1.js',
  '/app/host-node-session-v1.js',
  '/app/civweave-map-v1-manifest.json',
  '/app/civweave-map-service-v275.js',
  '/app/civweave-map-bootstrap-v1.js',
  '/app/civweave-map-mesh-v276.js',
  '/app/civweave-map-mesh-bridge-v276.js',
  '/app/civweave-map-coverage-v277.js',
  '/app/civweave-map-storage-v1.js',
  '/app/civweave-map-offline-v1.js',
  '/app/civweave-map-ui-v1.js',
  '/app/shared/civweave-map-coverage-scoring-v1.mjs',
  '/app/shared/civweave-sha256-stream-v1.mjs',
  '/app/federation-finder-data/federation-seed-v269.json',
  '/app/vendor/maplibre-v5.13.0/maplibre-gl.js',
  '/app/vendor/maplibre-v5.13.0/maplibre-gl.css',
  '/app/vendor/pmtiles-v4.4.1/pmtiles.js'
];

const CORE=[
  '/index.html','/install-v130.css','/install-v130.js','/offline.html',
  '/app/manifest.webmanifest','/app/installed-entry-v146.html','/app/installed-entry-v146.js','/app/install-boundary-v146.js','/app/local-object-mesh-v146.js','/app/local-first-policy-v131.js',
  '/app/working-campus-v156.html','/app/working-campus-v156.css','/app/working-campus-v156.js','/app/working-campus-v156.part1.txt','/app/working-campus-v156.part2.txt','/app/working-campus-v156.part3.txt','/app/working-campus-v156.part4.txt','/app/working-campus-v156.part5.txt',
  '/app/system-routes-v227.js','/app/persistent-system-context-v1.js','/app/themed-system-nav-v178.js','/app/persistent-shell-actions-v1.js','/app/subsystem-avatar-state-v347.js',
  '/app/guide-chat-surface-v350.js','/app/shared-guide-surface-v236.js','/app/guide-generation-floor-v1.js','/app/guide-stream-thinking-v249.js','/app/local-guide-control-bypass-v1.js','/app/weaveling-plan-materialization-v265.js','/extensions/civweave-weaveling-plan-json-v190.js',
  '/app/server-ai-router-v301.js','/app/server-ai-output-normalizer-v1.js','/app/cerbanimo-chat-quest-capability-v1.js','/app/cerbanimo-chat-quest-capability-v2.js',
  '/app/local-chat-runtime-v295.js','/app/local-provider-authority-v1.js','/app/local-ai/gemma4-inference-repair-v1.js','/app/local-ai/gemma4-litert-fast-extension-v1.js','/app/local-ai/litert-gemma4-fast-runtime-v1.js','/app/local-ai/model-registry-v266.js','/app/local-ai/download-manager-v267.js','/app/local-ai/runtime-v266.js','/app/local-ai/worker-v266.js',
  '/app/family-shell-v104.css','/app/family-shell-v104.js','/app/family-ai-loader-v105.js','/app/weaveling-memory-v191.js','/app/weaveling-memory-bridge-v191.js',
  '/app/model-settings-controller-v173.js','/app/unified-ai-settings-v175.js','/app/deterministic-mode-v175.js','/app/settings-delegation-v175.js','/app/shared-tools-cleanup-v175.js','/app/model-settings-v133.css','/app/shared/civweave-model-runtime.js','/app/safe-mode-v1.mjs',
  '/app/realm-console-v140.css','/app/realm-console-v140.js','/app/cerbanimo-quest-engine-v144.css','/app/cerbanimo-quest-engine-v144.js','/app/cerbanimo-ai-validator-v156.js',
  '/app/cabinets/living-school/living-school-cabinet-v151.css','/app/cabinets/living-school/living-school-cabinet-v151.mjs','/app/services/living-school/modules/rubric-engine.mjs','/app/services/living-school/modules/project-gate.mjs','/app/services/living-school/modules/cerbanimo-bridge.mjs',
  '/app/fellowfare-cabinet-v144.css','/app/fellowfare-cabinet-v144.js',
  '/app/anarchadia-console-v139.css','/app/anarchadia-console-v139.js','/app/anarchadia-cabinet-workbench-v144.js',
  '/app/anarchadia-governance-v145.html','/app/anarchadia-governance-v145.css','/app/anarchadia-governance-v145.js','/app/anarchadia-governance-kernel-v145.js','/app/anarchadia-governance-store-v145.js','/app/anarchadia-governance-bridge-v145.js',
  '/app/anarchadia-sovereignty-v146.html','/app/anarchadia-sovereignty-v146.css','/app/anarchadia-sovereignty-v146.js','/app/anarchadia-sovereignty-kernel-v146.js','/app/anarchadia-local-sovereignty-v146.js','/app/anarchadia-sovereignty-bridge-v146.js',
  '/app/guide-contracts-v141.js','/app/assistant-runtime-v141.js','/app/assistant-runtime-v141.css','/app/core-loop-v152.js','/app/capability-readiness-v154.js','/app/intention-planner-v141.js','/app/intention-ui-v138.js','/app/intention-ui-v138.css',
  '/app/shared/civweave-parity-runtime.js','/app/shared/civweave-parity-ledger.json',
  '/app/services/anarchadia/workbench.html','/app/services/anarchadia/cabinet-workbench-v144.css','/app/services/anarchadia/cabinet-workbench-loader-v144.js','/app/services/anarchadia/styles.css','/app/services/anarchadia/src/app.js','/app/services/anarchadia/src/domain.js','/app/services/anarchadia/src/store.js','/app/services/anarchadia/src/export.js','/app/services/anarchadia/src/ai.js','/app/services/anarchadia/civweave-handoff-consumer.js','/app/services/anarchadia/civweave-presence.js','/app/services/anarchadia/docs/PROVISIONAL_CONSTITUTION.md',
  '/app/services/fellowfare/cabinet.html','/app/services/fellowfare/cabinet-embed.css','/app/services/fellowfare/cabinet-bridge.js','/app/services/fellowfare/styles.css','/app/services/fellowfare/app.js','/app/services/fellowfare/ai.js','/app/services/fellowfare/ledger.js','/app/services/fellowfare/shared/civweave-model-runtime.js','/app/services/fellowfare/civweave-handoff-consumer.js',
  '/app/learning-pack-seeds-v1.js',
  '/app/shared/learning-pack-runtime-v1.mjs',
  '/app/shared/learning-pack-resolver-v1.mjs',
  '/app/shared/learning-pack-shelf-v1.mjs',
  '/app/shared/learning-pack-shelf-v1.css',
  '/app/shared/core-practice-pack-v1.mjs',
  '/app/shared/expert-pack-library-v1.mjs',
  '/app/shared/skill-crosswalk-v1.mjs',
  '/app/shared/labor-intelligence-core-v1.mjs',
  '/app/cerbanimo-learning-packs-v1.js',
  '/app/living-school-learning-packs-v1.mjs',
  '/app/services/fellowfare/labor-context-v1.mjs',
  '/downloads/learning-packs/catalog.json',
  '/downloads/learning-packs/onet-labor-atlas-30-3.json.gz',
  '/downloads/learning-packs/esco-skill-crosswalk-v1.json.gz',
  '/app/logos/civweave.webp','/app/logos/civweave-app-icon.png','/app/logos/cerbanimo.webp','/app/logos/fellowfare-v2.webp','/app/logos/civweave-icon-192.png','/app/logos/civweave-icon-512.png','/app/logos/civweave-icon-maskable-192.png','/app/logos/civweave-icon-maskable-512.png','/app/logos/civweave-pwa-192-v247.png','/app/logos/civweave-prismatic-wordmark-v1.png','/app/logos/cerbanimo-steward-mark-v1.png',
  '/app/assets/ai/weaveling.png','/app/assets/ai/moss.png','/app/assets/ai/kamiya.png','/app/assets/ai/rook.png','/app/assets/ai/merlin.png'
];

self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});

importScripts('/service-worker-v203.js?v=root-worker-bridge-v14-kamiya-transient-provider-failover');