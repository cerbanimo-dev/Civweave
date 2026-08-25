# Model context switching

Civweave routes requests by task weight without permanently changing the user’s provider selection.

## Gemini task tiers

When the selected provider is Google Gemini through the user's own API key:

- **Routine and lightweight requests** use the configured lightweight Gemini route.
- **Complex requests** use the configured higher Gemini route.
- Complex requests include project and lesson planning, research and source synthesis, code generation in Cerbanimo or Anarchadia, and every agentic or tool-using flow.

Gemini BYOK routing is separate from Civweave-funded Guild compute. The AI settings panel explains this automatic routing. Complex promotions also display a visible notice, and each response keeps its actual provider and model in the message metadata.

The router stores two non-secret Gemini profiles:

- **interactive**: ordinary conversation and small generation tasks.
- **agentic**: complex planning, research, code generation, and managed tool use.

Non-Gemini providers are not rewritten by the Gemini task-tier router.

## Guild Cloud high-compute tier

Guild Cloud may use `@cf/qwen/qwen3.8-27b` for the highest programming and software-engineering calls. This is intentionally narrower than the Gemini complex tier.

Qwen high compute requires **both**:

- `executionProfile: "agentic"`; and
- explicit code/implementation metadata (`capabilityRequirements.code`, a code/programming task tier, `highComputeClass: "qwen-code"`, or a code-specific application `purpose`).

The Qwen selector does **not** inspect arbitrary user-message text. A normal chat message that merely contains programming words therefore cannot promote itself to Qwen.

Before inference, Civweave estimates the full Qwen request at the Qwen neuron rates and requires it to fit inside that member's remaining included daily neurons. Qwen high compute never spends lifetime credits. If the request is not explicitly high-code, does not fit the remaining included allowance, or cannot use the available Workers AI rail, it falls through to the existing lower-cost router unchanged.

This keeps the expensive model bounded by the normal member allowance rather than making Qwen a general fallback.

## Request hints

Callers can mark work explicitly, although the shared router also recognizes planning, research, code-generation, and agentic signals:

```js
CivweaveModelRuntime.generateInteractive({
  purpose: "quick-answer",
  taskTier: "small",
  prompt,
});

CivweaveModelRuntime.generate({
  purpose: "project-plan",
  taskTier: "complex",
  prompt,
});

CivweaveModelRuntime.generateAgentic({
  purpose: "source-discovery",
  requiresTools: true,
  prompt,
});

CivweaveModelRuntime.generateAgentic({
  purpose: "cerbanimo-code-patch",
  capabilityRequirements: { code: true },
  prompt,
});
```

The runtime also recognizes explicit `executionProfile: "agentic"` and the booleans `background`, `agentic`, `requiresTools`, `webSearch`, and `youtubeSearch`. Ordinary lightweight conversation remains on the user's ordinary selected route unless a task-specific router deliberately promotes it.
