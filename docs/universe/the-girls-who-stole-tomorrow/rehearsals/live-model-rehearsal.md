# Opt-in Landryverse actual-model table read

The November 5 story package has two separate test types:

- `node scripts/build-landryverse-story-v1.mjs --check` / the GitHub workflow: **deterministic** scripted scene, fully offline, zero model calls.
- `node scripts/run-landryverse-live-rehearsal-v1.mjs --run ...`: **actual selected-model turn sampling**, which must be executed from a trusted machine with access to a model endpoint. The script **reuses** `tools/character-fleet-bench/run.mjs`'s existing Ollama/OpenAI-compatible inference adapter. It does not create a second Civweave chat system.

## Prepare an explicit private model connection

Use a model already installed in Ollama on the same machine (for example `qwen3.5:4b`). Do **not** place API keys, remote authorization headers, private manuscripts, or another person's personal data in the GitHub repo.

Create a locally stored, **untracked** JSON such as `bindings.landryverse.local.json`:

```json
{
  "default": {
    "provider": "ollama",
    "model": "qwen3.5:4b",
    "endpoint": "http://127.0.0.1:11434"
  },
  "characters": {
    "landry": {"model": "qwen3.5:2b"},
    "delia": {"model": "qwen3.5:2b"},
    "maggie": {"model": "qwen3.5:4b"},
    "magnus": {"model": "qwen3.5:4b"},
    "diner-child": {"model": "qwen3.5:2b"}
  }
}
```

Ensure each chosen model actually exists: `ollama list`. Remove per-character overrides for models not installed; otherwise the run fails rather than pretending success. The server must already be running.

## Run

```sh
# No model call: verify the eight turn positions.
node scripts/run-landryverse-live-rehearsal-v1.mjs

# Explicit private preview: 8 sequential inference requests, no persistent agent daemon.
node scripts/run-landryverse-live-rehearsal-v1.mjs --run \
  --config bindings.landryverse.local.json \
  --accept-creative-context \
  --out dist/landryverse-private-rehearsal.json
```

The preview uses Landry, Delia, Maggie, Magnus, Merlin, Gaia/Kami, the diner child, then Landry again. It passes each speaker only that character's safe public authoring instructions, allowed scene knowledge and prior **spoken** lines. The result is local JSON for human editing; it is not auto-merged with the book or promoted into a signed Convergence pilot.

- Default endpoint access is **localhost only**. A separate private LAN endpoint requires `--allow-lan`; a remote endpoint requires `--allow-remote` plus HTTPS. Model context may leave the device when the operator opts into remote inference.
- `--accept-creative-context` explicitly allows sending the limited authoring context. Do not include private source materials or unapproved personal testimonies.
- A single model failure stops the scene, and no fictional world/Quest writes, Guild votes, or publication occur.
- All generated dialogue is **provisional** and must be reviewed for voice, factual uncertainty, distinct identity, consent and spoilers.
- The GitHub Action runs only mocked adapter tests and a **dry-run plan**. GitHub runners cannot see a personal `127.0.0.1:11434` server or retrieve private credentials automatically. Do not call the CI artifact a live multi-model run.

The original `tools/character-fleet-bench/run.mjs` benchmark remains the correct tool for 5 × 20 character evaluation after an approved Performance Studio casting packet is available. This short narrative table read is an **author-only preview**; it is not a substitute for model-quality benchmarking.
