// The visitor journey, and the neuron table derived from the game itself.
//
// The registry used to be a hand-typed list of cell types, counts, assets and
// status. That is exactly the kind of copy that falls behind: it named layers
// the app no longer had and missed sequences the app had gained. It is now
// computed from the same three sources the experience renders from, so the hub
// reports on the build rather than on someone's memory of it:
//
//   CIRCUITS + STATIC_NEURON_LAYERS  the cell types and the layer accents
//   LAYER_SEQUENCES + FLIGHT_POWER   what actually animates, and at what length
//   layer-stats.json                 measured cells, synapses and dataset
import {
  CIRCUITS, STATIC_NEURON_LAYERS, LAYER_SEQUENCES, LAYER_SEQUENCE_FRAMES,
  LAYER_SEQUENCE_LOOP, LAYER_SEQUENCE_FPS, FLIGHT_POWER_DIR,
} from "./game-model";
import type { CircuitMode } from "./game-model";
import layerStats from "./layer-stats.json";

export type ExperienceStage = {
  id: string;
  label: string;
  worldState: string;
  circuitMode: string;
  trigger: string;
  duration: string;
  world: string[];
  hud: string[];
  dialog: string[];
  neurons: CircuitMode[];
  next: string[];
};


export type DerivedNeuronRow = {
  mode: CircuitMode;
  label: string;
  accent: string;
  types: string;
  summary: string;
  viewerUrl: string;
  cells: number | null;
  synapses: number | null;
  dataset: string | null;
  sequence: string | null;
  frames: number | null;
  loopSeconds: number | null;
  overlay: boolean;
};

const stats = layerStats.layers as Record<string, {
  cells: number; synapses: number | null; dataset: string;
}>;

// flight-forward and flight-reverse both run the DNg02 drive as an overlay on
// the EPG compass rather than as a layer of their own, so they are marked as
// overlays rather than being given a sequence slot they do not own.
const OVERLAY_MODES: CircuitMode[] = ["flight-forward", "flight-reverse"];

export const derivedNeurons: DerivedNeuronRow[] = (Object.keys(CIRCUITS) as CircuitMode[]).map((mode) => {
  const circuit = CIRCUITS[mode];
  const layer = STATIC_NEURON_LAYERS[mode];
  const stat = stats[mode] ?? null;
  const overlay = OVERLAY_MODES.includes(mode);
  const sequence = overlay ? FLIGHT_POWER_DIR : LAYER_SEQUENCES[mode] ?? null;
  return {
    mode,
    label: layer.label,
    accent: layer.accent,
    types: circuit.types,
    summary: circuit.summary,
    viewerUrl: circuit.viewerUrl,
    cells: stat?.cells ?? null,
    synapses: stat?.synapses ?? null,
    dataset: stat?.dataset ?? null,
    sequence,
    frames: sequence ? LAYER_SEQUENCE_FRAMES : null,
    loopSeconds: sequence ? Number((LAYER_SEQUENCE_LOOP / LAYER_SEQUENCE_FPS).toFixed(2)) : null,
    overlay,
  };
});

export const derivedByMode = Object.fromEntries(
  derivedNeurons.map((row) => [row.mode, row]),
) as Record<CircuitMode, DerivedNeuronRow>;

export const experienceStages: ExperienceStage[] = [
  {
    id: "seek",
    label: "Find fruit",
    worldState: "seeking",
    circuitMode: "walk / backward / left / right",
    trigger: "Page load or restart",
    duration: "Until fruit boundary contact",
    world: ["Fly", "ripe peach", "moss world"],
    hud: ["Foraging objective", "walking/steering neurons", "controls"],
    dialog: [],
    neurons: ["walk", "left", "right", "backward"],
    next: ["eat"],
  },
  {
    id: "eat",
    label: "Taste fruit",
    worldState: "eating",
    circuitMode: "eat",
    trigger: "Fly enters peach-slice ellipse",
    duration: "4.8 seconds before warning",
    world: ["Fly", "peach contact state"],
    hud: ["feeding selection"],
    dialog: ["Snack found"],
    neurons: ["eat"],
    next: ["threat"],
  },
  {
    id: "threat",
    label: "Choose response",
    worldState: "threat",
    circuitMode: "threat",
    trigger: "Snack viewing delay completes",
    duration: "Until player chooses",
    world: ["Spider enters", "fly remains visible"],
    hud: ["response selection"],
    dialog: ["Threat detected", "Freeze", "Run", "Fly"],
    neurons: ["threat"],
    next: ["freeze", "run", "dodge"],
  },
  {
    id: "freeze",
    label: "Freeze",
    worldState: "freeze",
    circuitMode: "threat",
    trigger: "Player chooses Freeze",
    duration: "3-second countdown",
    world: ["Stationary fly", "spider waits then leaves"],
    hud: ["response selection"],
    dialog: ["3… 2… 1…"],
    neurons: ["threat"],
    next: ["scent"],
  },
  {
    id: "run",
    label: "Run",
    worldState: "run → caught",
    circuitMode: "threat",
    trigger: "Player chooses Run",
    duration: "1.5 seconds to catch; 3.2 seconds to restart",
    world: ["Running fly", "chasing spider"],
    hud: ["response selection"],
    dialog: ["Nature is rough"],
    neurons: ["threat", "walk"],
    next: ["seek"],
  },
  {
    id: "dodge",
    label: "Fly / quick dodge",
    worldState: "dodge",
    circuitMode: "dodge",
    trigger: "Player chooses Fly",
    duration: "3.2 seconds",
    world: ["Dodge body animation", "retreating spider"],
    hud: ["expanded DNp03 pulse"],
    dialog: [],
    neurons: ["dodge"],
    next: ["takeoff"],
  },
  {
    id: "scent",
    label: "Flower scent",
    worldState: "scent",
    circuitMode: "eat",
    trigger: "Freeze succeeds",
    duration: "2.6 seconds",
    world: ["Flower target appears", "spider gone"],
    hud: ["new flight objective"],
    dialog: ["Tasty scent at the flower"],
    neurons: ["eat"],
    next: ["takeoff"],
  },
  {
    id: "takeoff",
    label: "Takeoff",
    worldState: "takeoff",
    circuitMode: "flight-forward",
    trigger: "Dodge completes or scent reveal completes",
    duration: "1.8 seconds",
    world: ["Wings accelerate", "fly gains altitude"],
    hud: ["thrust selection", "flight objective"],
    dialog: [],
    neurons: ["flight-forward"],
    next: ["flight"],
  },
  {
    id: "flight",
    label: "Fly to flower",
    worldState: "heading",
    circuitMode: "heading / flight-forward / flight-reverse",
    trigger: "Takeoff completes",
    duration: "Until flower boundary contact",
    world: ["Airborne fly", "landing flower"],
    hud: ["EPG compass", "velocity/throttle", "flight steering"],
    dialog: [],
    neurons: ["heading", "flight-forward"],
    next: ["landing"],
  },
  {
    id: "landing",
    label: "Land",
    worldState: "landing",
    circuitMode: "landing",
    trigger: "Fly enters flower landing radius",
    duration: "1.7 seconds",
    world: ["Leg extension", "touchdown on flower"],
    hud: ["landing pathway"],
    dialog: [],
    neurons: ["landing"],
    next: ["groom"],
  },
  {
    id: "groom",
    label: "Freshen up",
    worldState: "groom-head",
    circuitMode: "groom-head",
    trigger: "Landing completes",
    duration: "22.5-second slow cycle; player remains movable",
    world: ["Head wobble grooming", "fly stays on flower"],
    hud: ["slow looping DNg12 sequence"],
    dialog: ["Freshen up"],
    neurons: ["groom-head"],
    next: ["relaunch"],
  },
  {
    id: "relaunch",
    label: "Next flower",
    worldState: "relaunch",
    circuitMode: "flight-forward",
    trigger: "Grooming cycle completes",
    duration: "1.8 seconds",
    world: ["New target", "takeoff animation"],
    hud: ["new flower objective", "thrust selection"],
    dialog: [],
    neurons: ["flight-forward"],
    next: ["flight"],
  },
];
