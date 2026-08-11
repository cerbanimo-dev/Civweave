(()=>{
'use strict';

const REVISION='required-campus-autostart-v304-disabled';

// Compatibility shim for cached installer pages from older releases.
// Offline-campus transfer is now strictly user-initiated. This file stays at
// the legacy path so an old cached HTML document cannot revive autostart
// behavior by fetching the historical implementation.
function start(){return false}
function destroy(){return true}

globalThis.CivweaveRequiredCampusAutostartV1=Object.freeze({
  revision:REVISION,
  disabled:true,
  policy:'explicit-user-opt-in-only',
  start,
  destroy
});
})();
