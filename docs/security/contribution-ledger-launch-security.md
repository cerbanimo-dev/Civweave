# Civweave contribution ledger launch security

Status: contribution-beta launch profile

This document defines the security boundary for shipping Buttons and Acorns on Civweave's local-first mesh. It is an operational contract, not a claim that the system is a permissionless cryptocurrency or Byzantine-finality network.

## Security goal

A phone must be able to participate without a host node while preventing a single device, a single wallet key, or an arbitrary collection of fresh identities from unilaterally creating or finalizing transferable contribution value.

The launch profile separates four identities and roles:

1. **Transport device** moves signed objects between peers. It is not monetary authority.
2. **Wallet root** authorizes spending and validator-root membership. It is separate from the transport key and recoverable through a guardian threshold.
3. **Validator root** is an admitted wallet root bound to a current device. One root gets at most one committee seat.
4. **Federation policy anchor** is a threshold-signed statement defining the validator bootstrap set and current value-safety policy.

## Threat model

The launch profile explicitly defends against:

- one device inventing a transferable mint;
- one device witnessing its own transfer;
- fresh device keys being generated to fake a witness threshold;
- a validator witnessing conflicting same-nonce spends;
- replayed, duplicate, oversized, stale, or far-future ledger input;
- offline partitions being used for unbounded value movement;
- a lost phone permanently destroying the user's wallet;
- a stale or incomplete validator set silently degrading into weak finality;
- a suspected compromised wallet continuing to gain new secure finality after a committee-certified freeze;
- an operator accidentally enabling an external-value offramp before provider, compliance, and security review.

The launch profile does not claim to resist an adversary controlling a supermajority of admitted validator roots. That is the trust boundary of contribution-beta committee finality.

## Human-facing security controls

The installed PWA carries `/app/contribution-security-v1.html` in the required lightweight shell. The canonical settings surface links to it through `contribution-security-settings-entry-v1.js`.

The control surface exposes:

- launch readiness and blockers;
- guardian recovery creation and distribution confirmation;
- federation anchor creation, signing, verification, and installation;
- validator enrollment and root attestation;
- committee wallet-freeze request, witness, and certification;
- contribution-state quarantine diagnostics.

Security setup therefore remains usable while the larger campus download is paused or incomplete.

## Federation trust-anchor ceremony

Before transferable contribution value is enabled for a federation:

1. Create at least three independent genesis wallet roots on separately controlled devices.
2. Each genesis wallet completes guardian recovery before validator registration.
3. Create a policy anchor containing the federation ID, random epoch seed, genesis public keys, launch limits, and optional expiration.
4. Genesis roots sign the exact anchor hash. The threshold is `floor(2n / 3) + 1`.
5. Exchange and compare the anchor hash out of band.
6. Install the exact threshold-signed anchor on participating nodes.
7. Register the genesis validators on the contribution mesh.
8. Confirm `launchStatus().readyForContributionValue` becomes true only after the minimum validator roots are visible.

A policy change, emergency halt, epoch rotation, or validator-bootstrap change requires another valid threshold-signed policy anchor. A single server or device cannot silently rewrite policy.

## Validator admission and Sybil resistance

The launch profile does not treat a device key as a validator identity.

New validator roots require:

- a unique wallet root;
- a device binding signed by that wallet root;
- guardian recovery readiness;
- the minimum validator age from policy;
- independent attestations from already eligible validator roots;
- no objective equivocation fault;
- policy-defined contribution-history or bond requirements only when those metrics are derived from committee-certified ledger state.

Committee selection is deterministic from the policy epoch seed, operation subject hash, and eligible root ID. A root can occupy only one committee seat even if it controls many devices.

Self-reported contribution history or self-reported stake is not treated as Sybil resistance.

## Mint security

`MintFinalized` is a candidate contribution event, not spendable authority by itself.

Transferable Buttons and Acorns enter secure balance only when:

1. the mint references a claim, evidence root, and validation events;
2. a deterministic validator committee is reconstructed from the policy anchor and historical registry snapshot;
3. selected validator roots publish `MintSecurityWitnessed` events;
4. selected-root quorum is reached;
5. `MintSecurityCertified` binds the candidate, policy hash, registry hash, committee hash, quorum, and witness hashes;
6. the certificate verifies during balance recomputation.

An arbitrary signed `MintFinalized` remains visible as history but contributes zero secure transferable balance.

## Transfer security

A secure transfer consists of three layers:

1. `TransferSecurityIntent` freezes policy, registry, committee, expiry, limits, and partition state for the proposal.
2. The wallet-root-authorized transfer plus selected validator witnesses establish the spend and observations.
3. `TransferSecurityCertified` binds finalized transfer state to selected-root quorum.

Secure balance ignores an uncertified raw `TransferFinalized` event.

The origin and recipient wallet roots are excluded from their transfer committee when enough eligible roots exist.

## Partition policy

Offline use is supported, but value movement is deliberately bounded.

Default launch ceilings:

- 25 Buttons per offline transfer;
- 5 Acorns per offline transfer;
- 500 Buttons per transfer overall;
- 100 Acorns per transfer overall;
- 24-hour transfer-intent expiry;
- guardian recovery required above 5 Buttons or 1 Acorn.

If a node cannot reconstruct a verified policy anchor or minimum eligible validator set, an otherwise-safe transfer may remain pending but cannot gain secure finality.

## Wallet recovery

The wallet root is separate from the transport-device key.

Recovery setup:

1. Generate the wallet root once on-device.
2. Encrypt the exported wallet private JWK with a random AES-256-GCM recovery key.
3. Split that key using threshold secret sharing.
4. Give shares to at least three distinct guardians.
5. Require at least two shares for recovery.
6. Confirm distribution before setting `recoveryReady`.
7. Erase guardian-share copies from active application storage after confirmation.

Recovery reconstructs the original wallet root, preserving wallet ID and ledger ownership on a replacement device.

Guardian shares must be transported and stored outside ordinary public or federated Civweave mesh objects.

## Lost and compromised wallet containment

Lost-device recovery and suspected-key containment are distinct operations.

For suspected compromise:

1. any participant may publish a `WalletFreezeRequested` proposal with evidence references;
2. a deterministic validator committee is reconstructed from the request, historical policy anchor, and registry snapshot;
3. only selected validator roots can publish valid `WalletFreezeWitnessed` receipts;
4. quorum produces `WalletSecurityFrozen`;
5. once the certificate verifies, honest clients refuse new secure transfer creation, validators refuse new witnesses, and finalizers refuse new secure finality for that wallet;
6. the local phone ledger reports `local-wallet-frozen` as a launch blocker when its own wallet is frozen.

A request alone cannot freeze value, and no host or administrator receives unilateral freeze authority.

The launch profile still does not automatically migrate a wallet whose root private key is known to be stolen. A frozen compromised wallet remains contained until a separately audited committee-certified migration protocol or explicit federation recovery procedure is introduced. This is intentionally safer than silently assigning recovery authority to a single service.

## Input and availability safety

Ship gates enforce:

- 128 KiB contribution-security envelope limit;
- 500 envelopes per imported contribution bundle;
- far-future timestamp rejection;
- duplicate and causal-parent handling;
- per-wallet pending-transfer rate limits;
- per-validator witness rate limits;
- mesh storage-pressure reporting and value-readiness blocking;
- a ship-guard sweep that quarantines oversized or future-dated contribution rows and removes oversized contribution objects that entered through the older generic transport lane.

The generic community-object transport remains a broader availability surface. Contribution-beta therefore treats transport flooding as an availability risk rather than a value-integrity bypass. A future transport-level quota protocol should reject hostile objects earlier in the receive path.

## External value and offramps

External offramps are disabled in the contribution-beta policy and phone-ledger launch status.

A future fiat, stablecoin, or public-chain provider may settle or exchange already-existing Buttons or Acorns, but no external payment path may originate contribution currency. Enabling one requires separate legal/compliance review, provider security review, reserve/settlement design, abuse controls, and an explicit signed policy change.

## Launch gates

Do not advertise transferable contribution value as ready unless all are true:

- [ ] Secure wallet exists independently from the transport key.
- [ ] At least three guardians are assigned and the recovery threshold has been tested.
- [ ] Recovery shares are confirmed distributed and removed from active app storage.
- [ ] Federation policy anchor verifies at the required genesis threshold.
- [ ] At least the policy minimum of eligible validator roots are visible.
- [ ] A test mint reaches selected-root certification and only then changes secure balance.
- [ ] A fabricated raw mint does not change secure balance.
- [ ] A test transfer reaches selected-root certification and only then changes secure balance.
- [ ] Same-nonce conflicts block finality.
- [ ] Objective witness equivocation removes the faulty validator from eligibility.
- [ ] A wallet-freeze request alone does not freeze a wallet.
- [ ] A selected-root freeze quorum blocks subsequent secure finality.
- [ ] Offline transfer ceilings and expiry are enforced.
- [ ] Oversized, malformed, and future-dated input fail closed or are quarantined.
- [ ] External offramps report disabled.
- [ ] Security controls are accessible offline from the installed shell.
- [ ] PWA install, offline package, recovery, service-worker, root-hygiene, and production boot canaries pass.

## Launch classification

When all gates above pass, Civweave may ship this as **local-first contribution-beta value with federation committee finality**.

It should not be described as permissionless cryptocurrency consensus, trustless Byzantine finality, a bank account, a stablecoin, or a guaranteed fiat-equivalent asset.
