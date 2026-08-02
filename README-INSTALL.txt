COMMONWEAVE v1.0.27 IDENTITY + AI CONTROL FIX
=============================================

Copy the contents of this folder into the root of cerbanimo-dev/Commonweave,
preserving the directory structure, then commit and push.

FILES REPLACED
--------------
public/app/loom-v127.html
public/app/loom-v127.css
public/app/loom-v127.js
public/app/realm-v127.html
public/app/realm-v127.js

FILES ADDED
-----------
public/app/logos/anarchadia-v2.webp
public/app/logos/fellowfare-v2.webp
public/app/logos/living-school-v2.webp

WHAT THIS FIXES
---------------
- Reduces Weaveling to roughly one quarter of the prior display size.
- Repairs corrupted/non-array chat history that caused:
  "Cannot read properties of null (reading 'length')".
- Makes Weaveling and all four realm guide chats open reliably.
- Adds a working universal AI settings panel with:
  provider route, model, endpoint, remote-prompt consent, and session-only API key.
- Adds visible labels to the top toolbar controls.
- Replaces Living School, FellowFare, and Anarchadia logos with transparent v2 assets.
- Removes the duplicate overlaid Kamiya sprite in Cerbanimo.
- Uses the Kamiya already painted at the center table as the clickable chat target.
- Adds cache-busting query strings so the updated shell is fetched immediately.

POWERSHELL INSTALL
------------------
From the extracted bundle folder:

Copy-Item -Path .\public\* -Destination <PATH-TO-COMMONWEAVE>\public -Recurse -Force
Set-Location <PATH-TO-COMMONWEAVE>
git add public/app
git commit -m "Repair AI controls and update realm identities"
git push origin main

VERIFY BEFORE PUSH
------------------
node --check public/app/loom-v127.js
node --check public/app/realm-v127.js

After Render deploys, open:
https://commonweave-host-node.onrender.com/loom/

A normal refresh should be enough because the HTML references the identity-ai-2 asset revision.
