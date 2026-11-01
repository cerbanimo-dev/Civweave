# Worldweaver universal summon + avatar phone calls · implementation handoff

**Date:** 2026-11-01  
**Branch:** feature/worldweaver-summon-calls-v1-20261101

## Working in the browser / signed Worldweaver

- Starling Commune's **existing** Worldweaver viewport gets one universal summon shelf.
  - Desktop: side-of-viewport controls; world remains central.
  - Mobile: bottom shelf under the world viewport.
  - Shared kinds: experience, object, actor, NPC, real person.
  - Mouse, touchscreen pointer drag/drop, and keyboard selection/center placement share one command grammar.
  - No new simulator, member database, model loop, or independent signing authority.
- Guild-signed world manifest gains bounded `placements[]` with `pending-simulator` state. Guild founding-device authorization, stale revision checks, and 250-entry cap apply. The preview renders clearly marked pending pins; it **does not** depict them as actually spawned OpenSimulator objects.
- The cast catalogue comes from existing Starling persona definitions; registered NPCs and live experiences come from the selected signed world; human contacts come only from Civweave's existing explicit, directory-verified PM contact list. Unsourced objects are not invented.
- Real people use the same drag/placement UX but produce an encrypted **invitation**. There is never an automatic human teleport.
- Existing Civweave private messaging (P-256 ECDH + AES-GCM, mesh and mail relay) carries call invite/response envelopes. The recipient gets a separate incoming-call control: Pick up / Hang up and a user-configurable decline message.
- Sender sees the recipient's temporary avatar representation progress through `requested → ringing → accepted → joined` or `requested/ringing → declined / unavailable`. A verified decline triggers the selected response and dash animation. Only a transport event may update caller-visible state.
- The `accepted` state **does not claim an authenticated live avatar**. The recipient gets an explicit Open Worldweaver action. The `joined` state awaits a simulator/session-presence authority (next step).
- All temporary call representations and responses are visual artifacts, not evidence that a user was physically present.

## VR hand controls contract

`worldweaver-hand-gestures-v1.mjs` provides a hysteresis-based gesture recognizer accepting normalized tracked joints:

- **Five-Point Convergence** (all four fingers converge with thumb): toggles Civweave system menu.
- **Telephone sign** (thumb + pinky extended, other three fingers closed): summons Civweave core smartphone into **opposite** hand.
- Left hand → right-hand phone; right hand → left-hand phone.
- Screen anchor map: left-handed index-tip upper-left / pinky-base lower-left; right-handed pinky-tip upper-left / index-base lower-left.
- Recognition requires stable frames, supports reset and does not send raw joint data to the server.
- The module does not itself acquire OpenXR hand tracking, render hand-projected UI, or inject a panel into Firestorm. Those must be provided by the VR viewer/hand-tracking adapter.

## Authoritative adapters still required

1. **DreamGrid/OSSim side.** Resolve signed `pending-simulator` placements to explicit approved asset templates and real 3D coordinates, enforce parcel/region permissions and quotas, execute the spawn through a privileged owner-controlled adapter, and report receipts back to the signed world. A dropped experience may instead launch a bounded portal/scene. Never execute arbitrary uploaded scripts.
2. **Live human handoff.** On encrypted call acceptance, invitee explicitly enters Worldweaver. Only an authenticated viewer session for the right identity, world and invitation can emit `joined` and replace the temporary call representation with a real avatar.
3. **XR client.** OpenXR tracking, real palm projection, opposing hand's virtual phone screen, gesture activation boundaries, cross-handed touch and drop-to-world raycasting. The gesture grammar is implemented; the VR viewer rendering/integration is not.
4. **Guild policy.** Currently only the verified founding-device writer may enqueue world placements, preserving the existing trust model. Expand to democratic Guild-authorized member actions through the canonical governance owner, not client flags.
5. **Call discovery.** Encrypted calls are delivered only while Civweave's existing PM service is active or on the next sync. Explicitly verified contacts are eligible for visual ringing. No public presence query or hidden status disclosure.

## Validation

```sh
node --check public/app/shared/worldweaver-summon-v1.mjs
node --check public/app/shared/worldweaver-summon-ui-v1.mjs
node --check public/app/shared/worldweaver-hand-gestures-v1.mjs
node --check public/app/shared/worldweaver-pm-calls-v1.mjs
node --check public/app/shared/worldweaver-core-v1.mjs
node --check public/app/shared/worldweaver-commune-host-v1.mjs
node --check public/app/starling-lounge-v1.mjs
node --test scripts/test-worldweaver-summons-v1.mjs
node --test scripts/test-worldweaver-core-v1.mjs scripts/test-worldweaver-commune-host-v1.mjs
```

Test with two real PM identities: add each other as explicit verified contacts; open Guild Worldweaver on caller device; drag contact into scene; recipient picks up or declines with personalized answer; confirm caller avatar states and that no world session is faked. Then test actual DreamGrid physical placement only after adapter work.
