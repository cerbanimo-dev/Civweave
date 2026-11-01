# Civweave Collective ↔ OpenSimulator · Windows local setup

**Status:** JavaScript bridge, authenticated loopback relay, in-world LSL/OSSL controller, and Collective controls are implemented. The browser can send explicit human-approved `move` and `speak` commands to OpenSim NPCs and inspect controller result receipts. Local Fleet operator commands are device-private. Guild Fleet commands also require a registered signed Worldweaver pilot. **This has not been live-tested with your particular OpenSim installation; you must complete the steps below.**

The Civweave 3D renderer is a local geometry viewer, **not** a replacement for Firestorm or another OpenSim-native viewer. Without a region geometry exporter the Civweave visualization remains schematic, but the NPCs can still appear and move in the real OpenSim viewer. No OpenSim server, appearance data, or saved credentials are installed automatically on your computer.

## 1. Obtain the required software on your Windows mini PC

- **Node.js 22 or newer** — check with `node --version`. The source-side bridge needs Node; a deployed Civweave PWA is not itself a Node server.
- **.NET 8 x64 runtime** — check with `dotnet --list-runtimes` and look for `Microsoft.NETCore.App 8.x`.
- **OpenSimulator standalone x64**, preferably the published 0.9.3.0 stable binary package: https://opensimulator.dev/wiki/Download . Extract to a directory such as `C:\OpenSim\`. Leave it in standalone mode for the first test, without a public grid.
- An **OpenSim-compatible viewer** such as the OpenSim build of Firestorm. Firestorm/OSgrid viewer listing: https://www.osgrid.org/login_viewers . Use it to see actual NPC avatars, the live region, chat and movement.
- Civweave **staging source** (for the local Node relay, PowerShell launcher, and LSL scripts): https://github.com/cerbanimo-dev/Civweave/tree/staging . Either clone that branch or download its ZIP and extract it.

The Civweave controller bundle is in `tools/worldweaver/`:
- `start-opensim-civweave.ps1` — Windows launcher for OpenSim and the local bridge.
- `opensim-region-bridge.mjs` — loopback relay, tokens, controller heartbeat, bounded command queue and receipts.
- `opensim-civweave-npc-controller.lsl` — in-world NPC command controller.
- `opensim-save-npc-appearance.lsl` — temporary avatar-appearance capture helper.

## 2. Configure standalone OpenSimulator once

Inside `C:\OpenSim\bin\`, if `OpenSim.ini` is absent, copy `OpenSim.ini.example` to `OpenSim.ini`; for a fresh standalone source distribution also configure `StandaloneCommon.ini` and `FlotsamCache.ini` from their example files according to the official standalone guide.

Edit `OpenSim.ini` **in its existing matching sections**, without adding duplicate section headers:

```ini
[Const]
PublicPort = 9000

[Network]
http_listener_port = 9000
OutboundDisallowForUserScriptsExcept = 127.0.0.1:8769

[NPC]
Enabled = true
```

The `OutboundDisallowForUserScriptsExcept` entry is a **narrow exception** so only the selected local relay can be called from in-world scripts; do not disable the general outbound LAN block. Do not enable public RemoteAdmin or forward port 8769.

If `bin\config-include\osslEnable.ini` does not exist, copy `osslEnable.ini.example` and review the existing `[OSSL]` section. Under the existing `[OSSL]` section, permit only your estate owner or an exact approved avatar UUID for the functions this controller needs:

```ini
[OSSL]
AllowOSFunctions = true
Allow_osNpcCreate = ESTATE_OWNER
Allow_osNpcMoveTo = ESTATE_OWNER
Allow_osNpcGetPos = ESTATE_OWNER
Allow_osNpcSay = ESTATE_OWNER
Allow_osIsNpc = ESTATE_OWNER
Allow_osAgentSaveAppearance = ESTATE_OWNER
```

Some `osIsNpc` permissions may already be unrestricted; only add a per-function line if your version supports it. **Do not use `Allow_osNpcCreate = true` for all users** on a public region. Restart OpenSimulator after editing its INI files.

Start `OpenSim.exe` from its `bin` directory once. Follow the first-run region and estate-manager account prompts. Keep a simple 256 × 256 metre standalone region on port 9000 for this initial test. In the OpenSim console you can create another account with `create user` if needed.

## 3. Start both local processes

Open a PowerShell console from your extracted Civweave **staging source** directory:

```powershell
node --version
dotnet --list-runtimes
& .\tools\worldweaver\start-opensim-civweave.ps1 -OpenSimBin "C:\OpenSim\bin" -RegionId "civweave-region"
```

This launcher starts `OpenSim.exe` if it is not already running and hosts the Node relay at `http://127.0.0.1:8769` on **loopback only**. Leave both OpenSim and the PowerShell relay console open.

The relay prints **two different temporary secrets**:
1. **BROWSER CONTROL TOKEN** — paste only into Civweave's OpenSimulator section.
2. **IN-WORLD SCRIPT TOKEN** — paste only into the owner-controlled LSL script inside your own region.

The logical `-RegionId` is `civweave-region`; it must match the `REGION_ID` constant inside the LSL script. This is an allowlist ID for the relay, not OpenSimulator's region UUID.

To check the bridge is available before installing the in-world script:

```powershell
Invoke-RestMethod http://127.0.0.1:8769/status
```

Expected initially: `commandsEnabled: true`, `controllerConnected: false`. Once the in-world script starts polling, `controllerConnected` becomes `true`.

You can run the relay directly if desired:
```powershell
node tools/worldweaver/opensim-region-bridge.mjs - 8769 --live --region=civweave-region
```

Here the single dash means **no region geometry export file**; this does not disable real NPC control.

## 4. Install the in-world controller and a starter appearance

1. In Firestorm, connect to your standalone with grid login URI `http://127.0.0.1:9000` and the estate-manager credentials you created at first startup. OpenSim supports a `-loginuri http://127.0.0.1:9000` viewer launch option.
2. Rez one primitive on land owned by your estate-manager avatar, in a private area. Keep the object's scripts nontransferable and prevent other avatars from modifying its inventory.
3. In the object's Contents, create a script containing `opensim-save-npc-appearance.lsl`. Touch the prim with your owner avatar. It should create a notecard named **CivweaveAppearance** using your current appearance. Confirm the notecard exists, then **remove the appearance capture script**. Do not upload someone else's appearance without permission.
4. Add `opensim-civweave-npc-controller.lsl` to the same prim. Replace only `CONTROLLER_TOKEN` with the separate **IN-WORLD SCRIPT TOKEN** from PowerShell and verify `ENDPOINT = "http://127.0.0.1:8769"` and `REGION_ID = "civweave-region"`. Save and reset the controller script.
5. Re-run the status check. You need `controllerConnected: true`. The script checks every ~2 seconds when idle; this heartbeat only proves the script can talk to the relay, not that an NPC has moved.

**If the controller does not check in:** inspect Firestorm script errors and owner messages first. Verify `OutboundDisallowForUserScriptsExcept`, the exact token, Node relay still running, and your estate's OSSL permissions. On OpenSim versions with network-script filters, loopback requests are deliberately blocked until that narrow exception is set. Never fix this by allowing arbitrary private-network HTTP.

## 5. Connect Civweave and move an actual NPC

Open Civweave **staging** on the **same desktop browser running the relay**. Go to the Collective/Fleet page.

**Local Fleet (easiest initial test):**
1. Choose Local Fleet → **OpenSimulator · live NPC bridge**.
2. Keep `http://127.0.0.1:8769/region` as the bridge URL and paste the **BROWSER CONTROL TOKEN** from PowerShell.
3. Select the local operator NPC role (start with Kami); click **Connect / refresh OpenSim**. The controller should show connected. No Guild founding signer or local language model is required for these *manual* operator actions.
4. Set X, Y, Z to a valid in-region position, for example `128, 128, 28` if the target ground is accessible. Click **Move selected NPC to XYZ**, then **Check last result** after movement. The first command creates an NPC from the saved appearance card. Successful movement requires the in-world script to *observe* the NPC within 1.75 metres of the requested target; merely queueing the command is not success.
5. Type a short message into NPC dialogue, click **NPC speak**, then check the result. Look for the character in Firestorm and in-world local chat.

**Guild Fleet:** select an authorized Guild world and register the Starling persona with a **device-local AI model** first. Commands in this scope additionally use the signed Worldweaver pilot registry. If you created the Guild from a different founding device, that device must provision and register the Guild pilot under the existing signer policy; **local operator controls do not bypass Guild authorization**.

**Important:** The NPC controller receives operator commands, not model-generated tool calls. Model-directed autonomous movement, Guild tool receipts, and model identity authentication require a separate trusted runtime-to-simulator executor. Nothing in this setup authorizes autonomous AI access, member votes, task completion or money movement.

## 6. Add the actual OpenSim region geometry to Civweave (optional)

The local bridge accepts an optional **approved and privacy-filtered** `civweave.opensim-region-geometry.v1` JSON file produced by an OpenSimulator region module or an operator-approved exporter. This project includes the validated **format and viewer**, but not a compiled region-module DLL. A normal OpenSimulator install does not automatically expose that JSON.

If you have such an export, start the relay with its full filename instead of the dash:

```powershell
& .\tools\worldweaver\start-opensim-civweave.ps1 -OpenSimBin "C:\OpenSim\bin" -RegionId "civweave-region" -RegionExport "C:\CivweaveRegion\authorized-region.json"
```

Civweave then shows read-only source geometry in a 3D preview (and, for an authorized signed Guild room, both 2D and 3D Worldweaver views). Source geometry is **not** live NPC positioning and not a native OpenSim viewer. The region-export endpoint is GET-only, bounded to 2 MB, restricted by CORS, and never exposes the region admin API.

An OpenSim console `save oar` exports an archive, **not** the bridge JSON schema; do not point the bridge at an `.oar` directly.

## 7. Diagnostics

| Symptom | Verify |
| --- | --- |
| OpenSim does not start | `.NET 8` installed; launch from `bin`; first-run configuration and port 9000 availability |
| Firestorm cannot log in | Standalone login URI and local ports; `Regions.ini` public hostname and UDP region port |
| Local bridge unreachable | Node 22+, relay console open, correct local port and browser/Windows local-network permissions |
| `controllerConnected: false` | Script running, narrow outbound HTTP exception, controller token, owner-only OSSL |
| NPC not created | `[NPC] Enabled = true`, appearance notecard, `osNpcCreate` estate permission |
| Command rejected in Guild Fleet | Selected persona must be registered to the signed Worldweaver room by an authorized founder |
| Move timed out | Valid terrain height, unobstructed target and NPC pathfinding; use Firestorm to inspect the avatar |
| Geometry remains schematic | No approved `region.json` exporter connected; does not prevent Firestorm NPC control |
| Phone browser cannot connect | The bridge binds to desktop loopback only; `127.0.0.1` on a phone means the phone, not the desktop |

Never upload either token, avatar appearance notecard, region inventories, or private region archives to the shared Guild mesh.

## Tested boundaries

Run locally with Node 22 in the source checkout:

```powershell
node --test scripts/test-opensim-region-bridge-v1.mjs scripts/test-opensim-live-controls-v1.mjs scripts/test-opensim-browser-actions-v1.mjs scripts/test-starling-opensim-connect-v1.mjs
```

These cover browser requests, token separation, queue/receipt semantics, authorization failures and UI wiring against a **simulated in-world HTTP client**, not a live OpenSimulator server or a compiled LSL script.
