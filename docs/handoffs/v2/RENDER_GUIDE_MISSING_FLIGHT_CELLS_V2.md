# BANC Explorer: missing flight-cell render guide — v2

Version: **v2 · 2026-08-02**

This is the handoff for the next BANC render pass. It covers only neural assets that the current app needs but does not yet have: **DNg02 flight drive**, **b1 MN / MNb1 wing steering**, and **DNp07 + DNp10 landing**.

The candidate-behaviour queue is in the shared [research document](https://docs.google.com/document/d/1cLN_I6EwhWdDYRUw8QILUTVGpovW5QceHw78-J0o6jo/edit?usp=sharing). The IDs below were not copied from that document: they were resolved and audited against BANC v888.

## Non-negotiable common specification

- Dataset: `brain_and_nerve_cord`, BANC materialization `888`.
- Frozen mesh source: `precomputed://gs://lee-lab_brain-and-nerve-cord-fly-connectome/neuron_meshes`.
- Camera: byte-identical to the current `banc-context-base.webp` camera. Do not auto-fit per layer.
- Canvas: `1600 × 1200`, full canvas preserved, transparent background.
- Encoding: lossless WebP, straight alpha, alpha range 0–255.
- Context colour: `#52675E` gray.
- Current context: **122 cells**. If all three batches below are added together, regenerate it as **154 unique cells** under the same filename `public/banc-context-base.webp` and bump the app cache key.
- Every selected neuron must already exist in gray in the regenerated context. No neuron may appear from nothing when an action layer turns on.
- Static and animated layers must align pixel-for-pixel with the base.
- Signal animations are explanatory geometry-derived visualizations, not recorded action potentials or measured conduction timing.

## Batch A — DNg02 flight drive / throttle

Source of truth: `app/data/flight-dng02.json` (**26 root IDs**). Use every ID in that file and no inferred additions.

Interpretation: DNg02 is a flight-motor population associated with wingbeat-amplitude regulation and course correction. In the app, W means full forward thrust; S is a reduced/redirected-thrust simulator state. **Do not render or label S as a separate backward-flight cell type.**

Deliver:

1. `public/banc-flight-power-dng02.webp`
   - 26 cells.
   - Accent `#70D8CE`.
2. `public/banc-flight-power-dng02/frame-00.webp` through `frame-15.webp`
   - 16 frames.
   - One non-looping explanatory pulse.
   - Seed each skeleton at its synapse-weighted input-dominant region, then advance by geodesic distance toward downstream/VNC arbors.
   - Keep the mesh faintly visible under the pulse so thin branches do not disappear.
   - Frame 00 and frame 15 fully transparent.

App mapping after delivery:

- Both `flight-forward` and `flight-reverse` reuse this same anatomical layer.
- Forward uses full brightness. Reverse uses lower opacity and a mauve UI state; do not create a different set of cells.

## Batch B — b1 wing steering motor neurons (MNb1)

Both records are exact `b1 MN` matches in BANC v888 `cell_info`, are also present in `wing_mn_cell_type_table_v0` under classification system `b1`, are current roots, and return HTTP 200 from the frozen mesh source.

| anatomical side | BANC v888 root ID |
|---|---:|
| left | `720575941521196211` |
| right | `720575941549822781` |

Source of truth: `app/data/flight-mnb1.json`.

Deliver:

1. `public/banc-flight-steer-mnb1-all.webp`
2. `public/banc-flight-steer-mnb1-anatomical-left.webp`
3. `public/banc-flight-steer-mnb1-anatomical-right.webp`
4. `public/banc-flight-steer-mnb1-anatomical-left/frame-00.webp` through `frame-15.webp`
5. `public/banc-flight-steer-mnb1-anatomical-right/frame-00.webp` through `frame-15.webp`

Rendering:

- Accent `#8EDBD6` for both anatomical sides. Do not encode a behavioural turn direction through colour.
- For each animation, seed at the synapse-weighted input-dominant arbor and advance toward the peripheral axon exit along that cell’s CAVE skeleton.
- Frame 00 and frame 15 fully transparent.
- Keep left/right filenames anatomical.

Scientific wording:

- Label: **“b1 wing steering motor neurons (MNb1)”**.
- Safe app claim: **“Fine wing-steering motor output during flight.”**
- Required caveat: **“Anatomical side is not assigned to turn direction; b1 output is graded and phase-dependent.”**
- Do not claim that unilateral activation of one rendered cell causes a left or right turn.

## Batch C — landing DNs

Exact BANC v888 cells:

| type | root ID |
|---|---:|
| DNp07 | `720575941407841071` |
| DNp07 | `720575941545991429` |
| DNp10 | `720575941440683743` |
| DNp10 | `720575941593683051` |

All four are current roots and all four frozen mesh URLs return HTTP 200. Source of truth: `app/data/flight-landing-dnp07-dnp10.json`.

Deliver:

1. `public/banc-landing-dnp07-dnp10.webp`
   - Four cells combined.
   - Accent `#68D5C0`.
2. `public/banc-landing-dnp07.webp`
3. `public/banc-landing-dnp10.webp`
4. `public/banc-landing-dnp07-dnp10/frame-00.webp` through `frame-15.webp`

Animation:

- Seed from the visually responsive/input-dominant brain arbors and move down the descending skeletons toward VNC leg regions.
- Do not imply the render is measured activity.
- Use during final approach and landing-leg preparation, not during takeoff or grooming.

Safe claim: **“DNp07 and DNp10 contribute to visually evoked landing and landing-like extension of all six legs.”** Do not call them the only landing neurons.

## QC and manifest

For every static and every frame, record:

- root IDs, exact tags, materialization, current-root status, and frozen-mesh presence;
- camera file path plus SHA-256;
- canvas size, colour, encoding mode, and output checksum;
- alpha min/max and straight-alpha audit;
- percent of action pixels inside the regenerated context base;
- a 3 px shifted negative control proving that the alignment test discriminates;
- contact sheet on black and on the app’s dark neuron-canvas colour.

Target alignment is at least `99.5%` inside the context. A small exception is acceptable only for a documented skeleton tube extending beyond the mesh silhouette.

Manifest disclaimers:

- “Connectome-supported selection; not measured neural activity.”
- “Explanatory signal animation derived from skeleton geometry and synapse-polarity distributions; not recorded action potentials or measured conduction timing.”
