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

The hosted pilot defaults to invitation-only:

```env
CIVWEAVE_PILOT_MODE=1
CIVWEAVE_ALLOW_LOCAL_PREVIEW_ACCOUNTS=false
```

The operator console can create limited-use, expiring invitations. Only invitation hashes are stored.

Reward issuance remains proof-of-human-labor conditional minting. Transparent pilot caps limit abuse:

- 500 Fellowfare coins per labor submission
- 1,500 labor coins per identity per day
- 40 validator coins per identity per day
- 30 level-up coins per identity per day

These limits do not change the issuance principle or rewrite historical receipts.

## Operator console

`/operator` provides:

- account and active-session counts
- relay packet counts
- 24-hour operation and AI-spend summaries
- launch feature switches
- invite generation
- moderation queue
- incident publication
- backup manifests
- restore-drill recording
- privacy-bounded audit events

The console never displays relay plaintext, private keys, full AI prompts, or unrelated evidence.

## Public status

`/status` publishes the health of:

- campus
- hosted accounts
- hosted intelligence
- curriculum research
- encrypted relay
- rewards

Operators can publish and resolve incidents without exposing private diagnostic material.

## Policies

`/policies` publishes:

- privacy and data boundaries
- terms of use
- reward constitution
- community standards
- adult-only initial hosted-pilot boundary

Consent receipts are versioned and can be withdrawn for optional hosted features.

## Moderation

Authenticated users can:

- report harassment, scams, impersonation, unsafe curricula, prohibited market items, privacy issues, or validation collusion
- mute another Weaver identity
- block another Weaver identity
- inspect their own report history

Operators can review, resolve, dismiss, or escalate reports. Moderation never deletes a user’s local export.

## Backup and restore

Create and verify a D1 backup:

```bash
python3 scripts/civweave_d1_backup.py backup --database DB --remote
python3 scripts/civweave_d1_backup.py verify --input backups/<file>.sql
```

Remote restore requires an explicit danger flag:

```bash
python3 scripts/civweave_d1_backup.py restore \
  --database DB \
  --input backups/<file>.sql \
  --remote \
  --confirm-remote-restore
```

Each backup is checked with `PRAGMA integrity_check`, required tables are confirmed, and a SHA-256 manifest is written.

A restore drill should be completed before opening invitations and repeated before each major migration.

## Release integrity

Run:

```bash
npm ci
npm run typecheck
npm run lint
npm run validate:release
```

RC16 adds:

- static secret scanning
- launch-boundary checks
- reproducible artifact assembly through `SOURCE_DATE_EPOCH`
- an SPDX-style dependency inventory
- a release-integrity manifest
- optional HMAC signing with `CIVWEAVE_RELEASE_SIGNING_KEY`
- a production gate through `CIVWEAVE_REQUIRE_SIGNED_RELEASE=1`

## Recommended launch stages

### Closed alpha

Five to ten trusted participants. No cash redemption. Test authentication, recovery, automatic validation, reward pacing, encrypted sync, and restore drills.

### Invite-only public beta

Fifty to two hundred participants after operator monitoring, moderation response, budget controls, backup restoration, and policy review have been exercised.

### Public beta

Open only after at least thirty days without unrecoverable data loss, no unresolved critical security findings, predictable hosted-intelligence costs, and a tested rollback procedure.
