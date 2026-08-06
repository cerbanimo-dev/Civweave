# Commonweave v1.0.15

## Capability-based AI settings verification

Render stopped during prestart with:

> install boundary missing ADDITIONS_VERSION='v188-ai-settings-cleanroom'

That assertion belonged to the retired layered startup boundary. The active v226 boundary deliberately uses a release-versioned compatibility key and keeps the canonical Working Campus core-only.

v1.0.15 replaces the fossilized boundary metadata checks with capability contracts:

- the AI settings controller remains synchronous and local-DOM-only when opened
- provider runtimes, model discovery, tests, observers, polling, timers, and diagnostic loops remain dormant
- legacy realm pages still load the clean-room controller and delegation layer
- the canonical Working Campus still injects zero global compatibility scripts
- the retained v208 worker core and v218 Living School clean-room boundary remain intact
- the verifier synchronizes release assets before checking worker and boundary URLs

The boundary runtime version, exported version, and legacy compatibility cache key advance together to v1.0.15. No working runtime behavior is reintroduced or removed.
