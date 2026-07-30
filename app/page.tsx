"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlyHologram } from "./FlyHologram";

type Action = "rest" | "forward" | "left" | "right";
type CircuitMode = "walk" | "left" | "right";

type CircuitNode = {
  name: string;
  area: string;
  role: string;
  color: string;
  muted?: boolean;
};

const WALKING_FIGURE_URL = "https://ng.banc.community/2025a/figure-5c";
const FRONT_LEG_LOOP_URL = "https://spelunker.cave-explorer.org/#!middleauth+https://global.daf-apis.com/nglstate/api/v1/6393410721153024";
const STEERING_CODEX_URL = "https://codex.flywire.ai/app/connectivity?cell_names_or_ids=cell_type+%3D%3D+DNa01+%7C%7C+cell_type+%3D%3D+DNa02&dataset=banc";

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
    summary: "A published BANC pathway shows proprioceptive and threat modules modulating DNg100 walking drive; the front-leg scene reveals the larger local sensorimotor loop.",
    evidence: "BANC FIG. 5c · CONNECTOME-SUPPORTED",
    viewerUrl: WALKING_FIGURE_URL,
    viewerLabel: "OPEN WALKING PATHWAY",
    nodes: WALKING_NODES,
  },
  left: {
    eyebrow: "STEER LEFT · SELECTED",
    title: "A bilateral steering comparison",
    summary: "Left DNa02 and DNa01 are highlighted as high- and low-gain steering types. Their functional roles are experimentally characterized and their cell types are matched into BANC.",
    evidence: "FUNCTIONALLY CHARACTERIZED · BANC-MATCHED",
    viewerUrl: STEERING_CODEX_URL,
    viewerLabel: "OPEN STEERING TYPES",
    nodes: steeringNodes("LEFT"),
  },
  right: {
    eyebrow: "STEER RIGHT · SELECTED",
    title: "A bilateral steering comparison",
    summary: "Right DNa02 and DNa01 are highlighted as high- and low-gain steering types. Their functional roles are experimentally characterized and their cell types are matched into BANC.",
    evidence: "FUNCTIONALLY CHARACTERIZED · BANC-MATCHED",
    viewerUrl: STEERING_CODEX_URL,
    viewerLabel: "OPEN STEERING TYPES",
    nodes: steeringNodes("RIGHT"),
  },
};

const SIGNAL_STAGES = [
  { label: "SENSE", color: "#68d6c4", detail: "Leg proprioceptors report stance and motion." },
  { label: "ASCEND", color: "#8ac7ff", detail: "Ascending neurons carry body-state signals toward the brain." },
  { label: "STEER", color: "#ffc857", detail: "Descending pathways bias walking direction and speed." },
  { label: "STEP", color: "#ff7f6e", detail: "Local VNC circuits coordinate motor output across six legs." },
];

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
  const circuitRef = useRef<HTMLCanvasElement>(null);
  const flyRef = useRef({ x: 0.34, y: 0.58, angle: -0.28 });
  const keysRef = useRef(new Set<string>());
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const actionRef = useRef<Action>("rest");
  const [action, setAction] = useState<Action>("rest");
  const [stage, setStage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [steps, setSteps] = useState(0);
  const [circuitMode, setCircuitMode] = useState<CircuitMode>("walk");
  const activeCircuit = CIRCUITS[circuitMode];

  const updateAction = useCallback((next: Action) => {
    actionRef.current = next;
    setAction(next);
    if (next !== "rest") {
      setCircuitMode(next === "forward" ? "walk" : next);
      setIsPlaying(true);
      setStage(next === "forward" ? 3 : 2);
    }
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowleft", "arrowright", "w", "a", "d"].includes(key)) {
        event.preventDefault();
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
    if (!isPlaying) return;
    const timer = window.setInterval(() => setStage((current) => (current + 1) % 4), 1150);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

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
      if (forward) {
        fly.x += Math.cos(fly.angle) * dt * 0.12;
        fly.y += Math.sin(fly.angle) * dt * 0.16;
        nextAction = left ? "left" : right ? "right" : "forward";
      }
      fly.x = Math.max(0.1, Math.min(0.9, fly.x));
      fly.y = Math.max(0.16, Math.min(0.86, fly.y));
      if (nextAction !== actionRef.current) {
        actionRef.current = nextAction;
        setAction(nextAction);
        if (nextAction !== "rest") {
          setCircuitMode(nextAction === "forward" ? "walk" : nextAction);
          setStage(nextAction === "forward" ? 3 : 2);
          setIsPlaying(true);
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
    };
  }, []);

  useEffect(() => {
    const canvas = circuitRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animation = 0;
    let stopped = false;
    let lastDraw = 0;
    const render = (time: number) => {
      if (isPlaying && time - lastDraw < 30) {
        animation = requestAnimationFrame(render);
        return;
      }
      lastDraw = time;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const spineX = width * 0.5;
      const points = [
        [spineX - 86, height * 0.83], [spineX + 78, height * 0.84],
        [spineX - 92, height * 0.68], [spineX + 88, height * 0.67],
        [spineX - 70, height * 0.52], [spineX + 72, height * 0.51],
        [spineX, height * 0.4], [spineX, height * 0.28],
      ];
      ctx.strokeStyle = "rgba(223, 230, 202, .16)";
      ctx.lineWidth = 1.25;
      for (let i = 0; i < points.length - 1; i++) {
        for (let j = i + 1; j < points.length; j++) {
          if ((i + j) % 3 !== 0) continue;
          ctx.beginPath();
          ctx.moveTo(points[i][0], points[i][1]);
          ctx.quadraticCurveTo(spineX + (i - j) * 7, height * 0.48, points[j][0], points[j][1]);
          ctx.stroke();
        }
      }

      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.lineWidth = 20;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(spineX, height * 0.78);
      ctx.lineTo(spineX, height * 0.23);
      ctx.stroke();

      SIGNAL_STAGES.forEach((signal, index) => {
        const active = index <= stage;
        const y = height * (0.79 - index * 0.17);
        const x = spineX + (index % 2 === 0 ? -1 : 1) * (54 + index * 7);
        ctx.strokeStyle = active ? signal.color : "rgba(255,255,255,.18)";
        ctx.fillStyle = active ? signal.color : "#53605a";
        ctx.lineWidth = active ? 2.4 : 1;
        ctx.shadowColor = active ? signal.color : "transparent";
        ctx.shadowBlur = active ? 16 : 0;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(spineX + (index % 2 ? 40 : -40), y - 36, spineX, y - 25, spineX, y - 55);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, active ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      if (isPlaying) {
        const progress = ((time / 1150) % 1);
        const y = height * (0.79 - (stage + progress) * 0.17);
        ctx.fillStyle = SIGNAL_STAGES[stage].color;
        ctx.shadowColor = SIGNAL_STAGES[stage].color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(spineX, y, 4.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(223,230,202,.42)";
      ctx.fillStyle = "rgba(223,230,202,.06)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(spineX, height * 0.16, 62, 45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(223,230,202,.7)";
      ctx.font = "500 10px Arial";
      ctx.textAlign = "center";
      ctx.fillText("BRAIN", spineX, height * 0.16 + 4);
      ctx.fillText("VENTRAL NERVE CORD", spineX, height * 0.92);
      ctx.textAlign = "left";

      if (!stopped && isPlaying) animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
    return () => {
      stopped = true;
      cancelAnimationFrame(animation);
    };
  }, [stage, isPlaying]);

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
          <h1>One small step.<br/><em>An entire nervous system.</em></h1>
          <p className="lede">Steer a fruit fly and watch a connectome-derived circuit story unfold—from sensing the ground to coordinating six moving legs.</p>
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
          <div className="arena-wrap">
            <canvas ref={arenaRef} className="arena-motion-canvas" aria-hidden="true" />
            <FlyHologram motionRef={flyRef} action={action} />
            <div className="odor-label"><span /> ODOR SOURCE</div>
            <div className="arena-tip"><span className="holo-status" /> HOLOGRAM BODY · NMF-READY</div>
          </div>
          <div className="controls">
            <div className="control-copy">
              <strong>{action === "rest" ? "Ready when you are" : action === "forward" ? "Walking forward" : `Steering ${action}`}</strong>
              <span>{action === "rest" ? "Start moving to reveal the circuit" : "Connectome signals are now in motion"}</span>
            </div>
            <div className="key-controls" aria-label="Fly movement controls">
              <button onClick={() => nudge("left")} aria-label="Steer left">←<kbd>A</kbd></button>
              <button onClick={() => nudge("forward")} aria-label="Walk forward">↑<kbd>W</kbd></button>
              <button onClick={() => nudge("right")} aria-label="Steer right">→<kbd>D</kbd></button>
            </div>
          </div>
        </div>

        <div className="circuit-panel">
          <header className="panel-heading dark-heading">
            <div><span>02</span><p>CONNECTOME LENS</p></div>
            <a className="viewer-button" href={activeCircuit.viewerUrl} target="_blank" rel="noreferrer">{activeCircuit.viewerLabel} ↗</a>
          </header>
          <div className="circuit-canvas-wrap">
            <canvas ref={circuitRef} aria-label="Animated explanatory diagram of walking signals traveling through the fly nervous system" />
            <div className="viewer-badge"><span /> EXPLANATORY PATHWAY</div>
            <div className="circuit-label brain-label">CENTRAL<br/>BRAIN</div>
            <div className="circuit-label cord-label">LOCAL<br/>CONTROL</div>
          </div>
          <div className="signal-story">
            <div className="signal-topline">
              <span>NOW SHOWING</span>
              <button type="button" onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? "PAUSE Ⅱ" : "PLAY ▶"}</button>
            </div>
            <h2><span style={{ color: SIGNAL_STAGES[stage].color }}>{String(stage + 1).padStart(2, "0")}</span> {SIGNAL_STAGES[stage].label}</h2>
            <p>{SIGNAL_STAGES[stage].detail}</p>
            <div className="action-circuit" aria-live="polite">
              <div className="action-circuit-heading">
                <div>
                  <span>{activeCircuit.eyebrow}</span>
                  <strong>{activeCircuit.title}</strong>
                </div>
                <small>{activeCircuit.evidence}</small>
              </div>
              <p>{activeCircuit.summary}</p>
              <div className="neuron-grid" aria-label={`${activeCircuit.eyebrow} neuron selection`}>
                {activeCircuit.nodes.map((node) => (
                  <div className={`neuron-card${node.muted ? " muted" : ""}`} key={node.name}>
                    <i style={{ backgroundColor: node.color, boxShadow: `0 0 12px ${node.color}` }} />
                    <div><strong>{node.name}</strong><span>{node.area}</span></div>
                    <p>{node.role}</p>
                  </div>
                ))}
              </div>
              <div className="circuit-links">
                <a href={activeCircuit.viewerUrl} target="_blank" rel="noreferrer">{activeCircuit.viewerLabel} ↗</a>
                {circuitMode === "walk" && <a href={FRONT_LEG_LOOP_URL} target="_blank" rel="noreferrer">OPEN 1,160-NEURON FRONT-LEG LOOP ↗</a>}
              </div>
              <p className="activity-caveat">The controls select relevant anatomy; glow and timing are explanatory, not measured neural activity.</p>
            </div>
            <div className="stage-track" role="group" aria-label="Circuit stages">
              {SIGNAL_STAGES.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  className={index === stage ? "active" : index < stage ? "seen" : ""}
                  onClick={() => { setStage(index); setIsPlaying(false); }}
                  aria-label={`Show ${item.label.toLowerCase()} stage`}
                ><span style={{ backgroundColor: item.color }} />{item.label}</button>
              ))}
            </div>
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
          <p>BANC joins the brain and ventral nerve cord in one densely reconstructed adult fly nervous system. Walking emerges from distributed coordination: body sensors, local feedback loops, long-range pathways, and motor neurons working together.</p>
          <a href="https://www.nature.com/articles/s41586-026-10735-w" target="_blank" rel="noreferrer">Read the BANC paper <span>↗</span></a>
        </div>
        <div className="coming-soon">
          <span>COMING NEXT</span>
          <strong>TAKE FLIGHT</strong>
          <p>From six legs to two wings: steer through open air.</p>
          <button type="button" disabled>FLIGHT LAB · IN DEVELOPMENT</button>
        </div>
      </section>

      <footer>
        <span>BANC EXPLORER · PUBLIC PROTOTYPE</span>
        <span>Built to explore, not to overclaim.</span>
      </footer>
    </main>
  );
}
