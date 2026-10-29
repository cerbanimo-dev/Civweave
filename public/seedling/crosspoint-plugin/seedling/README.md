Living Library: Seedling Edition — X4 Pro public Wi-Fi shelf
Version 0.3.0 (preview)

This CrossPoint SD plugin provides public-domain book discovery and one-tap download.
It does NOT pair with Passport, spend AI credits, run Moss, or publish Guild content.

INSTALL:
1. Use a CrossPoint X4 Pro firmware with SD plugins enabled (nightly/beta; check the actual device).
2. Copy this seedling folder to SD card: /plugins/seedling/
3. Enable Settings > Connectivity > Plugins. Then Home > Plugins > Living Library: Seedling.
4. Join Wi-Fi and select books to download. They save to /Books/Seedling/Updates/.
5. Reopen the catalog to see newly published entries. CrossPoint's download picker is a MANUAL update, not unattended syncing.

Firmware 1.6.5 release may NOT support SD plugins. Use OPDS with the stable firmware instead.
The catalog is fetched from a public preview branch URL. Once staging or production serves
/seedling/library-v1.json, update device.json to your trusted deployment URL.

SECURITY:
There are no account tokens, Wi-Fi secrets, API keys or user IDs in this plugin.
CrossPoint's on-device HTTPS client does not validate remote certificates, so this
public-only plugin cannot be trusted for private Civweave traffic or unverified updates.
Only read public book editions; validate rights and content independently.

For Moss chat and Passport, open Civweave's signed-in Seedling companion on an authenticated phone/computer.
