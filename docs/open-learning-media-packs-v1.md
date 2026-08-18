# Open Learning Media Packs v1

Civweave's Open Learning Media library is driven by one pack registry instead of hard-coded topic lists.

## Core pack

**General Knowledge** is the default foundation. It covers world history, geography, civics, biology, physics, chemistry, astronomy, mathematics, computing, arts and culture, health and wellness, and philosophy and ethics.

Every core topic must retain at least one selected, redistributable record before a refreshed catalog can publish.

## Extension packs

- **Digital & AI Literacy**: computing basics, vibe coding, prompt engineering, pseudocoding, critical thinking/media literacy, and logic/systems thinking.
- **Practical Life**: personal finance, cooking and food safety, health and wellness, computing basics, and statistics/data literacy.
- **Creative Studio**: arts/culture, drawing/design, and photography/video.
- **Civic & Media Literacy**: critical thinking, civics, statistics/data literacy, climate/environment, and law/rights.
- **Deep Science**: biology, physics, chemistry, astronomy, and climate/environment.
- **Humanities & Culture**: world history, geography, arts/culture, civics, philosophy/ethics, and law/rights.
- Subject-pack expansion adds Tarot & Symbolic Practice, Mind & Body Practice, Relationships & Care, Garden & Nature, Career & Enterprise, Music & Performance, Language Learning, Systems & Decision Making, Home & Independence, Hands-on Maker, Environment & Resilience, Visual Storytelling, Society & Rights, and Technology Builder when their quality/coverage gates pass.

Packs share the same content-addressed catalog and cache, so overlapping topics do not duplicate downloaded media.

## Quality policy

The canonical registry is `config/open-learning-media-packs-v1.json`.

The harvest uses Wikimedia Commons, PeerTube/Sepia Search, and explicitly licensed Internet Archive media under the existing conservative redistribution policy.

Automatic selections pass deterministic relevance, pedagogy, selection-confidence, title-anchor, and subject-collision gates. A title that happens to reuse a subject word in another domain (for example software “parenting,” software “gardening,” or a Tarot-named video game) must not count as coverage.

Required topics fail closed when redistributable coverage disappears. Extension packs must meet the configured topic-coverage floor before publication. Discovery lanes may remain present without being treated as downloadable coverage until they have trustworthy material.

## Installation behavior

Manual pack selection is no longer required. After Civweave installation is confirmed, every currently available pack enters a sequential idle-time queue. The queue caches one compact approved video per unique topic, deduplicates overlapping topics across packs, requests persistent browser storage when available, and resumes from a catalog-scoped receipt after interruption.

The automatic queue respects the active storage profile, the cache budget, the existing automatic per-item size limit, revocations, SHA-256 verification, and redistribution licensing. Offline, Save-Data, and very-slow-network conditions pause the queue instead of forcing background traffic. The **Minimal** storage profile remains an explicit opt-out from automatic media-file downloads.

The General Knowledge outage control remains available as an explicit stronger action and pins up to two compact items per topic. Clearing the optional media cache clears the automatic receipt so eligible content can rebuild later.

Video Learning Atlas bundles are separate lightweight link/metadata ZIPs rather than video files. All published atlas ZIPs and current YouTube metadata/availability sidecars are also queued lazily after install, so selecting individual knowledge schools is not required to make the link catalog available offline.
