// Render stage: renderer, post-processing, hangar environment, camera rig and frame loop.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { skyDome, gridFloor, starfield } from './effects.js';
import { M } from './materials.js';

const ENV = {
  hangar: { top: 0x05080d, horizon: 0x142233, bottom: 0x05070a, glow: 0x2a3a4c, grid: 0x3c5878, stars: 0 },
  blueprint: { top: 0x0a2a4c, horizon: 0x103a64, bottom: 0x0a2440, glow: 0x0f3a66, grid: 0x8cc4ff, stars: 0 },
  space: { top: 0x000000, horizon: 0x02040a, bottom: 0x000000, glow: 0x0a1424, grid: 0x3c5878, stars: 1 },
};

/** World-space bounds of the solid (non-effect, visible) meshes under an object. */
export function solidBounds(root) {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || o.userData.fx || !o.geometry) return;
    let vis = true;
    for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
    if (!vis) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    box.union(tmp);
  });
  return box;
}

export class Stage {
  constructor(container) {
    this.container = container;
    this.frameHooks = new Set();
    this.clock = new THREE.Clock();
    this.time = 0;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'gl';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'label-layer';
    container.appendChild(this.labels.domElement);

    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.32;
    scene.fog = new THREE.Fog(0x070b11, 60, 260);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 4000);
    this.camera.position.set(14, 7, 16);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 220;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.target.set(0, 2.5, 0);

    // sky + stars are shared by every environment
    this.sky = skyDome();
    scene.add(this.sky);
    this.stars = starfield();
    scene.add(this.stars);

    // ---------------------------------------------------------- hangar bay
    const hangar = new THREE.Group();
    this.hangar = hangar;
    scene.add(hangar);

    const hemi = new THREE.HemisphereLight(0x9fb8d8, 0x2a323c, 0.6);
    const key = new THREE.DirectionalLight(0xfff1de, 2.1);
    key.position.set(12, 22, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 70;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight(0x7fc8ff, 1.3);
    rim.position.set(-14, 9, -12);
    const fill = new THREE.DirectionalLight(0xffc27a, 0.35);
    fill.position.set(-6, 3, 14);
    this.lights = { hemi, key, rim, fill };
    scene.add(hemi, key, key.target, rim, fill);

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.8, 0.35, 96), M.pad());
    platform.position.y = -0.175;
    platform.receiveShadow = true;
    const deck = new THREE.Mesh(new THREE.CircleGeometry(8.3, 96), new THREE.MeshStandardMaterial({ color: 0x10151b, roughness: 0.88, metalness: 0.15 }));
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.002;
    deck.receiveShadow = true;
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x1a1000, emissive: 0xffb000, emissiveIntensity: 1.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8.42, 0.035, 8, 160), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    const ticks = new THREE.Group();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const big = i % 6 === 0;
      const t = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.5 : 0.22, 0.01, 0.03), new THREE.MeshBasicMaterial({ color: big ? 0x8aa0b8 : 0x3a4a5c }));
      t.position.set(Math.cos(a) * 7.9, 0.012, Math.sin(a) * 7.9);
      t.rotation.y = -a;
      ticks.add(t);
    }
    this.ringMat = ringMat;
    this.grid = gridFloor();
    this.grid.position.y = -0.36;
    hangar.add(platform, deck, ring, ticks, this.grid);
    for (const o of [platform, deck, ring, ticks]) o.traverse((c) => { c.userData.fx = true; });
    this.platform = { platform, deck, ring, ticks };

    // vehicle holder
    this.holder = new THREE.Group();
    scene.add(this.holder);

    // ---------------------------------------------------------- post
    const composer = new EffectComposer(renderer);
    this.composer = composer;
    composer.addPass(new RenderPass(scene, this.camera));
    this.outline = new OutlinePass(new THREE.Vector2(256, 256), scene, this.camera);
    this.outline.edgeStrength = 4;
    this.outline.edgeGlow = 0.4;
    this.outline.edgeThickness = 1.2;
    this.outline.visibleEdgeColor.set(0xffb000);
    this.outline.hiddenEdgeColor.set(0x664400);
    composer.addPass(this.outline);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 1.05);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());

    this.tween = null;
    this.env = 'hangar';
    this.setEnvironment('hangar', true);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.fps = 60;
    this._fpsAcc = 0; this._fpsN = 0;
    this.running = true;
    renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onFrame(fn) { this.frameHooks.add(fn); return () => this.frameHooks.delete(fn); }

  frame() {
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.1);
    this.time += dt;
    this._fpsAcc += raw; this._fpsN++;
    if (this._fpsAcc > 0.5) { this.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; }
    if (this.tween) this.stepTween(dt);
    for (const fn of this.frameHooks) fn(dt, this.time);
    this.controls.update();
    this.ringMat.emissiveIntensity = 1.3 + Math.sin(this.time * 1.4) * 0.25;
    this.composer.render();
    this.labels.render(this.scene, this.camera);
  }

  /** Blend sky + grid colours to a named environment. */
  setEnvironment(name, instant = false) {
    this.env = name;
    const e = ENV[name];
    this._envTarget = e || null;      // unknown name = 'custom': sky is driven directly via setSky()
    if (e && instant) this.applyEnv(e, 1);
  }

  applyEnv(e, k) {
    const u = this.sky.material.uniforms;
    u.top.value.lerp(new THREE.Color(e.top), k);
    u.horizon.value.lerp(new THREE.Color(e.horizon), k);
    u.bottom.value.lerp(new THREE.Color(e.bottom), k);
    u.glow.value.lerp(new THREE.Color(e.glow), k);
    this.grid.material.uniforms.color.value.lerp(new THREE.Color(e.grid), k);
    this.stars.material.opacity += (e.stars - this.stars.material.opacity) * k;
  }

  /** Override the sky gradient directly (used by the launch ascent). */
  setSky(top, horizon, bottom, starOpacity) {
    const u = this.sky.material.uniforms;
    u.top.value.copy(top); u.horizon.value.copy(horizon); u.bottom.value.copy(bottom);
    this.stars.material.opacity = starOpacity;
  }

  stepEnv(dt) {
    if (this._envTarget) this.applyEnv(this._envTarget, 1 - Math.exp(-dt * 5));
  }

  /** Mount a vehicle: scale to display size, seat it on the deck and frame the camera. */
  setVehicle(vehicle, { animate = true } = {}) {
    this.holder.clear();
    const root = vehicle.root;
    if (!vehicle._fitted) {
      root.scale.setScalar(1);
      root.position.set(0, 0, 0);
      const box = solidBounds(root);
      const size = box.getSize(new THREE.Vector3());
      const s = vehicle.displaySize / Math.max(size.x, size.y, size.z);
      root.scale.setScalar(s);
      const c = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
      root.position.set(-c.x, -box.min.y * s + (vehicle.hover || 0), -c.z);
      vehicle._fitScale = s;
      vehicle._fitted = true;
      root.traverse((o) => { if (o.isMesh && !o.userData.fx) { o.castShadow = o.castShadow !== false; } });
    }
    this.holder.add(root);
    this.frameVehicle(vehicle, animate);
  }

  frameVehicle(vehicle, animate = true) {
    const root = vehicle.root;
    const box = solidBounds(root);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dir = new THREE.Vector3(...vehicle.view.dir).normalize();
    const fovV = (this.camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect);
    // the bounding sphere over-estimates elongated airframes, so pull in by ~25 %
    const dist = Math.max(sphere.radius / Math.sin(fovV / 2), sphere.radius / Math.sin(fovH / 2)) * (vehicle.view.fill || 1) * 0.74;
    const target = sphere.center.clone();
    if (vehicle.view.targetY != null) target.y = vehicle.view.targetY;
    const pos = target.clone().addScaledVector(dir, dist);
    this.flyTo(pos, target, animate ? 1.4 : 0);
  }

  flyTo(position, target, duration = 1.2) {
    if (duration <= 0 || this.reducedMotion) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.tween = null;
      return;
    }
    this.tween = {
      t: 0, d: duration,
      p0: this.camera.position.clone(), p1: position.clone(),
      t0: this.controls.target.clone(), t1: target.clone(),
    };
  }

  stepTween(dt) {
    const tw = this.tween;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.d);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    this.camera.position.lerpVectors(tw.p0, tw.p1, e);
    this.controls.target.lerpVectors(tw.t0, tw.t1, e);
    if (k >= 1) this.tween = null;
  }

  setHangarVisible(v) { this.hangar.visible = v; }
}
