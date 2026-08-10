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

Packs share the same content-addressed catalog and cache, so overlapping topics do not duplicate downloaded media.

## Quality policy

The canonical registry is `config/open-learning-media-packs-v1.json`.

The harvest uses Wikimedia Commons, PeerTube/Sepia Search, and explicitly licensed Internet Archive media under the existing conservative redistribution policy.

Automatic selections pass four deterministic gates:

1. topic relevance;
2. pedagogical intent;
3. automatic-selection confidence;
4. a topic-specific title anchor, so the title itself visibly supports the selected subject.

Required topics fail closed when redistributable coverage disappears. Extension packs must meet the configured topic-coverage floor before publication.

Emergency preparedness, home maintenance, career/work skills, electronics, woodworking, and sewing/textiles remain discovery lanes. They are not promoted into an installable pack until the strict quality and redistribution gates find enough useful material.

## Installation behavior

The installer reads pack metadata from generated `lookup.json`. A starter pack caches one compact item per topic. The General Knowledge outage pack can pin two items per topic. Existing storage profiles still bound the optional media cache.
