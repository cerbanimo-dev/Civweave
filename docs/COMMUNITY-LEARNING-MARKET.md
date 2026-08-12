# Civweave Community Learning Market v1

Living School learning products sold through FellowFare remain interactive curriculum objects. They are not rendered, flattened, or exported as PDFs.

## Creator flow

A Living School curriculum becomes eligible for marketplace publication only after the creator has actually tried it:

- every module lesson is complete;
- every module has at least one assessment attempt;
- every module assessment is passed.

When that trial gate is satisfied, Living School exposes a **Sell / Tutor** action. The creator may publish the tested curriculum for an Acorn price and may optionally create a linked tutoring offer priced in USD, Buttons, or both.

## Interactive package contract

Marketplace learning products use `civweave.interactive-learning-package.v1`. The package carries the normalized Living School `school` object rather than a document representation. This preserves the same structures Living School already renders and executes, including:

- lesson blocks and concepts;
- practice exercises, steps, deliverables, and rubrics;
- quiz and test banks, scoring thresholds, explanations, and remediation;
- visualizations and navigation metadata;
- completion criteria, badges, skill XP metadata, and Cerbanimo practice handoffs;
- source and provenance references;
- video and Open Learning Media metadata, licensing, attribution, and content hashes.

The creator's learner state is deliberately not part of the product. Attempts, evidence, completion state, practicum state, final-test results, credentials, and other personal progress do not transfer to a buyer.

Runtime-local `blob:` media URLs are never treated as portable identifiers. The package strips those dead URLs while retaining the media record key, content hash, topic, source, license, and attribution. The receiving Living School instance can resolve or cache the media again through its normal media contract.

## Purchase and installation

An interactive-learning listing in FellowFare is priced in Acorns. A purchase records an Acorn spend against the canonical Civweave reward ledger and creates a purchase receipt. The curriculum is then installed into the buyer's Living School community library.

Opening the purchased curriculum creates a fresh learner instance:

- the curriculum content stays intact;
- learner progress starts empty;
- quiz and test attempts start empty;
- final-test and credential state reset;
- the Living School project gate starts from its initial state;
- the package origin, seller identity, content hash, and FellowFare listing are retained as provenance.

The author can install their own published package for testing without charging themselves Acorns.

## Tutoring

A creator may publish a `tutoring-service` listing linked to the same tested curriculum. The listing can carry a USD price, Button price, price unit, and availability.

Requesting tutoring does not automatically book or settle anything. FellowFare creates a normal editable learning-service need so buyer and tutor can negotiate scope, timing, and exchange terms through the existing proposal and agreement flow.

## Local-first settlement boundary

The community-learning store is local-first and emits outbox records for listings, purchases, and tutor requests. Buyer-side Acorn spend can be recorded immediately by the canonical local reward ledger. Cross-passport seller settlement requires the host/mesh settlement layer to consume the outbox and issue the corresponding seller receipt exactly once.

Until that network settlement is acknowledged, a purchase is marked `pending-network-settlement` for the seller side. The local UI must not pretend that a remote seller payout has already happened.

## Main implementation files

- `public/app/shared/community-learning-market-v1.mjs`
- `public/app/living-school-fellowfare-publish-v1.mjs`
- `public/app/services/fellowfare/community-learning-market-v1.mjs`
- `scripts/verify-community-learning-market-v1.mjs`
