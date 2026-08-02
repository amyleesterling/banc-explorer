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

test("server renders the BANC fly simulator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>BANC Explorer — Be the Fly<\/title>/i);
  assert.match(html, /FLY WORLD/);
  assert.match(html, /NEURAL HUD/);
  assert.match(html, /FIND THE RIPE FRUIT/);
  assert.match(html, /banc-context-base\.webp/);
  assert.match(html, /banc-forward\.webp/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
});

test("ships the verified 12-frame DNp03 quick-dodge package", async () => {
  const [dataText, page, leftFrames, rightFrames] = await Promise.all([
    readFile(new URL("../app/data/flight-dnp03.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
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
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/FlyHologram.tsx", import.meta.url), "utf8"),
    readdir(new URL("../public/banc-groom-head-dng12/", import.meta.url)),
    stat(new URL("../public/banc-groom-head-dng12.webp", import.meta.url)),
    stat(new URL("../public/banc-context-base.webp", import.meta.url)),
  ]);

  assert.deepEqual(frames.sort(), Array.from({ length: 16 }, (_, index) => `frame-${String(index).padStart(2, "0")}.webp`));
  assert.ok(staticLayer.size > 100, "the DNg12 static layer should contain a rendered image");
  assert.ok(contextBase.size > 100, "the regenerated 122-cell context should contain a rendered image");
  assert.match(page, /GROOM_NEURAL_SOURCE_FPS = 24/);
  assert.match(page, /GROOM_NEURAL_PLAYBACK_FPS = GROOM_NEURAL_SOURCE_FPS \/ 10/);
  assert.match(page, /elapsed % cycleDuration/);
  assert.doesNotMatch(page, /groomPulseComplete|setGroomPulseComplete/);
  assert.match(page, /HEAD_GROOM_DURATION_MS = 22500/);
  assert.match(flyModel, /HEAD_GROOM_CYCLE_SPEED = 0\.32/);
  assert.match(flyModel, /HEAD_GROOM_DURATION_SECONDS = 22\.5/);
  assert.match(page, /BANC DNg12-annotated population — anterior grooming/);
  assert.match(page, /dng12-122/);
  assert.doesNotMatch(page, /wPN1|groom-wing/);
});

test("keeps movement controls live while the fly is grooming", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /PLAYER_CONTROL_STATES = new Set<WorldState>\(\["seeking", "eating", "heading", "groom-head"\]\)/);
  assert.match(page, /const controlsLocked = !isPlayerControllableState\(worldState\)/);
  assert.match(page, /if \(!isPlayerControllableState\(currentState\)\) return;/);
  assert.match(page, /if \(!isPlayerControllableState\(worldStateRef\.current\) && worldStateRef\.current !== "dodge"\) nextAction = "rest";/);
});

test("keeps the flight-drive readout from overlapping the cockpit title", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /!isFlightCockpit \|\| circuitMode === "heading"/);
  assert.match(page, /className={`flight-drive-readout \$\{circuitMode\}`}/);
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
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/FlyHologram.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(flyModel, /toeBean|SphereGeometry\(0\.062/);
  assert.match(flyModel, /toe: makeMaterial\("#d8f5e8"/);
  assert.match(flyModel, /frontToe: makeMaterial\("#ecfff6"/);
  assert.match(flyModel, /outlineScale = segment\.name\.includes\("_tarsus"\) \? 1\.24 : 1\.18/);
  assert.match(flyModel, /object\.position\.z \+= 0\.32 \* groomingPose/);
  assert.doesNotMatch(flyModel, /object\.position\.z \+= 0\.58 \* groomingPose/);
  assert.match(flyModel, /object\.rotateY\(-0\.42\)/);
  assert.match(page, /SNACK_BEFORE_WARNING_MS = 4800/);
  assert.match(page, /SPIDER_WARNING_MS = 2400/);
  assert.match(page, /DODGE_PLAYBACK_FPS = 12/);
  assert.match(page, /TAKEOFF_STAGE_MS = 1800/);
  assert.match(page, /LANDING_STAGE_MS = 1700/);
});

test("uses one botanical sci-fi HUD language over the natural fly world", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /--field-glass-a: rgba\(249,250,237,\.95\)/);
  assert.match(css, /\.world-event:before/);
  assert.match(css, /\.world-event strong:before/);
  assert.match(css, /\.landing-flower > strong:after/);
  assert.match(css, /\.world-label[^}]+linear-gradient\(135deg, var\(--field-glass-a\), var\(--field-glass-b\)\)/);
  assert.doesNotMatch(css, /\.world-event \{[^}]*border-radius: 12px/);
  assert.doesNotMatch(css, /\.landing-flower > strong \{[^}]*border-radius: 999px/);
});

test("uses the fly world as a full-viewport cockpit with neurons overlaid as a HUD", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Interactive BANC fly cockpit/);
  assert.match(page, /<p>NEURAL HUD<\/p>/);
  assert.match(css, /\.lab-shell \{[^}]*position: relative; display: block/);
  assert.match(css, /\.arena-panel \{[^}]*position: absolute;[^}]*inset: 0/);
  assert.match(css, /\.circuit-panel \{[^}]*position: absolute;[^}]*inset: 0;[^}]*background: transparent/);
  assert.match(css, /\.circuit-canvas-wrap \{[^}]*position: absolute;[^}]*width: min\(52vw, 900px\)/);
  assert.match(css, /\.epg-cockpit \{[^}]*background: transparent/);
  assert.doesNotMatch(css, /grid-template-columns: minmax\(0, 1\.12fr\) minmax\(360px, \.88fr\)/);
});

test("keeps event copy in the HUD and uses only a floating movement dock at the bottom", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /controlCopy|className="control-copy"/);
  assert.match(css, /\.controls \{[^}]*width: auto;[^}]*background: transparent/);
  assert.match(css, /\.key-controls \{[^}]*border-radius: 15px;[^}]*backdrop-filter: blur\(14px\)/);
  assert.doesNotMatch(css, /\.arena-panel \{[^}]*grid-template-rows/);
});

test("shows signed flight velocity measured from simulated displacement", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const SIM_WORLD_WIDTH_MM = 3/);
  assert.match(page, /const deltaX = fly\.x - previousVelocitySample\.x/);
  assert.match(page, /const longitudinalVelocity = dt > 0/);
  assert.match(page, /SIM VELOCITY · BODY AXIS/);
  assert.match(page, /velocityDisplay} mm\/s/);
  assert.match(css, /\.epg-velocity-gauge/);
  assert.match(css, /\.epg-velocity-readout\.reverse/);
});

test("uses the supplied BANC fly mark for the header and browser icons", async () => {
  const [page, layout, icon] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/banc-explorer-fly-icon.svg", import.meta.url), "utf8"),
  ]);

  assert.match(page, /banc-explorer-fly-icon\.svg/);
  assert.equal((layout.match(/banc-explorer-fly-icon\.svg/g) ?? []).length, 3);
  assert.match(icon, /viewBox="0 0 512 512"/);
  assert.match(icon, /fill="#C7A6F3"/);
  assert.match(icon, /stroke="#68D6C4"/);
});
