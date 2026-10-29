# Creator Suite: Visual implementation guide

**Scope:** 11 standalone Craft applications, five optional business services. The hosted ArtCraft AI service is intentionally excluded. This is a visual implementation map, not a declaration that every listed application is installed or connected.

## Architecture

```mermaid
flowchart LR
  subgraph USER["Civweave user / desktop browser"]
    UI["Creator Suite PWA<br/>Tool catalog + file picker"]
    REG["Scoped AI tool registry<br/>Per-action approval"]
    UI --> REG
  end
  subgraph DESKTOP["User-owned desktop — current prototype"]
    GATE["127.0.0.1:47871<br/>Random bearer + allowed origins"]
    TMP["Temporary workspace<br/>8 MiB input · 12 MiB export<br/>2 concurrent jobs max"]
    CLI["WordCraft / CADCraft / PdfCraft<br/>Separately installed CLI binaries"]
    GATE --> TMP --> CLI
  end
  REG -->|"selected files only"| GATE
  CLI -->|"result preview / download"| UI
  PHONE["Android PWA / Guild AI"] -.->|"FUTURE: authenticated HTTPS host-node bridge"| GATE
  TMP -.->|"FUTURE: explicit user approval, ACL and provenance"| VAULT["User Library / Guild vault"]
  style PHONE stroke:#e1a073,stroke-width:2px,stroke-dasharray: 5 5
  style VAULT stroke:#e1a073,stroke-width:2px,stroke-dasharray: 5 5
```

## Current execution matrix

| Tool | Implemented, CLI required | Not yet implemented |
|---|---|---|
| WordCraft | Inspect selected DOCX/ODT/RTF/Markdown/TXT, extract text, new PDF export | In-browser editing, full fidelity |
| CADCraft | Selected DXF/DWG info and SVG export | Full in-browser CAD |
| PdfCraft | One-PDF info/text; combine two PDFs into new file | OCR, signatures, annotations |
| Other eight Craft tools | Catalog only | Executable adapters |
| Gotenberg, Paperless-ngx, Stirling PDF, Collabora, Documenso | Listed as optional service candidates | Service deployment and authenticated connectors |

## Tested desktop setup

```mermaid
flowchart TB
  A["1. Clone / checkout PR #861 branch"] --> B["2. Install Node.js 22+ and trusted upstream CLI(s)"]
  B --> C["3. Start localhost Craft bridge"]
  C --> D["4. Open /creator-suite/tools.html on SAME desktop"]
  D --> E["5. Enter printed session token"]
  E --> F["6. Choose document or drawing"]
  F --> G["7. Execute allowlisted action with approval"]
  G --> H["8. Verify output; download separate result"]
```

PowerShell:
```powershell
$env:CIVWEAVE_CRAFT_ALLOWED_ORIGINS='https://civweave-staging.pages.dev'
node tools/creator-craft-bridge/server.mjs
```

Official upstream releases: [WordCraft](https://github.com/storytold/wordcraft/releases/latest), [CADCraft](https://github.com/storytold/cadcraft/releases/latest), [PdfCraft](https://github.com/storytold/pdfcraft/releases/latest).

**Security warning:** Loopback on an Android phone is the phone itself. This is *not* currently a phone-to-PC host-node link. Do not forward port 47871 or add a public tunnel to this bridge.

## Release decision

```mermaid
flowchart TB
  START["PR #861 source"] --> CI{"Craft + Quest + provenance CI green?"}
  CI -->|no| FIX["Repair root cause; rerun"]
  FIX --> CI
  CI -->|yes| SH{"Wider shell/release/capability gates green?"}
  SH -->|no| FIX
  SH -->|yes| RT{"Real upstream CLI/browser fidelity and origin acceptance verified?"}
  RT -->|no| MANUAL["Install actual binaries and run test documents; audit browser permission"]
  MANUAL --> RT
  RT -->|yes| STAGING["Review + merge to staging"]
  STAGING --> PROMOTE["Separately gate production promotion"]
```

See also [Craft + Business Integration Contract](CRAFT-BUSINESS-TOOLS-v1.md) and [local bridge setup](../tools/creator-craft-bridge/README.md).
