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
  assert.match(html, /CONNECTOME LENS/);
  assert.match(html, /Find the fallen fruit/);
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

test("keeps the flight-drive readout from overlapping the cockpit title", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /!isFlightCockpit \|\| circuitMode === "heading"/);
  assert.match(page, /className={`flight-drive-readout \$\{circuitMode\}`}/);
});
