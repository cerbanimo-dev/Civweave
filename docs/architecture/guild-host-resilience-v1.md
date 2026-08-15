# Guild host resilience v1

Civweave treats a Guild as a replicated social system, not as one machine. The Cloudflare Host Node remains the convenient always-online rendezvous and public service endpoint, while local replicas preserve Guild continuity when the Internet or the cloud path is unavailable.

## Host routes

### Pocket Node — premier onboarding route

Creating a Guild from Android or iPhone enrolls the steward device as a Pocket Node whenever the installed local mesh is available. The device keeps an encrypted/signed local replica, remains authorized while disconnected, reconciles with the Cloudflare Host Node when reachable, and participates in the local WebRTC object mesh while Civweave is available to run.

Pocket Nodes use a bounded active synchronization window of **four peers per device**. Authorization is not rotated: only the live synchronization connections rotate. Peers with pending changes are favored, then peers with the stalest completed synchronization. This bounds radio, battery, socket, and memory pressure without shrinking Guild membership.

If the local mesh is not available during mobile onboarding, the Cloudflare Host Node remains the immediate route. The steward session can complete Pocket Node enrollment later when the mesh becomes available.

A PWA Pocket Node is opportunistic on mobile operating systems. It must never be treated as the sole always-running server. Future native companions may improve background availability without changing the replication contract.

### Persistent local nodes — maintained first-class routes

Desktop, laptop, Raspberry Pi, NAS, home-server, and similar Docker deployments remain first-class persistent nodes. They use the same Guild identity and replication contract and are preferred when a community has hardware that can stay awake. Pocket Nodes complement these deployments rather than replace them.

The desired resilient Guild therefore has several independent copies when possible:

1. Cloudflare Host Node for public reachability and rendezvous.
2. One or more Pocket Nodes carried by Guild members.
3. Optional persistent Docker nodes on desktops, Raspberry Pis, NAS devices, or home servers.

No route is allowed to make another route non-canonical or silently retire it.

## Emergency shared AI hosting

A host may explicitly opt in to offer its local AI as an emergency shared inference provider. The opt-in control itself remains locked until the host passes the performance checks for **both premier response tiers**:

- `fast`
- `smart`

The policy intentionally names tiers rather than model IDs. The response router owns which model is premier for each tier. At present those tiers resolve to the two Gemma 4 26B quantization routes; when Civweave changes premier models, emergency-host eligibility follows the tier definitions automatically.

A pass must belong to the tier's current primary model and meet Civweave's current smooth-performance benchmark. A stale benchmark from a model that is no longer primary does not qualify. Eligibility is rechecked when requests execute, so an opted-in host that later falls below the current tier requirements stops serving emergency requests until it qualifies again.

Emergency AI uses the existing signed local-object mesh rather than a second peer protocol. An eligible host publishes a short-lived capability advert. A requester creates an addressed, bounded inference-request object for one eligible provider. The provider executes the request through its FIFO queue on the requested current premier tier and publishes an addressed result object back to the requester. Emergency requests do not grant tool use or external research access.

The default emergency scheduler is FIFO. Other schedulers may be added later behind the same eligibility gate. Emergency hosting is always opt-in and exposes queue depth and current tier eligibility to the operator.

## Guildkeeper expansion requirement

Guild governance must scale with membership. The canonical requirement is:

**At least one effective Guildkeeper for every 28 Guild members.**

The founding host counts as the primary Guildkeeper. Additional Guildkeepers are appointed as the Guild grows:

- members 1–28: minimum 1 Guildkeeper
- members 29–56: minimum 2 Guildkeepers
- members 57–84: minimum 3 Guildkeepers
- and so on

Paid hosting capacity does not bypass this rule. If the next admission would cross a 28-member-per-Guildkeeper boundary, admission is blocked until another Guildkeeper is appointed. Removing a Guildkeeper is likewise blocked when it would leave the current membership above the permitted ratio.

The Guildkeeper portion of host earnings is allocated deterministically across the effective Guildkeeper roster. Allocation preserves every cent; indivisible remainder cents are assigned in stable recipient order. This allocation belongs to the Guildkeeper share only and does not alter the system/compute or Cerbanimo shares.

### Payout boundary

The current money edge has one connected payout account per Host Node and therefore cannot safely fan the Guildkeeper allocation out to multiple bank/Stripe destinations yet. The capacity authority now computes the canonical per-Guildkeeper entitlement, but live payout fan-out must remain disabled until each appointed Guildkeeper can enroll a verified payout destination and the money edge can version that payout roster, issue separate idempotent transfers, and reverse/refund those transfers correctly. Ledger allocation must not be represented as completed external payout before that money-edge work exists.
