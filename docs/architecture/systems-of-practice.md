# Civweave Systems of Practice

This document is the map for cross-cutting behavior. Before adding a button handler, global event listener, loader, overlay, state store, service worker hook, or shared runtime, first find the existing owner here and in `config/system-ownership.json`.

## The rule

**Do not add another owner to make an existing owner work. Fix or extend the owner.**

A visible control is not an invitation to attach a new event. A custom realm page is not permission to implement another copy of a shared system. A failing helper is not permission to patch browser prototypes or globals around it.

For every cross-cutting change, an agent must perform this sequence before editing:

1. Trace the active route from `public/app/fullscreen-family-v104.html`.
2. Read `config/system-ownership.json` and identify the capability owner.
3. Search every active entry and shared runtime for the canonical control, event, global API, storage key, and loader.
4. Classify each match as **owner**, **subscriber**, **caller**, **compatibility shim**, or **retired code**.
5. If more than one input owner exists, consolidation is the task. Do not add another path.
6. Change the owning implementation first. Compatibility code may delegate to the owner but may not intercept input.
7. Update the ownership verifier whenever the capability boundary changes.
8. A PR is incomplete until the ownership verifier proves the active route graph still has one owner.

## Settings

Settings is the reference implementation of this discipline.

- Input owner: `public/app/settings-gateway-v317.js`
- Presentation owner: `public/app/model-settings-controller-v173.js`
- Downloaded-model management subscriber: `public/app/document-lifecycle-v221.js`
- Canonical control: `[data-open-unified-ai-settings]`
- Shared realm control: `public/app/family-shell-v104.js`

The gateway is intentionally tiny. At launch it installs one inert delegated click listener and does no Settings implementation work. On the first explicit Settings request it activates the controller. Only after the Settings surface has opened and the browser has yielded a paint may downloaded-model management activate.

Forbidden Settings patterns:

- attaching another click listener to a Settings control;
- calling the Settings controller directly from realm code;
- loading the active Settings controller or Settings management lane during startup;
- maintaining a realm-specific Settings surface;
- using a MutationObserver, polling loop, lifecycle hook, or prototype patch to discover or repair Settings entry;
- patching DOM/browser prototypes to compensate for a bug in the Settings controller;
- treating `civweave:model-settings-opened` as permission to own the original user input.

Subscribers may react to `civweave:model-settings-opened` after the canonical surface exists. They may not prevent, stop, capture, replay, or synthesize the original Settings click.

### Living School

Living School is not a special case. It uses the same family-shell Settings control, the same Settings gateway, the same controller, and the same downloaded-model management lane as Cerbanimo, FellowFare, and Anarchadia. Living School may not ship a realm-local Settings button or load Settings repair code to create one.

## Family navigation

- Shared chrome owner: `public/app/family-shell-v104.js`
- Route authority: `public/app/system-routes-v227.js`

Realm pages can expose realm-native navigation inside their content, but cross-system travel and shared family chrome belong to the family shell. Do not attach a second cross-system switcher to an embedded service.

## Guide chat

- Workspace owner: `public/app/guide-workspace-v242.js`
- Loader: `public/app/family-ai-loader-v105.js`

Realm code should request the canonical guide window. It should not create another persistent guide-chat owner because a specific page wants a different guide identity.

## Local AI inference

- Inference owner: `public/app/local-ai/runtime-v266.js`
- Bootstrap: `public/app/local-ai/bootstrap-v266.js`

Settings may configure and manage downloaded models. Opening Settings must never start inference, probe a provider, validate cached weights, run a health test, or warm a model. Those actions require their own explicit user intent.

## Radio and review

- Radio owner: `public/app/system-radio-agent-v233.js`
- Track suggestions: `public/app/radio-track-suggestions-v240.js`
- Review owner: `public/app/shared-review-surface-v234.js`

Extend these systems at their owners. Do not attach duplicate launchers or parallel global listeners from realm code.

## When a new shared system is genuinely necessary

A new cross-cutting owner requires all of the following in the same PR:

1. an entry in `config/system-ownership.json`;
2. a named canonical control/event/API contract;
3. an explicit list of allowed subscribers or callers;
4. an executable ownership verifier;
5. removal or delegation of any predecessor owner;
6. documentation of the active route graph it affects.

If those artifacts are absent, the correct default is to find and extend an existing system.

The objective is not fewer files for aesthetic reasons. It is one source of behavioral authority, with callers and subscribers orbiting it instead of a swarm of competing event handlers.
