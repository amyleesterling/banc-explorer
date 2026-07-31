"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlyHologram } from "./FlyHologram";
import walkingSteeringNeuroglancer from "./data/walking-steering-neuroglancer.json";

type Action = "rest" | "forward" | "backward" | "left" | "right";
type CircuitMode = "walk" | "backward" | "left" | "right" | "eat" | "threat" | "heading";
type WorldState = "seeking" | "eating" | "threat" | "takeoff" | "heading" | "landing";

type CircuitNode = {
  name: string;
  area: string;
  role: string;
  color: string;
  muted?: boolean;
};

const WALKING_FIGURE_URL = "https://ng.banc.community/2026a/figure-5c";
const WALKING_SCENE_URL = "https://ng.banc.community/2026a/walking";
const STEERING_SCENE_URL = "https://ng.banc.community/2026a/walking-steering";
const FEEDING_SCENE_URL = "https://ng.banc.community/2026a/feeding";
const INTERACTIVE_NEURON_URL = `https://spelunker.cave-explorer.org/#!${encodeURIComponent(JSON.stringify(walkingSteeringNeuroglancer))}`;
const FRONT_LEG_LOOP_URL = "https://spelunker.cave-explorer.org/#!middleauth+https://global.daf-apis.com/nglstate/api/v1/6393410721153024";
const STEERING_CODEX_URL = "https://codex.flywire.ai/app/connectivity?cell_names_or_ids=cell_type+%3D%3D+DNa01+%7C%7C+cell_type+%3D%3D+DNa02&dataset=banc";
const MDN_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+MDN&dataset=banc";
const EPG_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+EPG&dataset=banc";
const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const FOOD_TARGET = { x: 0.88, y: 0.18 };
const FOOD_CONTACT_RADIUS = 0.095;
const FLOWER_TARGET = { x: 0.2, y: 0.72 };
const FLOWER_CONTACT_RADIUS = 0.105;
const toScreenPosition = ({ x, y }: { x: number; y: number }) => ({
  left: `${50 + (x - 0.5) * 76}%`,
  top: `${50 + (y - 0.5) * 72}%`,
});
const FOOD_SCREEN = toScreenPosition(FOOD_TARGET);
const FLOWER_SCREEN = toScreenPosition(FLOWER_TARGET);

const STATIC_NEURON_LAYERS: Record<CircuitMode, { src?: string; label: string; detail: string; accent: string }> = {
  walk: { src: `${assetBase}/banc-forward.webp`, label: "FORWARD WALK", detail: "6 WALKING CELLS LIT", accent: "#ff1493" },
  backward: { src: `${assetBase}/banc-backward.webp`, label: "MOONWALK", detail: "4 MDNs LIT", accent: "#ff1493" },
  left: { src: `${assetBase}/banc-turn-left.webp`, label: "STEER LEFT", detail: "2 STEERING CELLS LIT", accent: "#ff1493" },
  right: { src: `${assetBase}/banc-turn-right.webp`, label: "STEER RIGHT", detail: "2 STEERING CELLS LIT", accent: "#ff1493" },
  eat: { src: `${assetBase}/banc-eat.webp`, label: "FEEDING", detail: "6 FEEDING CELLS LIT", accent: "#ffc857" },
  threat: { src: `${assetBase}/banc-threat-walk.webp`, label: "THREAT RESPONSE", detail: "5 RESPONSE CELLS LIT", accent: "#ff6b5f" },
  heading: { label: "EPG COCKPIT", detail: "ILLUSTRATIVE HEADING BUMP", accent: "#b98fca" },
};

const WALKING_NODES: CircuitNode[] = [
  { name: "DNg100", area: "BRAIN → VNC", role: "pro-walking descending type", color: "#ffc857" },
  { name: "AN09B029_b", area: "LEG → BRAIN", role: "proprioceptive context", color: "#8ac7ff" },
  { name: "AN02A002", area: "VNC → BRAIN", role: "inhibitory walking feedback", color: "#68d6c4" },
  { name: "T1 LOCAL LOOP", area: "FRONT LEG VNC", role: "sensory → intrinsic → motor", color: "#ff7f6e" },
];

function steeringNodes(side: "LEFT" | "RIGHT"): CircuitNode[] {
  const otherSide = side === "LEFT" ? "RIGHT" : "LEFT";
  return [
    { name: `DNa02 · ${side}`, area: "BRAIN → VNC", role: "high-gain ipsilateral steering", color: "#ffc857" },
    { name: `DNa01 · ${side}`, area: "BRAIN → VNC", role: "low-gain ipsilateral steering", color: "#d8ec71" },
    { name: `DNa02 · ${otherSide}`, area: "OTHER SIDE", role: "bilateral comparison", color: "#71827a", muted: true },
    { name: `DNa01 · ${otherSide}`, area: "OTHER SIDE", role: "bilateral comparison", color: "#5d6b64", muted: true },
  ];
}

const CIRCUITS: Record<CircuitMode, {
  eyebrow: string;
  title: string;
  summary: string;
  evidence: string;
  viewerUrl: string;
  viewerLabel: string;
  nodes: CircuitNode[];
}> = {
  walk: {
    eyebrow: "FORWARD WALK · SELECTED",
    title: "Walking drive meets local control",
    summary: "Walking drive is coordinated with body feedback and local leg circuits.",
    evidence: "BANC FIG. 5c · CONNECTOME-SUPPORTED",
    viewerUrl: WALKING_SCENE_URL,
    viewerLabel: "OPEN WALKING NEURONS",
    nodes: WALKING_NODES,
  },
  backward: {
    eyebrow: "MOONWALK · SELECTED",
    title: "Moonwalkers reverse the motor program",
    summary: "Four Moonwalker Descending Neurons are highlighted during backward walking.",
    evidence: "BANC v888 · LINEAGE-VERIFIED",
    viewerUrl: MDN_CODEX_URL,
    viewerLabel: "OPEN MDNs IN CODEX",
    nodes: [
      { name: "MDN × 4", area: "BRAIN → VNC", role: "command-like backward walking", color: "#ff1493" },
    ],
  },
  left: {
    eyebrow: "STEER LEFT · SELECTED",
    title: "A bilateral steering comparison",
    summary: "Left DNa01 and DNa02 are highlighted for steering.",
    evidence: "FUNCTIONALLY CHARACTERIZED · BANC-MATCHED",
    viewerUrl: STEERING_SCENE_URL,
    viewerLabel: "OPEN STEERING NEURONS",
    nodes: steeringNodes("LEFT"),
  },
  right: {
    eyebrow: "STEER RIGHT · SELECTED",
    title: "A bilateral steering comparison",
    summary: "Right DNa01 and DNa02 are highlighted for steering.",
    evidence: "FUNCTIONALLY CHARACTERIZED · BANC-MATCHED",
    viewerUrl: STEERING_SCENE_URL,
    viewerLabel: "OPEN STEERING NEURONS",
    nodes: steeringNodes("RIGHT"),
  },
  eat: {
    eyebrow: "FEEDING · SELECTED",
    title: "The snack recruits a feeding ensemble",
    summary: "Six cells from the official BANC feeding scene are highlighted.",
    evidence: "OFFICIAL BANC v888 FEEDING SCENE",
    viewerUrl: FEEDING_SCENE_URL,
    viewerLabel: "OPEN FEEDING SCENE",
    nodes: [
      { name: "FEEDING SET", area: "BRAIN + VNC", role: "six scene-defined feeding exemplars", color: "#ffc857" },
      { name: "VERSION NOTE", area: "FROZEN v888", role: "IDs follow the official scene snapshot", color: "#d8ec71" },
    ],
  },
  threat: {
    eyebrow: "THREAT RESPONSE · SELECTED",
    title: "Escape pathways join the walking context",
    summary: "Five response neurons are highlighted as the fly escapes.",
    evidence: "BANC EXEMPLARS · RESPONSE, NOT DETECTION",
    viewerUrl: WALKING_FIGURE_URL,
    viewerLabel: "OPEN BANC WALKING PATHWAY",
    nodes: [
      { name: "RESPONSE SET", area: "BRAIN → VNC", role: "five descending response exemplars", color: "#ff6b5f" },
      { name: "WALKING CONTEXT", area: "BRAIN + VNC", role: "gray cells provide anatomical context", color: "#71827a", muted: true },
    ],
  },
  heading: {
    eyebrow: "FLIGHT HEADING · SELECTED",
    title: "A compass in the fly brain",
    summary: "EPG neurons maintain the fly's heading as it turns.",
    evidence: "BANC v888 · 45 EPG CELLS",
    viewerUrl: EPG_CODEX_URL,
    viewerLabel: "OPEN EPG CELLS IN CODEX",
    nodes: [
      { name: "EPG × 45", area: "ELLIPSOID BODY", role: "heading-direction compass", color: "#b98fca" },
    ],
  },
};

const LEGEND = [
  ["Sensory", "#68d6c4"],
  ["Ascending", "#8ac7ff"],
  ["Descending", "#ffc857"],
  ["VNC + motor", "#ff7f6e"],
];

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export default function Home() {
  const arenaRef = useRef<HTMLCanvasElement>(null);
  const flyRef = useRef({ x: 0.34, y: 0.58, angle: -0.28 });
  const keysRef = useRef(new Set<string>());
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const lastHeadingUiRef = useRef(0);
  const actionRef = useRef<Action>("rest");
  const worldStateRef = useRef<WorldState>("seeking");
  const warningTimerRef = useRef<number | null>(null);
  const threatTimerRef = useRef<number | null>(null);
  const takeoffTimerRef = useRef<number | null>(null);
  const headingTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [action, setAction] = useState<Action>("rest");
  const [worldState, setWorldState] = useState<WorldState>("seeking");
  const [spiderWarning, setSpiderWarning] = useState(false);
  const [steps, setSteps] = useState(0);
  const [headingDegrees, setHeadingDegrees] = useState(344);
  const [circuitMode, setCircuitMode] = useState<CircuitMode>("walk");
  const [viewerOpen, setViewerOpen] = useState(false);
  const activeCircuit = CIRCUITS[circuitMode];
  const activeNeuronLayer = STATIC_NEURON_LAYERS[circuitMode];
  const worldCopy = worldState === "eating"
    ? spiderWarning
      ? { title: "Watch out for the spider!", detail: "Keep moving." }
      : { title: "Snack found!", detail: "Feeding neurons are glowing." }
    : worldState === "threat"
      ? { title: "Spider!", detail: "Get airborne." }
      : worldState === "takeoff"
        ? { title: "Takeoff!", detail: "Wings up." }
      : worldState === "heading"
        ? { title: "Fly to the flower", detail: "Steer with the arrow keys." }
      : worldState === "landing"
        ? { title: "Safe on the flower", detail: "The spider is gone." }
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
      ? { title: "SPIDER ALERT", detail: "MOVE AWAY FROM DANGER" }
    : worldState === "takeoff"
        ? { title: "AIRBORNE", detail: "LAUNCHING FROM DANGER" }
      : worldState === "heading"
        ? { title: "LAND HERE", detail: "STEER TO THE FLOWER" }
      : worldState === "landing"
        ? { title: "SAFE FLOWER", detail: "TOUCHING DOWN" }
        : { title: "RIPE FRUIT", detail: "FOLLOW THE YEASTY SCENT" };

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

  const triggerEating = useCallback(() => {
    if (worldStateRef.current !== "seeking") return;
    worldStateRef.current = "eating";
    setWorldState("eating");
    setCircuitMode("eat");
    setSpiderWarning(false);
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (threatTimerRef.current) window.clearTimeout(threatTimerRef.current);
    warningTimerRef.current = window.setTimeout(() => {
      if (worldStateRef.current !== "eating") return;
      setSpiderWarning(true);
      threatTimerRef.current = window.setTimeout(() => {
        if (worldStateRef.current !== "eating") return;
        worldStateRef.current = "threat";
        keysRef.current.clear();
        actionRef.current = "rest";
        setAction("rest");
        setSpiderWarning(false);
        setWorldState("threat");
        setCircuitMode("threat");
        takeoffTimerRef.current = window.setTimeout(() => {
          if (worldStateRef.current !== "threat") return;
          worldStateRef.current = "takeoff";
          setWorldState("takeoff");
          setCircuitMode("heading");
          headingTimerRef.current = window.setTimeout(() => {
            if (worldStateRef.current !== "takeoff") return;
            worldStateRef.current = "heading";
            setWorldState("heading");
          }, 850);
        }, 700);
      }, 1200);
    }, 2600);
  }, []);

  const triggerLanding = useCallback(() => {
    if (worldStateRef.current !== "heading") return;
    worldStateRef.current = "landing";
    keysRef.current.clear();
    actionRef.current = "rest";
    setAction("rest");
    setWorldState("landing");
    resetTimerRef.current = window.setTimeout(() => {
      worldStateRef.current = "seeking";
      setWorldState("seeking");
      setCircuitMode("walk");
    }, 1100);
  }, []);

  const updateAction = useCallback((next: Action) => {
    const currentState = worldStateRef.current;
    if (currentState !== "seeking" && currentState !== "eating" && currentState !== "heading") return;
    actionRef.current = next;
    setAction(next);
    if (next !== "rest" && currentState === "seeking") {
      setCircuitMode(next === "forward" ? "walk" : next);
    }
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "s", "a", "d"].includes(key)) {
        event.preventDefault();
        const currentState = worldStateRef.current;
        if (currentState !== "seeking" && currentState !== "eating" && currentState !== "heading") return;
        keysRef.current.add(key);
      }
    };
    const keyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = arenaRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = (time: number) => {
      if (time - lastRef.current < 30) {
        frameRef.current = requestAnimationFrame(render);
        return;
      }
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const dt = Math.min((time - lastRef.current) / 1000 || 0, 0.03);
      lastRef.current = time;

      const keys = keysRef.current;
      const fly = flyRef.current;
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
      const interactiveFlight = currentState === "heading";
      if (interactiveFlight && time - lastHeadingUiRef.current > 70) {
        const normalizedHeading = ((fly.angle * 180 / Math.PI) % 360 + 360) % 360;
        setHeadingDegrees(Math.round(normalizedHeading));
        lastHeadingUiRef.current = time;
      }
      const direction = Number(forward) - Number(backward);
      if (direction !== 0) {
        const flightBoost = interactiveFlight ? 1.45 : 1;
        fly.x += Math.cos(fly.angle) * dt * 0.12 * direction * flightBoost;
        fly.y += Math.sin(fly.angle) * dt * 0.16 * direction * flightBoost;
        nextAction = direction < 0 ? "backward" : left ? "left" : right ? "right" : "forward";
      }
      fly.x = Math.max(0.1, Math.min(0.9, fly.x));
      fly.y = Math.max(0.16, Math.min(0.86, fly.y));
      const foodDistance = Math.hypot(fly.x - FOOD_TARGET.x, fly.y - FOOD_TARGET.y);
      if (worldStateRef.current === "seeking" && foodDistance <= FOOD_CONTACT_RADIUS) {
        triggerEating();
      }
      const flowerDistance = Math.hypot(fly.x - FLOWER_TARGET.x, fly.y - FLOWER_TARGET.y);
      if (worldStateRef.current === "heading" && flowerDistance <= FLOWER_CONTACT_RADIUS) {
        triggerLanding();
      }
      if (worldStateRef.current !== "seeking" && worldStateRef.current !== "eating" && worldStateRef.current !== "heading") nextAction = "rest";
      if (nextAction !== actionRef.current) {
        actionRef.current = nextAction;
        setAction(nextAction);
        if (nextAction !== "rest" && worldStateRef.current === "seeking") {
          setCircuitMode(nextAction === "forward" ? "walk" : nextAction);
          setSteps((value) => value + 1);
        }
      }

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#ebe6cf");
      gradient.addColorStop(0.55, "#dfe5c8");
      gradient.addColorStop(1, "#cbd2ae");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = "#52674e";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 38) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 38) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const plumeX = width * 0.81;
      const plumeY = height * 0.31;
      const plume = ctx.createRadialGradient(plumeX, plumeY, 2, plumeX, plumeY, width * 0.27);
      plume.addColorStop(0, "rgba(255, 200, 87, .52)");
      plume.addColorStop(0.35, "rgba(255, 200, 87, .16)");
      plume.addColorStop(1, "rgba(255, 200, 87, 0)");
      ctx.fillStyle = plume;
      ctx.fillRect(plumeX - width * 0.32, plumeY - width * 0.32, width * 0.64, width * 0.64);
      ctx.fillStyle = "#263d32";
      ctx.beginPath();
      ctx.arc(plumeX, plumeY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffc857";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(plumeX, plumeY, 16 + Math.sin(time / 500) * 3, 0, Math.PI * 2);
      ctx.stroke();

      const fx = fly.x * width;
      const fy = fly.y * height;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(fly.angle + Math.PI / 2);
      const gait = actionRef.current === "rest" ? 0 : Math.sin(time / 55) * 5;
      const bodyGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
      bodyGlow.addColorStop(0, "rgba(104,214,196,.25)");
      bodyGlow.addColorStop(.45, "rgba(104,214,196,.08)");
      bodyGlow.addColorStop(1, "rgba(104,214,196,0)");
      ctx.fillStyle = bodyGlow;
      ctx.fillRect(-58, -58, 116, 116);

      ctx.strokeStyle = "rgba(104,214,196,.34)";
      ctx.lineWidth = 6;
      ctx.shadowColor = "#68d6c4";
      ctx.shadowBlur = 13;
      for (const side of [-1, 1]) {
        for (let leg = -1; leg <= 1; leg++) {
          ctx.beginPath();
          ctx.moveTo(side * 6, leg * 8);
          ctx.lineTo(side * (19 + gait * (leg || 1)), leg * 13 - gait * side);
          ctx.lineTo(side * 27, leg * 20);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = "rgba(225,255,246,.9)";
      ctx.lineWidth = 1.15;
      ctx.shadowBlur = 5;
      for (const side of [-1, 1]) {
        for (let leg = -1; leg <= 1; leg++) {
          ctx.beginPath();
          ctx.moveTo(side * 6, leg * 8);
          ctx.lineTo(side * (19 + gait * (leg || 1)), leg * 13 - gait * side);
          ctx.lineTo(side * 27, leg * 20);
          ctx.stroke();
          ctx.fillStyle = leg === 0 ? "#ffc857" : "#68d6c4";
          ctx.beginPath();
          ctx.arc(side * (19 + gait * (leg || 1)), leg * 13 - gait * side, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(200,255,239,.12)";
      ctx.beginPath();
      ctx.ellipse(-9, -2, 9, 19, -0.4, 0, Math.PI * 2);
      ctx.ellipse(9, -2, 9, 19, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(104,214,196,.76)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(16,42,35,.72)";
      ctx.shadowColor = "#68d6c4";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, 4, 7, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#baf5e7";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,127,110,.9)";
      ctx.beginPath();
      ctx.arc(0, -12, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d8ec71";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#d8ec71";
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.bezierCurveTo(-2, -4, 2, 3, 0, 19);
      ctx.stroke();
      for (let node = -8; node <= 14; node += 7) {
        ctx.beginPath();
        ctx.arc(Math.sin(node) * 1.4, node, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = node < 0 ? "#ffc857" : "#d8ec71";
        ctx.fill();
      }
      const scanY = ((time / 18) % 70) - 35;
      ctx.shadowColor = "#d8ec71";
      ctx.shadowBlur = 12;
      ctx.strokeStyle = "rgba(216,236,113,.72)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-30, scanY);
      ctx.lineTo(30, scanY);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      roundedRect(ctx, 16, 16, 138, 34, 17);
      ctx.fillStyle = "rgba(247,244,228,.86)";
      ctx.fill();
      ctx.fillStyle = "#24342c";
      ctx.font = "600 11px Arial";
      ctx.fillText(actionRef.current === "rest" ? "READY TO WALK" : actionRef.current.toUpperCase(), 34, 38);

      frameRef.current = requestAnimationFrame(render);
    };
    frameRef.current = requestAnimationFrame(render);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
      if (threatTimerRef.current) window.clearTimeout(threatTimerRef.current);
      if (takeoffTimerRef.current) window.clearTimeout(takeoffTimerRef.current);
      if (headingTimerRef.current) window.clearTimeout(headingTimerRef.current);
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, [triggerEating, triggerLanding]);

  const nudge = (next: Action) => {
    updateAction(next);
    const fly = flyRef.current;
    if (next === "left") fly.angle -= 0.24;
    if (next === "right") fly.angle += 0.24;
    if (next === "forward") {
      fly.x += Math.cos(fly.angle) * 0.035;
      fly.y += Math.sin(fly.angle) * 0.045;
      setSteps((value) => value + 1);
    }
    if (next === "backward") {
      fly.x -= Math.cos(fly.angle) * 0.035;
      fly.y -= Math.sin(fly.angle) * 0.045;
      setSteps((value) => value + 1);
    }
    window.setTimeout(() => updateAction("rest"), 380);
  };

  return (
    <main>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="BANC Explorer home">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>BANC <i>/</i> BE THE FLY</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="https://codex.flywire.ai/?dataset=banc" target="_blank" rel="noreferrer">Explore data ↗</a>
          <a className="about-button" href="#how">About BANC</a>
        </div>
      </nav>

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

      <section className="lab-shell" aria-label="Interactive walking lab">
        <div className="arena-panel">
          <header className="panel-heading light-heading">
            <div><span>01</span><p>FLY WORLD</p></div>
            <div className="metric"><small>STEPS</small><strong>{String(steps).padStart(3, "0")}</strong></div>
          </header>
          <div className="arena-wrap" style={{ backgroundImage: `url("${assetBase}/moss-garden.webp")` }}>
            <canvas ref={arenaRef} className="arena-motion-canvas" aria-hidden="true" />
            <FlyHologram
              motionRef={flyRef}
              action={action}
              escapeState={worldState === "eating" ? "eating" : worldState === "takeoff" ? "takeoff" : worldState === "heading" ? "flight" : worldState === "landing" ? "landing" : "ground"}
            />
            <img
              className={`snack-fruit${worldState === "eating" ? " found" : ""}`}
              style={FOOD_SCREEN}
              src={`${assetBase}/droso-peach.webp`}
              alt="Glowing slice of peach"
            />
            {worldState !== "takeoff" && worldState !== "heading" && worldState !== "landing" && (
              <div className={`odor-label ${worldState}`}><span /><div><strong>{targetCopy.title}</strong><small>{targetCopy.detail}</small></div></div>
            )}
            {(worldState === "takeoff" || worldState === "heading" || worldState === "landing") && (
              <div
                className={`landing-flower ${worldState}`}
                style={FLOWER_SCREEN}
              >
                <img className="safe-flower-art" src={`${assetBase}/safe-flower.webp`} alt="Glowing pink flower, the safe landing target" />
                <strong>{targetCopy.title}</strong>
              </div>
            )}
            {(worldState === "threat" || worldState === "takeoff" || worldState === "heading") && (
              <img
                className={`spider-threat${worldState === "heading" ? " retreating" : ""}`}
                src={`${assetBase}/mint-spider.webp`}
                alt=""
                aria-hidden="true"
              />
            )}
            {worldState !== "seeking" && (
              <div className={`world-event ${worldState}${spiderWarning ? " warning" : ""}`} role="status" aria-live="polite">
                <strong>{worldCopy.title}</strong><span>{worldCopy.detail}</span>
              </div>
            )}
            <div className="world-label"><span>FERMENTATION PATCH 01</span><strong>PEACHDROP GARDEN</strong></div>
            <div className="arena-tip"><span className="holo-status" /> MACRO VIEW · FLY ≈ 3 MM</div>
          </div>
          <div className="controls">
            <div className="control-copy">
              <strong>{worldCopy.title}</strong>
              <span>{worldCopy.detail}</span>
            </div>
            <div className="key-controls" aria-label="Fly movement controls">
              <button onClick={() => nudge("left")} disabled={worldState === "threat" || worldState === "takeoff" || worldState === "landing"} aria-label="Steer left">←<kbd>A</kbd></button>
              <button onClick={() => nudge("forward")} disabled={worldState === "threat" || worldState === "takeoff" || worldState === "landing"} aria-label={worldState === "heading" ? "Fly forward" : "Walk forward"}>↑<kbd>W</kbd></button>
              <button onClick={() => nudge("backward")} disabled={worldState === "threat" || worldState === "takeoff" || worldState === "landing"} aria-label={worldState === "heading" ? "Slow or reverse in flight" : "Walk backward with Moonwalker Descending Neurons"}>↓<kbd>S</kbd></button>
              <button onClick={() => nudge("right")} disabled={worldState === "threat" || worldState === "takeoff" || worldState === "landing"} aria-label="Steer right">→<kbd>D</kbd></button>
            </div>
          </div>
        </div>

        <div className="circuit-panel">
          <header className="panel-heading dark-heading">
            <div><span>02</span><p>CONNECTOME LENS</p></div>
            <button className="viewer-button" type="button" onClick={() => setViewerOpen(true)}>
              EXPLORE IN 3D ↗
            </button>
          </header>
          <div className="circuit-canvas-wrap">
            <div
              className={`neuron-render-stage${circuitMode === "heading" ? " heading" : ""}`}
              role="img"
              aria-label={circuitMode === "heading" ? `Front-view EPG cockpit with an illustrative heading bump at ${headingDegrees} degrees` : `BANC ${activeNeuronLayer.label.toLowerCase()} neurons highlighted over gray context neurons`}
              style={{
                "--layer-accent": activeNeuronLayer.accent,
                "--heading-angle": `${headingDegrees + 90}deg`,
              } as CSSProperties}
            >
              {circuitMode === "heading" ? (
                <div className={`epg-cockpit turn-${action}`} aria-hidden="true">
                  <img className="epg-cockpit-base" src={`${assetBase}/epg-cockpit.webp`} alt="" />
                  <img className="epg-cockpit-active" src={`${assetBase}/epg-cockpit.webp`} alt="" />
                  <div className="epg-cockpit-reticle"><span /></div>
                  <div className="epg-cockpit-readout"><span>FLY HEADING</span><strong>{String(headingDegrees).padStart(3, "0")}°</strong></div>
                  <div className="epg-cockpit-turn"><span>← A</span><b>EPG COMPASS</b><span>D →</span></div>
                </div>
              ) : (
                <>
                  <img className="neuron-context-layer" src={`${assetBase}/banc-context-base.webp`} alt="" aria-hidden="true" />
                  {activeNeuronLayer.src && <img key={activeNeuronLayer.src} className="neuron-action-layer" src={activeNeuronLayer.src} alt="" aria-hidden="true" />}
                </>
              )}
              <div className="neuron-render-glow" aria-hidden="true" />
              <div className="neuron-render-label">
                <span><i /> {circuitMode === "heading" ? "COMPASS COCKPIT" : "BANC NEURONS"}</span>
                <strong>{activeNeuronLayer.label}</strong>
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
          </div>
          <div className={`signal-story mode-${circuitMode}`} aria-live="polite">
            <div className="signal-topline"><span>ACTION</span></div>
            <h2>{activeNeuronLayer.label}</h2>
            <p>{activeCircuit.summary}</p>
            <a href={activeCircuit.viewerUrl} target="_blank" rel="noreferrer">EXPLORE THE CIRCUIT ↗</a>
          </div>
        </div>
      </section>

      <section className="legend-band">
        <p>COLOR KEY</p>
        <div>{LEGEND.map(([label, color]) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}</div>
        <p className="evidence-note"><strong>CONNECTOME-SUPPORTED</strong> Structure suggests pathways; it does not record neural activity.</p>
      </section>

      <section className="how-section" id="how">
        <div>
          <p className="eyebrow"><span /> WHY WALKING?</p>
          <h2>The brain doesn’t walk alone.</h2>
        </div>
        <div className="how-copy">
          <p>The BANC (Brain and Nerve Cord) is the first fly connectome that includes the whole central nervous system, mapped down to the synapse. Walking emerges from distributed coordination: body sensors, local feedback loops, long-range pathways, and motor neurons working together.</p>
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
        <span>Built to explore, not to overclaim.</span>
      </footer>

    </main>
  );
}
