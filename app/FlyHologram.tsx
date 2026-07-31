"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

type Action = "rest" | "forward" | "left" | "right";

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

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTint;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  varying vec3 vWorldPosition;

  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDirection))), 2.3);
    float scanWave = sin((vWorldPosition.x - uTime * 0.36) * 28.0);
    float scan = pow(max(0.0, scanWave), 18.0);
    float microGrid = step(0.965, sin(vWorldPosition.y * 74.0) * 0.5 + 0.5) * 0.09;
    float breathing = 0.92 + sin(uTime * 1.7) * 0.08;
    vec3 hot = vec3(0.86, 0.95, 0.44);
    vec3 color = uTint * (0.42 + rim * 1.7) + hot * scan * 0.7 + uTint * microGrid;
    float alpha = (0.09 + rim * 0.58 + scan * 0.24 + microGrid) * uOpacity * breathing;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.92));
  }
`;

function makeMaterial(color: string, opacity = 1): HologramMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  }) as HologramMaterial;
}

function materialFor(name: string, materials: Record<string, HologramMaterial>) {
  if (name.includes("eye")) return materials.eye;
  if (name.includes("wing") || name.includes("haltere")) return materials.wing;
  if (name.includes("tarsus") || name.includes("tibia")) return materials.leg;
  return materials.body;
}

export function FlyHologram({
  motionRef,
  action,
}: {
  motionRef: RefObject<FlyMotion>;
  action: Action;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef(action);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const container: HTMLDivElement = host;

    let disposed = false;
    let animationFrame = 0;
    let lastFrame = 0;
    const lowPower = window.matchMedia("(max-width: 640px), (prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: !lowPower, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.35));
    renderer.setClearColor(0xb9edc7, 1);
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
      segments = lowPower ? 18 : 28,
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
    target.position.set(3.02, 1.62, 0);
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
      body: makeMaterial("#108f8e", 1),
      leg: makeMaterial("#2fb9a8", 0.96),
      wing: makeMaterial("#55aef0", 0.78),
      eye: makeMaterial("#ef5674", 1.08),
    };
    const materialList = Object.values(materials);
    const modelPivot = new THREE.Group();
    const modelRoot = new THREE.Group();
    modelPivot.add(modelRoot);
    scene.add(modelPivot);
    const animatedSegments = new Map<string, THREE.Object3D>();
    const baseQuaternions = new Map<string, THREE.Quaternion>();

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
          }
        }

        for (const segment of manifest.segments) {
          const object = objects.get(segment.name)!;
          const sourceGeometry = geometries.get(segment.mesh);
          if (!sourceGeometry) continue;
          const geometry = sourceGeometry.clone();
          geometry.scale(manifest.scale, segment.mirrorY ? -manifest.scale : manifest.scale, manifest.scale);
          const mesh = new THREE.Mesh(geometry, materialFor(segment.name, materials));
          mesh.frustumCulled = false;
          object.add(mesh);
          if (segment.parent) objects.get(segment.parent)?.add(object);
          else modelRoot.add(object);
        }

        const neuralPoints = [
          new THREE.Vector3(-1.68, 0, 1.34),
          new THREE.Vector3(-0.95, 0, 1.38),
          new THREE.Vector3(-0.15, 0, 1.44),
          new THREE.Vector3(0.55, 0, 1.43),
          new THREE.Vector3(0.95, 0, 1.39),
        ];
        const neuralCurve = new THREE.CatmullRomCurve3(neuralPoints);
        const neuralGeometry = new THREE.TubeGeometry(neuralCurve, 50, 0.018, 6, false);
        const neuralMaterial = new THREE.MeshBasicMaterial({ color: 0xd8ec71, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending });
        const neuralTrace = new THREE.Mesh(neuralGeometry, neuralMaterial);
        modelRoot.add(neuralTrace);
        const pulse = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xfff8ae, blending: THREE.AdditiveBlending }),
        );
        pulse.userData.curve = neuralCurve;
        modelRoot.add(pulse);

        const bounds = new THREE.Box3().setFromObject(modelRoot);
        const thoraxPivot = objects.get("c_thorax")?.getWorldPosition(new THREE.Vector3())
          ?? bounds.getCenter(new THREE.Vector3());
        modelRoot.position.sub(thoraxPivot);
        modelPivot.scale.setScalar(0.38);
        modelPivot.userData.pulse = pulse;
        modelPivot.userData.curve = neuralCurve;
        modelPivot.userData.pivot = thoraxPivot;
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
    function animate(timeMs: number) {
      if (disposed) return;
      animationFrame = requestAnimationFrame(animate);
      if (timeMs - lastFrame < (lowPower ? 50 : 30)) return;
      lastFrame = timeMs;
      const time = timeMs / 1000;
      const moving = actionRef.current !== "rest";
      const turn = actionRef.current === "left" ? -1 : actionRef.current === "right" ? 1 : 0;
      const stride = moving ? 0.24 : 0.025;

      for (const [name, object] of animatedSegments) {
        const base = baseQuaternions.get(name);
        if (!base) continue;
        object.quaternion.copy(base);
        const prefix = name.slice(0, 2);
        const phase = tripodA.has(prefix) ? 0 : Math.PI;
        const wave = Math.sin(time * 8.2 + phase);
        const side = prefix.startsWith("l") ? 1 : -1;
        if (name.endsWith("coxa")) object.rotateZ(wave * stride + turn * side * 0.08);
        if (name.endsWith("trochanterfemur")) object.rotateY(wave * stride * 0.62);
        if (name.endsWith("tibia")) object.rotateY(-wave * stride * 0.48);
      }

      const motion = motionRef.current;
      if (motion) {
        const viewWidth = camera.userData.viewWidth as number ?? 8;
        const viewHeight = camera.userData.viewHeight as number ?? 6.8;
        modelPivot.position.x = (motion.x - 0.5) * viewWidth * 0.76;
        modelPivot.position.y = (0.5 - motion.y) * viewHeight * 0.72;
        // Arena coordinates use a downward-positive Y axis; Three.js uses upward-positive Y.
        modelPivot.rotation.z = -motion.angle;
      }
      modelPivot.position.z = Math.sin(time * 2.2) * 0.025;
      materialList.forEach((material) => { material.uniforms.uTime.value = time; });
      targetRing.scale.setScalar(1 + Math.sin(time * 2.4) * 0.055);
      targetMaterial.opacity = 0.55 + Math.sin(time * 2.4) * 0.12;

      const pulse = modelPivot.userData.pulse as THREE.Mesh | undefined;
      const curve = modelPivot.userData.curve as THREE.CatmullRomCurve3 | undefined;
      const pivot = modelPivot.userData.pivot as THREE.Vector3 | undefined;
      if (pulse && curve && pivot) pulse.position.copy(curve.getPoint((time * 0.22) % 1)).sub(pivot);

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
    <div className="fly-hologram" ref={hostRef}>
      {status !== "ready" && (
        <div className={`model-status ${status}`} role="status">
          <span />
          {status === "loading" ? "ASSEMBLING 69 ANATOMICAL SEGMENTS" : "3D MODEL UNAVAILABLE — CIRCUIT VIEW REMAINS ACTIVE"}
        </div>
      )}
    </div>
  );
}
