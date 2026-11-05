# Worldweaver AI operating modes v1

## Scope and authority

**The Worldweaver model roles are a provider-routing plan, not a new chat owner, a remote code execution facility, or proof of live API orchestration.** The canonical world owner remains `public/app/shared/worldweaver-core-v1.mjs`; role resolution is pure in `public/app/shared/worldweaver-ai-roles-v1.mjs`. Authenticated actions remain queued, authorized, and confirmed by the canonical owner. Neither a role name nor a model-generated claim grants permission to alter a Quest, Guild, or world.

The canonical Settings and credential owner is `public/app/settings-gateway-v317.js`. The existing guided first-run tour `public/app/new-user-onboarding-v1.js` adds an animated Weaveling step. Do not make a parallel login or settings page.

## Modes

| Mode | Loom / world DM | Actors including Lari | DeepSeek | Grok |
|---|---|---|---|---|
| System (first cloud setup default) | One selected OpenAI or Gemini provider | Same provider | Not used | Not used |
| Binary | OpenAI API | Gemini API for all personas, including Lari | Not used | Not used |
| Multiverse | OpenAI API | Gemini API | The Architect: invention, hypotheses, continuity and system designs | Lari the Lyrebird: foil, puzzles and safe fictional crises |
| Local only | Device-local AI if installed, otherwise manual local rules | Same local route | Not used | Not used |

Multiverse's DeepSeek and Grok remain **disabled until testing, human consent and provider authorization**; untested keys alone do not activate them. No automatic cross-provider sharing of memories, Guild data or private files. “Mutual infiltrating” is fictional banter and authorized opt-in idea exchange, **not** unauthorized account access, prompt exfiltration or breaking provider boundaries.

The Loom proposes non-deterministic fiction/world narration, but deterministic collision, identity, inventory, permissions, votes, billing and saved Quest state stay with trusted Civweave owners. Gemini can role-play many actors with distinct character memory and consent boundaries while reusing one provider connection. Lari may present reversible, bounded PvE challenges that never target real people or fabricate verified Quest completion.

## Startup and credentials

On startup, if no configured external route and user has not explicitly opted for Local Only, Weaveling guides them through three choices: OpenAI API, Gemini API, or Local Only. API selection opens the existing shared Settings form with the appropriate provider, model and endpoint preset. External-request consent and Save remain explicit. Local Only marks the startup choice and selects an existing downloaded local model if available or manual deterministic rules otherwise. The ordinary five-guide tour resumes after successful model setup.

ChatGPT subscription access is not an OpenAI API key; a separately provisioned provider API key and eligible billing/account access are required. API usage may cost money. The default key-lifetime selection is session-only. The current browser-only settings runtime stores session credentials in browser session storage, including one per provider for Binary Mode; **sessionStorage is not a hardened secret vault**. This is a constrained early implementation, not a production-grade secure BYOK deployment. Production should use a trusted per-user authenticated backend or device-secured secret broker with scoped, revocable tokens and clear user consent. Never emit keys to logs, Quest text, Guild reports, prompt payloads for other providers, shared mesh objects, public repository files, or analytics.

World mode preference is stored under `civweave.worldweaver.ai-mode.v1`. Startup local-only choice is under `civweave.ai-startup-choice.v1`. These are nonsecret settings. The implementation does **not** yet claim live multichannel Worldweaver requests; runtime fan-out, provider health checks, character memory isolation, spend limits, key vault hardening, consent per provider, and scene-authorized world event dispatch require subsequent integration and headset testing.

## Readiness and test gate

`resolveWorldweaverAIRoles` returns explicit enabled flags, missing providers, and a ready Boolean. System requires one configured primary; Binary requires both OpenAI and Gemini; Multiverse additionally requires Grok test approval for full character/foil readiness (DeepSeek remains separately optional). Missing providers are never silently replaced by another service.

Run:

```sh
node --test scripts/test-worldweaver-ai-roles-v1.mjs scripts/test-worldweaver-ai-setup-v1.mjs
npm run test:worldweaver
```

Review the CI run and test real providers with budgeted nonproduction API keys before promoting. Provider labels describe responsibilities, not claims of model consciousness or independent access.
