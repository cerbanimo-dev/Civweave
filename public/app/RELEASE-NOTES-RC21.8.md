# Commonweave 1.0.0-rc21.8 · Model-Guided Stewardship and Plan Negotiation

- Added a structured model replanner that uses the configured Commonweave model runtime and validates every response against a bounded JSON contract.
- Added deterministic fallback generation when the configured model is unavailable, times out, or returns invalid structure.
- Added multi-route negotiation sessions with assumptions, confidence, risks, tradeoffs, and follow-up revision support.
- Added exact before-and-after graph impact data for added, removed, changed, and downstream-dependent steps.
- Added review-gated adoption of negotiated plans and staging of native-record amendment handoffs.
- Added executive intention briefings covering state, forecast, risks, gaps, recommendations, required decisions, and uncertainty.
- Added estimate-learning storage so completed intentions can calibrate later forecasts without exposing private records externally.
- Updated the Quad to await model-guided replanning during natural conversation and render validated strategic alternatives.
