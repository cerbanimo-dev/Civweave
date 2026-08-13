// FellowFare legacy module compatibility shim.
// Old cached cabinet HTML may still request app.js, so keep this path alive without
// restoring the retired demo-seeded marketplace. The current cabinet loads these
// resources directly.

import '../../cw-reward-ledger-v2.js';
import '../../cerbanimo-commerce-distribution-v1.js';
import '../../civweave-live-data.js';
import './marketplace-v2.js';

if (!document.querySelector('link[data-fellowfare-marketplace-v2]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './marketplace-v2.css?v=live-market-v2';
  link.dataset.fellowfareMarketplaceV2 = 'true';
  document.head.append(link);
}
