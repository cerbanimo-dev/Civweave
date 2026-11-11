# Moonbridge v1 — Cerbanimo family safety × Civweave browser-first entry

**Stage:** browser-first navigation and nonprivileged family entry surfaces only; guardian account access NOT ENABLED. **Deployment:** staging review required.

## Browser first, installation optional

- An ordinary visit to Civweave's `/` or `/app/` goes to the same-origin canonical `/app/working-campus-v440.html`. `?install=required` is a deprecated old link, not an authorization mandate.
- `?install=1` or `?manage=1` explicitly opens optional maintenance/install. A functioning browser tab does not need the PWA's installed display mode, app shell preparation, offline campus package, local AI model, or service-worker readiness.
- A service worker can cache visited code opportunistically and an offline road pack can be offered as an **optional** enhancement. Failures to cache or install do not block the live web experience.
- Code and identity stay same-origin when entering via independent Guild servers and mirrors. Do not redirect Guild entry points to Cerbanimo, Cloudflare Pages, or a single privileged host merely to pass an installer gate.
- First online access still requires a reachable origin or local peer. Host independence means no **single indispensable host**, not magical operation in an empty browser with no cached code. Store user-owned Quest data locally and replicate only with authorized independent Guild nodes. A standalone Guild must supply its own app code, identity verification, and recovery exports.

## Family trust model (implementation prerequisite)

`cerbanimo.cc/family/` is a public **discovery** gateway, not an authorization endpoint. `{guild-origin}/app/family-guardian-v1.html` is a public **explanatory** surface, not an activity feed. Neither creates a guardian relationship nor receives/reads child data.

Future secure bridge:
1. A guardian signs in to their **selected Guild**; the Guild validates verified adult identity and lawful parent/guardian relationship, and uses account-appropriate age rules.
2. Child account creation or supervision setup provides a clear age-appropriate notice to the supervised user, including who has access and categories shared. No covert tracking mode.
3. Guild mints a short-lived, single-use, audience-bound authorization code. Cross-origin handoff uses a standard authorization-code + PKCE / state mechanism. Never put child identifiers, session secrets, message contents, or bearer tokens in a query string.
4. Guild-side server authorizes **each request** against scoped guardian grants; browser UI state, URL parameters, and local storage never grant authority. Default activity sharing is aggregate usage / approved Quest milestones, not private messages, notebooks, exact geolocation, or content-level logs.
5. Policy updates are logged, scoped, expiration-aware, and visible to a child in a suitable format. Revoke on role removal, age transition, custody change, account disconnect, or guardian request; cache invalidation and downstream replicas must honor revocation.
6. Store primary records with the selected Guild, encrypt transport, apply retention/deletion limits, support backups and portability across independently operated Guilds, and avoid a Cerbanimo-controlled central family database. Production launch needs age/jurisdiction-specific privacy and abuse-prevention review.

### Non-goals of this PR

- No implemented guardian login, identity proof, custody check, child monitoring, or policy enforcement.
- No cross-domain cookie sharing, cross-origin localStorage access, secret URL backdoor, or bypass of account permissions.
- No claims that full offline operation without any prior browser cache is possible.

## Acceptance / staging checks

- Android, iOS, and desktop ordinary browser openings reach the canonical campus without install prompts or redirection to another site.
- Legacy `/app/?install=required&next=...` opens browser campus, and explicit `?install=1` still allows optional installation.
- Guild domain / local preview remains its own origin, not forced to `civweave.cc`.
- Family safety opens from both Cerbanimo and Civweave; the link never includes child/account data, and the family page makes the unavailable authorization state explicit.
- No child activity or controls are exposed by unauthenticated requests, and no guardian authorization is inferred from mere navigation.
- Optional offline downloads still work when explicitly initiated; offline/cache failure cannot block online browser entry.
- Existing installer-only acceptance tests must be migrated to the browser-first behavior before release promotion.
