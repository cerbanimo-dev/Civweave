# Civweave map thread tiles

These transparent thread pieces are the visual vocabulary for Civweave's association and federation map.

## Geometry
- 8 curved thread tiles
- 3 straight thread tiles
- transparent WebP, individually labelled
- runtime-tinted into five semantic colors

The line engine chooses, rotates, overlaps, and tints these pieces while tracing a cubic path. Keeping one neutral raster per geometry gives the full five-color set at a fraction of the offline PWA weight.

## Runtime color semantics
- **gold**: trusted federation / node-to-node trust
- **cyan**: active person or active relationship
- **green**: local node / home-node relationship
- **pink**: pending invitation or pending federation
- **silver**: discovery, data trace, or blocked/read-only context

These files are presentation assets. Federation state always comes from Civweave data and federation APIs, never from the art.
