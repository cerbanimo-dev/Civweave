# Japanese localization v2

Japanese mode is a display-layer localization. Canonical route ids, storage keys, ledger ids, and system ids stay language-neutral.

## Brand names

- Civweave: `民織 / シヴウィーヴ / Civweave`
- Living School: `生学舎 / リビング・スクール / Living School`
- Cerbanimo: `神織 / セルバニモ / Cerbanimo`
- FellowFare: `共市 / フェローフェア / FellowFare`
- Anarchadia: `自治郷 / アナーケイディア / Anarchadia`

The coined kanji names are presentation choices, not migrations. They can be revised later without changing system identity.

## Translation boundary

Japanese v2 translates application-owned UI copy, including headings, controls, form labels and options, placeholders, accessibility labels, live status text, and common dynamic templates. It does not rewrite user-entered form values, user-authored chat messages, contenteditable text, or surfaces explicitly marked as user content.

The saved language preference remains `civweave.language.v1`, and `/ja/` remains the shareable Japanese install/test entry.

The release candidate is rebuilt from the current `main` before materialization, then validated again on GitHub's pull-request merge ref before merge.
