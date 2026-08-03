// The one description of what the game shows. page.tsx renders from it and the
// system-design hub reports on it, so the hub cannot drift out of step with the
// experience it documents: there is no second, hand-typed copy to fall behind.
import flightDng02 from "./flight-dng02.json";
import flightDnp03 from "./flight-dnp03.json";

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const WALKING_SCENE_URL = "https://ng.banc.community/2026a/walking";
export const FEEDING_SCENE_URL = "https://ng.banc.community/2026a/feeding";
export const WALKING_FIGURE_URL = "https://ng.banc.community/2026a/figure-5c";

export type CircuitMode = "walk" | "backward" | "left" | "right" | "eat" | "threat" | "dodge" | "heading" | "flight-forward" | "flight-reverse" | "landing" | "groom-head";

export const STEERING_CODEX_URL = "https://codex.flywire.ai/app/connectivity?cell_names_or_ids=cell_type+%3D%3D+DNa01+%7C%7C+cell_type+%3D%3D+DNa02&dataset=banc";
export const MDN_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+MDN&dataset=banc";
export const EPG_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+EPG&dataset=banc";
export const DNG02_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+DNg02&dataset=banc";
export const DNP03_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+DNp03&dataset=banc";
export const LANDING_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+DNp07+%7C%7C+cell_type+%3D%3D+DNp10&dataset=banc";
export const DNG12_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+DNg12&dataset=banc";

export const STATIC_NEURON_LAYERS: Record<CircuitMode, { src?: string; label: string; accent: string; populationLabel?: string }> = {
  walk: { src: `${assetBase}/banc-forward.webp`, label: "FORWARD WALK", accent: "#ff4fa3" },
  backward: { src: `${assetBase}/banc-backward.webp`, label: "MOONWALK", accent: "#ff4fa3" },
  left: { src: `${assetBase}/banc-turn-left.webp`, label: "STEER LEFT", accent: "#ff4fa3" },
  right: { src: `${assetBase}/banc-turn-right.webp`, label: "STEER RIGHT", accent: "#ff4fa3" },
  eat: { src: `${assetBase}/banc-eat.webp`, label: "FEEDING", accent: "#ffc857" },
  threat: { src: `${assetBase}/banc-threat-walk.webp`, label: "THREAT RESPONSE", accent: "#ff7b72" },
  dodge: { label: "QUICK DODGE", accent: "#ff8fa8" },
  heading: { label: "EPG COCKPIT", accent: "#bd9bd1" },
  "flight-forward": { label: "FORWARD THRUST", accent: "#70d8ce" },
  "flight-reverse": { label: "REVERSE FLIGHT", accent: "#efb7dc" },
  landing: { src: `${assetBase}/banc-landing-pathway.webp`, label: "LANDING", accent: "#68d5c0" },
  "groom-head": {
    src: `${assetBase}/banc-groom-head-dng12.webp`,
    label: "HEAD GROOMING",
    accent: "#c7a6f3",
    populationLabel: "BANC DNg12-annotated population — anterior grooming",
  },
};

export const CIRCUITS: Record<CircuitMode, {
  // `types` names the actual cell types on screen. Never describe a layer as
  // "five neurons": the type is the science, and a count without it says nothing.
  types: string;
  summary: string;
  viewerUrl: string;
}> = {
  walk: {
    types: "DNg100 ×2 · AN09B029_b ×2 · AN02A002 ×2",
    summary: "Six selected cells: DNg100 sends walking drive down from the brain; AN09B029_b and AN02A002 carry information about the moving legs back toward it.",
    viewerUrl: WALKING_SCENE_URL,
  },
  backward: {
    types: "MDN ×4",
    summary: "The Moonwalker Descending Neurons (MDN). Activating them switches the fly from forward to backward walking, one of the clearest command signals in the connectome.",
    viewerUrl: MDN_CODEX_URL,
  },
  left: {
    types: "DNa02 left · DNa01 left",
    summary: "Two ipsilateral steering descending neurons of the left hemisphere. DNa02 is the high-gain channel and DNa01 the low-gain one, and the fly compares the two sides rather than reading either alone.",
    viewerUrl: STEERING_CODEX_URL,
  },
  right: {
    types: "DNa02 right · DNa01 right",
    summary: "Two ipsilateral steering descending neurons of the right hemisphere. DNa02 is the high-gain channel and DNa01 the low-gain one, and the fly compares the two sides rather than reading either alone.",
    viewerUrl: STEERING_CODEX_URL,
  },
  eat: {
    types: "DNg70 ×2 · DNp44 ×2 · DNp62 ×2",
    summary: "Three descending pairs associated with feeding: DNg70, feeding-associated DNp44, and hunger-associated DNp62. They descend from the brain toward the circuits that drive the proboscis and mouthparts.",
    viewerUrl: FEEDING_SCENE_URL,
  },
  threat: {
    types: "DNp42 ×2 · DNge053 ×2 · DNg55 ×1",
    summary: "Five escape-response cells: DNp42 supports backward walking, DNge053 walking, and DNg55 steering. They help produce the escape; they do not detect the threat.",
    viewerUrl: WALKING_FIGURE_URL,
  },
  dodge: {
    types: `DNp03 ×${flightDnp03.count}`,
    summary: `The verified ${flightDnp03.count}-cell DNp03 pair is shown as an explanatory flight-saccade pulse. Anatomical side is not assigned to turn direction.`,
    viewerUrl: DNP03_CODEX_URL,
  },
  heading: {
    types: "EPG ×53",
    summary: "EPG compass neurons tile the ellipsoid body, and a bump of activity moves around that ring as the fly turns, holding its heading.",
    viewerUrl: EPG_CODEX_URL,
  },
  "flight-forward": {
    types: `DNg02 ×${flightDng02.count}`,
    summary: `The ${flightDng02.count}-cell DNg02 population regulates wingbeat amplitude and contributes to flight thrust.`,
    viewerUrl: DNG02_CODEX_URL,
  },
  "flight-reverse": {
    types: `DNg02 ×${flightDng02.count}`,
    summary: "Reverse is simulated by reducing and redirecting DNg02-powered thrust; no dedicated backward-flight cell type is claimed.",
    viewerUrl: DNG02_CODEX_URL,
  },
  landing: {
    types: "DNp07 ×2 · DNp10 ×2",
    summary: "Two descending pairs that contribute to visually evoked landing and to the landing-like extension of all six legs. They are not the only landing neurons.",
    viewerUrl: LANDING_CODEX_URL,
  },
  "groom-head": {
    types: "DNg12 ×28",
    summary: "Anterior grooming. These 28 DNg12 cells take their inputs in the brain and put their outputs in the T1 front-leg region of the nerve cord, which is the sweep of the head and the rubbing of the front legs.",
    viewerUrl: DNG12_CODEX_URL,
  },
};

export const LAYER_SEQUENCE_FRAMES = 16;
// Every sequence closes on a byte-identical copy of its first frame, which is
// how a cyclic render ends. Measured: frame 15 == frame 0 in all eight 16-frame
// directories, and frame 11 == frame 0 in both 12-frame dodges. Playing the
// duplicate holds that pose for two frame-times on every loop, an 83ms stutter
// at 12fps, so the loop length is one less than the file count.
export const LAYER_SEQUENCE_LOOP = LAYER_SEQUENCE_FRAMES - 1;
export const LAYER_SEQUENCE_FPS = 12;
export const LAYER_SEQUENCES: Partial<Record<CircuitMode, string>> = {
  walk: "banc-forward",
  backward: "banc-backward",
  left: "banc-turn-left",
  right: "banc-turn-right",
  eat: "banc-eat",
  threat: "banc-threat-walk",
  landing: "banc-landing-dnp07-dnp10",
};

// DNg02 is the flight drive. It is an ADDITIONAL overlay on the EPG compass,
// never a replacement for it: the compass holds the heading while these cells
// supply the thrust, and both populations are on screen at once.
export const FLIGHT_POWER_DIR = "banc-flight-power-dng02";
const sequenceFrames = (dir: string) => Array.from(
  { length: LAYER_SEQUENCE_FRAMES },
  (_, index) => `${assetBase}/${dir}/frame-${String(index).padStart(2, "0")}.webp`,
);
export const LAYER_SEQUENCE_ASSETS: Partial<Record<CircuitMode, string[]>> =
  Object.fromEntries(Object.entries(LAYER_SEQUENCES).map(([mode, dir]) => [mode, sequenceFrames(dir)]));
export const FLIGHT_POWER_ASSETS = sequenceFrames(FLIGHT_POWER_DIR);
