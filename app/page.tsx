"use client";

import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlyHologram } from "./FlyHologram";
import flightDng02 from "./data/flight-dng02.json";
import layerStats from "./data/layer-stats.json";
import flightDnp03 from "./data/flight-dnp03.json";
import walkingSteeringNeuroglancer from "./data/walking-steering-neuroglancer.json";

type Action = "rest" | "forward" | "backward" | "left" | "right";
type CircuitMode = "walk" | "backward" | "left" | "right" | "eat" | "threat" | "dodge" | "heading" | "flight-forward" | "flight-reverse" | "landing" | "groom-head";
type WorldState = "seeking" | "eating" | "threat" | "freeze" | "run" | "caught" | "scent" | "dodge" | "takeoff" | "heading" | "landing" | "groom-head" | "relaunch";
type ThreatChoice = "freeze" | "run" | "fly";

const PLAYER_CONTROL_STATES = new Set<WorldState>(["seeking", "eating", "heading", "groom-head"]);
const isPlayerControllableState = (state: WorldState) => PLAYER_CONTROL_STATES.has(state);

const WALKING_FIGURE_URL = "https://ng.banc.community/2026a/figure-5c";
const WALKING_SCENE_URL = "https://ng.banc.community/2026a/walking";
const FEEDING_SCENE_URL = "https://ng.banc.community/2026a/feeding";
const INTERACTIVE_NEURON_URL = `https://spelunker.cave-explorer.org/#!${encodeURIComponent(JSON.stringify(walkingSteeringNeuroglancer))}`;
const STEERING_CODEX_URL = "https://codex.flywire.ai/app/connectivity?cell_names_or_ids=cell_type+%3D%3D+DNa01+%7C%7C+cell_type+%3D%3D+DNa02&dataset=banc";
const MDN_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+MDN&dataset=banc";
const EPG_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+EPG&dataset=banc";
const DNG02_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+DNg02&dataset=banc";
const DNP03_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+DNp03&dataset=banc";
const LANDING_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+DNp07+%7C%7C+cell_type+%3D%3D+DNp10&dataset=banc";
const DNG12_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+DNg12&dataset=banc";
const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const BANC_CONTEXT_ASSET = `${assetBase}/banc-context-base.webp?v=dng12-122`;
const EPG_HEADING_COUNT = 16;
const EPG_HEADING_ASSETS = Array.from(
  { length: EPG_HEADING_COUNT },
  (_, index) => `${assetBase}/epg/epg-heading-${String(index).padStart(2, "0")}.webp`,
);
const EPG_BASE_ASSET = `${assetBase}/epg/epg-base.webp`;
const DODGE_FRAME_COUNT = 12;
const DODGE_PLAYBACK_FPS = 12;
const SNACK_BEFORE_WARNING_MS = 4800;
const FREEZE_SURVIVAL_MS = 3000;
const RUN_CAUGHT_MS = 1500;
const GAME_OVER_MS = 3200;
const SCENT_REVEAL_MS = 2600;
// Hold the scripted quick-dodge beat long enough for the mobile neural focus to
// show the 12-frame explanatory signal three times before takeoff continues.
const DODGE_STAGE_MS = 3200;
const TAKEOFF_STAGE_MS = 1800;
const LANDING_STAGE_MS = 1700;
const RELAUNCH_STAGE_MS = 1800;
const DODGE_LEFT_ASSETS = Array.from(
  { length: DODGE_FRAME_COUNT },
  (_, index) => `${assetBase}/banc-flight-dodge-anatomical-left/frame-${String(index).padStart(2, "0")}.webp`,
);
const DODGE_RIGHT_ASSETS = Array.from(
  { length: DODGE_FRAME_COUNT },
  (_, index) => `${assetBase}/banc-flight-dodge-anatomical-right/frame-${String(index).padStart(2, "0")}.webp`,
);
const WALK_SPEED_FRAME_COUNT = 16;
const WALK_SPEED_ASSETS = Array.from(
  { length: WALK_SPEED_FRAME_COUNT },
  (_, index) => `${assetBase}/banc-walk-speed-dng100/frame-${String(index).padStart(2, "0")}.webp`,
);
const GROOM_FRAME_COUNT = 16;
const GROOM_NEURAL_SOURCE_FPS = 24;
// Replay the explanatory render at one tenth of its encoded rate so the
// brain-to-T1 progression is visible, then repeat it while grooming continues.
const GROOM_NEURAL_PLAYBACK_FPS = GROOM_NEURAL_SOURCE_FPS / 10;
const GROOM_SIGNAL_DELAY_MS = 520;
// One complete 10x-slowed articulated grooming cycle, including ease in/out.
const HEAD_GROOM_DURATION_MS = 22500;
const HEAD_GROOM_ASSETS = Array.from(
  { length: GROOM_FRAME_COUNT },
  (_, index) => `${assetBase}/banc-groom-head-dng12/frame-${String(index).padStart(2, "0")}.webp`,
);
// Keep the food target inside the unobscured fly world. The desktop neural HUD
// occupies as much as 46vw, so the peach must stay in the left half rather than
// merely being mounted beneath that opaque panel.
const FOOD_TARGET = { x: 0.42, y: 0.3 };
const FOOD_CONTACT_BOUNDARY = { halfWidth: 0.15, halfHeight: 0.11 };
const FLOWER_TARGETS = [
  { x: 0.2, y: 0.72 },
  { x: 0.76, y: 0.34 },
  { x: 0.26, y: 0.24 },
  { x: 0.73, y: 0.72 },
] as const;
const FLOWER_CONTACT_RADIUS = 0.105;
const SIM_WORLD_WIDTH_MM = 3;
// The fly roams almost the entire viewport rather than a small centre box.
// WORLD_BOUNDS is the navigable range; WORLD_SPREAD maps it onto the screen.
const WORLD_BOUNDS = { minX: 0.05, maxX: 0.95, minY: 0.12, maxY: 0.9 };
const WORLD_SPREAD = { x: 90, y: 86 };
const SIM_WORLD_NAVIGABLE_SPAN = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
const MM_PER_SIM_UNIT = SIM_WORLD_WIDTH_MM / SIM_WORLD_NAVIGABLE_SPAN;
const MAX_SIM_VELOCITY_MM_S = 1;
const MIN_DRIVE_LEVEL = 0.25;
const DEFAULT_DRIVE_LEVEL = 0.55;
const DRIVE_LEVEL_STEP = 0.1;
const MAX_FLIGHT_SPEED_SIM_S = 0.29;
const toScreenPosition = ({ x, y }: { x: number; y: number }) => ({
  left: `${50 + (x - 0.5) * WORLD_SPREAD.x}%`,
  top: `${50 + (y - 0.5) * WORLD_SPREAD.y}%`,
});
const FOOD_SCREEN = toScreenPosition(FOOD_TARGET);
const isInsideEllipse = (
  point: { x: number; y: number },
  center: { x: number; y: number },
  boundary: { halfWidth: number; halfHeight: number },
) => {
  const x = (point.x - center.x) / boundary.halfWidth;
  const y = (point.y - center.y) / boundary.halfHeight;
  return x * x + y * y <= 1;
};

const STATIC_NEURON_LAYERS: Record<CircuitMode, { src?: string; label: string; accent: string; populationLabel?: string }> = {
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

const CIRCUITS: Record<CircuitMode, {
  // `types` names the actual cell types on screen. Never describe a layer as
  // "five neurons": the type is the science, and a count without it says nothing.
  types: string;
  summary: string;
  viewerUrl: string;
  note?: string;
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
    note: "This is the BANC-native DNg12 annotation population. It does not imply that every rendered cell was independently function-tested. Slow looping replay is derived from skeleton geometry and synapse polarity—not recorded activity or timing.",
  },
};

type NeuronColorKeyItem = {
  label: string;
  detail: string;
  color: string;
};

// These keys describe the pixels in the delivered renders, not inferred cell
// identities. Some current layers pool multiple types into one color; say so
// plainly until type-separated replacement renders arrive.
const NEURON_COLOR_KEYS: Partial<Record<CircuitMode, NeuronColorKeyItem[]>> = {
  walk: [
    { label: "DNg100", detail: "descending walking drive", color: "#ff1493" },
    { label: "AN09B029_b + AN02A002", detail: "leg-state feedback (pooled)", color: "#089c39" },
  ],
  threat: [
    { label: "DNp42 + DNge053 + DNg55", detail: "escape response (pooled)", color: "#ff6b5f" },
  ],
  heading: [
    { label: "Active EPG heading", detail: "compass readout", color: "#e8afd8" },
    { label: "Other EPG cells", detail: "compass population", color: "#706878" },
  ],
};

const CONTEXT_COLOR_KEY: NeuronColorKeyItem = {
  label: "Context neurons",
  detail: "anatomical reference",
  color: "#52675e",
};

const LEGEND = [
  ["Sensory", "#68d6c4"],
  ["Ascending", "#8ac7ff"],
  ["Descending", "#ffc857"],
  ["VNC + motor", "#ff7f6e"],
];

export default function Home() {
  const flyRef = useRef({ x: 0.34, y: 0.58, angle: -0.28 });
  const keysRef = useRef(new Set<string>());
  const boostRef = useRef(false);
  const driveLevelRef = useRef(DEFAULT_DRIVE_LEVEL);
  const flightMotionRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const lastHeadingUiRef = useRef(0);
  const lastVelocityUiRef = useRef(0);
  const velocityRef = useRef(0);
  const velocitySampleRef = useRef({ x: 0.34, y: 0.58 });
  const actionRef = useRef<Action>("rest");
  const worldStateRef = useRef<WorldState>("seeking");
  const warningTimerRef = useRef<number | null>(null);
  const threatTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const resolutionTimerRef = useRef<number | null>(null);
  const takeoffTimerRef = useRef<number | null>(null);
  const headingTimerRef = useRef<number | null>(null);
  const landingTimerRef = useRef<number | null>(null);
  const groomTimerRef = useRef<number | null>(null);
  const relaunchTimerRef = useRef<number | null>(null);
  const flowerIndexRef = useRef(0);
  const epgPreloadedRef = useRef(false);
  const pointerControlRef = useRef<{ pointerId: number; action: Exclude<Action, "rest"> } | null>(null);
  const [action, setAction] = useState<Action>("rest");
  const [boosting, setBoosting] = useState(false);
  const [driveLevel, setDriveLevel] = useState(DEFAULT_DRIVE_LEVEL);
  // the arrow dock is a hint, not furniture: it pulses until first use, then recedes
  const [controlsUsed, setControlsUsed] = useState(false);
  const [walkSpeedFrame, setWalkSpeedFrame] = useState(0);
  const [worldState, setWorldState] = useState<WorldState>("seeking");
  const [freezeCountdown, setFreezeCountdown] = useState(3);
  const [steps, setSteps] = useState(0);
  const [headingDegrees, setHeadingDegrees] = useState(344);
  const [simVelocity, setSimVelocity] = useState(0);
  const [flightThrottle, setFlightThrottle] = useState(0);
  const [dodgeFrame, setDodgeFrame] = useState(0);
  const [groomFrame, setGroomFrame] = useState(0);
  const [groomAssetsReady, setGroomAssetsReady] = useState(false);
  const [flowerIndex, setFlowerIndex] = useState(0);
  const [circuitMode, setCircuitMode] = useState<CircuitMode>("walk");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [mobileHudExpanded, setMobileHudExpanded] = useState(false);
  const activeCircuit = CIRCUITS[circuitMode];
  const activeNeuronLayer = STATIC_NEURON_LAYERS[circuitMode];
  const flowerTarget = FLOWER_TARGETS[flowerIndex];
  const flowerScreen = toScreenPosition(flowerTarget);
  const isFlightCockpit = circuitMode === "heading" || circuitMode === "flight-forward" || circuitMode === "flight-reverse";
  const isDodgePulse = circuitMode === "dodge";
  const isGrooming = worldState === "groom-head";
  const effectiveDriveLevel = boosting ? 1 : driveLevel;
  const isWalkSpeedPulse = worldState === "seeking"
    && effectiveDriveLevel > MIN_DRIVE_LEVEL
    && (action === "forward" || action === "left" || action === "right");
  const isGroomPulse = isGrooming && groomAssetsReady;
  const groomFrameAsset = HEAD_GROOM_ASSETS[groomFrame];
  const controlsLocked = !isPlayerControllableState(worldState);
  const flySceneState = worldState === "eating"
    ? "eating"
    : worldState === "dodge"
      ? "dodge"
      : worldState === "takeoff"
        ? "takeoff"
        : worldState === "heading"
          ? "flight"
          : worldState === "landing"
            ? "landing"
            : worldState === "groom-head"
              ? "groom-head"
              : worldState === "relaunch"
                ? "relaunch"
                : "ground";
  const compassDegrees = (headingDegrees + 90) % 360;
  const epgCounterClockwiseDegrees = (360 - compassDegrees) % 360;
  const epgHeadingIndex = Math.floor(epgCounterClockwiseDegrees / (360 / EPG_HEADING_COUNT)) % EPG_HEADING_COUNT;
  const epgHeadingAsset = EPG_HEADING_ASSETS[epgHeadingIndex];
  const headingCardinal = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(compassDegrees / 45) % 8];
  const isFlightDriveMode = worldState === "dodge"
    || worldState === "takeoff"
    || worldState === "heading"
    || worldState === "landing"
    || worldState === "relaunch";
  const velocityDirection = simVelocity > 0.02 ? "forward" : simVelocity < -0.02 ? "reverse" : "idle";
  const velocityDisplay = `${simVelocity > 0 ? "+" : ""}${simVelocity.toFixed(2)}`;
  const throttleLevel = Math.min(Math.abs(flightThrottle), 1);
  const driveSettingPercent = Math.round(driveLevel * 100);
  const drivePercent = Math.round(effectiveDriveLevel * 100);
  const appliedDriveLevel = isFlightDriveMode
    ? throttleLevel
    : action !== "rest" && isPlayerControllableState(worldState)
      ? effectiveDriveLevel
      : 0;
  const driveCommandLabel = isFlightDriveMode ? "THRUST SETTING" : "PACE SETTING";
  const driveNeuronLabel = isFlightDriveMode ? "DNg02 · WING DRIVE" : "DNg100 · WALK DRIVE";
  const speedOutputLabel = isFlightDriveMode ? "AIR SPEED" : "GROUND SPEED";
  const walkDrivePlaybackFps = 5 + effectiveDriveLevel * 11;
  const worldCopy = worldState === "eating"
    ? { title: "Snack found!", detail: "Feeding neurons are glowing." }
    : worldState === "threat"
      ? { title: "Threat detected!", detail: "Choose a survival strategy." }
    : worldState === "freeze"
      ? { title: "Hold still…", detail: `${freezeCountdown} seconds until the threat passes.` }
    : worldState === "run"
      ? { title: "Run!", detail: "The spider is faster." }
    : worldState === "caught"
      ? { title: "Nature is rough", detail: "You didn’t survive this round." }
    : worldState === "scent"
      ? { title: "The coast is clear", detail: "A tasty scent drifts from the top of a flower." }
      : worldState === "dodge"
        ? { title: "Quick dodge!", detail: "DNp03 flight-saccade pulse." }
      : worldState === "takeoff"
        ? { title: "Takeoff!", detail: "Wings up." }
      : worldState === "heading"
        ? { title: "Fly to the flower", detail: "Steer with the arrow keys." }
      : worldState === "landing"
        ? { title: "Touchdown!", detail: "Landing neurons guide the final approach." }
      : worldState === "groom-head"
        ? { title: "Freshen up!", detail: "Front legs sweep the head clean." }
      : worldState === "relaunch"
        ? { title: "New flower detected!", detail: "Wings up for another tiny journey." }
        : action === "rest"
          ? { title: "Find the fallen fruit", detail: "A 3 mm journey through a giant garden." }
          : action === "forward"
            ? { title: "Tiny feet in motion", detail: "Connectome signals are now in motion." }
            : action === "backward"
              ? { title: "Moonwalking", detail: "Four MDNs send the fly into reverse." }
            : { title: `Steering ${action}`, detail: "Connectome signals are now in motion." };
  const targetCopy = worldState === "eating"
    ? { title: "SNACK FOUND", detail: "TASTING THE FRUIT" }
    : worldState === "threat"
      ? { title: "THREAT DETECTED", detail: "FREEZE · RUN · FLY" }
    : worldState === "freeze"
      ? { title: "STAY STILL", detail: `${freezeCountdown} SECONDS` }
    : worldState === "run" || worldState === "caught"
      ? { title: "PREDATOR", detail: "TOO CLOSE" }
    : worldState === "scent"
      ? { title: "TASTY SCENT", detail: "FLOWER TOP DETECTED" }
    : worldState === "dodge"
      ? { title: "QUICK DODGE", detail: "FLIGHT SACCADE" }
    : worldState === "takeoff"
        ? { title: "AIRBORNE", detail: "LAUNCHING FROM DANGER" }
      : worldState === "heading"
        ? { title: "LAND HERE", detail: "STEER TO THE FLOWER" }
      : worldState === "landing"
        ? { title: "SAFE FLOWER", detail: "TOUCHING DOWN" }
      : worldState === "groom-head"
        ? { title: "GROOMING PERCH", detail: "CLEANING UP" }
      : worldState === "relaunch"
        ? { title: "NEW TARGET", detail: "FLOWER DETECTED" }
        : { title: "RIPE FRUIT", detail: "FOLLOW THE YEASTY SCENT" };
  const missionCopy = worldState === "heading" || worldState === "relaunch" || worldState === "scent"
    ? { kicker: "FLIGHT OBJECTIVE", title: worldState === "relaunch" ? "NEW FLOWER DETECTED" : "FLY TO THE FLOWER", detail: "LAND IN THE GLOW" }
    : { kicker: "FORAGING OBJECTIVE", title: "FIND THE RIPE FRUIT", detail: "FOLLOW THE YEASTY SCENT" };

  useEffect(() => {
    if (!viewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [viewerOpen]);

  const resetExperience = useCallback(() => {
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (threatTimerRef.current) window.clearTimeout(threatTimerRef.current);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
    if (takeoffTimerRef.current) window.clearTimeout(takeoffTimerRef.current);
    if (headingTimerRef.current) window.clearTimeout(headingTimerRef.current);
    keysRef.current.clear();
    flyRef.current.x = 0.34;
    flyRef.current.y = 0.58;
    flyRef.current.angle = -0.28;
    velocitySampleRef.current = { x: 0.34, y: 0.58 };
    velocityRef.current = 0;
    flightMotionRef.current = 0;
    driveLevelRef.current = DEFAULT_DRIVE_LEVEL;
    boostRef.current = false;
    actionRef.current = "rest";
    worldStateRef.current = "seeking";
    flowerIndexRef.current = 0;
    setAction("rest");
    setWorldState("seeking");
    setCircuitMode("walk");
    setFreezeCountdown(3);
    setSimVelocity(0);
    setFlightThrottle(0);
    setDriveLevel(DEFAULT_DRIVE_LEVEL);
    setBoosting(false);
    setFlowerIndex(0);
  }, []);

  const startTakeoff = useCallback((withDodge: boolean) => {
    keysRef.current.clear();
    const beginTakeoff = () => {
      worldStateRef.current = "takeoff";
      actionRef.current = "rest";
      setAction("rest");
      setWorldState("takeoff");
      setCircuitMode("flight-forward");
      headingTimerRef.current = window.setTimeout(() => {
        if (worldStateRef.current !== "takeoff") return;
        worldStateRef.current = "heading";
        setWorldState("heading");
        setCircuitMode("heading");
      }, TAKEOFF_STAGE_MS);
    };

    if (!withDodge) {
      beginTakeoff();
      return;
    }

    worldStateRef.current = "dodge";
    actionRef.current = "right";
    setDodgeFrame(0);
    setAction("right");
    setWorldState("dodge");
    setCircuitMode("dodge");
    takeoffTimerRef.current = window.setTimeout(() => {
      if (worldStateRef.current !== "dodge") return;
      beginTakeoff();
    }, DODGE_STAGE_MS);
  }, []);

  const handleThreatChoice = useCallback((choice: ThreatChoice) => {
    if (worldStateRef.current !== "threat") return;
    keysRef.current.clear();
    actionRef.current = "rest";
    setAction("rest");

    if (choice === "fly") {
      startTakeoff(true);
      return;
    }

    if (choice === "run") {
      worldStateRef.current = "run";
      actionRef.current = "forward";
      setAction("forward");
      setWorldState("run");
      setCircuitMode("threat");
      resolutionTimerRef.current = window.setTimeout(() => {
        if (worldStateRef.current !== "run") return;
        worldStateRef.current = "caught";
        actionRef.current = "rest";
        setAction("rest");
        setWorldState("caught");
        threatTimerRef.current = window.setTimeout(resetExperience, GAME_OVER_MS);
      }, RUN_CAUGHT_MS);
      return;
    }

    worldStateRef.current = "freeze";
    setFreezeCountdown(3);
    setWorldState("freeze");
    setCircuitMode("threat");
    countdownTimerRef.current = window.setInterval(() => {
      setFreezeCountdown((value) => Math.max(1, value - 1));
    }, 1000);
    resolutionTimerRef.current = window.setTimeout(() => {
      if (worldStateRef.current !== "freeze") return;
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      worldStateRef.current = "scent";
      setWorldState("scent");
      setCircuitMode("eat");
      threatTimerRef.current = window.setTimeout(() => {
        if (worldStateRef.current !== "scent") return;
        startTakeoff(false);
      }, SCENT_REVEAL_MS);
    }, FREEZE_SURVIVAL_MS);
  }, [resetExperience, startTakeoff]);

  const triggerEating = useCallback(() => {
    if (worldStateRef.current !== "seeking") return;
    worldStateRef.current = "eating";
    setWorldState("eating");
    setCircuitMode("eat");
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (threatTimerRef.current) window.clearTimeout(threatTimerRef.current);
    warningTimerRef.current = window.setTimeout(() => {
      if (worldStateRef.current !== "eating") return;
      worldStateRef.current = "threat";
      keysRef.current.clear();
      actionRef.current = "rest";
      setAction("rest");
      setWorldState("threat");
      setCircuitMode("threat");
    }, SNACK_BEFORE_WARNING_MS);
  }, []);

  const triggerLanding = useCallback(() => {
    if (worldStateRef.current !== "heading") return;
    worldStateRef.current = "landing";
    keysRef.current.clear();
    actionRef.current = "rest";
    setAction("rest");
    setWorldState("landing");
    setCircuitMode("landing");
    landingTimerRef.current = window.setTimeout(() => {
      if (worldStateRef.current !== "landing") return;
      setGroomFrame(0);
      worldStateRef.current = "groom-head";
      setWorldState("groom-head");
      setCircuitMode("groom-head");
      groomTimerRef.current = window.setTimeout(() => {
        if (worldStateRef.current !== "groom-head") return;
        const nextFlowerIndex = (flowerIndexRef.current + 1) % FLOWER_TARGETS.length;
        flowerIndexRef.current = nextFlowerIndex;
        setFlowerIndex(nextFlowerIndex);
        worldStateRef.current = "relaunch";
        setWorldState("relaunch");
        setCircuitMode("flight-forward");
        relaunchTimerRef.current = window.setTimeout(() => {
          if (worldStateRef.current !== "relaunch") return;
          worldStateRef.current = "heading";
          setWorldState("heading");
          setCircuitMode("heading");
        }, RELAUNCH_STAGE_MS);
      }, HEAD_GROOM_DURATION_MS);
    }, LANDING_STAGE_MS);
  }, []);

  const updateAction = useCallback((next: Action) => {
    const currentState = worldStateRef.current;
    if (!isPlayerControllableState(currentState)) return;
    actionRef.current = next;
    setAction(next);
    if (next !== "rest" && currentState === "seeking") {
      setCircuitMode(next === "forward" ? "walk" : next);
    } else if (currentState === "heading") {
      // EPG remains a compass readout while DNg02 supplies the mode-specific
      // drive command below. Do not relabel the EPG render as a DNg02 render.
      setCircuitMode("heading");
    }
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "shift") {
        if (!isPlayerControllableState(worldStateRef.current)) return;
        event.preventDefault();
        boostRef.current = true;
        setBoosting(true);
        setControlsUsed(true);
        return;
      }
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "s", "a", "d"].includes(key)) {
        event.preventDefault();
        const currentState = worldStateRef.current;
        if (!isPlayerControllableState(currentState)) return;
        keysRef.current.add(key);
        setControlsUsed(true);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "shift") {
        boostRef.current = false;
        setBoosting(false);
        return;
      }
      keysRef.current.delete(key);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  useEffect(() => {
    if (worldState !== "eating" || epgPreloadedRef.current) return;
    epgPreloadedRef.current = true;
    [EPG_BASE_ASSET, ...EPG_HEADING_ASSETS, ...DODGE_LEFT_ASSETS, ...DODGE_RIGHT_ASSETS].forEach((src) => {
      void fetch(src, { cache: "force-cache" }).catch(() => undefined);
    });
  }, [worldState]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(HEAD_GROOM_ASSETS.map((src) => fetch(src, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error(`Grooming frame unavailable: ${src}`);
      return response.arrayBuffer();
    })))
      .then(() => {
        if (!cancelled) setGroomAssetsReady(true);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void Promise.all(WALK_SPEED_ASSETS.map((src) => fetch(src, { cache: "force-cache" })))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isWalkSpeedPulse) return;
    const startedAt = performance.now();
    const frameDuration = 1000 / walkDrivePlaybackFps;
    let animationFrame = 0;
    const advance = () => {
      const elapsed = performance.now() - startedAt;
      setWalkSpeedFrame(Math.floor(elapsed / frameDuration) % WALK_SPEED_FRAME_COUNT);
      animationFrame = requestAnimationFrame(advance);
    };
    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [isWalkSpeedPulse, walkDrivePlaybackFps]);

  useEffect(() => {
    if (worldState !== "dodge") return;
    const startedAt = performance.now();
    let animationFrame = 0;
    const advance = () => {
      const elapsed = performance.now() - startedAt;
      setDodgeFrame(Math.min(DODGE_FRAME_COUNT - 1, Math.floor(elapsed / (1000 / DODGE_PLAYBACK_FPS))));
      if (elapsed < (DODGE_FRAME_COUNT / DODGE_PLAYBACK_FPS) * 1000) animationFrame = requestAnimationFrame(advance);
    };
    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [worldState]);

  useEffect(() => {
    if (!isGrooming || !groomAssetsReady) return;
    const startedAt = performance.now();
    const frameDuration = 1000 / GROOM_NEURAL_PLAYBACK_FPS;
    const cycleDuration = GROOM_FRAME_COUNT * frameDuration;
    let animationFrame = 0;
    const advance = () => {
      const elapsed = performance.now() - startedAt - GROOM_SIGNAL_DELAY_MS;
      const nextFrame = elapsed <= 0
        ? 0
        : Math.floor((elapsed % cycleDuration) / frameDuration) % GROOM_FRAME_COUNT;
      setGroomFrame(nextFrame);
      animationFrame = requestAnimationFrame(advance);
    };
    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [groomAssetsReady, isGrooming, worldState]);

  useEffect(() => {
    const shouldOpenFocus = worldState === "dodge" || worldState === "groom-head";
    const shouldCloseFocus = worldState === "takeoff" || worldState === "relaunch";
    if (!shouldOpenFocus && !shouldCloseFocus) return;
    const focusTimer = window.setTimeout(
      () => setMobileHudExpanded(shouldOpenFocus),
      0,
    );
    return () => window.clearTimeout(focusTimer);
  }, [worldState]);

  useEffect(() => {
    if (!mobileHudExpanded) return;
    const cycleDuration = circuitMode === "groom-head"
      ? (GROOM_FRAME_COUNT / GROOM_NEURAL_PLAYBACK_FPS) * 1000
      : circuitMode === "dodge"
        ? (DODGE_FRAME_COUNT / DODGE_PLAYBACK_FPS) * 1000
        : 2400;
    const autoCloseTimer = window.setTimeout(() => setMobileHudExpanded(false), cycleDuration * 3);
    return () => window.clearTimeout(autoCloseTimer);
  }, [circuitMode, mobileHudExpanded]);

  useEffect(() => {
    const render = (time: number) => {
      if (time - lastRef.current < 30) {
        frameRef.current = requestAnimationFrame(render);
        return;
      }
      const dt = Math.min((time - lastRef.current) / 1000 || 0, 0.03);
      lastRef.current = time;

      const keys = keysRef.current;
      const currentWorldState = worldStateRef.current;
      const fly = flyRef.current;
      const previousVelocitySample = velocitySampleRef.current;
      // Direction and drive magnitude are independent. W/S says where to go;
      // the persistent drive setting says how strongly to go there. Holding
      // Shift temporarily raises that same setting to maximum in either mode.
      const maxDriveHeld = boostRef.current && isPlayerControllableState(currentWorldState);
      const activeDriveLevel = maxDriveHeld ? 1 : driveLevelRef.current;
      const forward = keys.has("arrowup") || keys.has("w");
      const backward = keys.has("arrowdown") || keys.has("s");
      const left = keys.has("arrowleft") || keys.has("a");
      const right = keys.has("arrowright") || keys.has("d");
      let nextAction: Action = "rest";
      if (left) {
        fly.angle -= dt * 2.25;
        nextAction = "left";
      }
      if (right) {
        fly.angle += dt * 2.25;
        nextAction = "right";
      }
      const currentState = worldStateRef.current;
      if (currentState === "run") {
        fly.x += Math.cos(fly.angle) * dt * 0.15;
        fly.y += Math.sin(fly.angle) * dt * 0.2;
        nextAction = "forward";
      }
      if (currentState === "dodge") {
        fly.angle += dt * 2.2;
        fly.x += dt * 0.18;
        fly.y -= dt * 0.07;
        nextAction = "right";
      }
      const interactiveFlight = currentState === "heading";
      if (interactiveFlight && time - lastHeadingUiRef.current > 70) {
        const normalizedHeading = ((fly.angle * 180 / Math.PI) % 360 + 360) % 360;
        setHeadingDegrees(Math.round(normalizedHeading));
        lastHeadingUiRef.current = time;
      }
      const direction = Number(forward) - Number(backward);
      // W/S is the DNg02 flight-drive command. Reverse is deliberately a
      // reduced/redirected-thrust state, not a claim of a dedicated backward
      // flight cell type or an equal-magnitude reverse motor.
      const throttleCommand = interactiveFlight
        ? direction > 0
          ? activeDriveLevel
          : direction < 0
            ? -activeDriveLevel * 0.55
            : 0
        : 0;
      if (interactiveFlight) {
        // Thrust changes velocity rather than teleporting directly into speed.
        // The lag makes the command/output distinction visible in the HUD.
        const targetFlightMotion = throttleCommand * MAX_FLIGHT_SPEED_SIM_S;
        const flightResponse = 1 - Math.exp(-dt * (throttleCommand === 0 ? 2.1 : 4.2));
        flightMotionRef.current += (targetFlightMotion - flightMotionRef.current) * flightResponse;
        if (Math.abs(flightMotionRef.current) < 0.0005) flightMotionRef.current = 0;
        fly.x += Math.cos(fly.angle) * dt * flightMotionRef.current;
        fly.y += Math.sin(fly.angle) * dt * flightMotionRef.current;
        if (direction !== 0) nextAction = direction < 0 ? "backward" : left ? "left" : right ? "right" : "forward";
      } else {
        flightMotionRef.current = 0;
        if (direction !== 0) {
          const walkPace = 0.55 + activeDriveLevel * 1.45;
          const reverseScale = direction < 0 ? 0.72 : 1;
          fly.x += Math.cos(fly.angle) * dt * 0.12 * direction * walkPace * reverseScale;
          fly.y += Math.sin(fly.angle) * dt * 0.16 * direction * walkPace * reverseScale;
          nextAction = direction < 0 ? "backward" : left ? "left" : right ? "right" : "forward";
        }
      }
      fly.x = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, fly.x));
      fly.y = Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, fly.y));
      const deltaX = fly.x - previousVelocitySample.x;
      const deltaY = fly.y - previousVelocitySample.y;
      velocitySampleRef.current = { x: fly.x, y: fly.y };
      // Signed body-axis velocity comes from actual frame-to-frame displacement,
      // calibrated to the 3 mm world. Positive is forward; negative is reverse.
      const longitudinalVelocity = dt > 0
        ? ((deltaX * Math.cos(fly.angle)) + (deltaY * Math.sin(fly.angle))) / dt * MM_PER_SIM_UNIT
        : 0;
      const targetVelocity = isPlayerControllableState(currentWorldState)
        ? Math.max(-MAX_SIM_VELOCITY_MM_S, Math.min(MAX_SIM_VELOCITY_MM_S, longitudinalVelocity))
        : 0;
      const velocitySmoothing = 1 - Math.exp(-dt * 8);
      velocityRef.current += (targetVelocity - velocityRef.current) * velocitySmoothing;
      if (time - lastVelocityUiRef.current > 80) {
        const roundedVelocity = Math.abs(velocityRef.current) < 0.01
          ? 0
          : Math.round(velocityRef.current * 100) / 100;
        setSimVelocity(roundedVelocity);
        setFlightThrottle(throttleCommand);
        lastVelocityUiRef.current = time;
      }
      if (worldStateRef.current === "seeking" && isInsideEllipse(fly, FOOD_TARGET, FOOD_CONTACT_BOUNDARY)) {
        triggerEating();
      }
      const currentFlowerTarget = FLOWER_TARGETS[flowerIndexRef.current];
      const flowerDistance = Math.hypot(fly.x - currentFlowerTarget.x, fly.y - currentFlowerTarget.y);
      if (worldStateRef.current === "heading" && flowerDistance <= FLOWER_CONTACT_RADIUS) {
        triggerLanding();
      }
      if (!isPlayerControllableState(worldStateRef.current) && worldStateRef.current !== "dodge" && worldStateRef.current !== "run") nextAction = "rest";
      if (nextAction !== actionRef.current) {
        actionRef.current = nextAction;
        setAction(nextAction);
        if (nextAction !== "rest" && worldStateRef.current === "seeking") {
          setCircuitMode(nextAction === "forward" ? "walk" : nextAction);
          setSteps((value) => value + 1);
        } else if (worldStateRef.current === "heading") {
          setCircuitMode("heading");
        }
      }

      frameRef.current = requestAnimationFrame(render);
    };
    frameRef.current = requestAnimationFrame(render);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      if (threatTimerRef.current) window.clearTimeout(threatTimerRef.current);
      if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
      if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
      if (takeoffTimerRef.current) window.clearTimeout(takeoffTimerRef.current);
      if (headingTimerRef.current) window.clearTimeout(headingTimerRef.current);
      if (landingTimerRef.current) window.clearTimeout(landingTimerRef.current);
      if (groomTimerRef.current) window.clearTimeout(groomTimerRef.current);
      if (relaunchTimerRef.current) window.clearTimeout(relaunchTimerRef.current);
    };
  }, [triggerEating, triggerLanding]);

  const setDriveCommand = (nextLevel: number) => {
    const clamped = Math.max(MIN_DRIVE_LEVEL, Math.min(1, nextLevel));
    const rounded = Math.round(clamped * 20) / 20;
    driveLevelRef.current = rounded;
    setDriveLevel(rounded);
    setControlsUsed(true);
  };

  const nudge = (next: Action) => {
    updateAction(next);
    const fly = flyRef.current;
    const activeDriveLevel = boostRef.current ? 1 : driveLevelRef.current;
    const nudgeScale = 0.55 + activeDriveLevel * 1.15;
    if (next === "left") fly.angle -= 0.24;
    if (next === "right") fly.angle += 0.24;
    if (next === "forward") {
      fly.x += Math.cos(fly.angle) * 0.025 * nudgeScale;
      fly.y += Math.sin(fly.angle) * 0.032 * nudgeScale;
      setSteps((value) => value + 1);
    }
    if (next === "backward") {
      fly.x -= Math.cos(fly.angle) * 0.018 * nudgeScale;
      fly.y -= Math.sin(fly.angle) * 0.023 * nudgeScale;
      setSteps((value) => value + 1);
    }
    window.setTimeout(() => updateAction("rest"), 380);
  };

  const controlKey: Record<Exclude<Action, "rest">, string> = {
    left: "arrowleft",
    forward: "arrowup",
    backward: "arrowdown",
    right: "arrowright",
  };
  const controlDisabled = controlsLocked;
  const beginPointerControl = (event: ReactPointerEvent<HTMLButtonElement>, next: Exclude<Action, "rest">) => {
    if (controlDisabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerControlRef.current = { pointerId: event.pointerId, action: next };
    // Give every tap an immediate, visible step. Keeping the key active after
    // this first nudge preserves continuous movement for a press-and-hold.
    nudge(next);
    keysRef.current.add(controlKey[next]);
    setControlsUsed(true);
  };
  const endPointerControl = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = pointerControlRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    keysRef.current.delete(controlKey[active.action]);
    pointerControlRef.current = null;
    updateAction("rest");
  };
  const cancelPointerControl = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = pointerControlRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    keysRef.current.delete(controlKey[active.action]);
    pointerControlRef.current = null;
    updateAction("rest");
  };
  const beginMaxDrive = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (controlDisabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    boostRef.current = true;
    setBoosting(true);
    setControlsUsed(true);
  };
  const endMaxDrive = () => {
    boostRef.current = false;
    setBoosting(false);
  };
  const handleControlClick = (event: ReactMouseEvent<HTMLButtonElement>, next: Exclude<Action, "rest">) => {
    if (event.detail === 0) nudge(next);
  };

  const mobileNeuronLayers = isFlightCockpit ? (
    <>
      <img className="mobile-neuron-base" src={EPG_BASE_ASSET} alt="" />
      <img key={epgHeadingAsset} className="mobile-neuron-active" src={epgHeadingAsset} alt="" />
    </>
  ) : (
    <>
      <img className="mobile-neuron-base" src={BANC_CONTEXT_ASSET} alt="" />
      {isDodgePulse ? (
        <>
          <img className="mobile-neuron-active" src={DODGE_LEFT_ASSETS[dodgeFrame]} alt="" />
          <img className="mobile-neuron-active" src={DODGE_RIGHT_ASSETS[dodgeFrame]} alt="" />
        </>
      ) : activeNeuronLayer.src ? <img key={activeNeuronLayer.src} className="mobile-neuron-active" src={activeNeuronLayer.src} alt="" /> : null}
      {isWalkSpeedPulse && <img className="mobile-neuron-active walk-speed-frame" src={WALK_SPEED_ASSETS[walkSpeedFrame]} alt="" />}
    </>
  );
  const neuronColorKey = NEURON_COLOR_KEYS[circuitMode] ?? [{
    label: activeCircuit.types,
    detail: "selected circuit",
    color: activeNeuronLayer.accent,
  }];

  return (
    <main>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> AN INTERACTIVE CONNECTOME</p>
          <h1>Drive the fly.<br/><em>See behavior light up.</em></h1>
          <p className="lede">Walk, steer, eat, and escape—then see the neurons behind each move.</p>
        </div>
        <div className="live-note">
          <span className="pulse-dot" />
          <div><strong>WALKING LAB · LIVE</strong><small>Use arrow keys or the controls below</small></div>
        </div>
      </section>

      <section className="lab-shell" aria-label="Interactive BANC fly cockpit">
        <div className="arena-panel" style={{ backgroundImage: `url("${assetBase}/moss-garden.webp")` }}>
          <header className="panel-heading cockpit-topbar">
            <span className="brand">
              <span className="brand-mark" aria-hidden="true"><img src={`${assetBase}/be-the-fly-icon-v2.png`} alt="" /></span>
              <span>BE THE FLY</span>
            </span>
          </header>
          <div className="arena-wrap">
            <FlyHologram
              motionRef={flyRef}
              action={action}
              escapeState={flySceneState}
            />
            <div className="hud-frame" aria-hidden="true">
              <i className="hud-frame-current" />
              <span className="hud-frame-corner tl" /><span className="hud-frame-corner tr" />
              <span className="hud-frame-corner bl" /><span className="hud-frame-corner br" />
            </div>
            <aside
              className={`mobile-neuron-hud${mobileHudExpanded ? " expanded" : ""}${isFlightCockpit ? " cockpit" : ""}`}
              style={{ "--layer-accent": activeNeuronLayer.accent, "--drive-level": effectiveDriveLevel } as CSSProperties}
              aria-label={`Neural interface showing ${activeNeuronLayer.label.toLowerCase()}`}
            >
              <button
                className="mobile-neuron-toggle"
                type="button"
                aria-expanded={mobileHudExpanded}
                onClick={() => setMobileHudExpanded((value) => !value)}
              >
                <span className="hud-corner top-left" aria-hidden="true" />
                <span className="hud-corner bottom-right" aria-hidden="true" />
                <span className="mobile-neuron-kicker"><i /> NEURAL INTERFACE</span>
                <span className="mobile-neuron-preview" aria-hidden="true">{mobileNeuronLayers}</span>
                <strong>{activeNeuronLayer.label}</strong>
                <span className="mobile-neuron-moment">
                  <b>{worldCopy.title}</b>
                  <i>{worldCopy.detail}</i>
                </span>
                {isFlightCockpit && (
                  <span className="mobile-flight-telemetry">
                    <b>EPG HEADING</b>
                    <b>{headingCardinal} {String(compassDegrees).padStart(3, "0")}°</b>
                  </span>
                )}
                <small>{mobileHudExpanded ? "3 LOOPS · TAP TO CLOSE" : "TAP TO FOCUS"}<em>{String(steps).padStart(3, "0")} STEPS</em></small>
              </button>
              {mobileHudExpanded && (
                <div className="mobile-neuron-details">
                  {activeNeuronLayer.populationLabel && <strong>{activeNeuronLayer.populationLabel}</strong>}
                  <div className="mobile-neuron-color-key" aria-label="Neuron color key">
                    <b>COLOR KEY</b>
                    {neuronColorKey.map((item) => (
                      <span key={`mobile-${circuitMode}-${item.label}`}>
                        <i style={{ "--key-color": item.color } as CSSProperties} aria-hidden="true" />
                        {item.label}
                      </span>
                    ))}
                    {!isFlightCockpit && (
                      <span>
                        <i style={{ "--key-color": CONTEXT_COLOR_KEY.color } as CSSProperties} aria-hidden="true" />
                        {CONTEXT_COLOR_KEY.label}
                      </span>
                    )}
                  </div>
                  <p>{activeCircuit.summary}</p>
                  {activeCircuit.note && <small>{activeCircuit.note}</small>}
                  <a href={activeCircuit.viewerUrl} target="_blank" rel="noreferrer">EXPLORE THE CIRCUIT</a>
                </div>
              )}
            </aside>
              <img
                className={`snack-fruit visible${worldState === "eating" ? " found" : ""}`}
                style={FOOD_SCREEN}
                src={`${assetBase}/droso-peach.webp`}
                alt="Glowing slice of peach"
                draggable={false}
                fetchPriority="high"
                data-world-state={worldState}
              />
            {(worldState === "scent" || worldState === "takeoff" || worldState === "heading" || worldState === "landing" || worldState === "groom-head" || worldState === "relaunch") && (
              <div
                className={`landing-flower ${worldState}`}
                style={flowerScreen}
              >
                <img className="safe-flower-art" src={`${assetBase}/safe-flower.webp`} alt="Glowing pink flower, the safe landing target" />
                <strong>{targetCopy.title}</strong>
              </div>
            )}
            {isGrooming && (
              <div className={`groom-sparkles ${worldState}`} style={flowerScreen} aria-hidden="true">
                <i /><i /><i />
              </div>
            )}
            {(worldState === "threat" || worldState === "freeze" || worldState === "run" || worldState === "caught" || worldState === "dodge" || worldState === "takeoff") && (
              <img
                className={`spider-threat ${worldState}${worldState === "dodge" || worldState === "takeoff" ? " retreating" : ""}`}
                src={`${assetBase}/mint-spider.webp`}
                alt=""
                aria-hidden="true"
              />
            )}
            {(worldState === "eating" || worldState === "dodge" || worldState === "takeoff" || worldState === "landing" || worldState === "groom-head" || worldState === "relaunch") && (
              <div className={`world-event ${worldState}`} role="status" aria-live="polite">
                <strong>{worldCopy.title}</strong><span>{worldCopy.detail}</span>
              </div>
            )}
            {worldState === "threat" && (
              <section className="threat-dialog choice" role="alertdialog" aria-modal="true" aria-labelledby="threat-dialog-title">
                <span className="threat-dialog-kicker"><i /> PREDATOR PROTOCOL</span>
                <img className="threat-dialog-spider" src={`${assetBase}/mint-spider.webp`} alt="" aria-hidden="true" />
                <h2 id="threat-dialog-title">Threat detected!</h2>
                <p>A spider is closing in. Choose your survival strategy.</p>
                <div className="threat-choices">
                  <button type="button" onClick={() => handleThreatChoice("freeze")}><strong>Freeze</strong><small>Don’t move for 3 seconds</small></button>
                  <button type="button" onClick={() => handleThreatChoice("run")}><strong>Run</strong><small>Risk a ground escape</small></button>
                  <button type="button" onClick={() => handleThreatChoice("fly")}><strong>Fly</strong><small>Take to the air</small></button>
                </div>
              </section>
            )}
            {worldState === "freeze" && (
              <section className="threat-dialog countdown" role="status" aria-live="assertive">
                <span className="threat-dialog-kicker"><i /> FREEZE RESPONSE</span>
                <div className="freeze-countdown" aria-label={`${freezeCountdown} seconds remaining`}><strong>{freezeCountdown}</strong></div>
                <h2>Hold perfectly still…</h2>
                <p>The spider is watching for movement.</p>
              </section>
            )}
            {worldState === "run" && (
              <section className="threat-dialog outcome danger" role="status" aria-live="assertive">
                <span className="threat-dialog-kicker"><i /> ESCAPE ATTEMPT</span>
                <h2>Run!</h2>
                <p>But the spider is faster…</p>
              </section>
            )}
            {worldState === "caught" && (
              <section className="threat-dialog outcome game-over" role="alertdialog" aria-modal="true" aria-labelledby="game-over-title">
                <span className="threat-dialog-kicker"><i /> LIFE CYCLE ENDED</span>
                <h2 id="game-over-title">Nature is rough.</h2>
                <p>You didn’t survive this round.</p>
                <button type="button" onClick={resetExperience}>Try again</button>
              </section>
            )}
            {worldState === "scent" && (
              <section className="threat-dialog outcome scent" role="status" aria-live="assertive">
                <span className="threat-dialog-kicker"><i /> OLFACTORY SIGNAL</span>
                <h2>Tasty scent detected!</h2>
                <p>It’s drifting from the top of a flower. Preparing for takeoff…</p>
              </section>
            )}
          </div>
        </div>

        <div className="circuit-panel">
          <header className="panel-heading dark-heading">
            <div><span>02</span><p>NEURAL INTERFACE</p></div>
            <button className="viewer-button" type="button" onClick={() => setViewerOpen(true)}>
              EXPLORE IN 3D ↗
            </button>
          </header>
          <div className="circuit-canvas-wrap">
            <div className="hud-head">
              {(worldState === "seeking" || worldState === "heading"
                || worldState === "relaunch" || worldState === "scent") && (
                <div className="hud-objective">
                  <span>{missionCopy.kicker}</span>
                  <strong>{missionCopy.title}</strong>
                  <em>{missionCopy.detail}</em>
                </div>
              )}
              <div className="hud-neurons">
                <span className="hud-kicker"><i aria-hidden="true" />NEURONS INVOLVED</span>
                <strong>{activeNeuronLayer.label}</strong>
                <b className="hud-types">{activeCircuit.types}</b>
                <p>{activeCircuit.summary}</p>
                {activeCircuit.note && <small>{activeCircuit.note}</small>}
                {isFlightCockpit && (
                  <div className="hud-telemetry">
                    <div className="hud-row">
                      <span>FLY HEADING</span>
                      <b>{headingCardinal} · {String(compassDegrees).padStart(3, "0")}°</b>
                      <em>EPG {String(epgHeadingIndex).padStart(2, "0")}</em>
                    </div>
                    {worldState === "heading" && (
                      <div className={`hud-row ${velocityDirection}`}>
                        <span>SIM VELOCITY</span>
                        <b>{velocityDisplay} <u className="hud-u">mm/s</u></b>
                        <em>{velocityDirection === "idle" ? "HOVER" : velocityDirection.toUpperCase()}</em>
                      </div>
                    )}
                  </div>
                )}
                <div className="hud-stats">
                  {(() => {
                    const st = (layerStats.layers as Record<string, {
                      cells: number; synapses: number | null; dataset: string;
                    }>)[circuitMode];
                    if (!st) return null;
                    return (
                      <>
                        <span className="hud-stat"><b>{st.cells}</b> cells</span>
                        {st.synapses !== null && (
                          <span className="hud-stat"><b>{st.synapses.toLocaleString()}</b> synapses</span>
                        )}
                        <span className={`hud-pip${st.dataset.startsWith("BANC") ? "" : " alt"}`}>
                          <i aria-hidden="true" />{st.dataset}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div
              className={`neuron-render-stage${isFlightCockpit ? " heading" : ""}`}
              role="img"
              aria-label={isFlightCockpit ? `Front-view EPG cockpit at ${compassDegrees} compass degrees and ${velocityDisplay} millimeters per second with ${activeNeuronLayer.label.toLowerCase()} selected` : isDodgePulse ? `Animated bilateral DNp03 flight-saccade pulse over gray BANC context neurons` : `BANC ${activeNeuronLayer.label.toLowerCase()} neurons highlighted over gray context neurons`}
              style={{
                "--layer-accent": activeNeuronLayer.accent,
                "--heading-angle": `${headingDegrees + 90}deg`,
                "--drive-level": effectiveDriveLevel,
              } as CSSProperties}
            >
              {isFlightCockpit ? (
                <div className={`epg-cockpit turn-${action}`} aria-hidden="true">
                  <img className="epg-cockpit-base" src={EPG_BASE_ASSET} alt="" />
                  <img key={epgHeadingAsset} className="epg-cockpit-active" src={epgHeadingAsset} alt="" />
                  <div className="epg-cockpit-reticle"><span /></div>
                  <div className="epg-cockpit-turn"><span>← A</span><b>EPG COMPASS</b><span>D →</span></div>
                </div>
              ) : (
                <>
                  <img className="neuron-context-layer" src={BANC_CONTEXT_ASSET} alt="" aria-hidden="true" />
                  {isDodgePulse ? (
                    <>
                      <img className="neuron-action-layer dodge-frame" src={DODGE_LEFT_ASSETS[dodgeFrame]} alt="" aria-hidden="true" />
                      <img className="neuron-action-layer dodge-frame" src={DODGE_RIGHT_ASSETS[dodgeFrame]} alt="" aria-hidden="true" />
                    </>
                  ) : isGroomPulse ? (
                    <img className="neuron-action-layer groom-frame" src={groomFrameAsset} alt="" aria-hidden="true" />
                  ) : activeNeuronLayer.src && (
                    <img
                      key={activeNeuronLayer.src}
                      className="neuron-action-layer"
                      src={activeNeuronLayer.src}
                      alt=""
                      aria-hidden="true"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  )}
                  {isWalkSpeedPulse && (
                    <img className="neuron-action-layer walk-speed-frame" src={WALK_SPEED_ASSETS[walkSpeedFrame]} alt="" aria-hidden="true" />
                  )}
                </>
              )}
              <div className="neuron-render-glow" aria-hidden="true" />
              <div className="neuron-color-key" aria-label="Neuron color key">
                <b>COLOR KEY</b>
                {neuronColorKey.map((item) => (
                  <span key={`${circuitMode}-${item.label}`}>
                    <i style={{ "--key-color": item.color } as CSSProperties} aria-hidden="true" />
                    <em>{item.label}</em>
                    <small>{item.detail}</small>
                  </span>
                ))}
                {!isFlightCockpit && (
                  <span>
                    <i style={{ "--key-color": CONTEXT_COLOR_KEY.color } as CSSProperties} aria-hidden="true" />
                    <em>{CONTEXT_COLOR_KEY.label}</em>
                    <small>{CONTEXT_COLOR_KEY.detail}</small>
                  </span>
                )}
              </div>
            </div>
            {viewerOpen && (
              <div className="inline-neuroglancer expanded" role="dialog" aria-modal="true" aria-label="Interactive BANC walking and steering neurons">
                <div className="neuroglancer-expand-bar">
                  <div><span><i /> INTERACTIVE MORPHOLOGY</span><strong>WALKING + STEERING NEURONS</strong></div>
                  <div><a href={INTERACTIVE_NEURON_URL} target="_blank" rel="noreferrer">OPEN IN NEW TAB ↗</a><button type="button" onClick={() => setViewerOpen(false)} aria-label="Close expanded neuron viewer">CLOSE ×</button></div>
                </div>
                <iframe src={INTERACTIVE_NEURON_URL} title="Interactive 3D BANC walking and steering neuron view" allowFullScreen />
                <div className="neuroglancer-inline-footer"><span><i /> LIVE BANC MORPHOLOGY · DRAG TO ROTATE</span><span>LOADED ON REQUEST</span></div>
              </div>
            )}
            <div className="hud-status" aria-live="polite">
              {isFlightCockpit && (
                <div className="hud-row">
                  <span>EPG READOUT</span>
                  <b>{headingCardinal} · {String(compassDegrees).padStart(3, "0")}°</b>
                  <em>HEADING CELL {String(epgHeadingIndex).padStart(2, "0")}</em>
                </div>
              )}
              <a className="hud-link" href={activeCircuit.viewerUrl} target="_blank" rel="noreferrer">EXPLORE THE CIRCUIT ↗</a>
            </div>
          </div>
        </div>

        <section
          className={`drive-console ${isFlightDriveMode ? "flight" : "walk"} ${velocityDirection}${boosting ? " maxed" : ""}${controlDisabled ? " locked" : ""}${controlsUsed ? " used" : " hint"}`}
          style={{ "--drive-level": effectiveDriveLevel, "--applied-drive": appliedDriveLevel } as CSSProperties}
          aria-label={`Unified ${isFlightDriveMode ? "flight thrust" : "walking pace"} controls`}
        >
          <div className="drive-console-summary" aria-live="polite">
            <span className="drive-mode"><i aria-hidden="true" />{isFlightDriveMode ? "FLIGHT MODE" : "WALK MODE"}</span>
            <div className="drive-command-readout">
              <span>{driveCommandLabel}</span>
              <strong>{drivePercent}%</strong>
              <small>{driveNeuronLabel}</small>
            </div>
            <span className="drive-causality" aria-hidden="true">→</span>
            <div className="drive-speed-readout">
              <span>{speedOutputLabel}</span>
              <strong>{velocityDisplay}<small>mm/s</small></strong>
              <em>{velocityDirection === "idle" ? (isFlightDriveMode ? "HOVER" : "STILL") : velocityDirection.toUpperCase()}</em>
            </div>
          </div>

          <div className="drive-console-controls">
            <div className="drive-level-control">
              <button type="button" onClick={() => setDriveCommand(driveLevel - DRIVE_LEVEL_STEP)} disabled={controlDisabled || driveLevel <= MIN_DRIVE_LEVEL} aria-label={`Decrease ${isFlightDriveMode ? "thrust" : "walking pace"}`}>−</button>
              <input
                type="range"
                min={MIN_DRIVE_LEVEL * 100}
                max="100"
                step="5"
                value={driveSettingPercent}
                onChange={(event) => setDriveCommand(Number(event.currentTarget.value) / 100)}
                disabled={controlDisabled}
                aria-label={isFlightDriveMode ? "Flight thrust setting" : "Walking pace setting"}
                aria-valuetext={`${driveSettingPercent} percent${boosting ? ", temporarily overridden to 100 percent" : ""}`}
              />
              <button type="button" onClick={() => setDriveCommand(driveLevel + DRIVE_LEVEL_STEP)} disabled={controlDisabled || driveLevel >= 1} aria-label={`Increase ${isFlightDriveMode ? "thrust" : "walking pace"}`}>+</button>
              <button className={`drive-max${boosting ? " active" : ""}`} type="button" onPointerDown={beginMaxDrive} onPointerUp={endMaxDrive} onPointerCancel={endMaxDrive} onLostPointerCapture={endMaxDrive} disabled={controlDisabled} aria-pressed={boosting} aria-label={`Hold for maximum ${isFlightDriveMode ? "flight thrust" : "walking pace"}`}>MAX<kbd>SHIFT</kbd></button>
            </div>

            <div className="direction-controls" aria-label="Fly direction controls">
              <button className={action === "left" ? "active" : ""} onPointerDown={(event) => beginPointerControl(event, "left")} onPointerUp={endPointerControl} onPointerCancel={cancelPointerControl} onLostPointerCapture={cancelPointerControl} onClick={(event) => handleControlClick(event, "left")} disabled={controlDisabled} aria-label="Steer left">←<kbd>A</kbd></button>
              <button className={action === "forward" ? "active" : ""} onPointerDown={(event) => beginPointerControl(event, "forward")} onPointerUp={endPointerControl} onPointerCancel={cancelPointerControl} onLostPointerCapture={cancelPointerControl} onClick={(event) => handleControlClick(event, "forward")} disabled={controlDisabled} aria-label={isFlightDriveMode ? "Apply forward thrust" : "Walk forward"}>↑<kbd>W</kbd></button>
              <button className={action === "backward" ? "active" : ""} onPointerDown={(event) => beginPointerControl(event, "backward")} onPointerUp={endPointerControl} onPointerCancel={cancelPointerControl} onLostPointerCapture={cancelPointerControl} onClick={(event) => handleControlClick(event, "backward")} disabled={controlDisabled} aria-label={isFlightDriveMode ? "Apply reduced reverse thrust" : "Walk backward with Moonwalker Descending Neurons"}>↓<kbd>S</kbd></button>
              <button className={action === "right" ? "active" : ""} onPointerDown={(event) => beginPointerControl(event, "right")} onPointerUp={endPointerControl} onPointerCancel={cancelPointerControl} onLostPointerCapture={cancelPointerControl} onClick={(event) => handleControlClick(event, "right")} disabled={controlDisabled} aria-label="Steer right">→<kbd>D</kbd></button>
            </div>
          </div>
        </section>
      </section>

      <section className="legend-band">
        <p>COLOR KEY</p>
        <div>{LEGEND.map(([label, color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div>
        <p className="evidence-note"><strong>CONNECTOME-SUPPORTED</strong> Structure suggests pathways; it does not record neural activity.</p>
      </section>

      <section className="how-section" id="how">
        <div>
          <p className="eyebrow"><span /> WHY BANC?</p>
          <h2>A whole nervous system, in one map.</h2>
        </div>
        <div className="how-copy">
          <p>The BANC (Brain and Nerve Cord) is the first fly connectome that includes the whole central nervous system, mapped down to the synapse. Because the brain and the nerve cord were reconstructed together, a single pathway can be followed from the brain all the way to the motor neurons that move a leg or a wing.</p>
          <div className="how-links">
            <a href="https://www.nature.com/articles/s41586-026-10735-w" target="_blank" rel="noreferrer">Read the BANC paper <span>↗</span></a>
            <a href="https://codex.flywire.ai/?dataset=banc" target="_blank" rel="noreferrer">Explore BANC in Codex <span>↗</span></a>
          </div>
        </div>
        <div className="coming-soon">
          <span>NOW PLAYABLE</span>
          <strong>TAKE FLIGHT</strong>
          <p>Find the snack, escape the spider, and steer to the flower.</p>
          <button type="button" onClick={() => document.querySelector(".lab-shell")?.scrollIntoView({ behavior: "smooth" })}>ENTER FLIGHT COURSE ↑</button>
        </div>
      </section>

      <footer>
        <span>BANC EXPLORER · PUBLIC PROTOTYPE</span>
        <span className="footer-links">
          <span>Built to explore, not to overclaim.</span>
          <a href={`${assetBase}/credits`}>Citations & Credits</a>
        </span>
      </footer>

    </main>
  );
}
