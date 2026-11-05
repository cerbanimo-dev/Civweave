# Worldweaver Seed Universe v1

Canonical manifest: `public/app/shared/worldweaver-universe-v1.mjs`  
Browser proof: `/app/tools/worldweaver-universe-lab.html`  
Executable contract: `scripts/test-worldweaver-universe-v1.mjs`

## Purpose

The Seed Universe is a portable, deterministic topology above the existing Worldweaver microspace authority. It does not create a second simulator, second Guild authority, second commerce engine, or second learning system.

A Hero enters at **The Threshold**. The visible intention highway has three parallel lanes:

1. **Living School** — learn
2. **Cerbanimo** — build
3. **FellowFare** — exchange

**Anarchadia** is the governance interchange connected to all three lanes rather than a fourth intention lane.

This preserves the distinct authorities of the four systems while making them navigable as one universe.

## Realm mapping

| Realm | Worldweaver guide | Existing microspace kind |
| --- | --- | --- |
| Living School | Moss | `learning-workshop` |
| Cerbanimo | Kamiya | `task-training` |
| FellowFare | Rook | `creator-shop` |
| Anarchadia | Merlin | `convention` |

The manifest includes only bounded metadata, coordinates, station definitions, and portal topology. It contains no executable strings, remote scripts, provider credentials, payment authority, ballot authority, or model inference.

## Seeding

`seedUniverse(worldweaver, options)` calls the existing `createWorldweaver` dispatcher. It creates one microspace for each realm and the realm's canonical stations. It is idempotent against an already-seeded snapshot by matching the guide/title pair and station titles.

Seeding deliberately leaves every realm in `draft`. Provisioning remains the existing reviewed flow:

`draft -> provision-requested -> provisioned/live`

A future DreamGrid/OpenSimulator adapter can map each realm to a region, parcel, or region cluster by acknowledging the normal Worldweaver provisioning request. The universe manifest never claims that a native region already exists.

## Spatial contract

The v1 browser coordinates are planning coordinates, not authoritative simulator coordinates. The origin is The Threshold. Three intention realms sit ahead of it as parallel lanes; Anarchadia sits behind the threshold as the governance interchange.

The browser lab renders two synchronized views from the same manifest:

- a four-realm 3D selection carousel;
- a three-lane intention highway with the Anarchadia interchange.

A native simulator remains free to scale or rotate this arrangement as long as realm identity and portal topology remain intact.

## Authority boundaries

- Living School curriculum remains authoritative in Living School.
- Cerbanimo intention/quest/project state remains authoritative in Cerbanimo.
- FellowFare listings and exchange remain authoritative in FellowFare.
- Anarchadia governance remains authoritative in Anarchadia.
- Worldweaver owns spatial instances, stations, screens, NPC tool intents, and provisioning receipts.
- The universe manifest owns navigation topology only.

No realm may infer success from a visual transition. Portal travel is presentation until an authoritative simulator/runtime acknowledges movement.

## Security and cleanup requirements

The universe module must remain static-source and import-only:

- no dynamic script insertion;
- no `eval` or `new Function`;
- no runtime source patching;
- no compatibility iframe shims;
- no hidden remote URLs;
- no duplicate versioned universe implementations.

When v2 replaces v1, update callers and remove v1 rather than shipping a ladder of inactive universe versions.
