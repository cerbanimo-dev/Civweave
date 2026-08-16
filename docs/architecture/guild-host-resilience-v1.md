# Guild host resilience v1

Civweave treats a Guild as a replicated social system, not as one machine. A Guild may begin on one Pocket Node, one persistent local host, or a cloud-backed public edge. Those routes are replicas and service roles of the same Guild rather than separate kinds of community.

## Host routes

### Pocket Node — premier onboarding route

Creating a Guild from Android or iPhone creates an independent Guild identity on the steward device and enrolls that device as the founding Pocket Node whenever the installed local mesh is available. The device keeps the signed local replica, remains authorized while disconnected, and participates in the local WebRTC object mesh while Civweave is available to run.

A newly created Pocket Guild has **no implicit cloud primary**. It does not inherit the origin from which Civweave was downloaded, it does not create a Cloudflare Worker, and it does not consume Worker, Durable Object, compute, or storage capacity belonging to the source Guild. A Cloudflare/public gateway may be attached later only as an explicit expansion of that Guild.

Pocket Nodes use a bounded active synchronization window of **four peers per device**. Authorization is not rotated: only the live synchronization connections rotate. Peers with pending changes are favored, then peers with the stalest completed synchronization. This bounds radio, battery, socket, and memory pressure without shrinking Guild membership.

If the local mesh is not available during mobile onboarding, mobile Guild creation remains a Pocket route waiting for local mesh readiness. It must not silently fall back to the current website as a backend.

A PWA Pocket Node is opportunistic on mobile operating systems. It must never be treated as the sole always-running server. Future native companions may improve background availability without changing the replication contract.

### Persistent local nodes — maintained first-class routes

Desktop, laptop, Raspberry Pi, NAS, home-server, and similar Docker deployments remain first-class persistent nodes. Docker uses that machine's own CPU, storage, memory, and network connection. They use the same Guild identity and replication contract and are preferred when a community has hardware that can stay awake. Pocket Nodes complement these deployments rather than replace them.

### Optional Cloudflare public edge

A Guildkeeper may explicitly add an always-online Cloudflare doorway. The canonical setup runs Wrangler under the Cloudflare account the Guildkeeper authenticates for that Guild. It creates the Guild's Pages project plus the `civweave-host-edge` Worker and three starter Durable Object nodes in **that authenticated Cloudflare account**.

Cloudflare resources are never provisioned in the account or Worker capacity of the Guild from which a user happened to download Civweave. Download origin is software distribution provenance, not hosting authority.

The desired resilient Guild can therefore accumulate several independent copies when useful:

1. One or more Pocket Nodes carried by Guild members.
2. Optional persistent Docker nodes on desktops, Raspberry Pis, NAS devices, or home servers.
3. An optional Cloudflare public edge for always-online reachability and rendezvous.

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
