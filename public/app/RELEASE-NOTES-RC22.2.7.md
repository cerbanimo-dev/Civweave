# RC22.2.7 — Antigravity research-agent hotfix

- Adds `antigravity` and `antigravity-preview-05-2026` as Gemini model presets in the shared model foundry.
- Routes those model IDs through the Gemini Interactions API rather than `generateContent`.
- Enables managed background execution with the Antigravity agent's default code execution, Google Search, and URL Context tools.
- Polls background interactions, reports progress through the shared model event stream, and stores pending interaction IDs locally for diagnostics.
- Keeps API keys session-only and sends them only to Google's Gemini API host.

Mobile note: the managed job runs remotely and can continue when Android suspends the page, but this PWA hotfix can only resume/display the result while the app is active. Durable OS notifications and guaranteed automatic resume require a server relay, webhook, or native background worker.
