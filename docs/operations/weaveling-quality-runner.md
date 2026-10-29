# Weaveling real-model quality review

`scripts/run-weaveling-quality-v1.mjs` runs the canonical source extension's `createModelPlan` through the actual shared model runtime, planner persistence, and review materializer. It is opt-in and is not part of CI or automatic tests. It uses Node 22+ and has no added package dependencies.

List the five fictional scenarios without contacting the model:

```powershell
node scripts/run-weaveling-quality-v1.mjs --list
```

Inspect the source-generated prompt, schema, working memory, and Ollama payload without sending a network request:

```powershell
node scripts/run-weaveling-quality-v1.mjs --dry-run
```

Explicitly enable actual local inference for all five scenarios, sequentially:

```powershell
node scripts/run-weaveling-quality-v1.mjs --run --model llama3.2:latest
```

Use `--scenario one-person-decision` to select one, `--scenarios path/to/scenarios.json` for a custom scenario document, or `--prompt "Create a Quest ..."` for one custom request. `--help` lists endpoint, token, timeout, temperature, and output options. The endpoint must be a loopback `/api/chat` URL. The default is `http://127.0.0.1:11434/api/chat`, with 2200 output tokens, temperature 0, and a 300-second request budget shared with the source runtime's possible repair attempt. Changing these options is recorded in the artifacts.

Every scenario starts with fresh synthetic in-memory storage containing an unrelated fictional chess goal. The runner never reads or writes browser storage, saved chats, settings, or user plans. The default output is a timestamped folder under the operating system's temporary directory. `--out` can select another folder.

`metadata.json` identifies source hashes, versions, Git revision, working-tree state, and model configuration. Each scenario JSON records the actual generated request/schema/working memory, visible provider output, transport metadata, runtime events, normalized plan, persistence result, and structural checks. Private Ollama thinking is omitted. `report.md` presents every path's steps, completion criteria, evidence, observed versus expected realms, and open review questions. Results are saved after each scenario so a later failure does not hide earlier evidence.

Expected realms and review questions are evaluation annotations. They are never supplied to the model or used to rewrite the source-generated schema. Structural checks can detect invalid ownership, missing persistence, memory leakage, malformed paths, and token-limit stops; a structural pass does not establish semantic quality. Review each plan for necessary subsystem choice, achievable steps, honest evidence, sequencing, and unwanted assumptions. A dry run reports `not-run` and has no model-quality result.

This runner evaluates source authoring and review persistence. Browser CORS, chat routing, approval, and downstream execution still require native UI testing.
