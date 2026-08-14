# Civweave RC16: Launch Forge

RC16 is the release-hardening pass for the first invite-only hosted pilot. It adds survivability rather than another product branch.

## Launch model

Civweave remains local-first. Hosted infrastructure supplies optional continuity:

- portable Weaver identity sessions
- encrypted relay delivery
- hosted intelligence and research
- bounded account projections
- moderation and support
- public system status

The host does not become the authority for local curricula, task ledgers, coin balances, Cerbanimo Co credits, or private keys.

## Hosted authentication

The hosted account is linked to a portable Weaver identity.

1. The host issues a five-minute challenge.
2. The authorized device signs it with its local ECDSA P-256 key.
3. The host verifies the public key and creates an HttpOnly, Secure, SameSite=Lax session.
4. Lost-device recovery consumes one single-use recovery code.
5. Devices can be revoked without erasing their local files.

The raw `oai-authenticated-user-email` header is no longer trusted by account storage. A trusted upstream may be enabled only with a matching `CIVWEAVE_TRUSTED_AUTH_HEADER_SECRET`.

## Pilot controls

The hosted pilot defaults to invitation-only. Any documented pilot environment switch must be verified against the active deployed entry before it is relied on as a launch control. A documentation-only environment variable is not a security boundary.

Reward issuance remains proof-of-human-labor conditional minting. Transparent pilot caps limit abuse:

- 500 Fellowfare coins per labor submission
- 1,500 labor coins per identity per day
- 40 validator coins per identity per day
- 30 level-up coins per identity per day

These limits do not change the issuance principle or rewrite historical receipts.

## Operator console

`/operator` provides account/session counts, relay counts, 24-hour operation and AI-spend summaries, launch feature switches, invite generation, moderation, incident publication, backup manifests, restore-drill recording, and privacy-bounded audit events. It must never display relay plaintext, private keys, full AI prompts, or unrelated evidence.

## Public status

`/status` publishes campus, hosted-account, hosted-intelligence, curriculum-research, encrypted-relay, and rewards health. Operators can publish and resolve incidents without exposing private diagnostic material.

## Policies

`/policies` publishes privacy and data boundaries, terms of use, the reward constitution, community standards, and the adult-only initial hosted-pilot boundary. Consent receipts are versioned and can be withdrawn for optional hosted features.

## Moderation

Authenticated users can report harassment, scams, impersonation, unsafe curricula, prohibited market items, privacy issues, or validation collusion; mute or block another Weaver identity; and inspect their own report history. Operators can review, resolve, dismiss, or escalate reports. Moderation never deletes a user’s local export.

## Backup and restore

Create and verify a D1 backup:

```bash
python3 scripts/civweave_d1_backup.py backup \
  --database DB \
  --output backups/DB-$(date +%Y%m%d-%H%M%S).sql
```

Verify an existing export without contacting Cloudflare:

```bash
python3 scripts/civweave_d1_backup.py verify --input backups/<file>.sql
```

Remote restore is deliberately guarded. Verify the SHA-256 manifest, use a clean or explicitly prepared target, and pass the danger flag only during an intentional drill or incident:

```bash
python3 scripts/civweave_d1_backup.py restore \
  --database DB \
  --input backups/<file>.sql \
  --expected-sha256 <sha256-from-manifest> \
  --confirm-remote-restore
```

The verifier reconstructs the SQL export in temporary SQLite storage, runs `PRAGMA integrity_check`, inventories the restored tables, and writes a SHA-256 manifest. A real clean-target restore drill must be completed before opening invitations and repeated before each major migration.

## Release integrity

The canonical executable launch gate is:

```bash
node scripts/run-launch-gate-v1.mjs
```

It runs the repository regression suite, release-discipline checks, production dependency audit, PWA cold-launch recovery verifier, low-end local-AI contract verifier, per-user Cloudflare compute-boundary tests, and backup-tool checks.

For a public promotion, use the fail-closed form:

```bash
node scripts/run-launch-gate-v1.mjs --public
```

The public form additionally requires every administrative, production, legal, restore-drill, and physical-device evidence gate in `ops/launch/public-launch-readiness-v1.json` to be marked `pass` with durable evidence. Static CI is not accepted as a substitute for evidence that can only come from a real device, production deployment, repository administration, legal review, or restore drill.

The release-integrity layer also retains static secret scanning, reproducible artifact assembly through `SOURCE_DATE_EPOCH`, an SPDX-style dependency inventory, a release-integrity manifest, optional HMAC signing with `CIVWEAVE_RELEASE_SIGNING_KEY`, and the production signing gate through `CIVWEAVE_REQUIRE_SIGNED_RELEASE=1` where configured.

## Recommended launch stages

### Closed alpha

Five to ten trusted participants. No cash redemption. Test authentication, recovery, automatic validation, reward pacing, encrypted sync, restore drills, and actual weak-device behavior.

### Invite-only public beta

Fifty to two hundred participants after operator monitoring, moderation response, budget controls, backup restoration, legal/policy review, and rollback have been exercised.

### Public beta

Open only after the strict public launch gate passes, at least thirty days have elapsed without unrecoverable data loss, no critical security finding remains unresolved, hosted-intelligence costs are predictable, and rollback has been tested.
