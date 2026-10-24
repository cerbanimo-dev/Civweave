# Civweave WordCraft local bridge (experimental)

This is a **separate opt-in companion process** that connects the Civweave Creator Suite to a locally installed [WordCraft CLI](https://github.com/storytold/wordcraft). The bridge does not bundle the CLI, start a model, install system packages or connect to hosted ArtCraft.

## What works

The first, intentionally bounded adapter accepts a document chosen in the browser and runs:
- wordcraft-cli inspect [temporary file] to obtain JSON structure
- wordcraft-cli text [temporary file] to extract text
- wordcraft-cli convert [temporary file] [temporary result.pdf] to create a downloadable PDF copy

Accepted source extensions: DOCX, ODT, RTF, Markdown, TXT. Maximum source size: 8 MiB; max converted PDF: 12 MiB. The input is held only in a per-request temporary directory, cleaned up after processing. Originals are never overwritten and there is no network upload by the bridge itself.

**Installations are not automatic:** download and install a trusted WordCraft CLI release from its upstream repository, or build wordcraft-cli from source. Ensure 'wordcraft-cli --version' works in the terminal running Civweave (or configure WORDCRAFT_CLI to its exact executable path). Validate downloaded binaries against upstream release checksums.

## Launch

From your Civweave checkout, with Node.js 22 or newer:

PowerShell on Windows:
~~~powershell
$env:CIVWEAVE_CRAFT_ALLOWED_ORIGINS = 'https://civweave-staging.pages.dev'
node tools/creator-craft-bridge/server.mjs
~~~

Linux/macOS:
~~~sh
CIVWEAVE_CRAFT_ALLOWED_ORIGINS=https://civweave-staging.pages.dev node tools/creator-craft-bridge/server.mjs
~~~

The process prints its random, one-session access token. Do not share the token. Open Civweave's **Creator Suite → Creative & Business Tools** on **the same computer** (the service binds only to 127.0.0.1:47871), enter the token, connect, and choose a local file.

For locally served Civweave, http://localhost:8788 and http://127.0.0.1:8788 are allowed by default. If your staging origin differs, set CIVWEAVE_CRAFT_ALLOWED_ORIGINS to that exact origin (no path; comma-separated list accepted) before launching.

## Security model and limitations

- Binds only to the loopback interface, not LAN. This first version **cannot be reached directly from an Android phone** running Civweave; phone-to-PC connectivity requires a separate authenticated, TLS-secured host-node integration.
- All requests require a random bearer token. Browser origins are deny-by-default except two local development origins and any explicitly permitted environment origins; only POST JSON to the single allowlisted WordCraft endpoint is accepted.
- Files come from the user's browser file picker, not from model-supplied filesystem paths. Paths passed to the CLI are generated in isolated per-request temporary directories, and the CLI is invoked without shell interpolation. Requests/outputs are bounded and subprocesses time out.
- Only a selected file with a connected bridge registers browser AI tools. Each AI request requires a human confirmation modal. This is *not* a full Civweave model-router integration and does not bypass existing provenance or authorization contracts.
- Browser private-network rules may block HTTPS-to-localhost access, depending on the user's browser and permissions. This has not been confirmed in a live Android/desktop browser.
- Input files are processed by the separately installed WordCraft binary. Only use trusted upstream builds. The bridge doesn't currently provide versioned Civweave storage, shared Guild publication, persistent edit history, or full enterprise document fidelity.
- This is **not a general command execution or arbitrary file access API**. Do not forward its port, embed tokens in web pages, or expose it through Cloudflare tunnels without a separately reviewed authentication design.

## Tests

~~~sh
node --check tools/creator-craft-bridge/server.mjs
node --check tools/creator-craft-bridge/wordcraft.mjs
node --test scripts/test-creator-wordcraft-bridge-v1.mjs
~~~

The test uses a tiny **fake CLI binary** to verify process execution, argument boundaries, API access checks and returned artifacts. It does *not* assert that the real WordCraft has passed a browser or document-fidelity round-trip test.

## Next work

Integrate this tool bridge into Civweave's authenticated host node, add a service-status handshake to the account-level AI broker, enforce permission receipts and file snapshots, and test real WordCraft DOCX-to-PDF output before enabling it across guilds. CADCraft, GridCraft and PdfCraft can reuse the gateway and consent model after distinct upstream CLI contracts are validated.
