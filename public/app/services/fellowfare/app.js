// FellowFare legacy module compatibility shim.
// Old cached cabinet HTML may still request app.js. Keep that path alive, but
// always move it onto the live marketplace and the current economy boundary.

import './live-data-preflight-v3.js';
import '../../cw-reward-ledger-v2.js';
import '../../civweave-live-data.js';
import './marketplace-v2.js';
import './marketplace-v2-capabilities.js';
import './fulfillment-economy-v2.js';
import './jurisdiction-policy-v1.js';
import './seller-method-types-v1.js';
import './seller-methods-v1.js';
import './seller-direct-transactions-v1.js';
import './tax-records-v1.js';
import './tax-record-bridge-v1.js';
// Retained only for cached references/verifiers. v2 installs the compatibility
// global first, so v1 returns without booting its retired cash-disabled policy.
import './fulfillment-economy-v1.js';

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
