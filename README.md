# Commonweave clean baseline

This branch replaces the accumulated application surface with one small, inspectable five-system application written in plain HTML, CSS, and JavaScript.

The previous application is preserved on the branch:

`archive/pre-baseline-rebuild-v104`

## Systems

- **Commonweave** captures one shared AI configuration and turns a wish into learning, task, and materials requests.
- **Living School** turns learning requests into curricula, mixed media modules, quizzes, tests, and skill rewards.
- **Cerbanimo** turns task requests into dependency-aware projects, proof gates, and labor rewards.
- **FellowFare** turns material requests into market drafts and circulates goods and service offers.
- **Anarchadia** turns feature and bug requests into rail-checked implementation packets and can apply approved patches to an isolated local git branch.

The node provides static hosting, WebSocket signaling, fallback relay, peer discovery, trade circulation, and cross-validation requests. Direct browser peers use WebRTC data channels when available.

## Start

```bash
npm install
npm start
```

Open `http://localhost:4173`.

The application starts without downloading or initializing MiniLM. To install the local semantic router:

```bash
npm run setup:local
```

MiniLM provides local semantic routing and retrieval. It is not a text generator. Generative work can use Gemini, Antigravity, a local OpenAI-compatible MicroLLM such as Ollama or LM Studio, or another OpenAI-compatible source configured once in Commonweave.

## AI key safety

API secrets are never written to ordinary application state, exports, mesh messages, logs, or URLs.

- Session keys stay in memory and disappear on reload.
- Optional remembered keys are encrypted with AES-GCM using a user passphrase that is never stored.
- All five systems read the same unlocked vault.

A web application cannot protect a key from malicious code running on the same origin. The baseline therefore keeps the code surface intentionally small, applies a strict Content Security Policy, and does not load runtime scripts from third-party origins.

## Anarchadia implementation boundary

Patch application is disabled by default. A local node must be started with:

```bash
COMMONWEAVE_REPO_WRITE=1 npm start
```

The user must also approve with the exact phrase `APPLY ON LOCAL BRANCH`. The node creates an isolated git worktree and branch, rejects rail or secret changes, applies the patch, runs tests, and never pushes or merges automatically.
