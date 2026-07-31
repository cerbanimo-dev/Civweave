# Model context switching

Commonweave stores two non-secret model profiles:

- **interactive**: visible conversations and creative/generative output.
- **agentic**: managed background work that may browse, search, inspect URLs, execute code, or discover YouTube sources.

Use one of these request forms:

```js
CommonweaveModelRuntime.generateInteractive({ purpose: "curriculum-prose", prompt });
CommonweaveModelRuntime.generateAgentic({ purpose: "youtube-search", prompt });
CommonweaveModelRuntime.generate({ purpose: "source-discovery", requiresTools: true, prompt });
```

The runtime also recognizes explicit `executionProfile: "agentic"` and the booleans `background`, `agentic`, `requiresTools`, `webSearch`, and `youtubeSearch`. Ordinary curriculum generation remains on the creative model unless a separate research/search stage is marked agentic.
