# Civweave cryptographic starmap v1

## Contract

The cryptographic map has two independent layers over the same four-position beat.

The structural layer is the recursive binary expansion beginning:

```text
1001 0110 0110 1001
ABBA BAAB BAAB ABBA
```

The color layer is a full RGBA hexadecimal overlay. The canonical chain begins conceptually:

```text
ABBA ACCD DEEF FGGH ...
```

The letters are explanatory only. Runtime records store full `#RRGGBBAA` values.

## Direct position identity

Every one of the four positions in every record receives its own `positionUid`. A relationship never means “find the similar-looking color.” A child position stores `inheritedFromPositionUid`, which directly names exactly one position in its immediate predecessor record.

Color is therefore a discoverability and display layer, not the cryptographic security primitive.

## Record integrity

Each record contains:

- `recordUid`
- `recordIndex`
- the `1001`/`0110` structural beat for that index
- four position objects with independent UIDs
- each position's full RGBA color code
- at most one `inheritedFromPositionUid` per child record
- `previousRecordUid`
- `previousRecordHash`
- a SHA-256 digest of the attached payload
- a SHA-256 `recordHash` over the canonical record body

The default generator passes the predecessor's fourth position into the successor's first position, producing the simple visible `ABBA → ACCD → DEEF → FGGH` progression. The API also permits selecting a different predecessor position and/or target slot while retaining an exact UID relationship.

## Starmap

The starmap renderer adapts the interaction model of the earlier `glaedn/Cerbanimo` project visualizer:

- SVG pan and zoom
- topological levels
- deterministic small positional jitter for a constellation rather than a rigid table
- curved dependency paths
- separate path and node layers
- nodes rendered above their links

A record is drawn as a star with four colored satellite positions. The inherited path starts and ends on the exact position markers represented by the two UIDs. Its stroke uses the inherited `#RRGGBBAA` code. A low-alpha code remains selectable because the renderer preserves an opaque RGB ring around the literal-alpha core.

Selecting a position dispatches `civweave:starmap-position-select` with the source record, exact position, and any direct successor positions discovered through the UID index.

## Files

- `public/app/shared/civweave-cryptographic-map-v1.mjs` — chain construction, structural expansion, hashing, position UID indexing, validation.
- `public/app/cryptographic-starmap-v1.mjs` — SVG starmap renderer.
- `public/app/cryptographic-starmap-demo-v1.html` — isolated visual demonstration.
- `scripts/test-cryptographic-map-v1.mjs` — structural, inheritance, UID, successor, and tamper tests.
