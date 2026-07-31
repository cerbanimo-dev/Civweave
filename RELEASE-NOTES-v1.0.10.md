# Commonweave Host Node Hub v1.0.10

## Visual runtime recovery

This release repairs the failures found during live host-node testing.

### Runtime repairs
- Restored Living School visual startup by moving its visual runtime out of an accidentally nested entitlement function.
- Repaired Cerbanimo's truncated inline script and escaped nested script tags used by exported quest entrances.
- Synchronized Cerbanimo and Living School inline source mirrors with their actual page runtimes.
- Added first-paint shielding so Commonweave no longer flashes the conventional substrate before the illustrated world forms.
- The Quad now opens host-node setup when the device is not connected, and summons Weaveling after connection.

### Navigation and artwork
- Added a shared set of compact image-backed navigation glyphs.
- Replaced tall screenshot-thumbnail docks in Commonweave, Living School, Cerbanimo, FellowFare, and Anarchadia.
- Added an always-visible FellowFare return glyph and recalibrated the Main Atrium hotspots to its actual depicted storefronts, kiosk, Rook, and notice boards.
- Realm returns now go directly to the visual Town Square with a cache-busting build marker.
- Re-themed Anarchadia work surfaces as parchment, timber, and iron rather than Cerbanimo-style neon holograms.

### Host and model resilience
- Host-node clients now learn advertised capabilities before sending heartbeat traffic, preventing noisy 404 requests against older nodes.
- Antigravity permission-denied responses no longer block the workflow. The runtime falls back to the configured interactive Gemini model, or Gemini 2.5 Flash, and clearly reports that the managed agent sandbox was unavailable.
- All service-worker generations were advanced and the new icon assets were added to offline caches.
