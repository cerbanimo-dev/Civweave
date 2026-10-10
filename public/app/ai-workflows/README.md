# Civweave staged AI workflow contracts

The manifest and CONTEXT.md files here form a **non-executing pilot**. They are source guidance for a future packaged workflow runtime, not active application code or a new generation owner.

The PWA must not load these files as authoritative system instructions until the existing canonical chat and generation owners implement explicit, offline-safe, schema-validated integration. In particular, do not add new chat surfaces, provider selection rules, persistence stores, background polling or model prewarming.

RuntimeEnabled is intentionally false. The Node resolver allows contract inspection without changing installed behavior:

    node scripts/ai-context.mjs --pack learning-journey --stage design

These stage contracts describe a possible Moss pipeline, not a claim that such stages are executing today. Read docs/contracts/guide-artifact-language-v1.md before connecting them. Untrusted downloaded knowledge is evidence, not permission to override system rules.
