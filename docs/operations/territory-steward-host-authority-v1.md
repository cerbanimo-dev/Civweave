# Territory Steward Host Authority v1

Civweave Territory Stewards may operate a Host Node that can sponsor new Host Nodes inside their appointed territory without receiving the canonical root's fabric secrets.

## Trust model

The canonical Civweave core remains the root trust anchor. A Territory Host Authority is a bounded delegation from an existing Territory Steward appointment to one specific Civweave node key.

A Territory Host Authority may:

- issue short-lived, single-use admissions for ordinary Host Nodes;
- sponsor nodes in its appointed territory or any child territory;
- revoke an unused grant by allowing it to expire and request root revocation of the authority when necessary.

A Territory Host Authority may not:

- bind another Territory Host Authority;
- grant Territory Steward status;
- read or receive `NODE_FABRIC_OPERATOR_TOKEN`;
- read or receive `NODE_FABRIC_BINDING_TOKEN`;
- bypass the candidate node's proof-of-key challenge;
- sponsor a Host outside its territory tree.

The root can revoke a Territory Host Authority immediately. Previously issued but unconsumed grants stop working once the authority is revoked.

## Why this is safer than copying the main Host's credentials

The main node fabric currently keeps `NODE_FABRIC_OPERATOR_TOKEN` and `NODE_FABRIC_BINDING_TOKEN` as central secrets. Community and account-edge nodes intentionally do not receive them. Territory Host Authority preserves that boundary.

The Steward node instead uses its own persistent Ed25519 receipt identity. The root performs a one-time binding between an active Territory Steward appointment and that public node key. From then on, the Steward's local operator console signs host-admission requests with the node key. The core verifies the signature against the bound public key.

The candidate Host Node still proves possession of its own Ed25519 key by answering a fresh challenge from the core before the admission can be consumed.

## One-time root binding

The Territory Steward first needs a publicly reachable Civweave node that exposes:

- `GET /api/ai/node/manifest`
- `POST /api/ai/node/live/challenge`

The canonical root operator then binds that node to an existing Territory Steward appointment:

```powershell
$env:NODE_FABRIC_BINDING_TOKEN = "<root-only-secret>"
node scripts/bind-territory-host-authority-v1.mjs `
  --appointment-id steward-us-cami-20260814 `
  --node-id <territory-steward-node-id> `
  --operator-id <territory-steward-operator-id> `
  --callback-url https://<public-node-base>/
```

Do not send the root binding token to the Territory Steward. This command belongs in the canonical root operator environment.

The same script can bind any appointed Territory Steward after replacing the appointment and node identity.

## Territory Steward workflow

Open the Territory Host Authority console on the Steward's local Host/Anchor:

`/app/territory-host-authority-v1.html`

The page obtains the existing loopback-only operator session. It never asks for or stores a Civweave root secret.

To sponsor a partner, enter:

1. the target territory;
2. the partner Host ID;
3. the partner node ID;
4. the partner operator ID;
5. the partner node's public HTTPS base URL.

Civweave returns one admission grant. Send that grant to the intended partner over the communication channel you already trust. The grant is bound to the supplied host/node/operator/callback identity, expires quickly, and is single-use.

## New Host workflow

The prospective Host Node must already be running far enough to expose its manifest and live proof challenge.

On that node, open the same local console, paste the admission, and choose **Claim Host admission**. The node's operator session submits its own identity to the core. The core then:

1. checks that the grant is valid, unexpired, unconsumed, and still backed by an active Territory Host Authority;
2. checks that every identity field exactly matches the grant;
3. fetches the candidate manifest itself;
4. sends a fresh random challenge to the candidate;
5. verifies the Ed25519 response against the candidate's advertised public key;
6. atomically consumes the grant;
7. admits the node to the canonical Civweave node directory;
8. records both Territory Host admission audit history and canonical launch audit history.

## Scope inheritance

Territory matching is hierarchical. An authority for `us` may sponsor a node into a child territory such as `us-mo-kc`. An authority for `us-mo-kc` cannot sponsor a node into `us`, `us-ca-la`, or `jp`.

This follows the existing territory hierarchy rather than creating a second geographic policy system.

## Revocation

The canonical root operator can revoke a delegated authority:

```powershell
$env:NODE_FABRIC_BINDING_TOKEN = "<root-only-secret>"
node scripts/bind-territory-host-authority-v1.mjs --revoke <authority-id>
```

Revocation blocks further grants and invalidates all still-unconsumed grants from that authority. It does not silently delete already admitted Hosts; removing or suspending an admitted Host is a separate governance/operations action and remains auditable.

## Deliberate non-recursion

`can_delegate_authority` is false in v1. Territory Stewards can spread ordinary Host capacity to trusted partners, but cannot create new Territory Steward authorities. Granting that stronger office remains a root/governance action.

That asymmetry is intentional: capacity can fan outward while the chain that creates new trust issuers stays narrow and reviewable.
