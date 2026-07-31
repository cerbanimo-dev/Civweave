# Install the local Commonweave Campus on mobile

The no-build mobile path is the **Commonweave Mobile Install Kit**. It runs the
Pocket Campus on Android from a private loopback server, then lets you add
Commonweave to your home screen as a PWA. Signed quest invitations and the
opt-in Party Link can open narrow services to trusted devices on the same
Wi-Fi network or personal hotspot; the campus itself remains loopback-only. It does not require root access,
Android Studio, or a precompiled APK.

The separate Android bridge download is source code for people who want to
build their own signed wrapper in Android Studio. You do not need it for the
steps below.

## One Mind, Many Rooms in RC4

The RC4 mobile kit contains the same shared model runtime as the hosted campus and every standalone room. Configure the provider once under **Shared model**. Pocket Campus, Living School, Cerbanimo, and Anarchadia then inherit the route, model ID, and endpoint. API keys remain session-only and must be entered again after the browser session ends.

The **Validate settings** action now reports provider capabilities before saving. Model requests expose connecting, generating, validating, repairing, completed, failed, and cancelled phases. A deterministic fallback is identified as a fallback and is never labeled as Gemini, Ollama, or another requested provider.

## Android: private GitHub release to home screen

Commonweave's private releases are at:

<https://github.com/glaedn/Commonweave-Public-Loom/releases/latest>

1. Sign in to GitHub on the Android device and download
   `commonweave-mobile-install-kit.zip` from the release's **Assets** section.
2. Install a maintained Termux build using the official Termux installation
   guidance: <https://github.com/termux/termux-app#installation>. Android 7 or
   newer is recommended. Keep Termux and any Termux plug-ins on the same
   distribution source so their signatures match.
3. Open Termux and run:

   ```bash
   termux-setup-storage
   pkg update
   pkg install -y python unzip
   cd ~/storage/downloads
   unzip -o commonweave-mobile-install-kit.zip
   cd commonweave-mobile-install-kit
   bash install-mobile.sh
   ```

4. Commonweave opens at `http://127.0.0.1:8790/`. In Chrome, Edge, or another
   install-capable browser, open the browser menu and choose **Install app** or
   **Add to Home screen**.
5. Launch Commonweave from the new home-screen icon. Keep Termux installed:
   it supplies the local server used by the Pocket Campus.

When replacing an older Commonweave release, do not uninstall the PWA first.
Install the newer mobile kit over the existing campus, open Commonweave, and
press **Install / update**. The service worker refreshes the home-screen app in
place while preserving browser-local app data.

The installer verifies the Pocket Campus SHA-256 checksum before extracting it,
rejects unsafe archive entries, and binds the campus server to the device's
loopback interface. Other devices cannot browse the campus, provider relay,
model controls, or private browser storage. Cerbanimo may separately expose a
rate-limited signed invitation page or an encrypted party-event relay after you
explicitly start those features.

## Start and stop it later

Android may stop background processes after a reboot or during aggressive
battery management. Start the local campus again with:

```bash
bash "$PREFIX/var/lib/commonweave/start-commonweave.sh"
```

Stop it with:

```bash
bash "$PREFIX/var/lib/commonweave/stop-commonweave.sh"
```

If Android routinely stops Termux, allow Termux to run without battery
optimization in Android's app settings. The start command is safe to run when
Commonweave is already running.


## Close the Bridge in v0.5.1

Version 0.5.1 completes the mobile Living School → Commonweave → Cerbanimo
project relay. Living School remains in **Sending** until Cerbanimo saves the
packet. The Pocket Campus keeps Cerbanimo open long enough for Kamiya to link a
reviewable project proposal, then returns the receipt to Living School. A
submitted or under-review project remains locked; only an evidence-bound
Cerbanimo acceptance unlocks the final assessment.

The update also installs the replacement Commonweave triquetra across the PWA,
launcher, splash, favicon, and cached offline shell. Install over the existing
campus rather than uninstalling it so browser-local schools and progress remain
in place.

## Nearby sharing and Party Link

## Sequenced learning relay in v0.3.1

Version 0.3.1 repairs the same sequenced learning relay in both the offline
Pocket Campus and hosted campus. Commonweave saves the pathway and required
skill levels, then Living School pre-populates one unfinished category in Create
without generating it automatically. Enter a goal, review its completion
criteria and capability map, assess your current level, then choose whether to
learn, practice, recruit, or simplify each gap. Commonweave calculates a
readiness score and prepares explicit handoffs to Living School or Cerbanimo.

After a focused category is generated and cleared, Living School asks before
preparing the next one. After the last category, **Continue to Kamiya** carries
the saved intention into Cerbanimo as a proposal-ready dialogue. Cerbanimo still
requires review and ratification before its canonical quest changes.

The 0.3.1 kit retains the Gemini quest-generation repair from 0.2.8, the
Android sharing repair from 0.2.7, and the LAN invitation and Party Link tools
from 0.2.6.

## Update the Pocket Campus

Download the newer mobile kit from GitHub, extract it into Downloads, and run
its `install-mobile.sh` again. Then open Commonweave and press **Install /
update**. The installer keeps browser-local data while refreshing the
application files.

The local campus includes **Shared model** controls for the provider, model ID,
endpoint, consent, and a session-only key. Its **Device Exchange** can share the
verified Pocket Campus seed or a secret-free model profile with another device.

Version 0.2.6 restores signed LAN/hotspot invitations and the opt-in Party Link
relay inside the mobile kit while keeping the Commonweave campus loopback-only.
It also preserves the Version 0.2.5 Gemini structured-output repair.

Version 0.2.5 fixes Gemini structured quest generation by sending Kamiya's
full JSON Schema through Gemini's `responseJsonSchema` field instead of the
legacy OpenAPI-subset `responseSchema` field. It also refreshes Cerbanimo's
offline cache so installed mobile copies receive the repair.

Version 0.2.4 includes a Commonweave AI prompt box on the Pocket Campus home
screen and a named guide above every child app: **Moss** in Living School,
**Kamiya** in Cerbanimo, and **Rook** in Anarchadia. Entering a session key
enables child-app passthrough by default; it can still be turned off in
**Shared model**.
Cerbanimo plans can be submitted from its Anarchadia Bridge screen; Anarchadia
then records member choices and returns approved plans to Cerbanimo’s community
quest board.

To use another unprivileged port:

```bash
COMMONWEAVE_PORT=8791 bash install-mobile.sh
```

Use the same port when starting it later:

```bash
COMMONWEAVE_PORT=8791 bash "$PREFIX/var/lib/commonweave/start-commonweave.sh"
```

## Hosted PWA alternative

If you do not need the campus server to live entirely on the phone, open the
hosted Commonweave site in an install-capable browser and choose **Install
app**. The browser PWA is the simplest option on iPhone and iPad; the
Termux-based Pocket Campus instructions above are Android-specific.

## Troubleshooting

- **`~/storage/downloads` does not exist:** run `termux-setup-storage` again and
  approve Android's storage permission.
- **GitHub shows a 404:** confirm that the browser is signed in to the GitHub
  account that can access the private repository.
- **The home-screen icon says the page is unavailable:** open Termux and run
  the start command above, then reopen Commonweave.
- **Port 8790 is already in use:** choose another port with
  `COMMONWEAVE_PORT`, as shown above. The managed relay and invitation portal
  use the next two ports.
- **Nearby sharing says no LAN address:** confirm Wi-Fi or a personal hotspot is
  active, rerun the installer so `iproute2` is present, or use
  `CERBANIMO_SHARE_HOST` with the trusted local address.
- **Another phone cannot open the invitation:** keep both devices on the same
  Wi-Fi/hotspot, allow Termux through any device firewall, and leave Commonweave
  running while the invitation is being used.
- **An install was interrupted:** rerun `bash install-mobile.sh`. The process is
  designed to be repeatable.


## Android share permission repair in v0.2.7

Large files are now prepared before Android Share is opened. Direct download buttons use server-backed URLs, so they no longer depend on a delayed synthetic browser click after a multi-megabyte fetch.

## The Unbroken Thread in v0.6.0

Version 0.6.0 upgrades Pocket Campus with the same durable operation journal, offline outbox, Action Inbox, stable object routes, invitation intake, and Cerbanimo proof/review attention used by the hosted campus. The existing triquetra launcher identity is preserved. Invitation and object targets remain reviewable after app switching, local restart, and installation resume instead of dropping the learner onto an unrelated home screen.

Install this version over the existing local campus rather than deleting browser data. The service-worker cache name changes in 0.6.0 and removes the older shell after activation while preserving IndexedDB and localStorage records.

## Run a LAN peer relay

Pocket Campus includes a standard-library encrypted packet relay. In Termux or another Python 3 environment:

```sh
cd <your-commonweave-folder>
python tools/commonweave_peer_relay.py --host 0.0.0.0 --port 8799
```

In Commonweave Device Exchange, add `http://PHONE-IP:8799` as a peer relay. The relay stores ciphertext, expiry metadata, and delivery receipts only. Keep `commonweave-relay-key.json` private because it contains the channel decryption secret. Use HTTPS for any relay reachable beyond a trusted local network.
