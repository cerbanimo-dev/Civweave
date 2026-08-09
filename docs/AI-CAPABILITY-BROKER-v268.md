# Civweave AI Capability Broker v268

## Sprint goal

Stop treating **where a model runs** as if it determines **what kind of intelligence it is allowed to provide**.

The v268 broker separates three concerns:

1. **Execution locality/provider** — semantic-local, downloaded local generation, Ollama/LAN, Gemini/hosted, and other provider routes.
2. **Task capability** — interactive generation, bounded agentic reasoning, structured output, code, vision, tools, and live external research.
3. **Authority** — consequential actions, approvals, rewards, and ledger settlement remain governed by deterministic Civweave contracts regardless of which model drafted or interpreted the request.

## Routing contract

`CivweaveAICapabilityBrokerV268` produces `civweave.ai-capability-decision.v1` decisions.

A downloaded model stays local when its declared capabilities satisfy the request. A request is treated as agentic when it explicitly uses the agentic profile **or** is marked as agentic/background work.

A local model is not promoted to tool use or live research merely because it can reason agentically. Current downloaded text models explicitly declare:

- `tools: false`
- `externalResearch: false`

Those requests continue through the base runtime, where the configured remote/LAN/tool-capable route and its existing consent policy remain authoritative.

## Current local tiers

| Model | Interactive | Structured | Bounded agentic reasoning | Code | Tools | Live research |
| --- | --- | --- | --- | --- | --- | --- |
| Qwen 3 0.6B q4f16 | yes | yes | no | yes | no | no |
| Qwen 3 1.7B q4f16 | yes | yes | yes | yes | no | no |
| SmolLM3 3B q4f16 | yes | yes | yes | yes | no | no |

The capability flags are routing qualifications, not benchmark claims. Device-level performance and task quality still depend on hardware, prompt shape, context length, and model behavior.

## Cerbanimo boundary change

`cerbanimo-deterministic-boundary-v203.js` remains at its legacy path so existing boot/cache references do not break, but its role changes.

It no longer returns `DETERMINISTIC_PROVIDER_BOUNDARY`, no longer hijacks Kamiya chat, and no longer maps MiniLM/SmolLM/browser-local routes into a deterministic response engine.

It is now an authority compatibility shim:

- model output may interpret and draft;
- deterministic contracts own consequential execution;
- deterministic contracts own approval state;
- deterministic contracts own reward and ledger settlement.

## Local runtime change

`runtime-bridge-v266.js` now asks the broker whether the active downloaded model can satisfy each request.

- Qualified interactive request → downloaded local model.
- Qualified bounded agentic request → downloaded local model.
- Tool/live-web/unsupported request → base runtime.
- Invalid structured output from a local structured request → explicit local error, not a silent claim of success.

The bridge emits route diagnostics so future UI and telemetry can explain why a request stayed local or escalated.

## Verification

The sprint verifier exercises these behaviors in a VM harness:

- MiniLM canonicalizes to `semantic-local`, not `deterministic`.
- Cerbanimo no longer wraps the assistant or model generator.
- Qwen 3 1.7B receives a bounded agentic code-planning request locally.
- Tool/live-web work escalates to the base runtime.
- Qwen 3 0.6B is rejected for agentic reasoning but remains available for interactive code conversation.
- Background work is treated as agentic even when no explicit profile string is supplied.
- The local-AI bootstrap loads the broker before model capability declarations.

## Deliberate sprint boundaries

This sprint does **not** yet:

- consolidate every existing runtime wrapper into one middleware pipeline;
- add tool calling to downloaded browser models;
- add live web access to local models;
- add token-by-token browser-local streaming;
- benchmark local capability flags dynamically per device;
- preseed the new broker file into the legacy critical-cache coordinator.

Those are follow-on hardening and expansion tasks. The v268 change establishes the routing contract they can build on without restoring the old provider wall.
