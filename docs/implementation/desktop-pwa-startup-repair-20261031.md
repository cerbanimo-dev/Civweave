# Desktop PWA startup and reinstall recovery — 2026-10-31

The user reported a Desktop installed app stopping after its initial screen, then a Chromium “Page Unresponsive” dialog after clicking Install following uninstall. The repair starts from staging `6ccda3048` and preserves the existing installer, launch and signed-release owners. No project data, browser profile, installed model or release cache is deleted.

## Reproduced defects

- The install owner writes `aria-busy="true"` while its own MutationObserver watches that attribute. During a pending native install choice, the observer repeatedly schedules the same write. Real MutationObserver tests reproduce the loop with a safety cap; this can starve the watchdog and browser rendering.
- The retained v156 planner similarly rewrites an observed button's text. A bounded real-observer test reproduces the idle loop when that planner is reached. The current v440 route does not contain that observer.
- Installed launch awaits service-worker registration/update before arming its recovery watchdog. Controlled pending registration reproduces no navigation and no recovery timer.
- The release worker reads IndexedDB before serving executable assets and navigation. A pending/blocked database request can hold those responses indefinitely. An unreadable release selection must remain unknown; it cannot be interpreted as permission to fetch an unsigned origin release.

## Repair and authority boundary

The existing install/button owner now writes only changed values. Its planner subscriber observes its bounded workspace and detaches/resumes with the page lifecycle. No additional input owner, polling loop, prototype patch or runtime replacement loader is introduced.

The existing PWA launch owner arms recovery before awaiting worker work and applies one six-second budget to registration, update and generation settling. Native registration cannot be cancelled, so late continuations are guarded and abandoned controller/worker listeners are detached. A pagehide prevents late navigation. Returning through BFCache resumes that same owner with one active launch; initial and duplicate show events do not create concurrent launches. The worker generation query is rotated so the old script URL is not mistaken for the repaired generation.

The existing release owner bounds database open and transactions at1.2seconds each. It closes late connections and aborts unfinished transactions. Unknown authority returns the existing503 recovery response; it does not clear configuration, purge caches, activate an unsigned release or silently use the origin. During activation, only the recovery-capable worker may claim clients after a typed storage-unavailable error; warm/prune work remains skipped. Valid complete signed Guild releases keep their exclusive transport rule.

## Observations and limits

Public staging HTTP observations identified deployed source `6ccda3048`. All five inspected required shell hashes matched the deployed integrity manifest, so an integrity mismatch is not established as the cause of the user's live blank screen. The separate creation-workflow review branch had stale tracked hashes; its Pages build regenerates metadata, and that source issue is repaired separately.

The in-app browser rendered the existing campus without console errors. Opening the PWA start page in browser display mode correctly reached the installer; that does not exercise a Desktop standalone window. On the isolated repaired localhost origin, an Install click produced the expected missing-native-event guidance and the offline disclosure still opened with no console errors. That browser path does not expose a real native install prompt; pending native choice responsiveness is covered by the real MutationObserver regression. Native access to the user's Chrome window timed out. The exact installed-profile failure therefore remains an observed user report backed by reproducible source defects, rather than a completed native-device diagnosis.

Focused executable evidence lives in `test-installer-observer-quiescence-v1.mjs`, `test-pwa-start-bounded-launch-v1.mjs` and `test-release-storage-boundary-v1.mjs`. They cover pending native choices, watchdog progress, unchanged refreshes, teardown/resume, explicit Quest submission, pending/blocked/error storage, late results and signed-release exclusivity. Desktop boot CI runs these alongside its required dependency and generated-worker parity checks. Final test/build and preview results belong to the review PR and private verification archive.

Final local evidence:28/28 focused tests pass, the generated worker matches its template, and52/52 required asset hashes match source. The syntax scan passes1,546files with zero syntax failures; its later ownership postcheck still fails the pre-existing Settings query assertion (verifier and v440 target are identical to the staging base). The local Pages build reaches the browser-engine staging helpers, then fails on Windows `spawnSync npm.cmd EINVAL`; a Linux cloud build is required to verify the final Pages artifact. Those failures are reported, not hidden or labeled passed.

Concurrent staging Guild Council updates through `ce03bf8e4` were merged without conflicts. After that merge,28desktop tests and24Guild governance/tab-access tests pass; generated metadata was refreshed again. The1,546-file syntax count describes the earlier repair snapshot. CI and the preview build must be assessed on the published head.

## Delivery and rollback

Deliver through a staging-targeted review branch and verify the resulting preview. Do not promote production. Roll back the reviewed source commit through the normal deployment path; retain user state and existing signed-release data. Native Desktop install/relaunch and actual offline-device checks must be reported separately from source tests and browser emulation.
