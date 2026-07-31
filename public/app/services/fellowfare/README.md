# Fellowfare Standalone PWA

**Version 0.3.0 · Exchange Ledger**

Fellowfare is a local-first market for asking, offering, trading, lending, hiring, gifting, assembling multi-person solutions, and carrying accepted arrangements through fulfillment.

The application has no required runtime dependencies beyond a modern browser and either Node.js 18+ or Python 3 for the included static server. Market data remains in browser storage unless the user explicitly exports or shares it.

## Run it

### Android / Termux, Linux, or macOS

```sh
unzip Fellowfare-Standalone-MVP-v0.3.0-exchange-ledger.zip
cd Fellowfare-Standalone-MVP-v0.3.0-exchange-ledger
./start.sh
```

Open `http://localhost:4173`.

To use Fellowfare from another device on the same network, open the LAN address printed by the launcher. PWA installation requires localhost or HTTPS.

### Windows

Unzip the archive, open its folder, and run `start.cmd`. Then open `http://localhost:4173`.

## Critical product loop

1. Post a need, offer, or collective demand thread.
2. Search, save, message, or ask Loom for semantic matches.
3. Send, accept, or decline a proposal.
4. Convert an accepted proposal into a portable agreement.
5. Confirm human participation and split fulfillment into milestones.
6. Attach evidence notes, links, receipt references, or photo references.
7. Record cash, barter, gift, credit, loan, or waived settlement without processing money.
8. Open a repair path when fulfillment falls short.
9. Record contextual trust after settlement.
10. Reopen recurring agreements as clean new cycles.

## Fellowfare Loom

Loom supports deterministic offline assistance, OpenAI-compatible or local endpoints, and Gemini `generateContent`.

It can shape natural language into market threads, find complete and partial matches, propose multi-person assemblies, review clarity and fairness, draft proposals, surface provider capabilities, and identify unmet demand.

Loom cannot publish, accept, message, confirm, pay, rate, expose location, or commit another person.

## Exchange Ledger

The v0.3 domain layer lives in `ledger.js` and covers:

- agreements created from accepted proposals
- participant confirmations
- milestones and due dates
- evidence custody references
- settlement records
- recurring cycles
- repair and resolution paths
- scoped trust attestations
- append-oriented ledger events

Evidence files are not uploaded or embedded. The MVP stores notes and references so users retain control of sensitive material.

## Commonweave bridge

Use **You → Commonweave bridge bundle** or **Exchange Desk → Export Commonweave bundle**.

The resulting `commonweave.exchange-bundle` follows `schemas/commonweave-exchange-bundle.schema.json`. Integration guidance is in `COMMONWEAVE_BRIDGE.md`.

The bundle maps Fellowfare threads, proposals, assemblies, agreements, milestones, evidence, settlements, and reviews into domain-level Commonweave concepts. AI API keys are excluded.

## Test suite

```sh
npm run check
```

The suite covers static PWA integrity, deterministic Loom behavior, the exchange-ledger lifecycle, route rendering and click flows, secret stripping, and mock OpenAI-compatible and Gemini bridges.

## Boundaries

Fellowfare v0.3.0 does not provide hosted accounts, remote synchronization, identity verification, legal contracting, payment processing, escrow, automatic dispute judgments, or guaranteed delivery. Settlement records describe what participants report; they do not move funds.
