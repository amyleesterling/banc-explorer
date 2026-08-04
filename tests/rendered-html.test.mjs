import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}


// The app's source is now two files: page.tsx renders it, game-model.ts holds
// the circuit table, the layer table and the sequence map that the
// system-design hub also reads. Assertions about the app apply to both.
async function readAppSource() {
  const [page, model] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/game-model.ts", import.meta.url), "utf8"),
  ]);
  return `${page}
${model}`;
}

test("server renders the BANC fly simulator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>BANC Explorer — Be the Fly<\/title>/i);
  assert.match(html, /BE THE FLY/);
  assert.match(html, /NEURAL INTERFACE/);
  assert.match(html, /FIND THE RIPE FRUIT/);
  assert.match(html, /banc-context-base\.webp/);
  assert.match(html, /banc-forward\.webp/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
});

test("ships the verified 12-frame DNp03 quick-dodge package", async () => {
  const [dataText, page, leftFrames, rightFrames] = await Promise.all([
    readFile(new URL("../app/data/flight-dnp03.json", import.meta.url), "utf8"),
    readAppSource(),
    readdir(new URL("../public/banc-flight-dodge-anatomical-left/", import.meta.url)),
    readdir(new URL("../public/banc-flight-dodge-anatomical-right/", import.meta.url)),
  ]);
  const data = JSON.parse(dataText);

  assert.equal(data.cell_type, "DNp03");
  assert.equal(data.count, 2);
  assert.equal(data.role, "flight-saccade response; not threat detection");
  assert.equal(data.behavioral_direction_mapping, "pending");
  assert.deepEqual(data.cells.map((cell) => cell.root_id), [
    "720575941539809997",
    "720575941558607396",
  ]);
  assert.deepEqual(leftFrames.sort(), Array.from({ length: 12 }, (_, index) => `frame-${String(index).padStart(2, "0")}.webp`));
  assert.deepEqual(rightFrames.sort(), Array.from({ length: 12 }, (_, index) => `frame-${String(index).padStart(2, "0")}.webp`));
  assert.match(page, /DODGE_FRAME_COUNT = 12/);
  assert.match(page, /Anatomical side is not assigned to turn direction/);

  const requiredAssets = [
    "../public/banc-context-base.webp",
    "../public/banc-flight-dodge-dnp03-all.webp",
    "../public/banc-flight-dodge-dnp03-anatomical-left.webp",
    "../public/banc-flight-dodge-dnp03-anatomical-right.webp",
  ];
  for (const asset of requiredAssets) {
    const details = await stat(new URL(asset, import.meta.url));
    assert.ok(details.size > 100, `${asset} should contain a rendered image`);
  }
});

test("ships the audited DNg12 anterior-grooming package without an unsupported wing-grooming slot", async () => {
  const [page, flyModel, frames, staticLayer, contextBase] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/FlyHologram.tsx", import.meta.url), "utf8"),
    readdir(new URL("../public/banc-groom-head-dng12/", import.meta.url)),
    stat(new URL("../public/banc-groom-head-dng12.webp", import.meta.url)),
    stat(new URL("../public/banc-context-base.webp", import.meta.url)),
  ]);

  assert.deepEqual(frames.sort(), Array.from({ length: 16 }, (_, index) => `frame-${String(index).padStart(2, "0")}.webp`));
  assert.ok(staticLayer.size > 100, "the DNg12 static layer should contain a rendered image");
  assert.ok(contextBase.size > 100, "the regenerated 122-cell context should contain a rendered image");
  assert.match(page, /GROOM_NEURAL_SOURCE_FPS = 24/);
  // 24/2 = 12 fps: one 16-frame loop in 1.33 s, matching the dodge and
  // walk-speed loops. The old /10 ran 6.7 s per loop and read as a still image.
  assert.match(page, /GROOM_NEURAL_PLAYBACK_FPS = GROOM_NEURAL_SOURCE_FPS \/ 2/);
  assert.match(page, /elapsed % cycleDuration/);
  assert.doesNotMatch(page, /groomPulseComplete|setGroomPulseComplete/);
  // The grooming pose is still now, so a 22.5 second hold was dead time. Six
  // seconds is about five loops of the DNg12 signal, which is what there is to
  // see. The two files must agree or the fly and its render fall out of step.
  assert.match(page, /HEAD_GROOM_DURATION_MS = 6000/);
  assert.match(flyModel, /HEAD_GROOM_CYCLE_SPEED = 0\.32/);
  assert.match(flyModel, /HEAD_GROOM_DURATION_SECONDS = 6/);
  assert.match(page, /BANC DNg12-annotated population — anterior grooming/);
  assert.match(page, /dng12-122/);
  assert.doesNotMatch(page, /wPN1|groom-wing/);
});

test("keeps movement controls live while the fly is grooming", async () => {
  const page = await readAppSource();

  assert.match(page, /PLAYER_CONTROL_STATES = new Set<WorldState>\(\["seeking", "eating", "heading", "groom-head"\]\)/);
  assert.match(page, /const controlsLocked = !isPlayerControllableState\(worldState\)/);
  assert.match(page, /if \(!isPlayerControllableState\(currentState\)\) return;/);
  assert.match(page, /worldStateRef\.current !== "dodge" && worldStateRef\.current !== "run"/);
});

test("lets the player choose freeze, run, or fly when the threat arrives", async () => {
  const [page, css] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /type ThreatChoice = "freeze" \| "run" \| "fly"/);
  assert.match(page, /FREEZE_SURVIVAL_MS = 3000/);
  assert.match(page, /OMG a spider!/);
  // The approach render has no alpha, so it plays in its own window rather
  // than sitting on the card the way the cut-out still did.
  assert.match(page, /threat-dialog-spider-clip/);
  assert.match(page, /handleThreatChoice\("freeze"\)/);
  assert.match(page, /handleThreatChoice\("run"\)/);
  assert.match(page, /handleThreatChoice\("fly"\)/);
  assert.match(page, /Nature is rough\./);
  assert.match(page, /You didn’t survive this round/);
  assert.match(page, /A tasty scent drifts from the top of a flower/);
  assert.match(page, /window\.setTimeout\(resetExperience, GAME_OVER_MS\)/);
  assert.match(css, /\.freeze-countdown/);
  assert.match(css, /@keyframes freeze-ring-drain/);
  assert.match(css, /\.spider-threat\.run/);
});

test("scales the delivered DNg100 signal sequence with the unified walking pace setting", async () => {
  const [page, css, frames] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readdir(new URL("../public/banc-walk-speed-dng100/", import.meta.url)),
  ]);

  assert.equal(frames.filter((name) => /^frame-\d{2}\.webp$/.test(name)).length, 16);
  assert.match(page, /const WALK_SPEED_FRAME_COUNT = 16/);
  assert.match(page, /banc-walk-speed-dng100\/frame-/);
  assert.match(page, /const \[driveLevel, setDriveLevel\] = useState\(DEFAULT_DRIVE_LEVEL\)/);
  assert.match(page, /isWalkSpeedPulse = worldState === "seeking"[\s\S]*effectiveDriveLevel > MIN_DRIVE_LEVEL/);
  assert.match(page, /const walkDrivePlaybackFps = 5 \+ effectiveDriveLevel \* 11/);
  assert.match(page, /isWalkSpeedPulse && \(/);
  assert.match(css, /\.neuron-action-layer\.walk-speed-frame/);
  assert.match(css, /--drive-level/);
});

test("keeps the peach mounted and visible throughout the simulator loop", async () => {
  const [page, css] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /className={`snack-fruit visible/);
  assert.match(page, /fetchPriority="high"/);
  assert.match(page, /data-world-state=\{worldState\}/);
  assert.match(page, /const FOOD_TARGET = \{ x: 0\.42, y: 0\.3 \}/);
  assert.match(css, /\.snack-fruit\.visible \{ display: block; \}/);
});

test("puts an honest cell-color key inside the neuron viewport", async () => {
  const [page, css] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const NEURON_COLOR_KEYS/);
  assert.match(page, /DNg100[\s\S]*descending walking drive/);
  assert.match(page, /AN09B029_b \+ AN02A002[\s\S]*feedback \(pooled\)/);
  assert.match(page, /DNp42 \+ DNge053 \+ DNg55[\s\S]*response \(pooled\)/);
  assert.match(page, /aria-label="Neuron color key"/);
  assert.match(page, /mobile-neuron-color-key/);
  assert.match(page, /Context neurons/);
  assert.match(css, /\.neuron-color-key/);
});

test("links to a dedicated credits page with the requested acknowledgements", async () => {
  const [home, credits] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/credits/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(home, /credits`}>Citations & Credits<\/a>/);
  assert.match(credits, /Created by/);
  assert.match(credits, /Amy Sterling/);
  assert.match(credits, /https:\/\/x\.com\/amyneurons/);
  assert.match(credits, /https:\/\/orcid\.org\/0000-0002-4961-3954/);
  assert.match(credits, /Alexander Bates/);
  assert.match(credits, /Harvard University/);
  assert.match(credits, /Yijie Yin/);
  assert.match(credits, /University of Cambridge/);
  assert.match(credits, /banc-context-base\.webp/);
  assert.match(credits, /banc-forward\.webp/);
  assert.match(credits, /BANC neurons associated with forward walking/);
});

test("distinguishes persistent drive command, flight thrust, and measured speed", async () => {
  const [page, css] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const \[flightThrottle, setFlightThrottle\] = useState\(0\)/);
  assert.match(page, /const throttleCommand = interactiveFlight/);
  assert.match(page, /\? -activeDriveLevel \* 0\.55/);
  assert.match(page, /const driveLevelRef = useRef\(DEFAULT_DRIVE_LEVEL\)/);
  assert.match(page, /const flightMotionRef = useRef\(0\)/);
  assert.match(page, /const targetFlightMotion = throttleCommand \* MAX_FLIGHT_SPEED_SIM_S/);
  assert.match(page, /PACE SETTING/);
  assert.match(page, /THRUST SETTING/);
  assert.match(page, /DNg100 · WALK DRIVE/);
  assert.match(page, /DNg02 · WING DRIVE/);
  assert.match(page, /className={`drive-console/);
  assert.match(page, /type="range"/);
  assert.match(page, /else if \(currentState === "heading"\)[\s\S]*setCircuitMode\("heading"\)/);
  assert.match(css, /\.drive-console/);
  assert.match(css, /\.drive-level-control/);
  assert.match(css, /\.drive-command-readout::after/);
  assert.doesNotMatch(page, /flight-drive-readout/);
  // the six scattered cards were collapsed into one HUD column; none may return
  assert.doesNotMatch(page, /flight-throttle-hud|mission-hud|signal-story|neuron-render-label/);
});

test("records the audited bilateral BANC MNb1 render candidates without inventing turn direction", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/flight-mnb1.json", import.meta.url), "utf8"));

  assert.equal(data.cell_type, "b1 MN (MNb1)");
  assert.equal(data.dataset, "BANC v888");
  assert.equal(data.count, 2);
  assert.equal(data.status, "verified for rendering");
  assert.deepEqual(data.cells.map((cell) => [cell.root_id, cell.anatomical_side]), [
    ["720575941521196211", "left"],
    ["720575941549822781", "right"],
  ]);
  assert.equal(data.render_request.context_cell_count_after_addition, 124);
  assert.match(data.scientific_caveat, /Do not equate anatomical side with behavioral turn direction/);
  assert.match(data.render_request.animation, /not recorded activity or measured conduction timing/);
});

test("gives the anatomical fly kawaii compound eyes without the red glow", async () => {
  const flyModel = await readFile(new URL("../app/FlyHologram.tsx", import.meta.url), "utf8");

  assert.match(flyModel, /const eyeMaterial = new THREE\.MeshBasicMaterial/);
  assert.match(flyModel, /color: 0x38243f/);
  assert.match(flyModel, /const eyeHighlightGeometry = new THREE\.SphereGeometry/);
  assert.match(flyModel, /object\.add\(largeGlint, smallGlint\)/);
  assert.doesNotMatch(flyModel, /eye: makeMaterial\("#ff5f79"/);
});

test("keeps the articulated legs delicate, compact, and free of artificial red toe caps", async () => {
  const [page, flyModel] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/FlyHologram.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(flyModel, /toeBean|SphereGeometry\(0\.062/);
  assert.match(flyModel, /toe: makeMaterial\("#d8f5e8"/);
  assert.match(flyModel, /frontToe: makeMaterial\("#ecfff6"/);
  assert.match(flyModel, /outlineScale = segment\.name\.includes\("_tarsus"\) \? 1\.24 : 1\.18/);
  assert.match(flyModel, /object\.position\.z \+= 0\.2 \* groomingPose/);
  assert.doesNotMatch(flyModel, /object\.position\.z \+= 0\.58 \* groomingPose/);
  assert.match(flyModel, /object\.rotateY\(\(-0\.78 - sweep \* 0\.055\) \* groomingPose\)/);
  assert.match(flyModel, /object\.rotateY\(\(1\.18 \+ sweep \* 0\.075\) \* groomingPose\)/);
  assert.match(flyModel, /object\.rotateY\(-0\.42\)/);
  assert.match(page, /SNACK_BEFORE_WARNING_MS = 4800/);
  assert.match(page, /FREEZE_SURVIVAL_MS = 3000/);
  assert.match(page, /DODGE_PLAYBACK_FPS = 12/);
  // The dodge hands the controls over quickly now: one second of evasion, a
  // short launch beat, then flight control.
  assert.match(page, /TAKEOFF_STAGE_MS = 700/);
  assert.match(page, /LANDING_STAGE_MS = 1700/);
});

test("uses one botanical sci-fi HUD language over the natural fly world", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /--field-glass-a: rgba\(249,250,237,\.95\)/);
  assert.match(css, /\.world-event:before/);
  assert.match(css, /\.world-event strong:before/);
  assert.match(css, /\.landing-flower > strong:after/);
  assert.match(css, /\.mobile-neuron-hud[^}]+linear-gradient\(158deg, rgba\(9,26,26,\.9\), rgba\(6,18,20,\.86\)\)/);
  assert.doesNotMatch(css, /\.world-event \{[^}]*border-radius: 12px/);
  assert.doesNotMatch(css, /\.landing-flower > strong \{[^}]*border-radius: 999px/);
});

test("gives mobile a light full-size neuron focus without freezing grooming controls", async () => {
  const [page, css] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /worldState === "dodge" \|\| worldState === "groom-head"/);
  // One second of dodge, covering about a third of the arena.
  assert.match(page, /DODGE_STAGE_MS = 1000/);
  assert.match(page, /fly\.x \+= dt \* 0\.30/);
  assert.match(page, /cycleDuration \* 3/);
  assert.match(page, /3 LOOPS · TAP TO CLOSE/);
  assert.match(css, /\.mobile-neuron-hud\.expanded \{ inset: 72px 12px 82px/);
  assert.match(css, /\.fly-hologram canvas \{ filter: brightness\(1\.12\)[^}]*contrast\(1\.42\)/);
  assert.match(css, /\.mobile-neuron-details > strong \{ display: none; \}/);
  assert.match(css, /\.mobile-neuron-details small \{ display: none; \}/);
  assert.doesNotMatch(page, /FERMENTATION PATCH 01|world-label/);
  assert.match(page, /PLAYER_CONTROL_STATES = new Set<WorldState>\(\["seeking", "eating", "heading", "groom-head"\]\)/);
});

test("records the audited four-cell BANC landing selection", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/flight-landing-dnp07-dnp10.json", import.meta.url), "utf8"));

  assert.equal(data.count, 4);
  assert.deepEqual(data.cells.map((cell) => cell.root_id), [
    "720575941407841071",
    "720575941545991429",
    "720575941440683743",
    "720575941593683051",
  ]);
  assert.match(data.scientific_caveat, /not claim that they are the only landing neurons/i);
});

test("keeps executable render and project-memory handoffs", async () => {
  const [renderGuide, groomingGuide, memory] = await Promise.all([
    readFile(new URL("../docs/handoffs/v2/RENDER_GUIDE_MISSING_FLIGHT_CELLS_V2.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/handoffs/v2/GROOMING_ANIMATION_REVISION_V2.md", import.meta.url), "utf8"),
    readFile(new URL("../CODEX_MEMORY.md", import.meta.url), "utf8"),
  ]);

  assert.match(renderGuide, /720575941521196211/);
  assert.match(renderGuide, /720575941549822781/);
  assert.match(renderGuide, /Version: \*\*v2/);
  assert.match(renderGuide, /154 unique cells/);
  assert.match(groomingGuide, /population-level pooled distance scale/);
  assert.match(groomingGuide, /Version: \*\*v2/);
  assert.match(groomingGuide, /The fly remains steerable during grooming/);
  assert.match(memory, /DNg02 is exposed as the W\/S flight-drive throttle/);
  assert.match(memory, /project memory — v2/);
  assert.match(memory, /Anatomical left\/right is not automatically behavioral left\/right/);
});

test("uses the fly world as a full-viewport cockpit with neurons overlaid as a HUD", async () => {
  const [page, css] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Interactive BANC fly cockpit/);
  assert.match(page, /<p>NEURAL INTERFACE<\/p>/);
  assert.match(css, /\.lab-shell \{[^}]*position: relative; display: block/);
  assert.match(css, /\.arena-panel \{[^}]*position: absolute;[^}]*inset: 0/);
  assert.match(css, /\.circuit-panel \{[^}]*position: absolute;[^}]*inset: 0;[^}]*background: transparent/);
  // the HUD width is now a variable so the movement dock can centre on the
  // strip of world left beside it; same geometry, one source of truth
  assert.match(css, /\.circuit-canvas-wrap \{[^}]*--hud-w: min\(46vw, 760px\)/);
  assert.match(css, /\.circuit-canvas-wrap \{[^}]*position: absolute/);
  assert.match(css, /\.epg-cockpit \{[^}]*background: transparent/);
  assert.doesNotMatch(css, /grid-template-columns: minmax\(0, 1\.12fr\) minmax\(360px, \.88fr\)/);
});

test("keeps one responsive drive console available on desktop and mobile", async () => {
  const [page, css] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /controlCopy|className="control-copy"/);
  assert.match(page, /className={`drive-console/);
  assert.match(page, /className="drive-level-control"/);
  assert.match(page, /className="direction-controls"/);
  assert.match(page, /type="range"/);
  assert.match(css, /\.drive-console \{/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.drive-console \{ left: 10px; right: 10px; bottom: 10px/);
  assert.doesNotMatch(css, /\.arena-panel \{[^}]*grid-template-rows/);
});

test("shows signed simulated speed measured from displacement on ground and in air", async () => {
  const [page, css] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const SIM_WORLD_WIDTH_MM = 3/);
  assert.match(page, /const deltaX = fly\.x - previousVelocitySample\.x/);
  assert.match(page, /const longitudinalVelocity = dt > 0/);
  assert.match(page, /const targetVelocity = isPlayerControllableState\(currentWorldState\)/);
  assert.match(page, /setSimVelocity\(roundedVelocity\)/);
  assert.match(page, /GROUND SPEED/);
  assert.match(page, /AIR SPEED/);
  assert.match(page, /\{velocityDisplay\}<small>mm\/s<\/small>/);
  assert.match(page, /flightMotionRef\.current \+= \(targetFlightMotion - flightMotionRef\.current\) \* flightResponse/);
  assert.match(css, /\.drive-speed-readout/);
  // Heading and velocity are instruments over the stage. Each needle is driven
  // by the same value its own number shows, and the dial's full scale is the
  // clamp the simulation already applies, so the two cannot disagree.
  assert.match(page, /<HeadingCompass degrees=\{compassDegrees\}/);
  assert.match(page, /<VelocityDial velocity=\{simVelocity\}[^>]*display=\{velocityDisplay\}/);
  assert.match(page, /velocity \/ MAX_SIM_VELOCITY_MM_S/);
  assert.match(css, /\.hud-gauge \.gauge-pointer/);
  // Every rendered sequence is wired, and DNg02 is an addition to the EPG
  // compass rather than a replacement for it.
  assert.match(page, /walk: "banc-forward"/);
  assert.match(page, /const FLIGHT_POWER_DIR = "banc-flight-power-dng02"/);
  assert.match(page, /\{showFlightPower && \(/);
  assert.match(page, /hud-drive-inset/);
  // Walking into the fruit works from any grounded state, fires on entry rather
  // than every frame inside it, and only the first meal summons the spider.
  assert.match(page, /if \(insideFood && !insideFoodRef\.current\) triggerEating\(\);/);
  assert.match(page, /state !== "seeking" && state !== "groom-head"/);
  assert.match(page, /if \(ambushedRef\.current\) \{/);
  // .neuron-render-stage img absolutely positions every image in the stage;
  // the thrust panel has to opt out or its frame is stretched over the whole
  // stage and never seen.
  assert.match(css, /\.hud-drive-inset > img \{[^}]*position: static/);
  assert.doesNotMatch(page, /neuron-action-layer flight-power-frame/);
  assert.match(page, /src=\{activeSequence\[sequenceFrame\]\}/);
  // One quantity, one place: the compass replaced the duplicate heading strip.
  assert.doesNotMatch(page, /EPG READOUT/);
});

test("uses the supplied Be the Fly v2 mark for the header and browser icons", async () => {
  const [page, layout, icon] = await Promise.all([
    readAppSource(),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/be-the-fly-icon-v2.png", import.meta.url)),
  ]);

  assert.match(page, /be-the-fly-icon-v2\.png/);
  assert.equal((layout.match(/be-the-fly-icon-v2\.png/g) ?? []).length, 3);
  assert.equal(icon.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
});
