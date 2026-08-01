"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

type Action = "rest" | "forward" | "backward" | "left" | "right";
type EscapeState = "ground" | "eating" | "dodge" | "takeoff" | "flight" | "landing" | "groom-head" | "groom-wing-left" | "groom-wing-right" | "relaunch";

export type FlyMotion = {
  x: number;
  y: number;
  angle: number;
};

type Segment = {
  name: string;
  parent: string | null;
  mesh: string;
  mirrorY: boolean;
  pos: [number, number, number];
  quat: [number, number, number, number];
};

type Manifest = {
  scale: number;
  segments: Segment[];
};

type HologramMaterial = THREE.ShaderMaterial & {
  uniforms: {
    uTime: { value: number };
    uTint: { value: THREE.Color };
    uOpacity: { value: number };
  };
};

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const HEAD_GROOM_CYCLE_SPEED = 3.2;
const WING_GROOM_CYCLE_SPEED = 2.7;

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTint;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDirection;

  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDirection))), 2.0);
    float breathing = 0.95 + sin(uTime * 1.7) * 0.05;
    vec3 ice = vec3(0.9, 1.0, 0.97);
    vec3 color = mix(uTint, ice, 0.18 + rim * 0.34) * breathing;
    float alpha = (0.74 + rim * 0.24) * uOpacity;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.98));
  }
`;

function makeMaterial(color: string, opacity = 1, depthWrite = false): HologramMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  }) as HologramMaterial;
}

function materialFor(name: string, materials: Record<string, HologramMaterial>) {
  if (name.includes("eye")) return materials.eye;
  if (name.includes("wing") || name.includes("haltere")) return materials.wing;
  if (/^[lr]f_/.test(name)) return materials.frontLeg;
  if (/^[lr]h_/.test(name)) return materials.hindLeg;
  if (/^[lr][fmh]_/.test(name)) return materials.leg;
  return materials.body;
}

export function FlyHologram({
  motionRef,
  action,
  escapeState,
}: {
  motionRef: RefObject<FlyMotion>;
  action: Action;
  escapeState: EscapeState;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef(action);
  const escapeStateRef = useRef<EscapeState>(escapeState);
  const phaseStartedRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    const previous = escapeStateRef.current;
    escapeStateRef.current = escapeState;
    if (escapeState === "ground") {
      phaseStartedRef.current = null;
    } else if (escapeState !== previous && !(previous === "dodge" && escapeState === "takeoff")) {
      phaseStartedRef.current = performance.now() / 1000;
    }
  }, [escapeState]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const container: HTMLDivElement = host;

    let disposed = false;
    let animationFrame = 0;
    let lastFrame = 0;
    const compactViewport = window.matchMedia("(max-width: 640px)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactViewport ? 2 : 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Interactive holographic NeuroMechFly model in a miniature foraging garden");
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xb9edc7, 0.025);
    const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, 40);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);

    const worldMaterials: THREE.Material[] = [];
    const worldMaterial = (color: number, opacity = 1) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity === 1,
      });
      worldMaterials.push(material);
      return material;
    };
    const lineMaterial = (color: number, opacity = 1) => {
      const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
      worldMaterials.push(material);
      return material;
    };

    const palette = {
      ground: worldMaterial(0xb9edc7),
      groundLight: worldMaterial(0xd3f6d1, 0.82),
      moss: worldMaterial(0x75d5aa),
      mossDark: worldMaterial(0x4eb890),
      leaf: worldMaterial(0x49aa83),
      leafLight: worldMaterial(0x87dfa4),
      leafShade: worldMaterial(0x2e856f),
      petalPink: worldMaterial(0xffa9c4),
      petalBlush: worldMaterial(0xffd3df),
      petalCream: worldMaterial(0xfff3c7),
      flower: worldMaterial(0xffcf70),
      flowerShade: worldMaterial(0xe78082, 0.38),
      water: worldMaterial(0x7fdbd3, 0.78),
      waterShine: worldMaterial(0xe8fff3, 0.72),
      vein: lineMaterial(0x246e61, 0.72),
      grass: lineMaterial(0x308e72, 0.72),
      grassLight: lineMaterial(0x71c994, 0.8),
    };

    const world = new THREE.Group();
    world.name = "peachdrop-micro-garden";
    // The illustrated Peachdrop Garden now supplies the navigable ground.
    // Keep the former procedural scenery out of the render while retaining
    // the animated fruit target and fly in this transparent WebGL layer.
    world.visible = false;
    scene.add(world);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), palette.ground);
    ground.position.z = -1.25;
    world.add(ground);

    function addDisc(
      x: number,
      y: number,
      radiusX: number,
      radiusY: number,
      rotation: number,
      material: THREE.Material,
      z = -0.9,
      segments = compactViewport ? 22 : 28,
    ) {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, segments), material);
      mesh.position.set(x, y, z);
      mesh.scale.set(radiusX, radiusY, 1);
      mesh.rotation.z = rotation;
      world.add(mesh);
      return mesh;
    }

    // Soft, irregular ground patches replace the old diagram-like grid. At this
    // scale, a single leaf is a landscape and a dew drop is nearly fly-sized.
    addDisc(-2.55, -2.1, 2.8, 1.05, -0.12, palette.moss, -1.14);
    addDisc(-3.25, -2.35, 1.75, 0.76, 0.1, palette.groundLight, -1.11);
    addDisc(2.45, 2.45, 2.55, 0.95, 0.12, palette.moss, -1.14);
    addDisc(3.55, -2.65, 1.85, 0.9, -0.08, palette.groundLight, -1.12);

    function addBlade(x: number, y: number, height: number, lean: number, material: THREE.LineBasicMaterial) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x, y, -0.91),
        new THREE.Vector3(x + lean * 0.35, y + height * 0.6, -0.88),
        new THREE.Vector3(x + lean, y + height, -0.84),
      );
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(12)), material));
    }

    [
      [-4.4, -3.2, 2.0, 0.7], [-4.0, -3.3, 2.45, -0.25], [-3.55, -3.4, 1.75, 0.35],
      [-2.8, -3.45, 1.5, -0.4], [2.6, -3.45, 1.7, 0.45], [3.05, -3.4, 2.15, -0.25],
      [3.55, -3.35, 2.35, 0.48], [4.05, -3.25, 1.85, -0.55], [-4.2, 2.0, 1.5, 0.5],
      [3.65, 2.05, 1.55, -0.55],
    ].forEach(([x, y, height, lean], index) => addBlade(x, y, height, lean, index % 2 ? palette.grass : palette.grassLight));

    function addLeaf(x: number, y: number, scale: number, rotation: number, light = false) {
      addDisc(x + 0.055, y - 0.075, 0.52 * scale, 1.04 * scale, rotation, palette.leafShade, -0.9);
      addDisc(x, y, 0.49 * scale, 1 * scale, rotation, light ? palette.leafLight : palette.leaf, -0.86);
      const direction = new THREE.Vector2(Math.sin(rotation), Math.cos(rotation)).multiplyScalar(0.75 * scale);
      const vein = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x - direction.x, y - direction.y, -0.83),
          new THREE.Vector3(x + direction.x, y + direction.y, -0.83),
        ]),
        palette.vein,
      );
      world.add(vein);
    }

    addLeaf(-3.92, 1.78, 1.3, -0.6);
    addLeaf(-3.15, 2.42, 1.02, 0.68, true);
    addLeaf(3.68, -1.92, 1.18, 0.56);
    addLeaf(2.88, -2.62, 1.02, -0.52, true);

    function addFlower(x: number, y: number, scale: number, blush = false) {
      for (let petal = 0; petal < 7; petal += 1) {
        const angle = (petal / 7) * Math.PI * 2;
        addDisc(
          x + Math.cos(angle) * 0.36 * scale + 0.045,
          y + Math.sin(angle) * 0.36 * scale - 0.07,
          0.24 * scale,
          0.52 * scale,
          angle - Math.PI / 2,
          palette.flowerShade,
          -0.84,
          18,
        );
        addDisc(
          x + Math.cos(angle) * 0.36 * scale,
          y + Math.sin(angle) * 0.36 * scale,
          0.22 * scale,
          0.5 * scale,
          angle - Math.PI / 2,
          blush ? palette.petalBlush : palette.petalPink,
          -0.8,
          18,
        );
      }
      addDisc(x + 0.025, y - 0.035, 0.31 * scale, 0.31 * scale, 0, palette.flowerShade, -0.77, 22);
      addDisc(x, y, 0.28 * scale, 0.28 * scale, 0, palette.flower, -0.73, 22);
      for (let seed = 0; seed < 7; seed += 1) {
        const angle = seed * 2.4;
        const radius = 0.16 * scale * (0.35 + (seed % 3) * 0.22);
        addDisc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 0.022 * scale, 0.022 * scale, 0, palette.petalCream, -0.7, 10);
      }
    }

    addFlower(-4.05, 2.9, 1.82);
    addFlower(-2.35, 3.35, 1.28, true);
    addFlower(3.95, 3.12, 1.58, true);
    addFlower(4.48, -2.75, 1.55);

    function addDewDrop(x: number, y: number, scale: number) {
      addDisc(x + 0.05, y - 0.08, 0.44 * scale, 0.36 * scale, -0.12, palette.leafShade, -0.79);
      addDisc(x, y, 0.42 * scale, 0.35 * scale, -0.12, palette.water, -0.73);
      addDisc(x - 0.13 * scale, y + 0.11 * scale, 0.1 * scale, 0.06 * scale, -0.25, palette.waterShine, -0.68, 14);
    }

    addDewDrop(-2.72, 0.92, 1.25);
    addDewDrop(1.08, -2.18, 0.92);
    addDewDrop(3.72, 0.02, 0.72);

    const target = new THREE.Group();
    const targetMaterial = new THREE.MeshBasicMaterial({ color: 0xfff39a, transparent: true, opacity: 0.72 });
    const fruitSkinMaterial = new THREE.MeshBasicMaterial({ color: 0xe95f7d });
    const fruitFleshMaterial = new THREE.MeshBasicMaterial({ color: 0xffbb79 });
    const fruitGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xffe0a6 });
    const fruitSeedMaterial = new THREE.MeshBasicMaterial({ color: 0xa94f5d });
    worldMaterials.push(targetMaterial, fruitSkinMaterial, fruitFleshMaterial, fruitGlowMaterial, fruitSeedMaterial);
    const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.035, 10, 48), targetMaterial);
    targetRing.position.z = -0.05;
    const fruitSkin = new THREE.Mesh(new THREE.CircleGeometry(0.58, 32), fruitSkinMaterial);
    const fruitFlesh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), fruitFleshMaterial);
    fruitFlesh.position.z = 0.012;
    const fruitGlow = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), fruitGlowMaterial);
    fruitGlow.position.set(-0.08, 0.07, 0.024);
    target.add(targetRing, fruitSkin, fruitFlesh, fruitGlow);
    [[-0.18, 0.17], [0.08, 0.21], [0.2, -0.04], [-0.06, -0.2], [-0.24, -0.08]].forEach(([x, y]) => {
      const seed = new THREE.Mesh(new THREE.CircleGeometry(0.028, 10), fruitSeedMaterial);
      seed.position.set(x, y, 0.035);
      seed.scale.set(0.72, 1.25, 1);
      target.add(seed);
    });
    // Align the fruit with the reachable edge of the fly's normalized arena.
    target.position.set(2.65, 1.56, 0);
    target.visible = false;
    scene.add(target);

    const scentDots: Array<[number, number, number, number]> = [
      [2.28, 1.94, 0.085, 0.44],
      [1.7, 2.08, 0.067, 0.34],
      [1.16, 2.0, 0.05, 0.25],
      [0.68, 1.77, 0.038, 0.18],
    ];
    scentDots.forEach(([x, y, radius, opacity]) => {
      const scentMaterial = worldMaterial(0xffd170, opacity);
      addDisc(x, y, radius, radius, 0, scentMaterial, -0.18, 14);
    });

    const materials = {
      body: makeMaterial("#27c9ab", 1.22, true),
      // The articulated leg meshes are hair-thin at phone scale. A darker
      // material preserves their silhouette against the moss without turning
      // the whole animal back into a dark blob.
      leg: makeMaterial("#07584d", 1.36, true),
      frontLeg: makeMaterial("#07584d", 1.36, true),
      hindLeg: makeMaterial("#07584d", 1.36, true),
      wing: makeMaterial("#a9d7ff", 0.52),
      eye: makeMaterial("#ff5f79", 1.28, true),
    };
    const materialList = Object.values(materials);
    const makeLegOutlineMaterial = () => new THREE.MeshBasicMaterial({
        color: 0x032f2a,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: true,
      });
    const legOutlineMaterial = makeLegOutlineMaterial();
    const frontLegOutlineMaterial = makeLegOutlineMaterial();
    const hindLegOutlineMaterial = makeLegOutlineMaterial();
    worldMaterials.push(legOutlineMaterial, frontLegOutlineMaterial, hindLegOutlineMaterial);
    const modelPivot = new THREE.Group();
    const modelRoot = new THREE.Group();
    modelPivot.add(modelRoot);
    scene.add(modelPivot);
    const animatedSegments = new Map<string, THREE.Object3D>();
    const wingSegments = new Map<string, THREE.Object3D>();
    const baseQuaternions = new Map<string, THREE.Quaternion>();
    const basePositions = new Map<string, THREE.Vector3>();
    const legMeshes = new Map<string, THREE.Mesh>();
    const legOutlines = new Map<string, THREE.Mesh>();

    const loader = new STLLoader();

    async function loadModel() {
      try {
        const manifestResponse = await fetch(`${assetBase}/neuromechfly/manifest.json`);
        if (!manifestResponse.ok) throw new Error("NeuroMechFly manifest unavailable");
        const manifest = await manifestResponse.json() as Manifest;
        const uniqueMeshes = [...new Set(manifest.segments.map((segment) => segment.mesh))];
        const loaded = await Promise.all(uniqueMeshes.map(async (meshName) => {
          const geometry = await loader.loadAsync(`${assetBase}/neuromechfly/mesh/${meshName}`);
          geometry.computeVertexNormals();
          return [meshName, geometry] as const;
        }));
        if (disposed) return;

        const geometries = new Map(loaded);
        const objects = new Map<string, THREE.Object3D>();
        for (const segment of manifest.segments) {
          const object = new THREE.Group();
          object.name = segment.name;
          object.position.fromArray(segment.pos);
          object.quaternion.set(segment.quat[1], segment.quat[2], segment.quat[3], segment.quat[0]);
          objects.set(segment.name, object);
          if (/^[lr][fmh]_(coxa|tibia|trochanterfemur)$/.test(segment.name)) {
            animatedSegments.set(segment.name, object);
            baseQuaternions.set(segment.name, object.quaternion.clone());
            basePositions.set(segment.name, object.position.clone());
          }
          if (/^[lr]_wing$/.test(segment.name)) {
            wingSegments.set(segment.name, object);
            baseQuaternions.set(segment.name, object.quaternion.clone());
            basePositions.set(segment.name, object.position.clone());
          }
        }

        for (const segment of manifest.segments) {
          const object = objects.get(segment.name)!;
          const sourceGeometry = geometries.get(segment.mesh);
          if (!sourceGeometry) continue;
          const geometry = sourceGeometry.clone();
          geometry.scale(manifest.scale, segment.mirrorY ? -manifest.scale : manifest.scale, manifest.scale);
          const mesh = new THREE.Mesh(geometry, materialFor(segment.name, materials));
          const isWing = segment.name.includes("wing") || segment.name.includes("haltere");
          const isEye = segment.name.includes("eye");
          const isLeg = /^[lr][fmh]_/.test(segment.name);
          mesh.renderOrder = isWing ? 0 : isEye ? 4 : isLeg ? 3 : 2;
          mesh.frustumCulled = false;
          if (isLeg) {
            // A subtle back-face shell thickens the real leg geometry by a few
            // screen pixels. It remains an anatomical mesh, not a drawn tracer.
            const outlineGeometry = geometry.clone();
            // NeuroMechFly leg files run along local Z, so thicken X/Y without
            // making the limbs cartoonishly longer.
            outlineGeometry.scale(1.46, 1.46, 1.02);
            const outlineMaterial = /^[lr]f_/.test(segment.name)
              ? frontLegOutlineMaterial
              : /^[lr]h_/.test(segment.name)
                ? hindLegOutlineMaterial
                : legOutlineMaterial;
            const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
            outline.renderOrder = 2.5;
            outline.frustumCulled = false;
            object.add(outline);
            legMeshes.set(segment.name, mesh);
            legOutlines.set(segment.name, outline);
          }
          object.add(mesh);
          if (segment.parent) objects.get(segment.parent)?.add(object);
          else modelRoot.add(object);
        }

        const bounds = new THREE.Box3().setFromObject(modelRoot);
        const thoraxPivot = objects.get("c_thorax")?.getWorldPosition(new THREE.Vector3())
          ?? bounds.getCenter(new THREE.Vector3());
        modelRoot.position.sub(thoraxPivot);
        modelPivot.scale.setScalar(compactViewport ? 0.43 : 0.38);
        setStatus("ready");
      } catch (error) {
        console.error(error);
        if (!disposed) setStatus("error");
      }
    }

    void loadModel();

    function resize() {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      const viewHeight = 6.8;
      const viewWidth = viewHeight * (width / height);
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      camera.userData.viewWidth = viewWidth;
      camera.userData.viewHeight = viewHeight;
    }

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const tripodA = new Set(["lf", "rm", "lh"]);
    const animationStart = performance.now() / 1000;
    let displayedStride = 0.025;
    let displayedTurn = 0;
    function animate(timeMs: number) {
      if (disposed) return;
      animationFrame = requestAnimationFrame(animate);
      if (timeMs - lastFrame < (reducedMotion ? 50 : 30)) return;
      const frameDelta = Math.min((timeMs - lastFrame) / 1000, 0.08);
      lastFrame = timeMs;
      const time = timeMs / 1000;
      const sceneState = escapeStateRef.current;
      const flying = sceneState === "dodge" || sceneState === "takeoff" || sceneState === "flight" || sceneState === "landing" || sceneState === "relaunch";
      const eating = sceneState === "eating";
      const groomingHead = sceneState === "groom-head";
      const groomingWing = sceneState === "groom-wing-left" || sceneState === "groom-wing-right";
      const grooming = groomingHead || groomingWing;
      const phaseAge = phaseStartedRef.current === null ? 0 : Math.max(0, time - phaseStartedRef.current);
      const groomingPose = Math.min(1, phaseAge / 0.55);
      const moving = !flying && !grooming && actionRef.current !== "rest";
      const turn = actionRef.current === "left" ? -1 : actionRef.current === "right" ? 1 : 0;
      const gaitDirection = actionRef.current === "backward" ? -1 : 1;
      const easing = Math.min(1, frameDelta * 8);
      displayedStride += ((moving ? 0.24 : 0.025) - displayedStride) * easing;
      displayedTurn += (turn - displayedTurn) * easing;

      // Bring only the actively grooming legs to the foreground. The model's
      // leg axes point mostly into the dorsal camera, so depth testing made a
      // biologically correct raised leg disappear beneath the thorax.
      materials.frontLeg.depthTest = !groomingHead;
      materials.frontLeg.depthWrite = !groomingHead;
      materials.frontLeg.uniforms.uTint.value.set(groomingHead ? "#8ff1d2" : "#07584d");
      materials.frontLeg.uniforms.uOpacity.value = groomingHead ? 1.62 : 1.36;
      frontLegOutlineMaterial.depthTest = !groomingHead;
      materials.hindLeg.depthTest = !groomingWing;
      materials.hindLeg.depthWrite = !groomingWing;
      materials.hindLeg.uniforms.uTint.value.set(groomingWing ? "#8ff1d2" : "#07584d");
      materials.hindLeg.uniforms.uOpacity.value = groomingWing ? 1.58 : 1.36;
      hindLegOutlineMaterial.depthTest = !groomingWing;
      for (const [name, mesh] of legMeshes) {
        const emphasized = groomingHead ? /^[lr]f_/.test(name) : groomingWing && /^[lr]h_/.test(name);
        mesh.renderOrder = emphasized ? 6 : 3;
        const outline = legOutlines.get(name);
        if (outline) outline.renderOrder = emphasized ? 5.8 : 2.5;
      }

      for (const [name, object] of animatedSegments) {
        const base = baseQuaternions.get(name);
        const basePosition = basePositions.get(name);
        if (!base) continue;
        object.quaternion.copy(base);
        if (basePosition) object.position.copy(basePosition);
        const prefix = name.slice(0, 2);
        const phase = tripodA.has(prefix) ? 0 : Math.PI;
        const wave = Math.sin(time * 8.2 + phase) * gaitDirection;
        const side = prefix.startsWith("l") ? 1 : -1;
        if (groomingHead) {
          const isFrontLeg = prefix.endsWith("f");
          const sweepPhase = phaseAge * HEAD_GROOM_CYCLE_SPEED + (side > 0 ? 0 : Math.PI);
          const sweep = Math.sin(sweepPhase);
          const reach = 0.5 + 0.5 * sweep;
          if (isFrontLeg) {
            if (name.endsWith("coxa")) {
              object.position.z += 0.52 * groomingPose;
              object.rotateY((-0.42 - reach * 0.16) * groomingPose);
              object.rotateX(-side * (0.24 + reach * 0.14) * groomingPose);
            }
            if (name.endsWith("trochanterfemur")) {
              object.rotateY((-0.78 - reach * 0.34) * groomingPose);
              object.rotateX(-side * (0.52 - reach * 0.14) * groomingPose);
              object.rotateZ(side * sweep * 0.12 * groomingPose);
            }
            if (name.endsWith("tibia")) {
              object.rotateY((1.08 - reach * 0.26) * groomingPose);
              object.rotateX(side * (0.2 + sweep * 0.08) * groomingPose);
            }
          } else {
            if (name.endsWith("coxa")) object.rotateZ(side * 0.07);
            if (name.endsWith("trochanterfemur")) object.rotateY(-0.08);
            if (name.endsWith("tibia")) object.rotateY(0.12);
          }
          continue;
        }
        if (groomingWing) {
          const isHindLeg = prefix.endsWith("h");
          const selectedSide = sceneState === "groom-wing-left" ? 1 : -1;
          const ipsilateral = side === selectedSide;
          const polishPhase = phaseAge * WING_GROOM_CYCLE_SPEED + (ipsilateral ? 0 : 0.42);
          const sweep = 0.5 + 0.5 * Math.sin(polishPhase);
          if (isHindLeg) {
            if (name.endsWith("coxa")) {
              object.position.z += 0.62 * groomingPose;
              object.rotateY((-0.3 - sweep * 0.12) * groomingPose);
              object.rotateX(selectedSide * ((ipsilateral ? 0.26 : 0.52) + sweep * 0.12) * groomingPose);
            }
            if (name.endsWith("trochanterfemur")) {
              object.rotateY((-0.56 - sweep * 0.24) * groomingPose);
              object.rotateX(selectedSide * ((ipsilateral ? 0.42 : 0.76) + sweep * 0.16) * groomingPose);
              object.rotateZ(side * (0.08 + sweep * 0.1) * groomingPose);
            }
            if (name.endsWith("tibia")) {
              object.rotateY((0.86 + sweep * 0.3) * groomingPose);
              object.rotateX(-selectedSide * (0.16 + sweep * 0.12) * groomingPose);
            }
          } else {
            if (name.endsWith("coxa")) object.rotateZ(side * 0.06);
            if (name.endsWith("trochanterfemur")) object.rotateY(-0.06);
            if (name.endsWith("tibia")) object.rotateY(0.1);
          }
          continue;
        }
        if (flying) {
          if (name.endsWith("coxa")) object.rotateZ(side * 0.18);
          if (name.endsWith("trochanterfemur")) object.rotateY(-0.28);
          if (name.endsWith("tibia")) object.rotateY(0.42);
          continue;
        }
        if (name.endsWith("coxa")) object.rotateZ(wave * displayedStride + displayedTurn * side * 0.08);
        if (name.endsWith("trochanterfemur")) object.rotateY(wave * displayedStride * 0.62);
        if (name.endsWith("tibia")) object.rotateY(-wave * displayedStride * 0.48);
      }

      // A short, occasional wing shimmy makes the resting fly feel alert without
      // reading as flight. The two wings move slightly out of phase and settle
      // back onto their exact authored poses between bursts.
      const wingCycle = (time - animationStart) % 5.8;
      const wingWindow = wingCycle - 1.35;
      const wingEnvelope = !flying && !grooming && turn === 0 && wingWindow >= 0 && wingWindow < 0.72
        ? Math.sin((wingWindow / 0.72) * Math.PI) ** 2
        : 0;
      for (const [name, object] of wingSegments) {
        const base = baseQuaternions.get(name);
        const basePosition = basePositions.get(name);
        if (!base) continue;
        object.quaternion.copy(base);
        if (basePosition) object.position.copy(basePosition);
        const side = name.startsWith("l") ? 1 : -1;
        const phase = name.startsWith("l") ? 0 : 0.65;
        const flutter = 0.18 + 0.1 * (0.5 + 0.5 * Math.sin(wingWindow * 34 + phase));
        const groomingThisWing = groomingWing && (sceneState === "groom-wing-left" ? name.startsWith("l") : name.startsWith("r"));
        if (groomingThisWing) {
          // Wing grooming is a held posterior-lateral presentation, not a
          // backwards-looking flap. The legs provide the polishing motion.
          const polish = 0.5 + 0.5 * Math.sin(phaseAge * WING_GROOM_CYCLE_SPEED);
          object.position.x -= 0.035 * groomingPose;
          object.position.y += side * 0.035 * groomingPose;
          object.rotateZ(-side * (0.16 + polish * 0.035) * groomingPose);
          object.rotateX((0.07 + polish * 0.025) * groomingPose);
        } else {
          const flick = flying
            ? 0.68 + Math.sin(time * 58 + phase) * 0.38
            : groomingWing
              ? 0
              : wingEnvelope * flutter;
          object.rotateZ(side * flick);
          object.rotateX(flick * (flying ? 0.56 : 0.24));
        }
      }

      const motion = motionRef.current;
      if (motion) {
        const viewWidth = camera.userData.viewWidth as number ?? 8;
        const viewHeight = camera.userData.viewHeight as number ?? 6.8;
        modelPivot.position.x = (motion.x - 0.5) * viewWidth * 0.76;
        modelPivot.position.y = (0.5 - motion.y) * viewHeight * 0.72;
        // Arena coordinates use a downward-positive Y axis; Three.js uses upward-positive Y.
        modelPivot.rotation.z = -motion.angle;
        modelPivot.rotation.x = 0;
        modelPivot.rotation.y = 0;
        const baseModelScale = compactViewport ? 0.43 : 0.38;
        modelPivot.scale.setScalar(baseModelScale);

        if (eating) {
          const nibble = Math.sin(time * 10.5);
          modelPivot.position.y += nibble * 0.025;
          modelPivot.rotation.z += nibble * 0.018;
          modelPivot.scale.setScalar(baseModelScale * (1 + Math.max(0, nibble) * 0.018));
        }

        if (groomingHead) {
          const sweep = Math.sin(phaseAge * HEAD_GROOM_CYCLE_SPEED);
          modelPivot.position.y += Math.abs(sweep) * 0.018;
          modelPivot.rotation.z += sweep * 0.018;
          // A small three-quarter tilt exposes the real front-leg meshes that
          // otherwise sit beneath the body in the dorsal world camera.
          modelPivot.rotation.x = 0.16 + Math.abs(sweep) * 0.035;
          modelPivot.rotation.y = sweep * 0.04;
          modelPivot.scale.setScalar(baseModelScale * (1.24 - Math.abs(sweep) * 0.014));
        }

        if (groomingWing) {
          const polish = Math.sin(phaseAge * WING_GROOM_CYCLE_SPEED);
          const selectedSide = sceneState === "groom-wing-left" ? 1 : -1;
          modelPivot.position.x += selectedSide * Math.abs(polish) * 0.014;
          modelPivot.rotation.z += selectedSide * (0.035 + polish * 0.012);
          modelPivot.rotation.x = 0.13 + Math.abs(polish) * 0.025;
          modelPivot.rotation.y = selectedSide * 0.1;
          modelPivot.scale.setScalar(baseModelScale * (1.2 + Math.abs(polish) * 0.018));
        }

        if (flying && phaseStartedRef.current !== null) {
          const takeoff = Math.min(1, phaseAge / (sceneState === "dodge" ? 0.42 : 0.9));
          const landing = Math.min(1, phaseAge / 1.05);
          const lift = sceneState === "dodge" || sceneState === "takeoff" || sceneState === "relaunch"
            ? 1 - (1 - takeoff) ** 3
            : sceneState === "landing"
              ? (1 - landing) ** 2
              : 1;
          const cruise = sceneState === "flight" ? Math.sin(time * 2.6) : 0;
          const wingLift = sceneState === "flight" ? Math.sin(time * 9.5) : 0;
          modelPivot.position.x += viewWidth * cruise * 0.004;
          modelPivot.position.y += viewHeight * (cruise * 0.006 + wingLift * 0.004);
          modelPivot.rotation.z += displayedTurn * (sceneState === "dodge" ? 0.15 : 0.055) + cruise * 0.025;
          modelPivot.rotation.x = lift * ((sceneState === "dodge" ? 0.14 : 0.07) + wingLift * 0.018);
          modelPivot.rotation.y = displayedTurn * (sceneState === "dodge" ? 0.28 : 0.13);
          modelPivot.scale.setScalar(baseModelScale * (1 + lift * 0.13 + wingLift * 0.012));
        }
      }
      modelPivot.position.z = Math.sin(time * 2.2) * 0.025;
      materialList.forEach((material) => { material.uniforms.uTime.value = time; });
      targetRing.scale.setScalar(1 + Math.sin(time * 2.4) * 0.055);
      targetMaterial.opacity = 0.55 + Math.sin(time * 2.4) * 0.12;

      renderer.render(scene, camera);
    }
    animationFrame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      container.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose();
      });
      materialList.forEach((material) => material.dispose());
      worldMaterials.forEach((material) => material.dispose());
      renderer.dispose();
    };
  }, [motionRef]);

  return (
    <div
      className="fly-hologram"
      ref={hostRef}
    >
      {status !== "ready" && (
        <div className={`model-status ${status}`} role="status">
          <span />
          {status === "loading" ? "ASSEMBLING 69 ANATOMICAL SEGMENTS" : "3D MODEL UNAVAILABLE — CIRCUIT VIEW REMAINS ACTIVE"}
        </div>
      )}
    </div>
  );
}
