# Living School v262 generation boundary

This release makes three generation boundaries explicit.

## Quiz provenance

AI-generated curricula use `normalizeAIQuiz()`. That path only normalizes questions the model actually returned and rejects deterministic compiler question provenance. It never calls the deterministic `quizBank()` and never pads a bank.

The offline deterministic compiler uses `normalizeDeterministicQuiz()`. Only that path may call `quizBank()` or synthesize deterministic filler questions.

Missing AI quiz questions are completed through a targeted Gemini delta pass. Completion runs one module at a time, and if a multi-question structured response is incomplete it degrades to one-question recovery calls. If the resulting bank still does not satisfy the AI-only contract, Living School refuses to persist the hybrid result.

## Source material

Live Antigravity research is asked to return substantive evidence digests for every source actually opened, preserving the exact opened URL.

Downloaded Knowledge School passages are kept as local references with canonical article links when available.

Before Gemini writes or expands curriculum, the source IDs, titles, URLs, provenance labels, and passage text are serialized directly into the user prompt. Gemini is not expected to reopen or rediscover those sources. Lesson blocks cite the supplied source IDs, which the renderer resolves back to the stored source records and article links.

## Curriculum depth

If the initial curriculum contains fewer than three lesson blocks or less than roughly 3,000 characters of lesson text in a module, Moss performs a targeted module-depth pass instead of regenerating the whole curriculum. The expansion receives the same literal source packet plus the existing module content and may only return richer lesson blocks for that module.

Model-derived research remains a clearly labeled final fallback when neither live research nor downloaded local sources are available.
