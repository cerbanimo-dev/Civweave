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

World mode preference is stored under `civweave.worldweaver.ai-mode.v1`. Startup local-only choice is under `civweave.ai-startup-choice.v1`. These are nonsecret settings. The explicit on-demand Worldweaver session adapter `public/app/shared/worldweaver-ai-session-v1.mjs` now uses the canonical model runtime's `generate()` with separate OpenAI and Gemini configurations. `public/app/shared/worldweaver-ai-handoff-v1.mjs` requires an authenticated bound model pilot and queues proposed `speak` intents through the canonical Worldweaver owner. Model output is **never** reported as a successfully executed action, and this does not install any autonomous scheduler or new chat runtime. The optional, explicit-gesture story proposal playtest at `/app/tools/worldweaver-ai-playtest.html` exposes the shared session runtime; per-provider health tests, browser-safe credential brokerage, and approved remote execution acknowledgement remain pending.

## Runtime isolation and spending controls

- User must explicitly start an AI session with `consent:true`; missing provider keys, consent, or trusted HTTPS endpoints stop requests instead of switching providers.
- The System mode uses the one selected provider. In Binary, the Loom requests OpenAI and all character/Lari requests use Gemini. The optional DeepSeek and Grok channels remain disabled for requests until tested and specifically authorized; this implementation does not call their APIs.
- Character memory lives only in a bounded, per-session in-memory map scoped to world ID, role, and persona ID. It does not enter the object mesh, another actor's context, or durable storage. No role is given authority to move private memory across boundaries.
- Cloud requests reserve a finite call count, estimated prompt-token total, and estimated USD allowance before each invocation, using user-provided current model prices. An explicit zero budget blocks calls. Reservations intentionally include failures. **These are client-side estimates, not billing guarantees or provider-enforced spending caps**; a real hosted quota service is required before paid autonomy.
- The Settings owner offers provider-specific read-on-demand session configurations. Those keys remain accessible to same-origin browser JavaScript; `sessionStorage` and legacy “remember on device” preferences are not suitable for production secret handling. The secure credential-broker implementation is still a separate prerequisite to production activation. No automatic BYOK migration or key upload is performed.
- For the active client session, call `createConfiguredWorldweaverAISession({settings:CivweaveSettingsV320,runtime:CivweaveModelRuntime,consent:true,pricePerMillion,budget})`. On an authenticated character action, use `queueWorldweaverActorLine` with the existing canonical `world` and verified bound `actor`. The caller remains responsible for real authorization, user consent, and current pricing.

## Optional staging story playtest

The Commons Between links to `/app/tools/worldweaver-ai-playtest.html`. The playtest presentation explicitly allows only `civweave-staging.pages.dev`, `localhost`, and `127.0.0.1`; on production or other domains, its submit action and consent control are disabled before credential reading or model-runtime loading. This is a client-side release guard, **not** a security boundary or substitute for server-enforced quotas. It is **a developer playtest presentation**, not a second model owner, a new chat interface, a live multiplayer provider, or a route that publishes quests or changes canonical Worldweaver state.

- The page starts with **zero** remote calls. The existing Settings owner is loaded solely for the user-requested provider configuration; the canonical model runtime is lazily imported only during a deliberate form submission.
- The user chooses Loom, one character, or Lari; a room; a bounded prompt; a two-call limit; and an estimated USD cap no greater than five cents. They must explicitly check external-request consent before requesting each generation. Session history lives in memory and is cleared by End Session or page exit. Changing saved provider settings invalidates the current session.
- `public/app/shared/worldweaver-ai-pricing-v1.mjs` allows only exact models with a reviewed standard-text price on November 5, 2026: OpenAI `gpt-6-luna` ($0.10 input/$0.50 output per million tokens); Gemini `gemini-3.1-flash-lite` ($0.25/$1.50) and `gemini-3.7-flash` ($0.75/$3.75). Unsupported models, missing keys, missing provider consent, Local Only (without a verified local model adapter), and untested Multiverse fail closed. Rates are estimates and can change; verification references are https://developers.openai.com/api/docs/models/gpt-6-luna and https://ai.google.dev/gemini-api/docs/pricing.
- Each returned provider result must declare the **same actual provider and model** as the requested approved route. A mismatched or missing identity is rejected, with no write to character memory. User-visible provider errors redact the selected credential.
- Results appear only as **uncommitted fiction proposals**, not as verified NPC speech, official Quest proof, or changes to shared world state. No raw API key is put in on-screen output or into the shared Guild mesh.
- Browser-held credentials remain a **staging-only security weakness**. These are voluntary test calls with revocable test keys and client-estimated bounds; the browser controls do not offer a financial guarantee, and production remains blocked by issue #984 until server-enforced spending and a secure key broker are built.

## Readiness and test gate

`resolveWorldweaverAIRoles` returns explicit enabled flags, missing providers, and a ready Boolean. System requires one configured primary; Binary requires both OpenAI and Gemini; Multiverse additionally requires Grok test approval for full character/foil readiness (DeepSeek remains separately optional). Missing providers are never silently replaced by another service.

Run:

```sh
node --test scripts/test-worldweaver-ai-roles-v1.mjs scripts/test-worldweaver-ai-setup-v1.mjs scripts/test-worldweaver-ai-session-v1.mjs scripts/test-worldweaver-ai-handoff-v1.mjs scripts/test-worldweaver-ai-playtest-v1.mjs
npm run test:worldweaver
```

Review the CI run and test real providers with budgeted nonproduction API keys before promoting. Provider labels describe responsibilities, not claims of model consciousness or independent access.
