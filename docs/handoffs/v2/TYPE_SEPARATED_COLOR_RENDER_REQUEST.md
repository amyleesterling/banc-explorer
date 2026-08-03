# Type-separated color render request

The current forward-walking render distinguishes descending drive from pooled
feedback, but it does not distinguish the two feedback populations. The current
threat-response render pools all five selected cells into one coral color. The
app color key must never imply more separation than the pixels actually contain.

Render replacements on the existing locked camera with the same 1600 × 1200
transparent, straight-alpha, lossless WebP requirements and the same registered
gray context base (`#52675E`). Do not change segmentation IDs, camera, crop,
scale, or cell membership.

## Forward walk

Output basename: `banc-forward`

- DNg100 ×2: `#F05A9D` rose
- AN09B029_b ×2: `#58C9B9` mint
- AN02A002 ×2: `#79BCE8` sky blue

Deliver the static and 16-frame non-looping sequence. Preserve transparent
bookends at frames 00 and 15. Each population must retain its assigned color
through every pulse frame.

## Threat response

Output basename: `banc-threat-walk`

- DNp42 ×2: `#FF786D` coral
- DNge053 ×2: `#F2B84B` warm gold
- DNg55 ×1: `#C7A6F3` lavender

Deliver the static and 16-frame non-looping sequence. Preserve transparent
bookends at frames 00 and 15. This remains **THREAT RESPONSE**, never threat
detection.

## QC and manifest

- Record every root ID, canonical type, side where known, and assigned color.
- Confirm each colored population is a subset of the registered context base.
- Include the usual 3 px shifted-control alignment audit and contact sheet.
- Report per-population pixel presence so a missing color cannot pass unnoticed.
- Keep the explanatory-animation disclaimer: these are geometry-derived signal
  animations, not recorded neural activity or measured conduction timing.
