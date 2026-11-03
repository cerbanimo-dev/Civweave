# Character fleet: controlled 5 × 20 benchmark

This is a **developer-only, opt-in evaluation harness**. It does not implement a second chat/inference owner, modify production persona files, publish manuscript canon, vote as a human, or spend Cloudflare neurons. It calls a user-selected Ollama or OpenAI-compatible endpoint sequentially through an explicit local command, with no background daemon or parallel requests.

## Coverage

The authoritative runtime rosters remain:
- Starling Collective (8): `public/app/shared/starling-collective-v1.mjs`
- Five guide identities: `public/app/shared/worldweaver-convergence-cast-v1.mjs` with roles from `public/app/assets/ai/profiles.json`
- Book characters: only those in an explicitly supplied **private** Performance Studio Convergence casting packet (author-reviewed, unsigned preview), never an invented live installation.

`questions.json` holds twenty **character-specific** test questions for each of those thirteen canonical personas plus ten prepared book identities (Landry, Delia, Magnus, Maggie, Jess, Raven, Dish, Raj, Landry-Prime, Darkness). Book seeds are dormant unless a matching approved cast profile is supplied. Other author-cast book roles automatically receive twenty private questions grounded in their approved casting brief, canon rules, relationships, and interaction rules. Missing details are explicitly treated as unknown rather than invented.

Each character's twenty questions cover four specific scenarios with five probes each: voice, practical judgment, disagreement/agency, uncertainty, and changed-evidence continuity. Five editable agent-file overlays test canon/voice, relationship continuity, situated action, principled dissent, and integrated synthesis. Base canon is always loaded from the existing owners; overlays do not replace it.

## Execute locally

Requirements: Node.js 22, the repository, a running **user-selected** local inference server with the requested model installed. Example for Windows/desktop Ollama:

1. Run `ollama serve` and ensure `ollama list` includes the model.
2. Copy `bindings.example.json` to a private path such as `bindings.local.json`, setting the model for each character if the fleet has mixed sizes.
3. Preview: `node tools/character-fleet-bench/run.mjs --config tools/character-fleet-bench/bindings.local.json`
4. Run the complete registered fleet, one variant then one character then each of twenty questions:

   `node tools/character-fleet-bench/run.mjs --run --config tools/character-fleet-bench/bindings.local.json --out character-fleet-results.jsonl`

5. Resume completed cases safely with `--resume`. For a short server smoke test, add `--only starling:aphra --question-limit 2`. For a LAN-only community model endpoint add `--allow-lan` (explicit opt-in); public endpoints require `--allow-remote` and HTTPS.

For Book characters, supply `--book-packet /private/author-reviewed-convergence-packet.json` after exporting a reviewed Performance Studio cast. Model binding IDs use prefixes such as `book:maggie`; each must map to the intended model in `bindings.local.json`. This benchmark does not verify an export's author signature: local packets are untrusted rehearsal inputs and never public publishing authority. Never commit private character data or response logs.

`node tools/character-fleet-bench/report.mjs character-fleet-results.jsonl` writes runtime summary JSON and a human review CSV. **Human reviewers** should grade each answer 1–5 on voice, canon, independence/agency, practical usefulness, calibrated uncertainty, and distinctiveness. A fast answer, or one that matches a few keywords, is not evidence of characterization quality. Score blindly where practical and keep the same question/model/decoding settings across variations. No model grades itself.

Run deterministic tests with `node --test tools/character-fleet-bench/test.mjs`. Tests use an in-process fake HTTP server and make **no paid or real model calls**. A full thirteen-persona run is 5 × 13 × 20 = **1,300 real calls**; each additional approved book character adds 100. There is no automatic cloud fallback. Results are append-only JSONL, including failures and model metadata. Resume uses content-addressed case IDs; edit any question, agent file, or binding and the changed cases will run again.

## Important limits

The harness cannot access a model running on a developer's laptop/phone from GitHub or this conversation. Real runtime-quality results exist only after the operator runs the benchmark against those endpoints. Local response content may be private and is not sent to Civweave servers by this script. Ollama uses `keep_alive:0` to avoid cumulative loaded-model memory pressure; this may increase latency and should be treated equally across variants. Endpoint requests do not include chat history; each case is independent, preventing contamination from earlier test questions.
