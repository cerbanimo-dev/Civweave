# OpenSim region export in the Civweave Collective

The Collective can display real, permission-filtered OpenSimulator **region geometry** in its Worldweaver 3D preview and 2D map. This is deliberately **not** an OpenSim network viewer and does not start OpenSimulator, connect a grid account, authenticate an NPC pilot, control avatars, send movement packets, or create authoritative simulation receipts. The existing Worldweaver Guild signed manifest still owns room and pilot registration; imported geometry remains on the viewing device.

## Requirements

1. Run a reachable OpenSimulator instance with a trusted operator-approved region-export module or an existing export job. The exporter must write a **sanitized** `civweave.opensim-region-geometry.v1` JSON file to the local machine. Do not export owner names, scripts, credentials, parcels, hidden or unauthorized objects, private messages, or avatars. The operator must control which objects are disclosed. Civweave does **not** install or supply an OpenSim region module.
2. On the **same computer as the browser** (loopback is browser-local), launch the read-only bridge:

```powershell
node tools/worldweaver/opensim-region-bridge.mjs C:\\path\\to\\authorized-region.json 8769
```

3. In Civweave open your Guild’s Collective → **Guild Fleet** → **Start local world** on the founding device if needed. Select the signed Worldweaver room and enter `http://127.0.0.1:8769/region` in **OpenSim region export**, then choose **Connect / refresh region**. Select **3D Scene** or **2D Map**; both use the same exported triangles. Refresh again after the exporter updates the file. Disconnect returns to provisional local geometry.

The bridge binds only to `127.0.0.1` and serves **GET /region**. It reads the file per request, validates source/schema/bounds/face budget, limits exports to 2 MB, and restricts CORS to official Civweave origins and local development hosts. It has no edit API, RemoteAdmin access, file writing, arbitrary file path routes, model credentials, or Guild signing access. A distant browser, a phone on the LAN, or a public OpenSim grid cannot reach this particular loopback server; run the bridge on the browser host or use a separately designed, authenticated LAN capability.

## Export schema example

This is an illustrative shape for the operator to export, **not** proof of a connected simulator:

```json
{
  "schema":"civweave.opensim-region-geometry.v1",
  "source":"opensim-region-module",
  "regionId":"my-sanitized-region",
  "revision":1,
  "size":{"x":256,"y":256},
  "objects":[{
    "id":"public-stage",
    "name":"Public stage",
    "kind":"building",
    "position":{"x":128,"y":128,"z":2},
    "parts":[{
      "id":"public-stage-box",
      "name":"Stage platform",
      "type":"box",
      "offset":{"x":0,"y":0,"z":0},
      "scale":{"x":12,"y":8,"z":2},
      "color":"#658d80"
    }]
  }]
}
```

Other supported part types are `cylinder` and `mesh` with approved indexed vertices/triangles. OpenSim assets using sculpt textures or advanced parametric meshes require operator-side triangulation rather than being mislabeled as exact. The browser source loader rejects provisional data labeled as genuine OpenSim exports.

## Known integration boundary

Worldweaver’s existing **Observe room** uses the authorized room and displayed geometry. **Prepare move** creates a bounded proposal for a registered Starling pilot but intentionally does **not** execute movement. Live autonomous movement requires an authenticated, operator-installed OpenSim action adapter and trusted Worldweaver pilot executor that can issue, verify, and persist simulator receipts. No such adapter is connected merely by enabling the geometry bridge.

## Automated coverage

`node --test scripts/test-starling-opensim-connect-v1.mjs scripts/test-opensim-region-bridge-v1.mjs`

Other relevant suites: `scripts/test-worldweaver-commune-host-v1.mjs`, `scripts/test-worldweaver-fleet-simulator-v1.mjs`, and `scripts/test-starling-lounge-contract-v1.mjs`. The Starling staging workflow runs the exporter bridge and the Lounge tests.
