# Living School Interface Surface Audit v1.0.13

## Runtime contract

- The eight supplied object images are stored under `visual-assets/interfaces/`.
- Images contain no functional form state. Real Living School DOM nodes are mounted over normalized surface bounds at runtime.
- Closing a surface returns the exact node to its original parent and removes projection-only classes and observers.
- Input, change, submit, and DOM mutation events update the surface state badge without replacing application handlers.

## Typography roles

- Chalk headings: Cabin Sketch with handwritten system fallbacks.
- Chalk body and form copy: Schoolbell with handwritten system fallbacks.
- Hologram headings: Cinzel with serif fallbacks.
- Hologram controls and data: Rajdhani with screen-safe sans-serif fallbacks.
- Font binaries are not bundled; the app loads the open-source families through Google Fonts CSS and remains usable with local fallbacks when offline.

## Surface routing

- Pedestal hologram: compact learner-intention intake.
- Mossbound chalkboard: full curriculum and practicum forms.
- Modular chalkboard: cohort, review, scheduling, and administrative feeds.
- Easel: compact check-ins and feedback forms.
- Wall hologram: general output, model controls, evidence, credentials, and help matches.
- Circular hologram: research and topic-map output.
- Observatory arch: learner constellation and pathway output.
- Multi-panel hologram: dashboards, marketplace, project bridge, and overview feeds.

## Verification

- Static validator passes all 24 rooms and 397 hotspots.
- All eight interface assets exist in both Living School and campus offline cache manifests.
- Embedded Chromium harness verified form entry, live feed detection, profile switching, DOM restoration, responsive placement, and zero runtime exceptions.

## Living Displays verification

- All eight display states and six golden-path stages are declared in the runtime and manifest.
- Storage writes to the Living School state emit same-page workflow events.
- Generated curriculum, practica, submissions, reviews, facilitator notes, artifacts, badges, and credential proposals change the illustrated surface state.
- The display layer does not create a second authoritative learning store.

## Merlin verification

- Universal chat is loaded by the campus, Living School, Cerbanimo, Anarchadia, and FellowFare.
- The chat rejects deterministic and manual providers and supplies no fallback handler.
- Platform context is read-only, filtered, bounded, and optional.
