# Grooming animation revision

This modifies the existing BANC DNg12 anterior-grooming package. It does **not** authorize a wing-grooming layer: no BANC-native `wPN1` type was resolved.

## What is wrong with the current sequence

- The 28 cells each use their own normalized geodesic, so the middle frames read as a broad lavender glow.
- The brain-to-connective-to-T1 progression is difficult to see, especially on a phone.
- The 16-frame sequence is usable, but the next pass should make the VNC destination unmistakable without inventing synchronized biological timing.

## Revised neural render

Keep the same 28 exact DNg12 roots already recorded in the grooming manifest and the same camera.

Deliver:

- `public/banc-groom-head-dng12-v2.webp`
- `public/banc-groom-head-dng12-v2/frame-00.webp` through `frame-23.webp`
- 24 frames, `1600 × 1200`, transparent, lossless WebP, straight alpha.
- Accent `#C7A6F3`.

Signal construction:

1. Seed each cell at its own synapse-weighted input-dominant region.
2. Compute true geodesic distance on that cell’s CAVE skeleton.
3. Convert distances using one **population-level pooled distance scale** (use pooled P95), rather than normalizing every cell to finish simultaneously.
4. Preserve branching: the pulse must fork along graph branches rather than travel on a screen-space axis.
5. Keep the cell mesh at 10–13% opacity and the resting skeleton at 18–22% opacity below the pulse.
6. Use a soft pulse tail, not a hard on/off wipe.

Story timing across the 24 frames:

- 00–01: rest/transparent.
- 02–06: input-dominant brain arbors ignite.
- 07–14: pulse travels through descending processes and neck connective.
- 15–20: strongest read reaches the T1/front-leg VNC arbors.
- 21–23: output glow fades to transparent rest.

The anatomical progression must arise from the audited skeletons and polarity data. If the data do not support brain-to-T1 direction for a particular cell, flag that cell in the manifest instead of forcing it.

## Playback in the app

- Replay at `2.4 fps` (one tenth of the 24 fps source rate).
- Loop while the fly is grooming.
- On mobile, the neuron focus view should remain open for three loops unless the user taps to close it.
- Raise `HEAD_GROOM_DURATION_MS` to at least `30_500` when the 24-frame revision lands so all three 10-second explanatory loops fit before relaunch.
- The fly remains steerable during grooming. Do not lock movement controls.
- The body animation and neural sequence are explanatory and need not be phase-locked to one another.

## Body-animation modification already targeted in code

- Use the real articulated front-leg segments.
- Lift at the coxa, fold sharply at the trochanter/femur, flex the tibia back toward the head, then curl the tarsus.
- Alternate left and right wipes with a small foreleg-rubbing beat between passes.
- Keep the forelegs compact around the face; no straight “starfish” limbs crossing the whole body.
- Keep middle and hind legs planted or tucked while the front pair grooms.
- No glowing toe caps, tracer lines, or detached decorative legs.
- Preserve the user’s ability to walk the fly while it continues the grooming gesture.

## Required wording

Label: **“BANC DNg12-annotated population — anterior grooming.”**

Qualifier: **“This is the BANC-native DNg12 annotation population. It does not imply that every rendered cell was independently function-tested.”**

Animation disclaimer: **“Explanatory signal animation derived from skeleton geometry and synapse-polarity distributions; not recorded action potentials or measured conduction timing.”**
