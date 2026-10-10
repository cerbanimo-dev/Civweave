# Civweave agent workspaces

This directory supplies selective, readable workflow instructions for coding agents. It does not redefine application ownership, create runtime agents, or override repository policy.

Before a change, use AGENTS.md, config/agent-work-context.json, docs/contracts/mobile-interface-contract.md, docs/architecture/systems-of-practice.md, config/system-ownership.json, and docs/architecture/repository-map.md as the canonical authority chain.

Read docs/agent-workspaces/registry.json to select the smallest applicable workspace and stage. Resolve a stage with:

    node scripts/ai-context.mjs --workspace bug-fix --stage reproduce

The resolver loads only stage instructions and lists required authority references. The agent must read the applicable authority files separately before editing. Never infer a functional owner from a folder name or visual location.

Create working output in the agent's task workspace / pull-request artifacts, not in these instruction directories or release snapshots. Human approval remains mandatory for destructive migrations, live-money changes and other high-stakes actions.

Verify all stage paths and handoffs with:

    node scripts/ai-context.mjs --check
    node --test scripts/test-ai-context-resolver.mjs
