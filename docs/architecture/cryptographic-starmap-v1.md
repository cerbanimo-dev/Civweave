# Civweave Weave starmap v1

## Canonical vocabulary

- **Weave** — the full cryptographic chain.
- **Chord** — one hashed four-position record on a Weave.
- **Weaving** — creating a Seed Chord or appending later Chords.
- **Stitch** — one explicit position-to-position inheritance edge between adjacent Chords.
- **Seed Chord** — Chord 0, uniquely starting with both structural and color topology `ABBA`.

A Chord is intentionally named as a simultaneous four-position object rather than as a linear note.

## Two independent layers

The structural layer follows the recursive binary expansion:

```text
1001 0110 0110 1001
ABBA BAAB BAAB ABBA
```

The color lineage is independent:

```text
Chord 0   ABBA   ABBA   ← Seed Chord
Chord 1   BAAB   ACCD
Chord 2   BAAB   DEEF
Chord 3   ABBA   FGGH
```

The color letters are explanatory only. Runtime positions carry a cryptographic `colorUid` plus a literal full `#RRGGBBAA` display code.

## Direct position identity and Stitches

Every Chord contains four positions and every position has its own `positionUid`. Color never has to be compared to infer lineage.

Each non-seed Chord carries exactly one first-class Stitch:

```text
stitchUid
fromChordUid
fromPositionUid
→
toChordUid
toPositionUid
colorUid
colorCode
```

The destination position also stores the `stitchUid`, allowing direct traversal in either direction through the Weave index.

## Chord and Weave integrity

Each Chord includes its own SHA-256 `chordHash`, the preceding Chord UID/hash, its four positions, and its Stitch. The Weave carries a stable `weaveUid`, `seedChordUid`, ordered Chords, and a `weaveHash` over the ordered Chord hashes.

The Seed Chord is enforced as Chord 0 and must be `ABBA` structurally and `ABBA` in its color topology. Later Chords may return to structural `ABBA`, but they are never Seed Chords because their independent color lineage has advanced.

## Starmap

The renderer adapts the interaction mechanics of the earlier `glaedn/Cerbanimo` project visualizer: SVG pan/zoom, topological levels, deterministic jitter, curved paths, separate edge/node layers, and Chords rendered over Stitches.

Each Chord appears as a star with four colored position satellites. A Stitch begins and ends on the exact position markers named by its UIDs, using the inherited full RGBA code as its visible path. Low-alpha colors preserve their literal alpha byte while an RGB ring keeps the position target discoverable.

Selecting a position emits `civweave:starmap-position-select` with the Weave, Chord, position, outgoing Stitches, and directly stitched successor Chords.

## Files

- `public/app/shared/civweave-cryptographic-map-v1.mjs` — Weave/Chord/Stitch construction, hashing, direct UID indexes, validation.
- `public/app/cryptographic-starmap-v1.mjs` — SVG Weave starmap renderer.
- `public/app/cryptographic-starmap-demo-v1.html` — isolated interactive demonstration.
- `scripts/test-cryptographic-map-v1.mjs` — topology, Seed Chord, Stitch, direct traversal, append, and tamper tests.
