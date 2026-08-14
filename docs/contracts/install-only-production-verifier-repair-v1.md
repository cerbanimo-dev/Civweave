# Install-only production verifier repair v1

This repair keeps Civweave's installed-display-only runtime policy intact while aligning two stale verification assertions with the current v1 install-only metadata.

- Production boot verification accepts the stable `VERSION-boot-recovery-v426` prefix so additive legal-consent and install-only release suffixes do not create false deployment failures. It separately requires `browserRuntimePolicy:'installed-display-only'`.
- Five-system navigation verification requires the current `v228-installed-only-stale-session-chat-escape-install-only-pwa-v1` boundary revision and explicitly verifies `browserRuntimePolicy:'installed-display-only'` and `installedQueryIsAuthorization:false`.

No browser authorization is broadened by this change.