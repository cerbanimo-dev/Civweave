# Digital Y Walkable Prototype — Stage 1

**State:** Staging-only prototype. Not approved by, deployed within, or associated with the real Watertown Family YMCA. Geometry, characters and new spaces are fictionalized. Source schedules are a November 2026 historical snapshot and are not live availability or registrations.

## Open the prototype

- Walkable interior (first-person + 2D): \`/app/tools/watertown-y-walkthrough-v1.html\`
- Three-studio schedule kiosk: \`/app/tools/watertown-y-schedule-v2.html\`
- Existing Worldweaver schedule screen lab: \`/app/tools/watertown-y-world-lab.html\`
- Editable scene: \`public/app/tools/watertown-y-walkable-scene-v1.json\`
- Movement, collision and pathfinding: \`public/app/tools/watertown-y-walkable-core-v1.mjs\`
- Game runtime: \`public/app/tools/watertown-y-walkthrough-v1.mjs\`

## Scope delivered

1. Fictionalized schematic containing Lobby, Cardio, Spin, Yoga/Quest Gallery, Commons, corridor.
2. Single scene data set for first-person raycaster, collision, door gaps and 2D accessible layout; no geometry claim about real facility.
3. Nine interactable stations: four schedules, fictional scripted reception, scripted Moss, voluntary quest, fruit-fly bigfixers read-only audit and an exit.
4. Worldweaver local manifests: scene creates a room and four screens with the existing \`createWorldweaver\` action and \`cast-screen\` permissions. The same screen IDs are used in a \`projectWorld2D\` projection and rendered with \`renderWorldScreen\`; no duplicate media authorization protocol.
5. On secure HTTPS hosts, presentation uses only same-origin permitted https URLs through the sandboxed Worldweaver screen renderer. Local unencrypted preview does not claim a successfully authorized screen cast.
6. Mobile held-direction controls, keyboard WASD/arrow controls, canvas pointer interaction, HTML destination buttons and 2D route-checked accessible fast travel.
7. Local, user-editable, Markdown-exportable first-quest plan with separate Intention → Quest → Party → Guild workflow and the four Civweave supports: Living School, Cerbanimo, FellowFare and Anarchadia.
8. Explicitly fictional scripted dialogue. It is **not** running a live AI guide or spending cloud neurons; no claims that model agents have continued running.
9. Fruit-fly **bigfixers** maintain their exact lore name. The audit is read-only and flags structural schedule problems and stale months.

## Stage-gate commands

\`\`\`sh
node scripts/test-watertown-y-walkthrough-v1.mjs
node scripts/test-watertown-y-schedules-v2.mjs
\`\`\`

Validation performed via GitHub source inspection and executable pure geometry checks:
- All 9 interactive stations reachable from spawn;
- All 81 pairwise station routes reachable, collision free;
- 2,319 sampled movement starts remained collision free;
- Browser app and core source syntax parsed;
- Worldweaver schedule presentation, map projection, document IDs and internal links verified in source.

**Not verified:** GitHub CI execution, live Pages deployment, browser interaction, offline PWA packaging, real headset/Quest 3 behavior, production integration or actual YMCA review. Do not state that those gates passed.

## Browser acceptance checklist (still pending physical testing)

- Launch secure staging URL from desktop and Android; no runtime exceptions.
- Walk Lobby → Commons → Cardio; use corridor door gaps to reach Spin and Yoga, without crossing walls.
- Open each schedule; text remains readable on narrow phones and at larger kiosk sizes; November 2026 provenance visible.
- Run all nine map destination buttons and interact with each.
- Confirm projected screen URL remains same-origin and iframe remains sandboxed without \`allow-same-origin\`.
- Complete five quest milestones and export a Markdown file; check that it contains no user secrets or enrollment claims.
- Bigfixers audit detects an outdated month and cannot mutate schedule files.
- Navigate away/back and confirm animation resumes; test reduced-motion preferences and keyboard/assistive-tech controls.
- Run on low-end Android and a real VR headset before calling this a launch-ready three-dimensional environment.

## Next milestones

- Replace invented room topology with a survey, sanctioned photos or an approved OpenSimulator export and explicit measurements. Do not silently claim architectural fidelity.
- Add accessible path markers, labeled restroom/exit/entrance locations and multi-floor navigation when verified.
- Connect optional real model-powered guides only with explicit scope, capabilities, consent, safety limits, and appropriate model/provider costs; retain the offline scripted mode.
- With YMCA authorization, implement a reviewed schedule update path that verifies official changes, update timestamps and source provenance; **never** infer a class booking slot from the static schedule.
- Build VR interaction with the same canonical world snapshot, portable screen content and 2D fallback.
- Put the experience in an opt-in Guild Map route only after browser QA and approval; no real user, payment or membership changes from the demo.

## Privacy / authority

No real YMCA employee likeness or identity is simulated. The fictional receptionist and Moss are labeled script-only stand-ins. The app does not ask for keys or collect membership/health data. No automatic enrollment, attendance, bookings or cloud usage occurs. When exported, the plan is generated locally on the visitor's device.
