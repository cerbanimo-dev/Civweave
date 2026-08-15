# Civweave Core Interface Runtime v1

The five core systems use one interface lifecycle. Civweave, Living School, Cerbanimo, FellowFare, and Anarchadia may present different worlds and features, but they do not get separate boot architectures.

## Ownership

`public/app/core-interface-runtime-v1.js` owns the shared interface lifecycle and adapter contract.

It does **not** absorb the owners around it:

- installed-app authorization remains `public/app/install-boundary-v146.js`;
- route authority remains `public/app/system-routes-v227.js`;
- family navigation/status chrome remains `public/app/family-shell-v104.js`;
- Settings input remains `public/app/settings-gateway-v317.js`;
- guide windows remain `public/app/guide-workspace-v242.js`.

The runtime exists underneath those capabilities so a realm can change its own feature surface without inventing another startup stack.

## Five-system manifest

The runtime has one manifest for exactly these canonical systems:

| System | Canonical entry | Realm-specific feature examples |
| --- | --- | --- |
| Civweave | `/app/working-campus-v156.html` | intentions, planning, campus |
| Living School | `/app/cabinets/living-school/index.html` | learning, projects, evidence |
| Cerbanimo | `/app/realm-console-v140.html` | quests, skills, projects |
| FellowFare | `/app/fellowfare-cabinet-v144.html` | exchange, resources, services |
| Anarchadia | `/app/anarchadia-console-v139.html` | governance, consent, review |

All five declare the same structural needs: lifecycle, navigation, Settings entry, guide workspace, status, and overlays.

## Lifecycle

Every canonical surface moves through the same runtime phases:

1. `created`
2. `booting`
3. `dom-ready`
4. `shared-ready`
5. `system-ready`
6. `interactive`

`pagehide` suspends the active adapter. A BFCache `pageshow` resumes it through the same runtime instead of asking a realm-specific recovery layer to reconstruct the interface.

The canonical lifecycle events are:

- `civweave:interface-runtime-phase`
- `civweave:interface-runtime-ready`
- `civweave:interface-system-ready`
- `civweave:interface-system-changed`
- `civweave:interface-adapter-registered`
- `civweave:interface-adapter-unmounted`
- `civweave:interface-feature-ready`
- `civweave:interface-feature-error`
- `civweave:interface-runtime-error`

## Adapter contract

Realm-specific behavior plugs into the core with `registerAdapter(systemId, adapter)`.

An adapter may implement:

- `beforeMount(context)`
- `mount(context)`
- `afterMount(context)`
- `suspend(context)`
- `resume(context)`
- `unmount(context)`

The context supplies the current system definition, standardized structural slots, navigation, feature requests, and runtime status. An adapter must not replace the runtime, attach a rival Settings owner, or create a second family-navigation owner.

Adapters are optional. Existing surfaces continue to work before they are migrated; the runtime therefore supports incremental adoption instead of requiring a five-realm flag day.

## Shared structural slots

The runtime marks the canonical content root with `data-civweave-interface-slot="content"` and supplies one empty overlay host at `#civweave-interface-overlays`.

The runtime also exposes existing family-shell slots when present:

- `familyHeader` → `#cwf104-head`
- `familyTray` → `#cwf104-tray`

The core does not dictate each realm's art direction or feature layout. Standardization is at the lifecycle and ownership boundary, not a demand that five distinct applications become the same screen in different colors.

## Shared feature loading

Cross-system features can register a lazy loader with `registerFeature(name, loader)` and be requested with `requestFeature(name)`. The runtime memoizes the feature promise so a feature has one load attempt per document rather than five realm-specific boot variants.

Existing capability owners can migrate into this registry independently. Until a capability migrates, its existing canonical owner remains authoritative.

## Boot boundary

`install-boundary-v146.js` requests the core runtime once for every canonical system. It remains responsible for deciding whether the installed application may run. It is not the realm UI lifecycle owner.

The core runtime is part of the critical offline cache. A user who can open a canonical system offline therefore has the same interface spine available regardless of which system was opened last.

## Change rule

A new core system feature should normally be implemented in one of three places:

1. **Core runtime** when all five systems need the same lifecycle/structural behavior.
2. **Existing shared capability owner** when the behavior is shared but already has an owner, such as Settings or guide chat.
3. **Realm adapter / realm feature** when only one system needs it.

Do not create a new realm loader because a feature differs. Extend the adapter or the shared capability owner while preserving the common runtime.
