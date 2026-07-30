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
    blending: THREE.AdditiveBlending,
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

    let disposed = false;
    let animationFrame = 0;
    let lastFrame = 0;
    const lowPower = window.matchMedia("(max-width: 640px), (prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: !lowPower, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.35));
    renderer.setClearColor(0xdfe3c9, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Interactive holographic NeuroMechFly model in a walking arena");
    renderer.domElement.setAttribute("role", "img");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xdfe3c9, 0.055);
    const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, 40);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);

    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x52674e, transparent: true, opacity: 0.13 });
    const gridPoints: THREE.Vector3[] = [];
    for (let value = -8; value <= 8; value += 0.5) {
      gridPoints.push(new THREE.Vector3(-12, value, -1), new THREE.Vector3(12, value, -1));
      gridPoints.push(new THREE.Vector3(value, -12, -1), new THREE.Vector3(value, 12, -1));
    }
    const gridGeometry = new THREE.BufferGeometry().setFromPoints(gridPoints);
    scene.add(new THREE.LineSegments(gridGeometry, gridMaterial));

    const target = new THREE.Group();
    const targetMaterial = new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.78 });
    const targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.026, 10, 40), targetMaterial);
    const targetCore = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), targetMaterial);
    target.add(targetRing, targetCore);
    target.position.set(3.1, 1.45, 0);
    scene.add(target);

    const materials = {
      body: makeMaterial("#68d6c4", 1),
      leg: makeMaterial("#b7f6df", 0.93),
      wing: makeMaterial("#8ac7ff", 0.72),
      eye: makeMaterial("#ff7f6e", 1.08),
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
        const manifestResponse = await fetch("/neuromechfly/manifest.json");
        if (!manifestResponse.ok) throw new Error("NeuroMechFly manifest unavailable");
        const manifest = await manifestResponse.json() as Manifest;
        const uniqueMeshes = [...new Set(manifest.segments.map((segment) => segment.mesh))];
        const loaded = await Promise.all(uniqueMeshes.map(async (meshName) => {
          const geometry = await loader.loadAsync(`/neuromechfly/mesh/${meshName}`);
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
        const center = bounds.getCenter(new THREE.Vector3());
        modelRoot.position.sub(center);
        modelPivot.scale.setScalar(0.72);
        modelPivot.userData.pulse = pulse;
        modelPivot.userData.curve = neuralCurve;
        modelPivot.userData.center = center;
        setStatus("ready");
      } catch (error) {
        console.error(error);
        if (!disposed) setStatus("error");
      }
    }

    void loadModel();

    function resize() {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
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
    observer.observe(host);
    resize();

    const tripodA = new Set(["lf", "rm", "lh"]);
    function animate(timeMs: number) {
      if (disposed) return;
      animationFrame = requestAnimationFrame(animate);
      if (timeMs - lastFrame < (lowPower ? 50 : 30)) return;
      lastFrame = timeMs;
      const time = timeMs / 1000;
      const moving = actionRef.current !== "rest";
      const turn = actionRef.current === "left" ? 1 : actionRef.current === "right" ? -1 : 0;
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
        modelPivot.rotation.z = motion.angle;
      }
      modelPivot.position.z = Math.sin(time * 2.2) * 0.025;
      materialList.forEach((material) => { material.uniforms.uTime.value = time; });
      targetRing.scale.setScalar(1 + Math.sin(time * 2.4) * 0.12);
      targetMaterial.opacity = 0.62 + Math.sin(time * 2.4) * 0.16;

      const pulse = modelPivot.userData.pulse as THREE.Mesh | undefined;
      const curve = modelPivot.userData.curve as THREE.CatmullRomCurve3 | undefined;
      const center = modelPivot.userData.center as THREE.Vector3 | undefined;
      if (pulse && curve && center) pulse.position.copy(curve.getPoint((time * 0.22) % 1)).sub(center);

      renderer.render(scene, camera);
    }
    animationFrame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) object.geometry.dispose();
      });
      materialList.forEach((material) => material.dispose());
      gridMaterial.dispose();
      targetMaterial.dispose();
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
