# PWA install debugging v282

If Android accepts the Civweave install prompt but no app appears, the installer must not report the install as complete solely from `userChoice` or `appinstalled`. On Android those signals can precede WebAPK minting.

Use the installer status instead:

- `Finishing Android install…` means Chrome accepted the request and Civweave is waiting for Android registration.
- `Open Civweave` means the canonical Cloudflare PWA was detected as installed.
- `Check / retry install` means the registration was not detected within the verification window and a clean prompt retry is available.

The canonical install origin remains `https://commonweave.pages.dev` and Render remains a related host-node origin rather than an install target.
