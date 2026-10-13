// Render stage: renderer, HDR/MSAA post-processing chain (GTAO → outline → NaN guard → bloom → AgX → grade),
// environment sets, camera rig, quality presets and the frame loop.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { Environment } from './environment.js';

// dpr: render at the screen's native pixel density up to this cap; minPixels: never draw fewer
// pixels than this (the 4K preset supersamples a 3840 × 2160 frame onto smaller screens);
// showroom.reflect: mirror-floor resolution (fraction of the canvas, 0 = off);
// showroom.contact: contact-shadow map size; contactEvery: refresh every n frames
export const UHD = 3840 * 2160;
export const QUALITY = {
  '4k': { label: '4K', dpr: 4, minPixels: UHD, msaa: 2, ao: 1, shadow: 4096, showroom: { reflect: 0.5, contact: 2048, contactEvery: 1 } },
  ultra: { label: 'Ultra', dpr: 3, msaa: 4, ao: 1, shadow: 4096, showroom: { reflect: 0.5, contact: 1024, contactEvery: 1 } },
  high: { label: 'High', dpr: 2, msaa: 4, ao: 0.5, shadow: 2048, showroom: { reflect: 0.38, contact: 512, contactEvery: 1 } },
  balanced: { label: 'Balanced', dpr: 1.5, msaa: 4, ao: 0, shadow: 2048, showroom: { reflect: 0, contact: 512, contactEvery: 2 } },
  performance: { label: 'Performance', dpr: 1, msaa: 0, ao: 0, shadow: 1024, showroom: { reflect: 0, contact: 256, contactEvery: 3 } },
};
const ORDER = ['4k', 'ultra', 'high', 'balanced', 'performance'];

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

/** GTAO that ignores effects (plumes, sky, stars, Earth backdrop) and can run at reduced resolution. */
class SceneAOPass extends GTAOPass {
  constructor(scene, camera, w, h) {
    super(scene, camera, w, h);
    this.resScale = 0.5;
  }
  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse((o) => {
      const m = o.material;
      if (o.userData.noAO || (m && !Array.isArray(m) && m.blending === THREE.AdditiveBlending)) o.visible = false;
    });
  }
  setSize(w, h) { super.setSize(Math.max(1, Math.round(w * this.resScale)), Math.max(1, Math.round(h * this.resScale))); }
}

// One NaN/Inf pixel in the HDR buffer is enough for bloom's blur chain to smear it into a black
// block across the frame. Zero such pixels (from the scene, AO or outline) before bloom runs.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // the comparison is false for NaN and for +/-Inf, so it catches both
      bool ok = all(lessThan(abs(c), vec4(60000.0))) && !any(isnan(c)) && !any(isinf(c));
      gl_FragColor = ok ? c : vec4(0.0, 0.0, 0.0, 1.0);
    }`,
};

// Final grade in display space: a touch of lateral chromatic aberration toward the corners, a
// gentle S-curve, split toning (cool shadows, warm highlights), vignette and fine grain.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.3 }, grain: { value: 0.022 },
    aberration: { value: 0.0045 }, contrast: { value: 0.14 }, split: { value: 0.035 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float time; uniform float vignette; uniform float grain;
    uniform float aberration; uniform float contrast; uniform float split; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      vec2 off = d * dot(d, d) * aberration * 4.0;
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv - off).r;
      c.b = texture2D(tDiffuse, vUv + off).b;
      vec3 x = clamp(c.rgb, 0.0, 1.0);
      c.rgb = mix(c.rgb, x * x * (3.0 - 2.0 * x), contrast);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb += vec3(-0.35, 0.05, 0.6) * (1.0 - smoothstep(0.0, 0.45, l)) * split * 0.5;
      c.rgb += vec3(0.5, 0.18, -0.4) * smoothstep(0.55, 1.0, l) * split;
      float v = smoothstep(0.95, 0.25, length(d * vec2(1.15, 1.0)));
      c.rgb *= mix(1.0 - vignette, 1.0, v);
      c.rgb += (hash(mod(gl_FragCoord.xy, 1024.0) + fract(time) * 37.0) - 0.5) * grain;   // per pixel at any resolution
      gl_FragColor = c;
    }`,
};

export class Stage {
  constructor(container) {
    this.container = container;
    this.frameHooks = new Set();
    this.clock = new THREE.Clock();
    this.time = 0;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.autoQuality = true;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1;
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

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 4000);
    this.camera.position.set(14, 7, 16);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 220;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.target.set(0, 2.5, 0);

    this.env = new Environment(this);
    this.lights = this.env.lights;

    this.holder = new THREE.Group();
    scene.add(this.holder);

    this.tween = null;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 900;
    let saved = null;
    try { saved = localStorage.getItem('aeroforge.quality'); } catch { /* storage blocked */ }
    const cores = navigator.hardwareConcurrency || 4;
    this.quality = QUALITY[saved] ? saved : (coarse ? 'balanced' : cores >= 8 ? 'ultra' : 'high');
    if (saved) this.autoQuality = false;
    this.buildComposer();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.fps = 60;
    this._fpsAcc = 0; this._fpsN = 0;
    this._slow = 0;
    this.onQualityChange = null;
    renderer.setAnimationLoop(() => this.frame());
  }

  /** Compatibility handles used by the labs. */
  get hangar() { return this.env.ground; }
  setHangarVisible(v) { this.env.ground.visible = v; }

  /** Pixel ratio for a preset: native density (capped), raised to reach minPixels if it has one. */
  pixelRatioFor(q) {
    let r = Math.min(window.devicePixelRatio || 1, q.dpr);
    if (q.minPixels) {
      const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
      r = Math.min(q.dpr, Math.max(r, Math.sqrt(q.minPixels / (w * h))));
    }
    return r;
  }

  /** Size of the frame actually being drawn, in device pixels. */
  get renderSize() {
    const c = this.renderer.domElement;
    return { width: c.width, height: c.height };
  }

  buildComposer() {
    const q = QUALITY[this.quality];
    this.renderer.setPixelRatio(this.pixelRatioFor(q));
    const key = this.lights.key;
    if (key.shadow.mapSize.x !== q.shadow) {
      key.shadow.mapSize.set(q.shadow, q.shadow);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
    if (this.composer) { for (const p of this.composer.passes) p.dispose?.(); this.composer.dispose(); }
    this.env.showroom.setQuality(q.showroom);
    this._grace = (this.time || 0) + 4;     // shader compiles after a rebuild are not a slow frame rate
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: q.msaa });
    const composer = new EffectComposer(this.renderer, rt);
    this.composer = composer;
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = null;
    if (q.ao) {
      const ao = new SceneAOPass(this.scene, this.camera, 2, 2);
      ao.resScale = q.ao;
      ao.blendIntensity = 1.0;
      ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: q.ao >= 1 ? 16 : 12, distanceFallOff: 1, screenSpaceRadius: false });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      composer.addPass(ao);
      this.ao = ao;
    }
    this.outline = new OutlinePass(new THREE.Vector2(2, 2), this.scene, this.camera);
    this.outline.edgeStrength = 4;
    this.outline.edgeGlow = 0.35;
    this.outline.edgeThickness = 1.2;
    this.outline.visibleEdgeColor.set(0x8cc4ff);
    this.outline.hiddenEdgeColor.set(0x24466e);
    if (this._outlined) this.outline.selectedObjects = this._outlined;
    composer.addPass(this.outline);
    composer.addPass(new ShaderPass(SanitizeShader));     // before bloom, the pass that spreads pixels
    this.bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.38, 0.45, 1.9);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    if (this.container) this.resize();
  }

  setQuality(name, { manual = true } = {}) {
    if (!QUALITY[name] || name === this.quality) return;
    const up = ORDER.indexOf(name) < ORDER.indexOf(this.quality);
    this.quality = name;
    if (manual) {
      this.autoQuality = false;
      try { localStorage.setItem('aeroforge.quality', name); } catch { /* storage blocked */ }
    }
    this.buildComposer();
    this.onQualityChange?.(name, manual, up);
  }

  setOutlined(objects) {
    this._outlined = objects;
    this.outline.selectedObjects = objects;
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    // the 4K preset's supersampling factor depends on the window size
    const r = this.pixelRatioFor(QUALITY[this.quality]);
    if (Math.abs(r - this.renderer.getPixelRatio()) > 1e-3) {
      this.renderer.setPixelRatio(r);
      this.composer.setPixelRatio(r);
    }
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.labels.setSize(w, h);
    this.env.showroom.resize();
    this.camera.aspect = w / h;
    this.applyViewShift();
  }

  /** Slide the projection centre (fractions of width / height) so a panel doesn't cover the subject;
   *  positive x moves the subject right, positive y moves it up. Eases there over ~0.5 s. */
  setViewShift(f, fy = 0) {
    this._shiftTarget = [f, fy];
    if (this.reducedMotion || this._shift === undefined) {
      this._shift = f;
      this._shiftY = fy;
      this.applyViewShift();
    }
  }

  stepViewShift(dt) {
    const t = this._shiftTarget;
    if (!t) return;
    const k = 1 - Math.exp(-dt * 7);
    const dx = t[0] - (this._shift || 0), dy = t[1] - (this._shiftY || 0);
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) {
      if (dx || dy) { this._shift = t[0]; this._shiftY = t[1]; this.applyViewShift(); }
      return;
    }
    this._shift = (this._shift || 0) + dx * k;
    this._shiftY = (this._shiftY || 0) + dy * k;
    this.applyViewShift();
  }

  /** Half-angle tangents of the part of the frame the subject can use: frameCover / frameCoverY are
   *  the fractions of width / height hidden behind interface panels. */
  frameTan() {
    const t = Math.tan((this.camera.fov * Math.PI) / 360);
    return { tanV: t * (1 - (this.frameCoverY || 0)), tanH: t * this.camera.aspect * (1 - (this.frameCover || 0)) };
  }

  applyViewShift() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    const f = this._shift || 0, fy = this._shiftY || 0;
    if (f || fy) this.camera.setViewOffset(w, h, -w * f, h * fy, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  onFrame(fn) { this.frameHooks.add(fn); return () => this.frameHooks.delete(fn); }

  frame() {
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.1);
    this.time += dt;
    this._fpsAcc += raw; this._fpsN++;
    if (this._fpsAcc > 0.5) {
      this.fps = this._fpsN / this._fpsAcc;
      this._fpsAcc = 0; this._fpsN = 0;
      // adaptive quality: step down after ~3 s below 26 fps; step Ultra up to 4K supersampling
      // after ~4 s above 50 fps, unless the screen is already 4K or a step down has happened
      if (this.autoQuality && document.visibilityState === 'visible' && this.time > this._grace) {
        this._slow = this.fps < 26 ? this._slow + 1 : 0;
        this._fast = this.fps > 50 ? (this._fast || 0) + 1 : 0;
        if (this._slow >= 6) {
          const i = ORDER.indexOf(this.quality);
          if (i < ORDER.length - 1) this.setQuality(ORDER[i + 1], { manual: false });
          this._slow = 0;
          this._noUpgrade = true;
        } else if (this._fast >= 8 && !this._noUpgrade && this.quality === 'ultra') {
          const { width, height } = this.renderSize;
          if (width * height < UHD * 0.95) this.setQuality('4k', { manual: false });
          else this._noUpgrade = true;
          this._fast = 0;
        }
      }
    }
    this.stepViewShift(dt);
    if (this.tween) this.stepTween(dt);
    for (const fn of this.frameHooks) fn(dt, this.time);
    this.controls.update();
    // shadow maps render once per frame, in the beauty pass, not again in AO / outline sub-passes
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.env.update(dt, this.camera);
    this.grade.uniforms.time.value = this.time;
    this.composer.render();
    this.labels.render(this.scene, this.camera);
  }

  /** Mount a vehicle: scale to display size, seat it on the deck and frame the camera. */
  setVehicle(vehicle, { animate = true, reveal = false } = {}) {
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
      root.traverse((o) => {
        if (o.isMesh && !o.userData.fx) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; }
      });
    }
    this.holder.add(root);
    this.frameVehicle(vehicle, animate, { reveal });
  }

  /** Frame the camera on a vehicle. reveal: start low and close off the quarter and pull back
   *  into the hero framing, the way a product film opens. */
  frameVehicle(vehicle, animate = true, { reveal = false } = {}) {
    const root = vehicle.root;
    const box = solidBounds(root);
    const dir = new THREE.Vector3(...vehicle.view.dir).normalize();
    const target = box.getCenter(new THREE.Vector3());
    if (vehicle.view.targetY != null) target.y = vehicle.view.targetY;
    // exact fit: the distance at which every corner of the bounding box sits inside the frame
    const { tanV, tanH } = this.frameTan();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();
    let need = 0;
    const c = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(target);
      const z = c.dot(dir);
      need = Math.max(need, z + Math.abs(c.dot(right)) / tanH, z + Math.abs(c.dot(up)) / tanV);
    }
    const dist = need * 1.06 * (vehicle.view.fill || 1);
    const pos = target.clone().addScaledVector(dir, Math.min(dist, this.controls.maxDistance * 0.92));
    if (reveal && animate && !this.reducedMotion) {
      const start = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.75);
      start.y = Math.max(0.04, start.y * 0.35);
      start.normalize();
      this.camera.position.copy(target).addScaledVector(start, Math.min(dist, this.controls.maxDistance * 0.92) * 0.62);
      this.controls.target.copy(target);
      this.flyTo(pos, target, 3.2, 'out');
      return;
    }
    this.flyTo(pos, target, animate ? 1.4 : 0);
  }

  flyTo(position, target, duration = 1.2, ease = 'inOut') {
    if (duration <= 0 || this.reducedMotion) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.tween = null;
      return;
    }
    this.tween = {
      t: 0, d: duration,
      p0: this.camera.position.clone(), p1: position.clone(),
      t0: this.controls.target.clone(), t1: target.clone(), ease,
    };
  }

  /** Translate the camera, its orbit target and any running fly-to by a world-space offset. */
  shiftView(delta) {
    this.camera.position.add(delta);
    this.controls.target.add(delta);
    if (this.tween) for (const k of ['p0', 'p1', 't0', 't1']) this.tween[k].add(delta);
  }

  stepTween(dt) {
    const tw = this.tween;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.d);
    const e = tw.ease === 'out' ? 1 - Math.pow(1 - k, 4) : k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    this.camera.position.lerpVectors(tw.p0, tw.p1, e);
    this.controls.target.lerpVectors(tw.t0, tw.t1, e);
    if (k >= 1) this.tween = null;
  }
}
