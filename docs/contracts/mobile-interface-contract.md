# Civweave Mobile Interface Contract

This is the canonical interface and runtime contract for the active Civweave project.

## Platform boundary

- Civweave is an offline-first, mesh-architecture platform that also has online capabilities.
- Core participation, local state, chat history, and mesh workflows must not assume continuous internet access.
- Online services extend the local system. They do not define the application architecture.

## One chat system, five themes

- Civweave has one core chat system.
- The five guide identities are themes and memory contexts of that one system: Weaveling / Civweave, Moss / Living School, Kamiya / Cerbanimo, Rook / FellowFare, and Merlin / Anarchadia.
- The five themes share one visual and functional chat surface: one composer, one transcript renderer, one lifecycle, one input/event owner, one streaming path, one local-model path, one saved-chat UI, and one responsive/full-screen mobile behavior.
- Each theme keeps its own memory folder. Switching themes must never mix private thread histories implicitly.
- Cross-theme context moves only through an explicit handoff or user-directed transfer.
- Realm-specific capabilities belong behind the shared chat system as capability handlers. They must not create another chat UI, event owner, polling loop, or realm-specific chat runtime.
- Living School is not a special chat cabinet. Moss uses the same chat surface as the other four guides. Living School learning/curriculum functions are capabilities invoked by the shared chat.

## Runtime discipline

- The runtime must know the capabilities and limitations of the current device and remain comfortably within them.
- Prefer bounded work, bounded history/rendering, explicit lifecycle ownership, and backpressure over speculative prewarming or repeated retries.
- A user interaction must have one authoritative event owner. Do not stack capture handlers, mutation observers, synthetic clicks, polling loops, or repair layers that compete for the same interaction.
- Do not repeatedly throw events at the DOM to discover or repair state. State should be owned directly and rendered deliberately.
- Expensive local-model work starts from explicit user demand and must respect device resource limits.

## No runtime replacement injection

- Active Civweave code must not inject replacement application files, replacement source, or repair code at runtime.
- Do not add runtime self-patching, source rewriting, emergency replacement loaders, code-injection repair systems, or scripts whose purpose is to replace another implementation after boot.

## Obsolete means delete

- If an implementation, file, system, workflow, script, interface, or contract has been made obsolete by its replacement, delete the obsolete artifact from the active repository in the same change.
- Do not keep obsolete implementations as versioned duplicates, archived copies, tombstones, legacy fallbacks, compatibility copies, backup files, or side-by-side replacements.
- Do not preserve superseded behavior by leaving a second active or discoverable source of truth behind.
- Do not create new filenames solely to retain the old implementation after a replacement becomes canonical.
- Git history is the archive. The active repository must describe only the current canonical implementation.
- A replacement is not complete until the superseded active artifact and its stale references, loaders, registrations, tests, workflows, and documentation are removed.

## Verification belongs in CI and review

- Verification that can run statically or deterministically belongs in GitHub Actions, tests, linting, type checks, or review checks.
- Standalone `verify-*` scripts should be converted into CI/review checks where practical and then removed when they exist only to enforce repository structure or static contracts.
- Runtime verification must be limited to genuine runtime health signals. It must not mutate, replace, or inject application code.

## Mobile interaction rule

- Use straightforward semantic mobile interaction patterns wherever they are the clearest and least expensive implementation.
- Artwork and game-like presentation are an engagement layer, not the application surface itself.
- Images may enrich navigation and atmosphere, but ordinary functionality must not depend on invisible hotspots or mandatory illustrated containers.
- Chat, forms, settings, account management, installation, recovery, messaging, and accessibility must remain direct, reliable mobile interactions.
