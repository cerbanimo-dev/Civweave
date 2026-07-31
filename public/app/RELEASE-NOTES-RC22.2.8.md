# RC22.2.8 — Dual-context Gemini routing

- Adds separate Gemini profiles for interactive/creative generation and background/agentic work.
- Keeps Flash, Flash-Lite, or another user-selected model on visible generative content.
- Routes explicit background, agentic, web-search, URL-context, source-discovery, and YouTube-discovery requests to the configured Antigravity agent.
- Adds `executionProfile`, `modelRole`, `background`, `agentic`, `requiresTools`, `webSearch`, and `youtubeSearch` routing signals to the shared model runtime.
- Adds `generateInteractive()` and `generateAgentic()` helpers for application flows.
- Preserves a single session-only Gemini API key while storing no secret in localStorage.
- Does not intercept arbitrary prompts sent directly to Gemini. Applications must mark tool-using calls or use an agentic purpose name.
