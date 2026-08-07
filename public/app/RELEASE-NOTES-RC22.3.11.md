# Civweave Pocket Campus RC22.3.11

## Living Displays

Living School interface objects now react to real workflow state rather than acting as passive frames.

- Eight chalkboard and hologram shells expose `empty`, `editing`, `processing`, `completed`, `updated`, `reviewed`, `error`, and `archived` states.
- The golden learning path is tracked across curriculum intake, generated curriculum, practicum, submission, mentor feedback, and credential progress.
- New curriculum, evidence, feedback, artifacts, and credential changes produce in-world notices and surface-specific visual treatments.
- Surface density adapts to long output while preserving the original interactive DOM and offline state.
- Existing forms remain keyboard accessible and return to their original workspace position when the illustrated surface closes.

## Merlin universal conversation

Merlin, the android starfish wizard, is available throughout Civweave as a universal chat.

- Merlin uses the shared interactive language-model connection and streams ordinary conversational text.
- Deterministic and manual providers are rejected for Merlin, and no deterministic fallback is supplied.
- Merlin receives a filtered, read-only snapshot of local Civweave, Living School, Cerbanimo, and FellowFare state.
- Secret-like fields are removed before context is sent to the model.
- Merlin can explain, summarize, critique, brainstorm, and generate drafts.
- Merlin cannot navigate the user, move intentions, mutate tasks, approve work, or claim to operate platform state.
- Conversation history remains local to the browser and can be cleared from the chat.

## Offline and mobile

- Merlin scripts, styles, and character art are cached by the campus and service PWAs.
- Living Display contracts and assets remain available offline.
- The mobile seed and mobile install kit are rebuilt from this release.
