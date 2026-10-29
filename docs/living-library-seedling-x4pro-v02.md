# Living Library: Seedling Edition — X4 Pro installation (v0.2)

The primary deliverable is a populated **offline library**, not a manual or custom firmware image.

## Contents
- 40 original field-reference articles in four EPUB volumes (fieldcraft/resilience; gardening/food; making/technology; cooperation/learning).
- 14 complete public-domain books taken directly from Project Gutenberg, not summaries or link-only catalog entries.
- One reflowable index EPUB, source catalog and SHA-256 checksums.
- Total: 19 readable EPUB files.

Full books use Project Gutenberg **no-images** editions for compatibility and storage efficiency. Books dependent on diagrams, especially Practical Mechanics for Boys, may be incomplete for instructional purposes without the image edition. Historical engineering, medical and food-safety advice is not current authority.

## Firmware installation
Use CrossPoint Reader stable **1.6.5**, which supports the X4 Pro's touchscreen, frontlight, font size and TTF fonts. Reference: https://github.com/crosspoint-reader/crosspoint-reader

1. Back up the SD card, charge the reader and determine whether the X4 Pro has a locked regional firmware.
2. On desktop Chrome/Edge, open https://crosspointreader.com/#flash-tools and choose **XTEINK X4 Pro** (ESP32-S3), not the original X4 or X4 Classic.
3. Try the official first-time web flasher via the original magnetic data connector and a known working data cable. Save full flash backup if that specific device/tool allows it.
4. X4 Pro USB Drive mode is not the same as ROM serial flashing. Some regional units support USB mass storage but cannot be flashed through the USB serial path. Do not treat successful USB file transfer as proof that browser flashing is available.
5. If the serial flasher cannot detect the device after testing the cable/port/browser, use only the official CrossPoint **Xteink Unlocker / Crosslink OTA method** documented for the specific X4 Pro region. Locked Pro units may require an initial Wi-Fi OTA procedure; generic ESP32 flashing instructions and X3/X4 SD boot methods may be inappropriate.
6. After CrossPoint is successfully installed, subsequent updates can be installed via Settings → System → Check for Updates or SD Card Firmware Update using the **X4 Pro-specific** binary. Always keep a known-good recovery file.

## Installing the shelf
1. Extract the complete Seedling v0.2 ZIP on the PC or Android phone.
2. Find the Books/Seedling/ directory containing 00_Seedling_Offline_Index.epub, Reference/, and Full/.
3. Enter CrossPoint Home → File Transfer → USB Drive if a data-capable connection is available; otherwise use the microSD reader or CrossPoint Wi-Fi file-transfer feature.
4. Copy the entire Seedling tree to the SD card (typically /Books/Seedling). Safely eject the card or USB drive.
5. On-device Browse Files → Books/Seedling. Open the index, then open any reference volume or full book.
6. Use text settings to change font size. To add a TTF font, put it in /fonts/ on the SD card, restart, and select it in text settings.
7. Disable Wi-Fi to test that the reference and full book texts open offline.

## Book downloads in CrossPoint
The feature branch contains a curated OPDS 1.2 catalog at /seedling/books.opds.xml on the Civweave host once the branch is deployed. It supplies Project Gutenberg source links, not a second copy of the books. The CrossPoint OPDS browser may also use Gutenberg's own https://www.gutenberg.org/ebooks/search.opds/ address. Both require Wi-Fi.

## Implementation status
The repository contains manual Learning Journey authoring, sourcing, video/image metadata, an EPUB exporter, canonical Moss REVIEW staging, and signed Guild review exchange in PR #859. A dedicated GitHub workflow downloads, validates and packages 14 original Project Gutenberg EPUBs, publishing them as an Action artifact. The four article volumes and 19-EPUB combined v0.2 download were assembled separately as conversation artifacts, not by that GitHub workflow. Do not claim the workflow reproduces the complete combined archive yet.

Still to build: native X4 Pro Seedling interface, Passport device authorization, Cloudflare AI budget usage, Learning Journey creation on-device, source/media caching, authenticated publishing and voting support. The plain EPUB library performs none of those actions.
