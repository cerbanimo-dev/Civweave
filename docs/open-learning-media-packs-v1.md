# Open Learning Media Packs v1

Civweave's Open Learning Media library is registry-driven rather than hard-coded to the original five launch topics.

## Core pack

**General Knowledge** is the default broad foundation. It spans world history, geography, civics, biology, physics, chemistry, astronomy, mathematics, computing, arts and culture, health and wellness, and philosophy and ethics.

The core pack is a launch invariant: every topic must retain at least one selected, rights-cleared, mesh-redistributable media record before a refreshed catalog is publishable.

## Extension packs

- **Digital & AI Literacy**: computing basics, vibe coding, prompt engineering, pseudocoding, critical thinking/media literacy, and logic/systems thinking.
- **Practical Life**: personal finance, cooking and food safety, health and wellness, computing basics, and statistics/data literacy.
- **Maker & Creative Studio**: electronics, woodworking, sewing/textiles, drawing/design, and photography/video.
- **Civic & Media Literacy**: critical thinking, civics, statistics/data literacy, climate/environment, and law/rights.
- **Deep Science**: biology, physics, chemistry, astronomy, and climate/environment.
- **Humanities & Culture**: world history, geography, arts/culture, civics, philosophy/ethics, and law/rights.

Extension packs may share topic nodes. The catalog stores media once and exposes it through every relevant pack, so overlapping packs do not duplicate cached binaries.

## Coverage policy

The canonical registry lives at `config/open-learning-media-packs-v1.json`.

The harvester discovers all configured topics from Wikimedia Commons, PeerTube/Sepia Search, and explicitly licensed Internet Archive media using the same conservative rights policy as Open Learning Media v1.

The curation pipeline applies three deterministic gates:

1. topic relevance;
2. pedagogical intent;
3. automatic-selection confidence.

Required topics fail closed if they lose redistributable coverage. Extension packs must meet the configured minimum topic-coverage ratio before publication. Individual extension-only topics can therefore disappear temporarily without blocking the entire weekly harvest.

Emergency preparedness, home maintenance, and career/work skills remain active discovery lanes in the registry, but they are not advertised as part of the installable Practical Life pack until they earn enough strict, redistributable coverage. This preserves useful future expansion without weakening the current quality and rights gates.

## Installation behavior

The installer reads pack metadata from the generated `lookup.json`. Users can cache one compact item per topic from any pack, or pin a two-per-topic General Knowledge outage pack. Storage remains governed by the existing Minimal, Learning Path, Outage Ready, and Archive budgets.

Because packs are topic lists layered over the same content-addressed cache, a video already present for one pack is reused by another pack rather than downloaded twice.
