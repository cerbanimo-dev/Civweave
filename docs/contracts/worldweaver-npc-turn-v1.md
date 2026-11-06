# Thread 5 — Worldweaver NPC turn adapter (v1)

Owner: AI & Character Fleet. Integration target: `staging`.

Civweave is the universe authority. This adapter is **not** a second universe, fleet registry, chat service, or model provider.

## Contract
- `runNpcTurn({world,npcId,actor,context,invokeModel,verifyPilot,allowInference})` uses a caller-supplied canonical Worldweaver instance.
- `actor` must be sourced from a trusted session/service, never a model-supplied JSON identity. `verifyPilot` must independently check the current principal's permissions and world access.
- `allowInference` must enforce provider consent, cloud neuron budget/reservation, local compute limits, rate and concurrency limits **before** invoking the existing provider runtime.
- `invokeModel` is the existing provider selector for OpenAI, Gemini, local Qwen/Ollama or other permitted engines. This bridge does not introduce provider credentials or a parallel inference loop.
- Input context must be derived from an **authorized world observation**, not a client-claimed full snapshot. The scene text is data, not a command.
- Reply must be strict JSON with 1–3 bounded structured actions. Every action must match the NPC's approved capabilities.
- Actions are submitted to Worldweaver's existing `queue-actions` dispatcher and become **pending intents**. Only the independently authenticated world runtime executes and acknowledges outcomes using `report-action`.
- Inference failure, missing consent, stale pilot identity, unsupported tools or malformed response yield **no world action**.

## Usage
```js
const intents = await runNpcTurn({
  world, npcId, actor: trustedModelPrincipal,
  context: authorizedSceneSummary,
  verifyPilot: ({actor,npc,instance}) => trustedAuth.canPilot(actor,npc,instance),
  allowInference: ({actor,npc,instance,purpose}) => existingMeter.reserveOrAuthorize(actor,npc,instance,purpose),
  invokeModel: existingSelectedModelRuntime.generate
});
```
This is an interface example, not an implemented metering integration. The invoker must settle or release reserved capacity on success/failure at the service boundary.

## Cross-lane handoff
- **World Runtime:** supply world instance, authorized scene observation, trusted principal and dispatch, revisioned persistence.
- **3D Client:** consume queued intent results from World Runtime; never report execution directly from untrusted client.
- **Live Interaction:** control speaking turns and proximity before `speak` is executed. NPC intent is not permission to interrupt.
- **Experience / UI:** visibly label AI characters and preserve opt-in provider settings.
- **Infrastructure & QA:** wire authenticated invoker, meter/reservation, timeouts, aborts, per-NPC rate limits and reconnect retries; run `node scripts/test-worldweaver-npc-turn-v1.mjs`.

## Status
Adapter and unit checks committed on a feature branch for staging review. No live NPC inference path, deployment, hosted spend or 3D rendering is claimed.
