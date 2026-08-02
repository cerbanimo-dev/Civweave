# Commonweave Capability-to-Room Parity Ledger

> Canonical endpoint: `/app/shared/commonweave-parity-ledger.json`
>
> Base capability source: `public/app/shared/commonweave-parity-ledger.part1.b64` through `.part4.b64` (lossless gzip-base64)
>
> Cabinet renderer overlay: `public/app/shared/cabinet-shells-v129.json`

Commonweave now has one information architecture and two renderers. As of v1.0.30, the Lite renderer is projected through the same five cabinet shells used as in-world terminal assets:

- **Visual** at `/loom/`, where rooms are illustrated scenes and capabilities open through in-world objects or projections.
- **Lite** at `/lite/`, where the same system, room, and capability IDs appear as accessible forms, ledgers, lists, and working tools projected inside each system’s cabinet screen.

The service applications remain the working implementation sources during migration. They are opened through `/lite/source/<system>/` beneath the canonical room structure rather than treated as competing navigation systems.

## Contract

1. A capability has one canonical ID across both renderers.
2. Visual and Lite share state semantics, consent requirements, handoffs, rewards, and source references.
3. Consequential actions marked `explicit` never run without a visible confirmation step.
4. Visual capability activation begins on an illustrated asset.
5. Lite may be plain, but it must never invent a different hierarchy.
6. A feature is not considered parity-complete until both renderers execute the same operation against the same state contract.
7. Every system owns one `interfaceShell` record defining its cabinet asset, projection rectangle, motif, and physical system controls.

## Current ledger size

- **Systems:** 5
- **Rooms:** 59
- **Capabilities:** 117
- **Golden-path steps:** 17

## Systems and rooms

| System | Guide | Rooms | Capabilities | Visual entry | Lite entry |
|---|---:|---:|---:|---|---|
| Commonweave | Weaveling | 6 | 16 | `/loom/` | `/lite/?system=commonweave` |
| Living School | Moss | 15 | 26 | `/loom/realm/living-school/` | `/lite/?system=living-school` |
| Cerbanimo | Kamiya | 14 | 24 | `/loom/realm/cerbanimo/` | `/lite/?system=cerbanimo` |
| FellowFare | Rook | 15 | 23 | `/loom/realm/fellowfare/` | `/lite/?system=fellowfare` |
| Anarchadia | Merlin | 9 | 28 | `/loom/realm/anarchadia/` | `/lite/?system=anarchadia` |

## Golden path

1. **Set up a model** in Settings Hall (`commonweave.model-setup`)
2. **Tell Weaveling a wish** in Compass Chamber (`commonweave.state-wish`)
3. **Clarify the wish** in Compass Chamber (`commonweave.clarify-wish`)
4. **Choose skill posture** in Compass Chamber (`commonweave.skill-posture`)
5. **Generate the three paths** in Route Board (`commonweave.generate-weave`)
6. **Review and revise the weave** in Route Board (`commonweave.review-weave`)
7. **Activate the weave** in Route Board (`commonweave.activate-weave`)
8. **Start a learning path** in Schoolhouse (`living-school.start-path`)
9. **Follow modules** in Learning Map (`living-school.follow-modules`)
10. **Send work quest to Cerbanimo** in Cerbanimo Bridge (`living-school.send-quest`)
11. **Manage quests** in Mission Room (`cerbanimo.manage-quests`)
12. **Submit work and evidence** in Quest Deck (`cerbanimo.submit-work`)
13. **Settle rewards** in Proof Observatory (`cerbanimo.settle-reward`)
14. **Browse exchange threads** in Marketplace (`fellowfare.browse-threads`)
15. **Accept an agreement** in Exchange Galleria (`fellowfare.accept-agreement`)
16. **Settle an exchange** in Exchange Galleria (`fellowfare.settle-exchange`)
17. **View Acorns and Buttons** in Reward Loom (`commonweave.reward-wallet`)

## Consent vocabulary

- `automatic`: read-only interpretation, guidance, derived indicators, or an already-agreed reward grant.
- `review`: the system may prepare or analyze, but the user reviews before a consequential transition.
- `explicit`: publishing, spending, transferring, accepting, submitting, sealing, or changing shared state requires a deliberate confirmation.

## Migration status model

- `sourceStatus` describes whether the underlying service capability already works.
- `visual.status` describes whether the capability has a canonical illustrated room and interaction host.
- `lite.status` describes whether the same capability is exposed in the Lite hierarchy.
- Renderer mapping is not execution parity. Full parity requires moving the underlying operation behind a shared adapter and state contract.

## Engineering sequence

1. Keep the JSON ledger authoritative and run `npm run check` on every change.
2. Replace source-app iframe bridges one capability cluster at a time with shared adapters.
3. Bind each Visual capability to a shaped hotspot or illustrated instrument.
4. Bind each Lite capability to the same adapter using standard controls.
5. Add shared state-contract tests and remove the corresponding legacy navigation only after both renderers pass.

## Cabinet renderer introduced in v1.0.29

- `public/app/shared/cabinet-shells-v129.json`
- `public/app/assets/cabinets/*.webp` (direct validated cabinet assets)
- `public/app/lite-v129.html` with split `lite-v129-*` style and runtime files
- `public/app/lite-source-v129.css`
- `server-v129.mjs`
- native Commonweave wish-to-weave forms and an in-screen working-source workspace

## Files introduced in v1.0.28

- `public/app/shared/commonweave-parity-ledger.part1.b64` through `.part4.b64` (served as `/app/shared/commonweave-parity-ledger.json`)
- `public/app/shared/commonweave-parity-runtime.js`
- `public/app/lite-v128.html` / `.css` / `.js`
- `public/app/realm-v128.html` / `.js`
- `scripts/verify-parity-ledger.mjs`
- `scripts/smoke-v128.mjs`
- `server-v128.mjs`

## Source baselines

- `Current integrated Commonweave`: Commonweave-main.zip 1.0.27
- `Service reference bundle`: services(1).zip 
- `GitHub source of truth`: cerbanimo-dev/Commonweave main


## v1.0.30 visual-to-workstation convention

Visual rooms no longer navigate automatically into Lite. Each page presents a small cabinet near the bottom center. Its screen reports the number of mapped workstation interactions in the current visual context. Activating it opens the matching Lite system and room as an overlay, while the illustrated room remains in place behind it.

The workstation projection is a strict containment boundary. Content may scroll inside the glass but must not overflow across the cabinet art.
