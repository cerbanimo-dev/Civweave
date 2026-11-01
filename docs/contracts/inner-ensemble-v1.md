# Inner Ensemble — author-controlled three-layer agent prototype (v1)

## Purpose

This is a **fictional author self-insert system** within Civweave Local Fleet. Authors edit three initially blank personality files and choose which agent currently faces the user. The stages are **inner child** (Qwen 3.5 0.8B), **inner teen** (Qwen 3.5 2B), and **main/adult** (Qwen 3.5 4B). These are metaphorical developmental simulation roles, not a clinical model of personality, consciousness, child development, or human mental health.

The engine `public/app/shared/inner-ensemble-v1.mjs` has no network, filesystem, or tool execution authority. The Local Fleet UI `public/app/shared/inner-ensemble-panel-v1.mjs` uses Civweave's existing `CivweaveModelRuntime` and the explicitly activated **desktop Ollama** inventory; it requires a loopback endpoint for private author-self-insert material. Browser/Termux/Android GGUF multi-model simultaneity is not included in this version. No hosted model fallback.

## Data and authoring

- `authorTemplate()` returns blank identity, personality, voice, worldview and experience fields per agent; three optional JSON starter files live under `public/app/author-lab/templates/`.
- Every agent has an editable model tag, enabled toggle, six blank persona fields, authored fictional memories, and editable developmental challenges.
- Controls include the front-facing layer, previous-response cross-talk, stop/pause/resume, local memory, event broadcasting, JSON import/export and clearing history.
- `INNER_ENSEMBLE_STORAGE` identifies browser-profile local storage. Exporting is explicitly user-initiated, and importing is an explicit author action. Neither operation shares memories with a Guild.
- Events and results form an append-only ordered *activity journal within each saved snapshot*, with a limit of 600 entries. Clearing the browser copy is an explicit action. This is **not** a durable multi-device event log, signed Civweave Guild object, or model weights.
- A developmental challenge is an authored fiction prompt. Recorded output can influence subsequent turns through context; it is **not weight training, LoRA fine-tuning, or a claim of real lived experience**. The author should review outputs before treating them as canon.

## Event / inner action bus

1. Every enabled layer receives the same event snapshot immediately. Each independent generation is scheduled without awaiting the others.
2. Every layer is instructed to act as the **hypothetical main executive** and propose `{reply,action:{kind,description,reason}}`. Accepted kinds: `speak`, `ask`, `plan`, `observe`, `defer`. Unstructured output falls back to a simulated `speak` proposal.
3. Each child/teen (or other non-front layer) result becomes an `upstream-action` addressed to the selected front-facing agent and visible immediately in the event journal. No actual action is performed.
4. The front-facing model's independent first response is never blocked by the inner agents. After its first response arrives, the front reviews every upstream action in order. Each review can revise its proposed action or preserve an explicit disagreement.
5. The front is selectable before the next event. An in-flight event pins its front-facing agent to avoid replay/race ambiguity. Layer failures are recorded independently. `stop()` aborts all in-flight and upstream generation requests.

These **are proposals**, not privileged calls. Agent outputs never directly execute tools, modify Guild roles, publish content, spend neurons, claim tasks, or change permissions. The actual human author and Civweave's canonical authorized tools retain control. A later gated executor could require explicit author approval for a reviewed front action, with authorization, audit and idempotency.

## Memory and concurrency limits

Ollama may queue or unload model instances under memory pressure. Parallel **dispatch** is guaranteed by the JavaScript service; parallel **physical token generation** and timing are not. The adult's two review passes are intentionally serialized to prevent conflicting revisions. Do not interpret dispatch count as concurrent hardware residency.

The current frontend requires all selected model tags to appear in Desktop Fleet's discovered inventory, an active local Ollama configuration, and `endpointLeavesDevice === false`. It rejects remote/LAN endpoints for these author materials until explicit per-world privacy control is designed.

## Validation

- `node --test scripts/test-inner-ensemble-v1.mjs`
- Check the Local Fleet panel, author JSON save/import/export and blank persona fields.
- Check all three `initial` inference requests begin before the first response; confirm upstream actions target the chosen front and produce sequential `front-integration` records.
- Stop an in-progress run and ensure signals are aborted.
- Real-device acceptance needs local Ollama with `qwen3.5:0.8b`, `qwen3.5:2b` and `qwen3.5:4b` installed. Mock-based tests do not verify real-model performance.

## Out of scope

Autonomous agent privileges, private/hosted generation, multi-host leases, model weight updates, real-world autobiographical ingestion without consent, automatic Guild publication, clinical inference, and guaranteed simultaneous inference on insufficient hardware.


## Nightly development, model sleep, and fictional trigger takeover (v2)

### UTC Cloudflare rollover

The node-cloud included-neuron ledger uses UTC calendar day keys and advertises \`resetsAt\` at the next **00:00 UTC**. This is an accounting boundary, **not** an existing event emitted to the user's local machine and not proof that an autonomous Cloudflare scheduler has run.

\`public/app/shared/daily-sleep-cycle-v1.mjs\` is the host-independent nightly *policy/transaction coordinator*. The production Cloudflare job runner, exclusive server lease, authenticated Guild context reader, verified free-only reserve/settle transport, durable account storage, and local trainer must be bound through concrete adapters before unattended processing can run. The module deliberately refuses to spend without those adapters, an enabled opt-in, and verified member/Guild authorization.

The intended run is:

1. **23:15–23:58 UTC**, while ordinary daily billing is still active: use *eligible, verified remaining* **free included** neurons for observations, tomorrow options, and draft planning. The nightly budget is the minimum of the member's remaining included allowance, Workers AI free pool, shared daily remaining, and any separately authorized Guild allowance. Preserve at least **25 neurons** and never silently use paid overage or lifetime balances. A no-charge path is required.
2. **At 00:00 UTC**, the next daily included allowance begins. Stop participating author-ensemble inference and unload owned Ollama model sessions on the opted-in host. No training is performed on Cloudflare Workers.
3. **Sleep**: consolidate provenance-preserving fictional experience and Guild progress. An explicitly installed local/Guild trainer may prepare a LoRA adapter, subject to evaluation on held-out test data and ability to roll back. Failed training keeps the previous adapter. No raw, private Guild material may automatically enter an author's adapter.
4. **Before daily Quest draft planning**, verify the sleep receipt (complete or degraded), then provide only authorized planning context, authorized member contribution history, and vetted observations. Generate **review-only** draft Quest beats. Do not create tasks for inactive people, invent completion evidence, or claim human ratification. The real Guild Quest owner must handle publication.

Without the server-side scheduling adapters, these are executable domain policies and mocks, **not** a claim of live overnight cloud generation.

### Trigger meters and temporary front switching

\`inner-activation-v1.mjs\` implements an author-controlled fictional activation meter for every layer, including the currently front-facing layer.

On each shared event, models may add JSON \`activation: {delta,reason}\` to their action proposal. Changes are bounded to **−25/+35** points per turn. Every meter decays by default **12** points per event. With automatic takeovers enabled (author adjustable), an internal layer reaching **70/100** becomes temporary front on the **next** event, not during an already-dispatched turn. It releases at **32/100**, after a **3-turn maximum**, or if disabled; a **2-turn cooldown** reduces rapid oscillation. The default/home front is the author's manual selection. A manual front switch immediately clears any temporary control.

The smallest model can simulate executive control and provide its own front-facing narrative, but its permissions never escalate. No agent obtains tool, money, Guild role, publication, voting, or human-authenticated authority from a meter. These meters are storytelling mechanics, **not clinical measurements** or diagnoses.

The Author Lab now includes trigger enable/disable, threshold/release settings, live meter displays, reset, and an **opt-in** UTC model-unload control. Model unload is supported only against the explicitly selected **loopback** desktop Ollama host, and the host page must be open to receive its timer. The page has no actual Cloudflare overnight cron or unattended training process. A full always-on deployment requires an authorized local host scheduler.

### Contract tests

\`node --test scripts/test-inner-activation-v1.mjs scripts/test-daily-sleep-cycle-v1.mjs\` covers meter bounds, hysteresis, cooldown, front routing, free-only daily accounting, rollover, local trainer fallback, and Quest draft gating. Mock tests do not certify Cloudflare billing deployment or LoRA quality.
