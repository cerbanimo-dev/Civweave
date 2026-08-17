# Cloudflare request storm diagnostic — 2026-08-17

This snapshot records the output of direct Cloudflare account queries run with the existing staging deployment credentials. It is intentionally kept on the isolated diagnostic branch only.

## Proven account metrics

### Named Workers — 2026-08-17 00:00 UTC through approximately 13:44 UTC

- Account Worker requests: 13,605
- Account Worker subrequests: 2,727
- Account Worker errors: 0
- `__unknown__`: 13,350 requests / 2,665 subrequests
- `civweave-core`: 191 requests
- `civweave-node-cloud`: 35 requests / 33 subrequests
- `civweave-host-edge`: 29 requests / 29 subrequests

The named Guild Workers therefore did not generate the account-scale request volume that caused the incident.

### Pages Functions — 2026-08-17 00:00–06:59 UTC

- Requests: 115,986
- Subrequests: 117,544
- Errors: 23

Hourly requests/subrequests/errors:

| UTC hour | requests | subrequests | errors |
| --- | ---: | ---: | ---: |
| 00 | 13,909 | 13,936 | 1 |
| 01 | 15,402 | 15,405 | 0 |
| 02 | 16,151 | 16,156 | 0 |
| 03 | 16,789 | 16,799 | 0 |
| 04 | 17,810 | 17,819 | 0 |
| 05 | 18,794 | 18,807 | 0 |
| 06 | 17,131 | 18,622 | 22 |

Most statuses were success. Late in the window the account also recorded client disconnects and `exceededResources` outcomes.

### Pages Functions daily comparison

- 2026-08-15: 4,109 requests
- 2026-08-16: 122,085 requests
- 2026-08-17 through 06:59 UTC: 115,986 requests

The abnormal behavior began during the 04:00 UTC hour on 2026-08-16. It ramped from hundreds per hour to roughly 10k–12k/hour, went nearly quiet from approximately 13:00–17:00 UTC, then restarted around 18:00 UTC and continued growing overnight.

## CI correlation

There were 748 staging GitHub Actions workflow runs from 2026-08-16 00:00 UTC through 2026-08-17 07:00 UTC, compared with 252 runs during all of 2026-08-15. However, the Pages Function storm continued to grow during multiple hours with zero staging workflow runs. Examples include 06:00–09:00 UTC on Aug 16 and 03:00–05:00 UTC on Aug 17. CI is therefore noisy but does not explain the dominant Pages Function traffic.

## Current Pages projects

Cloudflare currently reports three Pages projects using Functions:

- `civweave`
- `civweave-staging`
- `cerbanimo-cc`

Filtering the incident window using the *current* Pages production/preview script names attributed only 91 requests to the current `civweave` production script and zero to the other current scripts. The historical high-volume Pages rows were returned without a usable current script attribution.

This does **not** prove that a deleted/recreated project caused the storm. Cloudflare's historical Pages aggregate dataset did not expose project name, deployment id, hostname, or request path for these rows.

## Limits of the available credentials

The deployment token successfully queried account Worker/Pages metrics and current Pages project metadata. It does not have permission to read account Audit Logs or zone-level HTTP analytics, so the historical request hostname/path and project deletion/recreation history could not be recovered with this token.

## Evidence-based conclusion

The incident is a **Pages Functions request storm**, not heavy use of `civweave-node-cloud` or the staging Guild Worker. The measured Pages request/subrequest totals are almost 1:1, consistent with a Pages Function path that performs roughly one downstream request per invocation. The exact historical route is not recoverable from the aggregate account dataset available to the deployment token, so any claim naming a specific endpoint would still be an inference rather than a proven fact.
