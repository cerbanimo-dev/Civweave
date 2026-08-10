# Civweave Android WebAPK finalization v282

Chrome on Android can accept a PWA install request before the WebAPK is fully minted and registered with Android. Civweave therefore treats prompt acceptance as an intermediate state rather than proof that the app is available.

The canonical Cloudflare installer now:

1. accepts the browser-native install prompt;
2. enters a visible `Finishing Android install…` state;
3. checks `navigator.getInstalledRelatedApps()` for the canonical Civweave PWA;
4. exposes `Open Civweave` only after the canonical install is detected;
5. exposes `Check / retry install` if Android has not registered the app within the bounded verification window;
6. reloads the installer on retry so Chrome can issue a fresh `beforeinstallprompt` event if the previous WebAPK mint failed.

The Render related-PWA manifest declaration uses the documented cross-origin Android form: `platform: webapp` plus the Render manifest URL. Render remains discoverable but is not a preferred install target.
