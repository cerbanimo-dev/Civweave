# Canonical guide artifact language v1

Civweave has one chat system with five guide identities. Specialized artifact generation remains owned by the guide capability that knows how to materialize it; universalizing chat does not universalize artifact ownership.

The canonical user-facing artifact language is:

| Guide | System | Creates |
| --- | --- | --- |
| Weaveling | Civweave | **Quests** |
| Moss | Living School | **Learning Journeys** |
| Kamiya | Cerbanimo | **Endeavors** |
| Rook | FellowFare | **Manifests** |

Merlin continues to own civic/governance proposals and automation work; this contract does not rename those artifacts.

## Ownership rule

The terms above describe artifact ownership, not separate chat implementations. All five guides continue through the shared chat spine, router, transcript surface, model paths, and memory-folder architecture.

A guide may discuss another guide's domain, but it must not silently substitute its own generator for another guide's artifact. When the Hero asks the wrong guide to create a specialized artifact, the response should identify the correct guide and offer a passover action. Accepting the passover opens the destination guide and resubmits the original request through the canonical shared chat path.

Examples:

- Moss asked to create a productive project → pass to Kamiya for an **Endeavor**.
- Kamiya asked to create learning content → pass to Moss for a **Learning Journey**.
- Rook asked to create a Quest → pass to Weaveling.
- Weaveling asked to create an Endeavor → pass to Kamiya.

## Compatibility identifiers

Some runtime identifiers predate this language contract. They may remain internally until a safe schema migration is justified:

- `weave` → Weaveling **Quest**
- `curriculum` → Moss **Learning Journey**
- `quest` → Kamiya **Endeavor**
- `resource` → Rook **Manifest**

These are compatibility identifiers only. They must not leak into user-facing ownership language or cause a canonical term to route to the wrong guide.

In particular, the legacy internal `quest` artifact class does **not** mean that Kamiya creates user-facing Quests. User-facing **Quest** always belongs to Weaveling; the legacy internal class remains mapped to Kamiya's **Endeavor** until the internal schema is migrated.

## Generation preservation

Moss's existing Living School generation engine remains the materialization owner for Learning Journeys. The shared chat/passover layer may classify, route, and rename user-facing output, but it must not replace `generateCurriculumFromChat` or create a second learning generator.

The same principle applies to future specialized Endeavor and Manifest generators: extend the canonical capability owner rather than creating guide-local chat forks.
