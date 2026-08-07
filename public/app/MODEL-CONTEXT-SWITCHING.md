# Model context switching

Civweave routes requests by task weight without permanently changing the user’s provider selection.

## Gemini task tiers

When the selected provider is Google Gemini:

- **Routine and lightweight requests** use `gemini-3.1-flash-lite`.
- **Complex requests** use `gemini-3.5-flash-lite`.
- Complex requests include project and lesson planning, research and source synthesis, code generation in Cerbanimo or Anarchadia, and every agentic or tool-using flow.

The AI settings panel explains this automatic routing. Complex promotions also display a visible notice, and each response keeps its actual provider and model in the message metadata.

The router stores two non-secret Gemini profiles:

- **interactive**: `gemini-3.1-flash-lite` for ordinary conversation and small generation tasks.
- **agentic**: `gemini-3.5-flash-lite` for complex planning, research, code generation, and managed tool use.

Non-Gemini providers are not rewritten by the Gemini task-tier router.

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
```

The runtime also recognizes explicit `executionProfile: "agentic"` and the booleans `background`, `agentic`, `requiresTools`, `webSearch`, and `youtubeSearch`. Ordinary lightweight conversation remains on Gemini 3.1 Flash-Lite unless the request is classified as complex.
