# Commonweave v1.0.34

This recovery release reconnects the shared guide runtime across the installed Commonweave family.

## Fixed

- Added the missing Weaveling textarea and Send control to the Working Campus and connected it to `CommonweaveAssistantV141`.
- Reconnected Merlin's native Anarchadia chat through a compatibility adapter to the current assistant runtime.
- Persisted deliberately saved API credentials on the current device across realm changes and installed-app restarts, with a visible **Forget saved key** control.
- Stopped Cerbanimo's validation interface from recursively replacing its own controls and freezing when review-state work is restored.
- Added the recovery runtime and changed surfaces to the additive service-worker package.

Credentials remain local to the browser profile and are excluded from exports, handoffs, and offline seeds.
