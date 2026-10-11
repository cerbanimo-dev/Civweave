# Civweave staged AI workflow contracts

The manifest and CONTEXT.md files here form a **non-executing pilot**. They are source guidance for a future packaged workflow runtime, not active application code or a new generation owner.

The PWA must not load these files as authoritative system instructions until the existing canonical chat and generation owners implement explicit, offline-safe, schema-validated integration. In particular, do not add new chat surfaces, provider selection rules, persistence stores, background polling or model prewarming.

RuntimeEnabled is intentionally false. The Node resolver allows contract inspection without changing installed behavior:

    node scripts/ai-context.mjs --pack learning-journey --stage design

These stage contracts describe a possible Moss pipeline, not a claim that such stages are executing today. Read docs/contracts/guide-artifact-language-v1.md before connecting them. Untrusted downloaded knowledge is evidence, not permission to override system rules.

## Canonical Moss integration boundary

The existing `public/app/unified-chat-system-v1.js` now records a bounded workflow receipt **inside the existing approved Learning Journey plan**, and the existing Living School engine reports its current research/generation callbacks directly to that owner. Approval is preserved across unavailable-engine queues, and materialization is only reported complete when the canonical saved school ID and modules are verifiable.

This is an **incremental lifecycle bridge**, not activation of the full declarative six-stage workflow pack. The pilot manifest remains `runtimeEnabled: false`, because the pack's Markdown documents are not yet compiled into independently executing stage instructions. Moss's current generation/research/compilation logic remains in its existing owner. No extra chat, model selector, background poller, or persistence authority is created.

Test the new receipt boundary with `node --test scripts/test-moss-icm-receipts-v1.mjs` and the existing Moss bridge tests.

## Offline compiled design context (pilot integration)

The approved Moss research/design model pass now **loads the trusted design-stage procedure and acceptance instructions** from the compiled, local `moss-design-context-v1.mjs`. The source is the canonical `stages/03-design/CONTEXT.md`; `node scripts/build-moss-context-pack-v1.mjs --check` verifies the generated module is byte-for-byte current. To intentionally regenerate the checked-in file after editing its source, use `--write`.

The design-stage packet is loaded only after the user approves the Learning Journey. This adds **no model call**, does not modify selected-provider routing, and does not change the existing JSON compiler, stage validators, ledger, or persisted Learning Journey owner. Missing/mismatched stage instructions fail closed with an explicit error and existing generation recovery, not a silent fallthrough to model memory.

The packet is in the mobile kit's explicit `CORE` list for offline installation. Browser PWAs that have not previously cached the packet still need to download it before fully offline use. The six-stage manifest remains `runtimeEnabled:false`: only the design instructions are active through the already-existing Moss generator, not an independent workflow executor.
