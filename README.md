# BANC Explorer — Be the Fly

**BANC Explorer** is a public-facing, interactive way to explore how behavior is organized across the adult fruit fly brain and ventral nerve cord.

The first experience, **Be the Fly: Walking Lab**, lets visitors steer a small fly toward an odor source while a synchronized circuit story shows how sensory feedback, ascending neurons, descending pathways, local ventral nerve cord circuits, and motor output work together.

Repository: [github.com/amyleesterling/banc-explorer](https://github.com/amyleesterling/banc-explorer)

Live site: [amyleesterling.github.io/banc-explorer](https://amyleesterling.github.io/banc-explorer/)

> The current prototype presents connectome-derived explanatory pathways. BANC is a wiring diagram, not a recording of neural activity; animated signal sequences are clearly framed as interpretation rather than measured firing.

## Current prototype

- Keyboard and touch-friendly walking and steering controls
- Animated fly arena with an odor target
- A web-optimized, 69-segment NeuroMechFly body with a custom hologram shader
- Synchronized four-stage circuit explainer
- Action-driven, named neuron selections for forward walking and left/right steering
- Published BANC Figure 5c, front-leg sensorimotor-loop, and DNa01/DNa02 viewer links
- Color-coded sensory, ascending, descending, VNC, and motor roles
- Scientific confidence and interpretation language
- Evidence labels that distinguish BANC connectivity, experimentally characterized function, and explanatory animation
- Responsive layout for desktop and mobile

## Planned next steps

1. Coauthor-review the first walking and steering neuron selections and explanatory copy.
2. Add compact in-page morphology previews for the selected BANC cell types.
3. Add more leg modules and action-specific Neuroglancer scenes.
4. Replace the procedural tripod gait with recorded walking kinematics.
5. Extend the same behavior system into a flight simulator.

## Scientific sources

- Bates, Phelps, Kim, Yang et al. **Distributed control circuits across a brain-and-cord connectome.** *Nature* (2026). [Read the paper](https://www.nature.com/articles/s41586-026-10735-w)
- [BANC dataset in Codex](https://codex.flywire.ai/?dataset=banc)
- [Neuroglancer](https://github.com/google/neuroglancer)
- [NeuroMechFly / FlyGym](https://neuromechfly.org/)

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Then open the local address shown in the terminal.

## Project status

Early public prototype. Circuit selections, annotations, contributor credits, data licensing, and final visual assets will be reviewed before launch.
