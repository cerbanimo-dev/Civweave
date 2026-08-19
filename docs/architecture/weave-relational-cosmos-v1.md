# Civweave Weave history and Relational Cosmos v1

Civweave now keeps two visual systems deliberately separate.

## Weave history

The Weave is the canonical cryptographic history. Its historical projection is a static four-cell wall: one row per Chord, four color cells per Chord, and one global letter per color lineage marker. The visible wall intentionally does not behave like a graph.

The Seed Chord is the unique `ABBA + ABBA` synchronization. Later Chords preserve the recursive binary topology while the color lineage proceeds independently (`ABBA`, `ACCD`, `DEEF`, `FGGH`, ...). Exact Chord hashes, position UIDs, RGBA bytes, and Stitch metadata remain available as metadata but are not visual clutter in the wall.

## Relational Cosmos

The Relational Cosmos is not the Weave and does not replace its cryptographic history. It is a projection of relationships among three entity types:

- Guild
- Quest
- Quest Beat

Hierarchy and origin edges express ancestry. Similarity edges are independent and may be supplied explicitly or derived from shared tags between entities of the same type.

### Spatial behavior

The layout is deterministic from entity UIDs. Guilds are large anchor stars. Quests cluster around their Guild. Quest Beats cluster around their Quest. Similarity relations gently pull same-type peers toward each other and are rendered as secondary curved links.

### Warp depth

Zoom is semantic as well as geometric:

- far / outward: Guild constellations
- middle: Guilds and Quests
- near / inward: Guilds, Quests, and Quest Beats

Wheel zoom is anchored under the pointer. Touch uses true two-pointer pinch distance and center. Free panning is available at every depth.

### Origins

Selecting an entity centers it. `traceOrigins(uid)` highlights the exact origin chain and warps outward to its root Guild. Zooming outward while centered therefore recovers the broader grouping from which the selected Beat or Quest originated.

### Projection contract

A node has a stable `uid`, `type`, and `label`, plus optional `parentUid`, `originUid`, `guildUid`, `questUid`, tags, summary, and Weave references (`weaveUid`, `chordUid`). The Weave references allow a semantic entity to point back to canonical history without turning Stitches into semantic graph edges.
