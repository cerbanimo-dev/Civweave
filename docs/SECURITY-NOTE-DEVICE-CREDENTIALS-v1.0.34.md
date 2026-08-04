# Device credential note

Commonweave v1.0.34 stores a deliberately saved model credential in browser-local storage so the installed app can restore it after navigation or restart. This is device convenience, not a hardware-backed vault.

The credential is not included in exported weaves, realm handoffs, offline seeds, or host-node synchronization. Anyone with access to the same unlocked browser profile may be able to use or inspect it. The settings surface therefore exposes **Forget saved key**, which removes both the persistent copy and the active session copy.
