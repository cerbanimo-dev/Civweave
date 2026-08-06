# Civweave v1.0.29 — Cabinet Interface Parity

This release turns the five supplied cabinet/tablet artworks into the actual Civweave Lite interface shells.

## Added

- Dedicated projected workstation shells for Civweave, Living School, Cerbanimo, FellowFare, and Anarchadia.
- Ledger-owned screen rectangles, cabinet assets, secondary accents, motifs, and physical control order.
- All 59 canonical rooms and 117 capabilities now flow through the matching cabinet screen.
- The five illustrated cabinet controls switch between the five systems using accessible shaped hit targets.
- Existing working source applications open inside the active cabinet screen rather than in a detached generic modal.
- System-specific form and data-output themes:
  - illuminated botanical scholarship for Living School;
  - neon industrial quest controls for Cerbanimo;
  - woven market ledgers for FellowFare;
  - highlighter-punk civic controls for Anarchadia;
  - prismatic woven navigation for Civweave.
- Native Civweave Lite forms for model setup, wish intake, clarification, skill posture, three-path generation, weave review, explicit activation, Passport sealing, and rewards display.
- A visible 17-step golden-path tracker generated from the canonical parity ledger.
- Source-surface theme injection for forms, buttons, tables, panels, and focus states.

## Parity behavior

The room and capability hierarchy is unchanged. The cabinet workstation is a renderer around the same canonical IDs used by Visual Civweave. Clicking a capability can either use a native Lite form or open the existing mature working surface inside the same projected display while shared adapters are built.

## Consent

Review and explicit-consent boundaries remain unchanged. Weave activation and Passport sealing require an affirmative checkbox before state is written.

## Validation

`npm run check` verifies:

- 5 systems, 59 rooms, 117 capabilities, and 17 journey steps;
- one cabinet asset and valid screen rectangle per system;
- all cabinet assets are served;
- Lite uses the v1.0.29 cabinet renderer;
- all four working-source bridges receive their system theme;
- Visual routes, legacy redirects, ledger decoding, and host logging still pass.
