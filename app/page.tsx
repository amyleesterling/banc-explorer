"use client";

import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlyHologram } from "./FlyHologram";
import flightDng02 from "./data/flight-dng02.json";
import layerStats from "./data/layer-stats.json";
import {
  CIRCUITS, STATIC_NEURON_LAYERS, LAYER_SEQUENCES, LAYER_SEQUENCE_ASSETS, LAYER_SEQUENCE_FRAMES,
  LAYER_SEQUENCE_LOOP, LAYER_SEQUENCE_FPS, FLIGHT_POWER_DIR, FLIGHT_POWER_ASSETS,
  STEERING_CODEX_URL, MDN_CODEX_URL, EPG_CODEX_URL, DNG02_CODEX_URL, DNP03_CODEX_URL,
  LANDING_CODEX_URL, DNG12_CODEX_URL,
  WALKING_SCENE_URL, FEEDING_SCENE_URL, WALKING_FIGURE_URL,
} from "./data/game-model";
import type { CircuitMode } from "./data/game-model";
import flightDnp03 from "./data/flight-dnp03.json";
import walkingSteeringNeuroglancer from "./data/walking-steering-neuroglancer.json";

type Action = "rest" | "forward" | "backward" | "left" | "right";
type WorldState = "seeking" | "eating" | "threat" | "freeze" | "run" | "caught" | "scent" | "dodge" | "takeoff" | "heading" | "landing" | "groom-head" | "relaunch";
type ThreatChoice = "freeze" | "run" | "fly";

const PLAYER_CONTROL_STATES = new Set<WorldState>(["seeking", "eating", "heading", "groom-head"]);
// The states that put a dialog over the arena and take the controls away.
const MODAL_WORLD_STATES = new Set<WorldState>(["threat", "freeze", "caught"]);
const isPlayerControllableState = (state: WorldState) => PLAYER_CONTROL_STATES.has(state);

const INTERACTIVE_NEURON_URL = `https://spelunker.cave-explorer.org/#!${encodeURIComponent(JSON.stringify(walkingSteeringNeuroglancer))}`;
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
const DODGE_STAGE_MS = 1000;
// One escape saccade, not a spin. The dodge used to apply a constant 2.2 rad/s
// for the whole 3.2 s stage, which is 403 degrees: the fly corkscrewed through
// the air. A saccade is a fast turn of bounded amplitude that then stops.
const DODGE_SACCADE_RADIANS = 1.75;   // 100 degrees
const TAKEOFF_STAGE_MS = 700;
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
// Every rendered signal sequence, keyed by circuit mode. The mapping is the one
// the render side already uses (APP_LAYERS in banc_layer_stats.py), so a layer
// cannot be named one thing in the renders and another in the app. dodge and

// The arena spider walks rather than sliding along as a still image. 24 frames
// at 24fps is a one second gait cycle, and the last frame is not a copy of the
// first, so all 24 play.
const SPIDER_FRAME_COUNT = 24;
const SPIDER_FPS = 24;
const SPIDER_WALK_ASSETS = Array.from(
  { length: SPIDER_FRAME_COUNT },
  (_, index) => `${assetBase}/spider-walk/frame-${String(index).padStart(2, "0")}.webp`,
);

const GROOM_FRAME_COUNT = 16;
const GROOM_NEURAL_SOURCE_FPS = 24;
// Replay the explanatory render at one tenth of its encoded rate so the
// brain-to-T1 progression is visible, then repeat it while grooming continues.
// 16 frames at the old 2.4 fps ran 6.7 s per loop, which is slower than a
// viewer will wait: the signal crept and read as a still image. 12 fps puts one
// loop at 1.33 s, matching the dodge and walk-speed loops, so three loops land
// in about four seconds and the propagation is actually visible as motion.
const GROOM_NEURAL_PLAYBACK_FPS = GROOM_NEURAL_SOURCE_FPS / 2;
const GROOM_SIGNAL_DELAY_MS = 520;
// One complete 10x-slowed articulated grooming cycle, including ease in/out.
const HEAD_GROOM_DURATION_MS = 6000;
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

const LEGEND: [string, string][] = [
  ["Sensory", "#68d6c4"],
  ["Ascending", "#8ac7ff"],
  ["Descending", "#ffc857"],
  ["VNC + motor", "#ff7f6e"],
  ["Central brain", "#bd9bd1"],
];
const CLASS_COLOR = Object.fromEntries(LEGEND) as Record<string, string>;

// The class of a cell type read off its own name, which is the only claim the
// naming convention actually supports: DN descending, AN ascending, MN motor,
// EPG the central-complex compass population. Anything that does not match gets
// no pip rather than a guessed one.
function neuronClass(type: string): string | null {
  if (/^EPG/i.test(type)) return "Central brain";
  if (/^MN/.test(type)) return "VNC + motor";
  if (/^AN/.test(type)) return "Ascending";
  if (/^(DN|MDN)/.test(type)) return "Descending";
  return null;
}

// "DNg100 ×2 · AN09B029_b ×2" and "DNa02 left · DNa01 left" both split the same
// way: the first token is the type, the rest is its count or side.
function NeuronChips({ types }: { types: string }) {
  return (
    <div className="hud-chips">
      {types.split(" · ").map((entry) => {
        const [name, ...rest] = entry.trim().split(" ");
        const cls = neuronClass(name);
        return (
          <span key={entry} className={`hud-chip${cls ? "" : " unclassed"}`}
            style={cls ? { "--chip": CLASS_COLOR[cls] } as CSSProperties : undefined}
            title={cls ?? undefined}>
            {cls && <i aria-hidden="true" />}
            <b>{name}</b>
            {rest.length > 0 && <em>{rest.join(" ")}</em>}
          </span>
        );
      })}
    </div>
  );
}

// Two flight instruments drawn over the render stage. Both take the SAME value
// the numeric readout takes, so the needle and the number can never disagree:
// the compass reads compassDegrees, the dial reads flightVelocity, and the dial
// is scaled by MAX_SIM_VELOCITY_MM_S, which is the clamp the simulation
// already applies, so the needle cannot leave the arc.
function GaugeShell({ kind, label, sub, value, unit, children }: {
  kind: string; label: string; sub: string; value: string; unit?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`hud-gauge ${kind}`}>
      <span className="gauge-bracket tl" aria-hidden="true" />
      <span className="gauge-bracket br" aria-hidden="true" />
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {/* a broken ring rather than a bezel: four arcs with gaps on the
            diagonals, so the instrument reads as drawn light, not as a dial */}
        {[0, 90, 180, 270].map((start) => (
          <path key={start} className="gauge-ring" d={describeArc(50, 50, 42, start + 6, start + 84)} />
        ))}
        {children}
        <circle className="gauge-hub" cx="50" cy="50" r="1.4" />
      </svg>
      <b className="gauge-value">{value}{unit && <u className="hud-u">{unit}</u>}</b>
      <span className="gauge-label">{label}<em>{sub}</em></span>
    </div>
  );
}

// A hairline from the centre out to a lit point on the ring. This is the whole
// needle: no blade, no hub, just the line and where it lands.
function GaugePointer({ angle, radius = 42 }: { angle: number; radius?: number }) {
  const rad = (angle - 90) * Math.PI / 180;
  const x = 50 + radius * Math.cos(rad);
  const y = 50 + radius * Math.sin(rad);
  return (
    <g className="gauge-pointer" style={{ "--gauge-angle": `${angle}deg` } as CSSProperties}>
      <line x1="50" y1="50" x2={x.toFixed(2)} y2={y.toFixed(2)} />
      <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r="2.6" />
    </g>
  );
}

function HeadingCompass({ degrees, cardinal, epgIndex }: {
  degrees: number; cardinal: string; epgIndex: number;
}) {
  return (
    <GaugeShell kind="compass" label="HEADING" sub={`EPG ${String(epgIndex).padStart(2, "0")}`}
      value={`${cardinal} ${String(degrees).padStart(3, "0")}°`}>
      {/* the offset from north, drawn */}
      <path className="gauge-arc live" d={describeArc(50, 50, 42, 0, degrees)} />
      {[0, 90, 180, 270].map((tick) => (
        <line key={tick} className={`gauge-tick${tick === 0 ? " major" : ""}`}
          x1="50" y1="30" x2="50" y2="35" transform={`rotate(${tick} 50 50)`} />
      ))}
      <text className="gauge-north" x="50" y="24" textAnchor="middle">N</text>
      <GaugePointer angle={degrees} />
    </GaugeShell>
  );
}

function VelocityDial({ velocity, direction, display }: {
  velocity: number; direction: string; display: string;
}) {
  // Zero at the top, reverse swinging left and forward swinging right across a
  // 240 degree arc. The scale is MAX_SIM_VELOCITY_MM_S, the clamp the simulation
  // already applies, so the pointer and the number are one quantity from one
  // source and the pointer cannot leave the dial.
  const fraction = Math.max(-1, Math.min(1, velocity / MAX_SIM_VELOCITY_MM_S));
  return (
    <GaugeShell kind={`dial ${direction}`} label="VELOCITY"
      sub={direction === "idle" ? "HOVER" : direction.toUpperCase()}
      value={display} unit="mm/s">
      <path className="gauge-track" d={describeArc(50, 50, 42, -120, 120)} />
      <path className="gauge-arc live"
        d={fraction >= 0 ? describeArc(50, 50, 42, 0, fraction * 120)
                         : describeArc(50, 50, 42, fraction * 120, 0)} />
      {[-120, 0, 120].map((tick) => (
        <line key={tick} className={`gauge-tick${tick === 0 ? " major" : ""}`}
          x1="50" y1="30" x2="50" y2="35" transform={`rotate(${tick} 50 50)`} />
      ))}
      <GaugePointer angle={fraction * 120} />
    </GaugeShell>
  );
}

// Arc between two angles measured clockwise from twelve o'clock, which is the
// same convention the pointer rotation uses.
function describeArc(cx: number, cy: number, r: number, from: number, to: number) {
  const point = (angle: number) => {
    const rad = (angle - 90) * Math.PI / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  if (Math.abs(to - from) < 0.01) return "";
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${point(from)} A${r} ${r} 0 ${large} ${to > from ? 1 : 0} ${point(to)}`;
}

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
  const dodgeTurnTargetRef = useRef<number | null>(null);
  // The spider is on a schedule rather than a one-off. Every visit to a target,
  // fruit or flower, counts as one interaction; the ambush fires on the first
  // (it is how the player learns the threat exists) and on every third after
  // that. A predator at every snack wears thin, and a predator only once means
  // the mechanic is seen and never again.
  const interactionsRef = useRef(0);
  const spiderIsDue = () => interactionsRef.current === 1 || interactionsRef.current % 3 === 0;
  // Feeding fires when the fly crosses INTO the fruit, not on every frame it
  // spends inside, so standing on the peach does not retrigger endlessly.
  const insideFoodRef = useRef(false);
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
  const [sequenceFrame, setSequenceFrame] = useState(0);
  const [spiderFrame, setSpiderFrame] = useState(0);
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
  const spiderOnScreen = worldState === "threat" || worldState === "freeze"
    || worldState === "run" || worldState === "caught"
    || worldState === "dodge" || worldState === "takeoff";
  const activeSequence = LAYER_SEQUENCE_ASSETS[circuitMode];
  const showFlightPower = isFlightCockpit && appliedDriveLevel > 0.01;
  const worldCopy = worldState === "eating"
    ? { title: "Snack found!", detail: "Feeding neurons are glowing." }
    : worldState === "threat"
      ? { title: "OMG a spider!", detail: "Choose a survival strategy." }
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
    interactionsRef.current = 0;
    insideFoodRef.current = false;
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
    // Any grounded state the player controls can walk into the fruit: seeking,
    // or perched and grooming after a landing.
    const state = worldStateRef.current;
    if (state !== "seeking" && state !== "groom-head") return;
    interactionsRef.current += 1;
    worldStateRef.current = "eating";
    setWorldState("eating");
    setCircuitMode("eat");
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (threatTimerRef.current) window.clearTimeout(threatTimerRef.current);
    warningTimerRef.current = window.setTimeout(() => {
      if (worldStateRef.current !== "eating") return;
      if (!spiderIsDue()) {
        worldStateRef.current = "seeking";
        setWorldState("seeking");
        setCircuitMode("walk");
        return;
      }
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
    interactionsRef.current += 1;
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
        if (spiderIsDue()) {
          keysRef.current.clear();
          actionRef.current = "rest";
          setAction("rest");
          worldStateRef.current = "threat";
          setWorldState("threat");
          setCircuitMode("threat");
          return;
        }
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

  // One clock for every per-layer sequence and for the DNg02 flight overlay, so
  // the layers that play together stay in step instead of drifting apart.
  useEffect(() => {
    if (!activeSequence && !showFlightPower) return;
    const started = performance.now();
    const frameDuration = 1000 / LAYER_SEQUENCE_FPS;
    let animationFrame = 0;
    const advance = (time: number) => {
      setSequenceFrame(Math.floor((time - started) / frameDuration) % LAYER_SEQUENCE_LOOP);
      animationFrame = requestAnimationFrame(advance);
    };
    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeSequence, showFlightPower]);

  useEffect(() => {
    const wanted = [...(activeSequence ?? []), ...(showFlightPower ? FLIGHT_POWER_ASSETS : [])];
    void Promise.all(wanted.map((src) => fetch(src, { cache: "force-cache" }))).catch(() => {});
  }, [activeSequence, showFlightPower]);

  useEffect(() => {
    if (!spiderOnScreen) return;
    const started = performance.now();
    const frameDuration = 1000 / SPIDER_FPS;
    let animationFrame = 0;
    const advance = (time: number) => {
      setSpiderFrame(Math.floor((time - started) / frameDuration) % SPIDER_FRAME_COUNT);
      animationFrame = requestAnimationFrame(advance);
    };
    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [spiderOnScreen]);

  useEffect(() => {
    void Promise.all(SPIDER_WALK_ASSETS.map((src) => fetch(src, { cache: "force-cache" }))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isWalkSpeedPulse) return;
    const startedAt = performance.now();
    const frameDuration = 1000 / walkDrivePlaybackFps;
    let animationFrame = 0;
    const advance = () => {
      const elapsed = performance.now() - startedAt;
      setWalkSpeedFrame(Math.floor(elapsed / frameDuration) % (WALK_SPEED_FRAME_COUNT - 1));
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
      setDodgeFrame(Math.min(DODGE_FRAME_COUNT - 2, Math.floor(elapsed / (1000 / DODGE_PLAYBACK_FPS))));
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
        : Math.floor((elapsed % cycleDuration) / frameDuration) % (GROOM_FRAME_COUNT - 1);
      setGroomFrame(nextFrame);
      animationFrame = requestAnimationFrame(advance);
    };
    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [groomAssetsReady, isGrooming, worldState]);

  // A modal state has to happen where the player is looking. The threat dialog
  // is drawn inside the arena, so if the page is scrolled away from the arena
  // the spider appears offscreen and the page seems to have jumped. Bring the
  // arena back, and drop focus from whatever button is still holding it further
  // down the page, since a focused offscreen control is the usual way a browser
  // pulls the viewport somewhere the player did not ask for.
  useEffect(() => {
    if (!MODAL_WORLD_STATES.has(worldState)) return;
    const shell = document.querySelector(".lab-shell");
    if (!shell) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !shell.contains(active)) active.blur();
    const box = shell.getBoundingClientRect();
    const visible = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0);
    if (visible < box.height * 0.6) shell.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [worldState]);

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
        // Latch one target heading on the first dodge frame and ease into it,
        // so the total turn is exactly DODGE_SACCADE_RADIANS however long the
        // stage runs. The drift continues; only the rotation is bounded.
        if (dodgeTurnTargetRef.current === null) {
          dodgeTurnTargetRef.current = fly.angle + DODGE_SACCADE_RADIANS;
        }
        fly.angle += (dodgeTurnTargetRef.current - fly.angle) * Math.min(1, dt * 5.5);
        fly.x += dt * 0.30;
        fly.y -= dt * 0.12;
        nextAction = "right";
      } else if (dodgeTurnTargetRef.current !== null) {
        dodgeTurnTargetRef.current = null;
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
      const insideFood = isInsideEllipse(fly, FOOD_TARGET, FOOD_CONTACT_BOUNDARY);
      if (insideFood && !insideFoodRef.current) triggerEating();
      insideFoodRef.current = insideFood;
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

      <section className={`lab-shell${viewerOpen ? " viewer-open" : ""}`} aria-label="Interactive BANC fly cockpit">
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
                src={SPIDER_WALK_ASSETS[spiderFrame]}
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
                <div className="threat-dialog-spider-stage" aria-hidden="true">
                  <video className="threat-dialog-spider-clip" src={`${assetBase}/spider-approach.mp4`}
                    autoPlay loop muted playsInline
                    poster={`${assetBase}/mint-spider.webp`} />
                </div>
                <h2 id="threat-dialog-title">OMG a spider!</h2>
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
              <div className="hud-objective">
                <span>{missionCopy.kicker}</span>
                <strong>{missionCopy.title}</strong>
                <em>{missionCopy.detail}</em>
              </div>
              <div className="hud-neurons">
                <span className="hud-kicker"><i aria-hidden="true" />NEURONS INVOLVED</span>
                <strong>{activeNeuronLayer.label}</strong>
                <NeuronChips types={activeCircuit.types} />
                <p>{activeCircuit.summary}</p>
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
              ) : null}
              {isFlightCockpit && (
                <div className="hud-instruments">
                  <HeadingCompass degrees={compassDegrees} cardinal={headingCardinal} epgIndex={epgHeadingIndex} />
                  <div className="hud-instrument-group">
                    {showFlightPower && (
                      <div className="hud-drive-inset"
                        style={{ "--drive-level": appliedDriveLevel } as CSSProperties}>
                        <span className="gauge-bracket tl" aria-hidden="true" />
                        <span className="gauge-bracket br" aria-hidden="true" />
                        <img src={FLIGHT_POWER_ASSETS[sequenceFrame]} alt="" aria-hidden="true" />
                        <span className="hud-drive-inset-label">
                          {CIRCUITS["flight-forward"].types}<em>THRUST</em>
                        </span>
                      </div>
                    )}
                    <VelocityDial velocity={simVelocity} direction={velocityDirection} display={velocityDisplay} />
                  </div>
                </div>
              )}
              {!isFlightCockpit && (
                <>
                  <img className="neuron-context-layer" src={BANC_CONTEXT_ASSET} alt="" aria-hidden="true" />
                  {isDodgePulse ? (
                    <>
                      <img className="neuron-action-layer dodge-frame" src={DODGE_LEFT_ASSETS[dodgeFrame]} alt="" aria-hidden="true" />
                      <img className="neuron-action-layer dodge-frame" src={DODGE_RIGHT_ASSETS[dodgeFrame]} alt="" aria-hidden="true" />
                    </>
                  ) : isGroomPulse ? (
                    <img className="neuron-action-layer groom-frame" src={groomFrameAsset} alt="" aria-hidden="true" />
                  ) : activeSequence ? (
                    <img className="neuron-action-layer sequence-frame"
                      src={activeSequence[sequenceFrame]} alt="" aria-hidden="true" />
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
                    <img className="neuron-action-layer walk-speed-frame"
                      style={{ "--drive-level": appliedDriveLevel } as CSSProperties}
                      src={WALK_SPEED_ASSETS[walkSpeedFrame]} alt="" aria-hidden="true" />
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
          <span>GO DEEPER</span>
          <strong>What is a connectome?</strong>
          <p>A wiring diagram of a nervous system, mapped synapse by synapse.</p>
          <a className="coming-soon-link" href="https://connectome-atlas.amysterling.chatgpt.site/" target="_blank" rel="noreferrer">OPEN THE ATLAS ↗</a>
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
