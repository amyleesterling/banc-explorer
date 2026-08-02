# BANC Explorer project memory — v2

Last updated: 2026-08-02

## Project

Public-facing BANC connectome explorer: **“Drive the fly. See behavior light up.”** Users control a cute, anatomically derived NeuroMechFly model while connectome-supported neuron selections appear in a neural HUD. Neuroglancer/Codex are opt-in deep links, not the default rendering path.

- Repository: `amyleesterling/banc-explorer`
- GitHub Pages: `https://amyleesterling.github.io/banc-explorer/`
- Sites deployment: `https://banc-explorer.amysterling.chatgpt.site`
- BANC data portal: `https://codex.flywire.ai/?dataset=banc`
- Candidate-behaviour queue: `https://docs.google.com/document/d/1cLN_I6EwhWdDYRUw8QILUTVGpovW5QceHw78-J0o6jo/edit?usp=sharing`

## Product direction

- Full-viewport browser cockpit; fly world is primary, neurons are a HUD over/around it.
- Natural moss background with a botanical sci-fi glass language inspired by Amy’s `scifi-ui`, adapted for a light natural world. On the mobile driving cockpit this is presented as a single dark "Neural Interface" HUD wrapped by a circuit line of light (an animated edge frame); all readouts live inside that one HUD while driving.
- Friendly to kids, scientifically careful, little text, large readable type.
- Mobile must be first-class: floating glass controls, tap-to-focus neuron view, exactly one HUD (a dark "Neural Interface" card that holds every readout — objective, neuron label, heading/velocity, and the DNg02 throttle), no overlapping HUD cards, and sufficiently large neurons.
- The fly should feel cute and alive: a pleasant amethyst-purple body, kawaii dark-purple eyes with catchlights, six real articulated legs, soft wing motion, no red toe dots or tracer lines.
- EPG is an allocentric heading readout (a compass), not the direct egocentric steering command.
- DNg02 is exposed as the W/S flight-drive throttle. Forward is full command; reverse is a reduced/redirected simulator state, not a dedicated backward-flight cell type.
- Grooming happens after landing. The front legs clean the head; controls stay live during grooming. Neural animation loops slowly.
- The current mobile neuron focus opens automatically for quick-dodge and grooming sequences, can be tapped closed, and auto-closes after three animation loops. It does not freeze grooming controls.

## Current narrative loop

1. Walk/steer to the peach.
2. Eat while feeding cells remain visible for several seconds.
3. Spider warning, escape/dodge, takeoff.
4. Flight cockpit: EPG heading plus DNg02 throttle/velocity.
5. Steer to the flower and land.
6. Head grooming on the flower.
7. Relaunch toward another flower and repeat.

Timing is intentionally gentle. Current key constants are in `app/page.tsx`; avoid collapsing stages or freezing immediately after the snack.

## Verified neural data already in the app

- Walking/steering prerenders: forward, left, right.
- Backward walking: MDN layer.
- Feeding: six-cell official BANC feeding selection.
- Threat response: five response exemplars; explicitly not “threat detection.”
- DNp03 flight saccade: two current BANC cells, anatomical sides only; behavioral turn-direction mapping remains pending.
- DNg12 anterior grooming: 28-cell BANC-native population, context regenerated to 122 cells. Existing 16-frame skeleton sequence is replayed at 2.4 fps.
- EPG cockpit: FAFB-derived 16-sector ring accepted for this conceptual compass because EPG identity is conserved; do not present it as BANC morphology.
- DNg02: 26-cell BANC v888 population listed in `app/data/flight-dng02.json`.

## Newly verified render candidates

### b1 wing steering MN / MNb1

- Left anatomical side: `720575941521196211`
- Right anatomical side: `720575941549822781`
- Exact `b1 MN` BANC v888 tag; also in `wing_mn_cell_type_table_v0`; both current; both meshes present.
- Safe role: fine wing-steering motor output.
- Do not map anatomical side directly to left/right turn.
- Audit: `app/data/flight-mnb1.json`.

### Landing DNs

- DNp07: `720575941407841071`, `720575941545991429`
- DNp10: `720575941440683743`, `720575941593683051`
- Exact BANC v888 tags; all current; all meshes present.
- Safe role: significant contributors to visually evoked landing and six-leg landing extension; not the only possible landing neurons.
- Audit: `app/data/flight-landing-dnp07-dnp10.json`.

## Scientific guardrails

- Never infer segment IDs from a cell name. Resolve against the stated BANC materialization, then check all tags, lineage/current-root status, and frozen mesh presence.
- Connectome morphology supports pathways; the app does not show measured neural activity.
- All moving signal pulses are explanatory skeleton/geodesic animations, not action-potential recordings or measured conduction timing.
- Anatomical left/right is not automatically behavioral left/right.
- `wPN1` was not found as a BANC-native cell type; do not create a wing-grooming neural slot without a new authoritative crosswalk.
- A prior DNg70 candidate pair conflicted with BANC `cell_info`; do not reuse it without a fresh audit.

## Render pipeline contract

- Current neural canvas: 1600 × 1200, transparent lossless WebP, straight alpha, fixed orthographic camera.
- Base context filename: `public/banc-context-base.webp`.
- Current base: 122 cells. It must be regenerated whenever new action cells are added so selected cells never appear from nothing.
- Action layers preserve the full canvas and use the identical camera.
- Require alignment audit, 3 px shifted negative control, alpha audit, checksums, manifest, and contact sheet.
- Versioned handoff index: `docs/handoffs/v2/README.md`.
- Next batch guide: `docs/handoffs/v2/RENDER_GUIDE_MISSING_FLIGHT_CELLS_V2.md`.
- Grooming revision: `docs/handoffs/v2/GROOMING_ANIMATION_REVISION_V2.md`.

## Asset and UX caveats

- `public/banc-landing-pathway.webp` is referenced but missing; replace the app reference with the audited four-cell landing asset when rendered.
- DNg02 currently has data and UI but no BANC prerender; the HUD makes the throttle explicit meanwhile.
- MNb1 is verified for rendering but not wired into the app until assets land.
- Preserve the user-owned untracked `public/banc-walking-steering-poster.webp` unless explicitly asked to remove it.
- Keep the top-level simulator fullscreen. Do not return to a split card below a large hero.
