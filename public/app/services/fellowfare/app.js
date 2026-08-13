// FellowFare legacy module compatibility shim.
// Old cached cabinet HTML may still request app.js. Keep that path alive, but
// always move it onto the live-data marketplace before any legacy seed can render.

import './live-data-preflight-v3.js';
import '../../cw-reward-ledger-v2.js';
import '../../cerbanimo-commerce-distribution-v1.js';
import '../../civweave-live-data.js';
import './marketplace-v2.js';
import './marketplace-v2-capabilities.js';

function ensureStyle(href, marker) {
  if (document.querySelector(`link[${marker}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(marker, 'true');
  document.head.append(link);
}

ensureStyle('./marketplace-v2.css?v=live-market-v2', 'data-fellowfare-marketplace-v2');
ensureStyle('./marketplace-v2-contrast.css?v=contrast-live-r1', 'data-fellowfare-marketplace-contrast');
