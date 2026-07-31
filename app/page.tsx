"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlyHologram } from "./FlyHologram";
import walkingSteeringNeuroglancer from "./data/walking-steering-neuroglancer.json";

type Action = "rest" | "forward" | "backward" | "left" | "right";
type CircuitMode = "walk" | "backward" | "left" | "right" | "eat" | "threat" | "heading";
type WorldState = "seeking" | "eating" | "threat" | "takeoff" | "heading" | "landing";

const WALKING_FIGURE_URL = "https://ng.banc.community/2026a/figure-5c";
const WALKING_SCENE_URL = "https://ng.banc.community/2026a/walking";
const FEEDING_SCENE_URL = "https://ng.banc.community/2026a/feeding";
const INTERACTIVE_NEURON_URL = `https://spelunker.cave-explorer.org/#!${encodeURIComponent(JSON.stringify(walkingSteeringNeuroglancer))}`;
const STEERING_CODEX_URL = "https://codex.flywire.ai/app/connectivity?cell_names_or_ids=cell_type+%3D%3D+DNa01+%7C%7C+cell_type+%3D%3D+DNa02&dataset=banc";
const MDN_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+MDN&dataset=banc";
const EPG_CODEX_URL = "https://codex.flywire.ai/app/search?filter_string=cell_type+%3D%3D+EPG&dataset=banc";
const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const EPG_HEADING_COUNT = 16;
const EPG_HEADING_ASSETS = Array.from(
  { length: EPG_HEADING_COUNT },
  (_, index) => `${assetBase}/epg/epg-heading-${String(index).padStart(2, "0")}.webp`,
);
const EPG_BASE_ASSET = `${assetBase}/epg/epg-base.webp`;
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

const STATIC_NEURON_LAYERS: Record<CircuitMode, { src?: string; label: string; accent: string }> = {
  walk: { src: `${assetBase}/banc-forward.webp`, label: "FORWARD WALK", accent: "#ff4fa3" },
  backward: { src: `${assetBase}/banc-backward.webp`, label: "MOONWALK", accent: "#ff4fa3" },
  left: { src: `${assetBase}/banc-turn-left.webp`, label: "STEER LEFT", accent: "#ff4fa3" },
  right: { src: `${assetBase}/banc-turn-right.webp`, label: "STEER RIGHT", accent: "#ff4fa3" },
  eat: { src: `${assetBase}/banc-eat.webp`, label: "FEEDING", accent: "#ffc857" },
  threat: { src: `${assetBase}/banc-threat-walk.webp`, label: "THREAT RESPONSE", accent: "#ff7b72" },
  heading: { label: "EPG COCKPIT", accent: "#bd9bd1" },
};

const CIRCUITS: Record<CircuitMode, {
  summary: string;
  viewerUrl: string;
}> = {
  walk: {
    summary: "DNg100 walking drive is coordinated with ascending feedback and local leg circuits.",
    viewerUrl: WALKING_SCENE_URL,
  },
  backward: {
    summary: "Four Moonwalker Descending Neurons are highlighted during backward walking.",
    viewerUrl: MDN_CODEX_URL,
  },
  left: {
    summary: "Left DNa01 and DNa02 are highlighted for steering.",
    viewerUrl: STEERING_CODEX_URL,
  },
  right: {
    summary: "Right DNa01 and DNa02 are highlighted for steering.",
    viewerUrl: STEERING_CODEX_URL,
  },
  eat: {
    summary: "Six cells from the official BANC feeding scene are highlighted.",
    viewerUrl: FEEDING_SCENE_URL,
  },
  threat: {
    summary: "Five response neurons are highlighted as the fly escapes.",
    viewerUrl: WALKING_FIGURE_URL,
  },
  heading: {
    summary: "EPG neurons maintain the fly's heading as it turns.",
    viewerUrl: EPG_CODEX_URL,
  },
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
  const epgPreloadedRef = useRef(false);
  const [action, setAction] = useState<Action>("rest");
  const [worldState, setWorldState] = useState<WorldState>("seeking");
  const [spiderWarning, setSpiderWarning] = useState(false);
  const [steps, setSteps] = useState(0);
  const [headingDegrees, setHeadingDegrees] = useState(344);
  const [circuitMode, setCircuitMode] = useState<CircuitMode>("walk");
  const [viewerOpen, setViewerOpen] = useState(false);
  const activeCircuit = CIRCUITS[circuitMode];
  const activeNeuronLayer = STATIC_NEURON_LAYERS[circuitMode];
  const compassDegrees = (headingDegrees + 90) % 360;
  const epgCounterClockwiseDegrees = (360 - compassDegrees) % 360;
  const epgHeadingIndex = Math.floor(epgCounterClockwiseDegrees / (360 / EPG_HEADING_COUNT)) % EPG_HEADING_COUNT;
  const epgHeadingAsset = EPG_HEADING_ASSETS[epgHeadingIndex];
  const headingCardinal = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(compassDegrees / 45) % 8];
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
    if (worldState !== "eating" || epgPreloadedRef.current) return;
    epgPreloadedRef.current = true;
    [EPG_BASE_ASSET, ...EPG_HEADING_ASSETS].forEach((src) => {
      void fetch(src, { cache: "force-cache" }).catch(() => undefined);
    });
  }, [worldState]);

  useEffect(() => {
    const render = (time: number) => {
      if (time - lastRef.current < 30) {
        frameRef.current = requestAnimationFrame(render);
        return;
      }
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
              aria-label={circuitMode === "heading" ? `Front-view EPG cockpit with heading sector ${epgHeadingIndex} selected at ${compassDegrees} compass degrees` : `BANC ${activeNeuronLayer.label.toLowerCase()} neurons highlighted over gray context neurons`}
              style={{
                "--layer-accent": activeNeuronLayer.accent,
                "--heading-angle": `${headingDegrees + 90}deg`,
              } as CSSProperties}
            >
              {circuitMode === "heading" ? (
                <div className={`epg-cockpit turn-${action}`} aria-hidden="true">
                  <img className="epg-cockpit-base" src={EPG_BASE_ASSET} alt="" />
                  <img key={epgHeadingAsset} className="epg-cockpit-active" src={epgHeadingAsset} alt="" />
                  <div className="epg-cockpit-reticle"><span /></div>
                  <div className="epg-cockpit-readout"><span>FLY HEADING · EPG {String(epgHeadingIndex).padStart(2, "0")}</span><strong>{headingCardinal} · {String(compassDegrees).padStart(3, "0")}°</strong></div>
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
