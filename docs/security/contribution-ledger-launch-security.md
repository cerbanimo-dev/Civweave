# Civweave contribution ledger launch security

Status: contribution-beta launch profile

This document defines the security boundary for shipping Buttons and Acorns on Civweave's local-first mesh. It is an operational contract, not a claim that the system is a permissionless cryptocurrency or Byzantine-finality network.

## Security goal

A phone must be able to participate without a host node while preventing a single device, a single wallet key, or an arbitrary collection of fresh identities from unilaterally creating or finalizing transferable contribution value.

The launch profile therefore separates four identities and roles:

1. **Transport device**: moves signed objects between peers. It is not monetary authority.
2. **Wallet root**: authorizes spending and validator-root membership. It is separate from the transport key and recoverable through a guardian threshold.
3. **Validator root**: an admitted wallet root bound to a current device. One root gets at most one committee seat.
4. **Federation policy anchor**: a threshold-signed statement defining the validator bootstrap set and current value-safety policy.

## Threat model

The launch profile explicitly defends against:

- one device inventing a transferable mint;
- one device witnessing its own transfer;
- many fresh device keys being generated to satisfy a witness threshold;
- a validator witnessing conflicting spends with the same wallet, asset, and nonce;
- replayed, duplicate, oversized, stale, or far-future ledger input;
- offline partitions being used for unbounded value movement;
- a lost phone permanently destroying the user's wallet;
- a stale or incomplete validator set silently degrading into weak finality;
- an operator accidentally enabling an external-value offramp before provider, compliance, and security review.

The launch profile does not claim to resist an adversary controlling a supermajority of admitted validator roots. That is the trust boundary of contribution-beta committee finality.

## Federation trust-anchor ceremony

Before transferable contribution value is enabled for a federation:

1. Create at least three independent genesis wallet roots on separately controlled devices.
2. Each genesis wallet must complete guardian recovery setup before validator registration.
3. Create a policy anchor containing the federation ID, random epoch seed, genesis public keys, launch limits, and expiration if desired.
4. Every required genesis root signs the anchor. The threshold is `floor(2n / 3) + 1`.
5. Exchange and compare the anchor hash out of band before installation.
6. Install the exact signed anchor on participating nodes.
7. Register the genesis validators on the contribution mesh.
8. Confirm that `launchStatus().readyForContributionValue` becomes true only after the required validator roots are visible.

A policy change, emergency halt, epoch rotation, or validator-bootstrap change requires another valid threshold-signed policy anchor. A single server or device cannot silently rewrite the policy.

## Validator admission and Sybil resistance

The launch profile does not treat a device key as a validator identity.

New validator roots require:

- a unique wallet root;
- a device binding signed by that wallet root;
- guardian recovery readiness;
- the minimum validator age from policy;
- independent attestations from already eligible validator roots;
- no objective equivocation fault;
- policy-defined contribution-history or bond requirements when those metrics are backed by committee-certified ledger state.

Committee selection is deterministic from the policy epoch seed, operation subject hash, and eligible root ID. A root can occupy only one committee seat even if it controls many devices.

For the browser launch profile, self-reported contribution history or self-reported stake must not be treated as Sybil resistance. Such metrics are advisory until derived from committee-certified ledger state.

## Mint security

`MintFinalized` is a candidate contribution event, not spendable authority by itself.

Transferable Buttons and Acorns enter the secure balance only when all of the following hold:

1. the mint references a claim, evidence root, and validation events;
2. a deterministic validator committee is reconstructed from the policy anchor and historical registry snapshot;
3. selected validator roots sign `MintSecurityWitnessed` events;
4. the selected-root quorum is reached;
5. `MintSecurityCertified` binds the candidate mint, policy hash, registry hash, committee hash, quorum, and witness hashes;
6. the certificate verifies when the balance projection is recomputed.

An arbitrary signed `MintFinalized` event is therefore visible as history but contributes zero secure transferable balance.

## Transfer security

A secure transfer consists of three layers:

1. `TransferSecurityIntent` freezes the policy, registry, committee, expiry, limits, and partition state for the proposed transfer.
2. The wallet-root-authorized base transfer and selected validator witness receipts establish the spend and observations.
3. `TransferSecurityCertified` binds the finalized transfer to the selected-root quorum.

Secure balance projection ignores an uncertified raw `TransferFinalized` event.

The origin and recipient wallet roots are excluded from validator committee selection for their own transfer when enough eligible roots exist.

## Partition policy

Offline use is supported, but offline value movement is deliberately bounded.

Default launch ceilings:

- 25 Buttons per offline transfer;
- 5 Acorns per offline transfer;
- 500 Buttons per transfer overall;
- 100 Acorns per transfer overall;
- 24-hour transfer-intent expiry;
- guardian recovery required above 5 Buttons or 1 Acorn.

If the local node cannot reconstruct a verified policy anchor or minimum eligible validator set, a transfer may remain a local pending intent when otherwise safe, but it cannot gain secure finality.

## Wallet recovery

The wallet root is separate from the transport-device key.

Recovery setup:

1. Generate the wallet root once on-device.
2. Encrypt the exported wallet private JWK with a random AES-256-GCM recovery key.
3. Split that recovery key using threshold secret sharing.
4. Give shares to at least three distinct guardians.
5. Require at least two shares for recovery.
6. Confirm distribution before setting `recoveryReady`.
7. Erase guardian share material from the active application record after distribution confirmation.

Recovery reconstructs the original wallet root, preserving the wallet ID and ledger ownership on a replacement device.

Guardian shares must be transported and stored outside the ordinary Civweave mesh unless a future encrypted guardian-delivery protocol is explicitly designed for them.

## Lost versus compromised wallet roots

The current launch profile solves **lost-device recovery**. It does not claim transparent cryptographic recovery from a wallet root whose private key has already been stolen.

If compromise is suspected:

1. rotate the federation policy into emergency-halt mode using the policy signature threshold;
2. stop new committee finality;
3. recover the affected wallet from guardian shares onto a clean device if the root itself is believed recoverable but the device was lost;
4. if the root key is believed exposed, treat the wallet as compromised and do not resume value finality for that root until a committee-certified wallet-freeze/migration protocol or an audited manual federation procedure is available.

This is a deliberate launch boundary. Low transfer ceilings and disabled external offramps keep the consequence bounded while that stronger compromised-root migration mechanism is developed and audited.

## Input and availability safety

Ship gates enforce:

- 128 KiB security-envelope limit;
- 500 envelopes per imported contribution bundle;
- far-future timestamp rejection;
- duplicate and causal-parent handling;
- per-wallet pending-transfer rate limits;
- per-validator witness rate limits;
- mesh storage-pressure reporting and value-readiness blocking.

The generic community-object transport predates the contribution security wrapper and remains a broader availability surface. Contribution-beta therefore treats transport flooding as an availability risk, not a value-integrity bypass: oversized or malformed contribution state must make `valueReady` fail closed. A future transport-level quota protocol should move rejection earlier in the receive path.

## External value and offramps

External offramps are disabled in the contribution-beta policy and the phone-ledger launch status.

A future fiat, stablecoin, or public-chain provider may settle or exchange already-existing Buttons or Acorns, but no external payment path may originate contribution currency. Enabling such a provider requires separate legal/compliance review, provider security review, reserve/settlement design, abuse controls, and an explicit signed policy change.

## Launch gates

Do not advertise transferable contribution value as ready unless all are true:

- [ ] Secure wallet exists independently from the transport key.
- [ ] At least three guardians were assigned and the recovery threshold was tested.
- [ ] Recovery shares were confirmed distributed and removed from active app storage.
- [ ] A federation policy anchor verifies at the required genesis threshold.
- [ ] At least the policy minimum of eligible validator roots are visible.
- [ ] A test mint reaches selected-root certification and only then changes secure balance.
- [ ] A fabricated raw mint does not change secure balance.
- [ ] A test transfer reaches selected-root certification and only then changes secure balance.
- [ ] Same-nonce conflicts block finality.
- [ ] Objective witness equivocation removes the faulty validator from eligibility.
- [ ] Offline transfer ceilings and expiry are enforced.
- [ ] Oversized, malformed, and future-dated input fail closed.
- [ ] External offramps report disabled.
- [ ] PWA install, offline package, recovery, service-worker, and production boot canaries pass.

## Launch classification

When all gates above pass, Civweave may ship this as **local-first contribution-beta value with federation committee finality**.

It should not be described as permissionless cryptocurrency consensus, trustless Byzantine finality, a bank account, a stablecoin, or a guaranteed fiat-equivalent asset.
