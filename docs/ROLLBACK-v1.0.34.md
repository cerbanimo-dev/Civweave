# Rollback notes v1.0.34

The recovery is isolated behind `/extensions/commonweave-guide-runtime-recovery-v160.js` and explicit preload tags on the Working Campus, realm console, and Anarchadia console.

A rollback can remove those preload tags, stop loading v160 from the install boundary, restore the v159 additive cache identifier, and remove the v160 extension. Working Campus composer markup and its part-five submit handler should be reverted together.
