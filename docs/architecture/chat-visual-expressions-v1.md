# Civweave chat visual expressions v1

## Architecture
The canonical guide chat remains the only message and storage owner. A new visual rail renders validated visual expressions inside assistant messages for Weaveling, Moss, Kamiya, Rook, and Merlin. Text and markup persist in existing message history, including across reloads.

Client-only rendering runs inside the PWA without cloud AI, a second model call, or extra inference. After offline assets are cached, the visual renderer can work offline.

## Model-facing visual tool
The global CivweaveChatVisualsV1 browser API provides promptFor, tierFor, manifest, parse, extract, render, and mount.

- Tiny local models (135M–1B): use minimal inline markers such as [[cw:meter|Lessons completed|3|8]] and [[cw:character|moss|curious|Try the next example]]. Put the marker inside the answer field for JSON-only tasks.
- Small local models (1.5B–9B): optional fenced cw-view JSON for meter, steps, choices and character.
- Larger local models and cloud models: additional cards, metric, chart, table, timeline, quiz and diagram modules.
- Structured Quest, Learning Journey, Endeavor and Manifest generation: do not add visual markup to the required machine-readable schema. Visuals belong in ordinary assistant answers.

The visual tool contract is advertised through the guide capability language prompt, the local provider authority, the standard assistant runtime, the SmolLM constrained runtime, the native Termux llama-server chat route, and the generic fallback route. No provider is silently changed.

## Examples
Models can append a Markdown code fence labeled cw-view containing one JSON object.

~~~cw-view
{"type":"chart","title":"Practice sessions","labels":["Mon","Tue","Wed"],"values":[2,3,5]}
~~~

~~~cw-view
{"type":"quiz","question":"Which card begins the Major Arcana?","options":["The Magician","The Fool","The Star"],"answerIndex":1,"explanation":"The Fool is numbered 0."}
~~~

~~~cw-view
{"type":"choices","title":"What next?","options":[{"label":"Practice","prompt":"Give me an interactive practice exercise."},{"label":"Review","prompt":"Review the material I studied."}]}
~~~

~~~cw-view
{"type":"character","character":"moss","mood":"curious","speech":"What if we reverse the order?"}
~~~

| Type | Main fields |
| --- | --- |
| card | title, description, body |
| cards | title, items of title/body objects |
| metric | title, value, label |
| meter | title, label, value, max |
| steps / timeline | title, items of strings or title/description objects |
| choices | title, options of strings or label/prompt objects |
| quiz | question, options, answerIndex, explanation |
| chart | title, labels, values |
| table | title, headers, rows |
| diagram | title, nodes of strings or label/detail objects |
| character | character (guide key), mood, speech |

## Safety and permissions
AI-supplied code never executes. There is no raw HTML, script, user CSS, remote image URL, fetch, or eval support in the renderer. Input is bounded, parsed and validated; presentation is made with inert DOM text nodes.

Choice buttons prefill the real chat composer and require an explicit send click. Quizzes give local feedback without model calls. Other consequential actions continue to require consent through their existing owners. Guide faces come from already packaged assets. Reduced-motion preferences are respected.

Invalid, malformed or truncated visual output remains visible as text. Older clients may display the fenced source without breaking chat.

## Testing
Run: node scripts/verify-chat-visual-expressions-v1.mjs
Included in: npm run check:runtime

Manual exercise: ask a guide to explain using a chart, quiz or character expression. Verify small-model output, mobile width, offline caching, history reload and text-only fallback.

## Future extension
A future custom HTML/JS teaching simulation must run in a separately permissioned and sandboxed artifact surface, never in the main chat DOM.