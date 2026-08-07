# Reported Android regression contract

Observed on Civweave v1.0.40:

- Working Campus controls were visibly compressed on a narrow Android viewport.
- Realm cards behaved as a horizontally clipped carousel instead of a viewport-contained layout.
- The Civweave brand image failed to render in the Working Campus header.
- Shared guide messaging appeared unable to send for Weaveling, Moss, Kamiya, and Merlin, while FellowFare's native Rook composer remained functional.

v248 tests these conditions as layout and interaction contracts rather than treating them as cosmetic-only issues.
