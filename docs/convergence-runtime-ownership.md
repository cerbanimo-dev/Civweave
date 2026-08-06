# Runtime ownership contract

## Family shell

Owns:

- five-realm navigation
- shared guide aperture
- shared AI-settings aperture
- mobile viewport and keyboard behavior
- display of adapter-provided realm status

Does not own:

- realm storage keys
- realm state interpretation
- realm rendering
- realm action routing
- realm guide identity

## Realm adapter

Each realm will expose the same boundary:

```js
export const realmAdapter = {
  id,
  getStatus,
  getAttentionItems,
  getActiveContext,
  migrateState,
  openHome,
  executeCapability
};
```

Adapters translate canonical realm state into shared contracts. They do not permit the family shell to read private storage directly.

## Realm runtime

Each realm owns exactly:

- one startup path
- one state engine
- one renderer
- one delegated action controller
- one guide identity
- one settings route

## Shared authorities

- AI settings: one shared controller
- guide transport and persistence: one shared runtime
- rewards: one signed canonical ledger
- package contents: one generated package manifest
- offline lifecycle: one service worker

## Compatibility

Compatibility logic belongs only under `public/app/compat/` or `public/app/migrations/`. Canonical runtime code may call a migration boundary, but it may not embed old interaction systems, hidden launchers, synthetic events, or alternate state writers.
