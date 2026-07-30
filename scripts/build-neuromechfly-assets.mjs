import { copyFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(process.argv[2] ?? "tmp/flygym-main");
const modelRoot = join(repoRoot, "src/flygym/assets/model/neuromechfly");
const meshSource = join(modelRoot, "meshes/simplified_max2000faces");
const outputRoot = resolve("public/neuromechfly");
const meshOutput = join(outputRoot, "mesh");

mkdirSync(meshOutput, { recursive: true });
cpSync(meshSource, meshOutput, { recursive: true });
copyFileSync(join(repoRoot, "LICENSE"), join(outputRoot, "LICENSE"));

const yaml = readFileSync(join(modelRoot, "rigging.yaml"), "utf8");
const entries = {};
let current = null;

for (const line of yaml.split(/\r?\n/)) {
  const key = line.match(/^([a-z0-9_]+):\s*$/);
  if (key) {
    current = key[1];
    entries[current] = { name: current };
    continue;
  }
  if (!current) continue;
  const vector = line.match(/^\s+(pos|quat):\s*(\[[^\]]+\])/);
  if (vector) entries[current][vector[1]] = JSON.parse(vector[2]);
}

function parentFor(name) {
  if (name === "c_thorax") return null;
  if (name === "c_head" || name === "c_abdomen12") return "c_thorax";
  if (name === "c_rostrum") return "c_head";
  if (name === "c_haustellum") return "c_rostrum";
  if (/^c_abdomen[3-6]$/.test(name)) {
    const number = Number(name.replace("c_abdomen", ""));
    return number === 3 ? "c_abdomen12" : `c_abdomen${number - 1}`;
  }
  if (/^[lr]_(eye|pedicel)$/.test(name)) return "c_head";
  if (/^[lr]_funiculus$/.test(name)) return `${name[0]}_pedicel`;
  if (/^[lr]_arista$/.test(name)) return `${name[0]}_funiculus`;
  if (/^[lr]_(wing|haltere)$/.test(name)) return "c_thorax";
  const leg = name.match(/^([lr][fmh])_(coxa|trochanterfemur|tibia|tarsus([1-5]))$/);
  if (leg) {
    const [, prefix, segment, tarsusNumber] = leg;
    if (segment === "coxa") return "c_thorax";
    if (segment === "trochanterfemur") return `${prefix}_coxa`;
    if (segment === "tibia") return `${prefix}_trochanterfemur`;
    const number = Number(tarsusNumber);
    return number === 1 ? `${prefix}_tibia` : `${prefix}_tarsus${number - 1}`;
  }
  throw new Error(`No parent mapping for ${name}`);
}

const segments = Object.values(entries).map((entry) => {
  const meshName = entry.name.startsWith("r_")
    ? `l_${entry.name.slice(2)}.stl`
    : entry.name.startsWith("r")
      ? `l${entry.name.slice(1)}.stl`
      : `${entry.name}.stl`;
  return {
    ...entry,
    parent: parentFor(entry.name),
    mesh: meshName,
    mirrorY: entry.name.startsWith("r"),
  };
});

writeFileSync(
  join(outputRoot, "manifest.json"),
  JSON.stringify({
    source: "https://github.com/NeLy-EPFL/flygym",
    license: "Apache-2.0",
    meshSet: "simplified_max2000faces",
    scale: 1000,
    segments,
  }, null, 2),
);

writeFileSync(
  join(outputRoot, "SOURCE.md"),
  "# NeuroMechFly assets\n\nSimplified NeuroMechFly meshes and rigging metadata from [NeLy-EPFL/flygym](https://github.com/NeLy-EPFL/flygym), used under the Apache License 2.0. Meshes are limited to 2,000 faces per anatomical segment.\n",
);

console.log(`Prepared ${segments.length} articulated segments in ${outputRoot}`);
