# Manual-first installer contract v304

Civweave 1.0.104 treats the offline campus as an explicit user choice rather than an install prerequisite.

The installer must remain idle on first paint: it does not prepare the service-worker shell, start the offline campus, or load optional knowledge/media installers until the user chooses the relevant action. Installing or checking the release may prepare the small PWA shell, but must not opt the device into campus transfer.

The `Download offline campus` action is the sole opt-in boundary. It records `civweave.offline-campus.explicit-opt-in.v304`, loads the resumable installer state controller, performs storage preflight, and starts the current compact campus package. Working Campus background continuation may resume that transfer only after the opt-in exists.

The legacy `required-campus-autostart-v1.js` path remains as an inert compatibility shim so stale cached installer HTML cannot resurrect automatic downloading. Recovery keeps the installer storage guard and current service-worker recovery layers intact.

Browser regression coverage must prove zero offline-campus package traffic on initial installer load, after shell-only release preparation, and after opening Working Campus on a fresh device. Traffic is expected only after the explicit offline-campus action.
