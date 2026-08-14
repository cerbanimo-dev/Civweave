# Japanese localization v3

Japanese mode is a display-layer localization. Canonical route ids, storage keys, ledger ids, and system ids stay language-neutral.

## Brand names

- Civweave: `民織 / シヴウィーヴ / Civweave`
- Living School: `生学舎 / リビング・スクール / Living School`
- Cerbanimo: `神織 / セルバニモ / Cerbanimo`
- FellowFare: `共市 / フェローフェア / FellowFare`
- Anarchadia: `自治郷 / アナーケイディア / Anarchadia`

The coined kanji names are presentation choices, not migrations. They can be revised later without changing system identity.

## Translation boundary

Japanese v3 translates application-owned UI copy, including headings, controls, form labels and options, placeholders, accessibility labels, live status text, common dynamic templates, Hub onboarding, Passport/passkey account flows, offline map controls, Node AI payment prompts, model settings, and legal/permission surfaces. It does not rewrite user-entered form values, user-authored chat messages, contenteditable text, or surfaces explicitly marked as user content.

Technical and product tokens that Japanese software commonly leaves recognizable, such as WebGPU, WASM, PMTiles, Gemini, Stripe, Spotify, model ids, URLs, protocols, and provider names, may remain in English while the surrounding explanatory copy is localized.

A repository coverage auditor scans likely app-owned visible English strings and compares them with the Japanese catalogs. Audit output is triaged rather than blindly translated so code identifiers, technical names, user content, and generated data do not become false localization work.

The saved language preference remains `civweave.language.v1`, and `/ja/` remains the shareable Japanese install/test entry.

The release candidate is rebuilt from the current `main` before materialization, then validated again on GitHub's pull-request merge ref before merge.
