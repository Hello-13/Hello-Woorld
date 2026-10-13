// Environment sets: HDRI image-based lighting (Poly Haven CC0), a Preetham physical sky,
// floors and backdrops for each "look", a starfield, and an Earth-limb backdrop that keeps
// the correct angular size for any altitude (used in orbit and during ascent).

import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { skyDome, gridFloor } from './effects.js';
import { concrete, floorMarkings, fbm } from './surface.js';
import { rng } from './materials.js';
import { createEarth, setEarthDetail } from './earth.js';
import { Showroom, showroomEnvironment } from './showroom.js';

const R_EARTH_KM = 6371;

/** Per-look settings. Sun directions are world-space (y up). */
export const LOOKS = {
  showroom: {
    label: 'Showroom', env: 'showroom', background: 'showroom', envIntensity: 1.0,
    exposure: 1.06, floor: 'showroom', turntable: false, maxDistance: 60, sun: [0.42, 0.86, 0.36],
    key: { color: 0xfff8f0, intensity: 2.1 }, hemi: [0x9fb4cc, 0x0c0e11, 0.16], rim: 1.7, rim2: 0.9,
  },
  hangar: {
    label: 'Hangar', hdri: 'warehouse', hdriSun: [0.57, 51], background: 'hdri', plate: 'warehouse', plateGain: 0.79, bgIntensity: 0.34, envIntensity: 0.95,
    exposure: 1.12, bgRotation: 0.2, floor: 'hangar', turntable: true,
    key: { color: 0xfff2df, intensity: 2.4 }, hemi: [0xbfd2ff, 0x3a3630, 0.25], rim: 0.6,
  },
  studio: {
    label: 'Studio', hdri: 'studio', hdriSun: [-1.69, 42.5], background: 'color', bgColor: 0x1c1f23, envIntensity: 1.15,
    exposure: 1.05, bgRotation: -2.45, floor: 'studio', turntable: true, maxDistance: 26,
    key: { color: 0xffffff, intensity: 2.8 }, hemi: [0xffffff, 0x202020, 0.15], rim: 1.1,
  },
  sky: {
    label: 'Open sky', hdri: 'sky', hdriSun: [0.6, 48], background: 'sky', bgRotation: -0.28, envIntensity: 1.0,
    exposure: 1.0, floor: 'clouds', turntable: false, fog: [0xaecbe8, 0.0016],
    sky: { turbidity: 3.2, rayleigh: 1.1, mie: 0.004, g: 0.82 },
    key: { color: 0xfff6e8, intensity: 3.4 }, hemi: [0xa8c8ff, 0x8a8f96, 0.45], rim: 0.0,
  },
  pad: {
    label: 'Launch pad', hdri: 'dawn', hdriSun: [0.79, 3.9], background: 'hdri', plate: 'dawn', plateGain: 1.9, bgIntensity: 0.85, bgRotation: 1.12, envIntensity: 0.8,
    exposure: 1.0, floor: 'pad', turntable: false, fog: [0x8a7f8c, 0.0011],
    sky: { turbidity: 3.2, rayleigh: 3.0, mie: 0.006, g: 0.88 },
    key: { color: 0xffb27a, intensity: 2.0 }, hemi: [0x8a9ac8, 0x3a3228, 0.35], rim: 0.0, floods: true,
  },
  orbit: {
    label: 'Low Earth orbit', hdri: null, background: 'space', sun: [0.55, 0.72, 0.42], envIntensity: 0.25,
    exposure: 0.95, floor: null, turntable: false, earth: { altitude: 520 },
    key: { color: 0xfffaf0, intensity: 4.2 }, hemi: [0x000000, 0x4a6a9a, 0.35], rim: 0.0,
  },
};

// ------------------------------------------------------------------------------- stars
function makeStars(count = 6000, radius = 1500) {
  const r = rng(77);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // concentrate a share of stars into a tilted galactic band
    let x, y, z;
    if (i % 3 === 0) {
      const a = r() * Math.PI * 2, b = (r() + r() + r() - 1.5) * 0.22;
      x = Math.cos(a) * Math.cos(b); y = Math.sin(b); z = Math.sin(a) * Math.cos(b);
      const t = 0.5; const yy = y * Math.cos(t) - z * Math.sin(t); z = y * Math.sin(t) + z * Math.cos(t); y = yy;
    } else {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      x = s * Math.cos(th); y = u; z = s * Math.sin(th);
    }
    pos.set([x * radius, y * radius, z * radius], i * 3);
    const temp = r();
    const c = temp < 0.15 ? [1, 0.78, 0.6] : temp > 0.85 ? [0.7, 0.8, 1] : [1, 0.96, 0.92];
    const b = Math.pow(r(), 3.2);
    col.set(c.map((v) => v * (0.25 + b * 1.4)), i * 3);
    size[i] = 0.6 + b * 2.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, dpr: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float size; attribute vec3 color; varying vec3 vC; uniform float dpr;
      void main() { vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * dpr; gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w * 0.9999; }`,
    fragmentShader: /* glsl */`
      uniform float opacity; varying vec3 vC;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a * opacity, a * opacity); }`,
    transparent: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m);
  p.userData.fx = true;
  p.userData.noAO = true;
  p.frustumCulled = false;
  p.renderOrder = -9;
  return p;
}

// ------------------------------------------------------------------------------- floors
function radialFade(inner = 0.55, outer = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 128 * inner, 128, 128, 128 * outer);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#000');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function hangarFloor() {
  const g = new THREE.Group();
  const size = 80;
  const c = concrete();
  for (const t of [c.map, c.roughnessMap, c.normalMap]) t.repeat.set(size / 6, size / 6);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb8bcc0, map: c.map, roughnessMap: c.roughnessMap, normalMap: c.normalMap, normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 1, metalness: 0.0, alphaMap: radialFade(0.42, 1), transparent: true,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.renderOrder = -2;
  const marks = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({
    map: floorMarkings(), transparent: true, roughness: 0.6, alphaMap: radialFade(0.35, 0.8), depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  }));
  marks.rotation.x = -Math.PI / 2;
  marks.position.y = 0.004;
  marks.receiveShadow = true;
  marks.renderOrder = -1;
  g.add(floor, marks);
  g.position.y = -0.36;
  return g;
}

function studioCove() {
  // a revolved infinity cove: flat floor that curves seamlessly into a cylindrical wall
  const prof = [];
  prof.push(new THREE.Vector2(0.01, 0));
  prof.push(new THREE.Vector2(20, 0));
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    prof.push(new THREE.Vector2(20 + Math.sin(a) * 7, 7 - Math.cos(a) * 7));
  }
  prof.push(new THREE.Vector2(27, 40));
  const geo = new THREE.LatheGeometry(prof, 128);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.92, metalness: 0, side: THREE.BackSide });
  const cove = new THREE.Mesh(geo, mat);
  cove.receiveShadow = true;
  cove.position.y = -0.36;
  const g = new THREE.Group();
  g.add(cove);
  // two softbox panels the camera can catch in reflections
  for (const [x, z, ry] of [[-14, 9, -1.0], [12, -12, 2.4]]) {
    const box = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    box.position.set(x, 9, z);
    box.rotation.y = ry;
    g.add(box);
  }
  return g;
}

function padGround() {
  const g = new THREE.Group();
  const c = concrete({ seed: 11 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x7c7a74, map: c.map, roughnessMap: c.roughnessMap, normalMap: c.normalMap, roughness: 1, alphaMap: radialFade(0.5, 1), transparent: true });
  for (const t of [c.map, c.roughnessMap, c.normalMap]) t.repeat.set(8, 8);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.receiveShadow = true;
  apron.renderOrder = -1;
  // scrubland: low-frequency colour noise baked into a texture
  const s = 512, f = fbm(s, { seed: 3, octaves: 6, base: 4 });
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < f.length; i++) {
    const v = f[i];
    img.data[i * 4] = 70 + v * 60; img.data[i * 4 + 1] = 72 + v * 52; img.data[i * 4 + 2] = 52 + v * 30; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const groundTex = new THREE.CanvasTexture(cv);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(4, 4);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 96), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, color: 0x9a8a78, alphaMap: radialFade(0.35, 1), transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  ground.renderOrder = -3;
  g.add(ground, apron);
  g.position.y = -0.01;
  return g;
}

function cloudDeck() {
  const g = new THREE.Group();
  const tex = new THREE.TextureLoader().load('assets/earth/clouds.jpg');
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.5);
  const layers = [];
  for (const [y, op, rep] of [[-60, 0.95, 1], [-38, 0.5, 1.7]]) {
    const t = tex.clone();
    t.repeat.set(3 * rep, 1.5 * rep);
    t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0xffffff, alphaMap: t, transparent: true, opacity: op, depthWrite: false, fog: true }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.userData.fx = true;
    m.userData.noAO = true;
    m.renderOrder = -4;
    g.add(m);
    layers.push(t);
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x1d3a52, roughness: 0.25, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -140;
  sea.userData.fx = true;
  sea.userData.noAO = true;
  g.add(sea);
  g.userData.layers = layers;
  return g;
}

function turntable() {
  const g = new THREE.Group();
  // machined, hard-anodised turntable with concentric tool marks
  const s = 1024;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, s, s);
  for (let r = 4; r < s / 2; r += 3) {
    ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},128,0.03)`;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2); ctx.stroke();
  }
  const rough = new THREE.CanvasTexture(cv);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x15181b, metalness: 0.25, roughness: 0.78, roughnessMap: rough });
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.4, 0.18, 128), deckMat);
  deck.position.y = -0.09;
  deck.receiveShadow = true; deck.castShadow = false;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(8.75, 8.9, 0.2, 128, 1, true), new THREE.MeshStandardMaterial({ color: 0x8c949c, metalness: 1, roughness: 0.25 }));
  skirt.position.y = -0.26;
  const bevel = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.11, 12, 160), new THREE.MeshStandardMaterial({ color: 0xa6adb4, metalness: 1, roughness: 0.22 }));
  bevel.rotation.x = -Math.PI / 2;
  bevel.position.y = -0.03;
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x050a12, emissive: 0x7fb8ff, emissiveIntensity: 2.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8.78, 0.025, 6, 200), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.17;
  const ticks = new THREE.Group();
  const tickMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.9, roughness: 0.3 });
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const big = i % 6 === 0;
    const t = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.42 : 0.2, 0.006, 0.028), tickMat);
    t.position.set(Math.cos(a) * 8.05, 0.004, Math.sin(a) * 8.05);
    t.rotation.y = -a;
    ticks.add(t);
  }
  g.add(deck, skirt, bevel, ring, ticks);
  g.traverse((o) => { o.userData.fx = true; });
  return { group: g, ringMat, deck, ticks };
}

// ------------------------------------------------------------------------------- manager
export class Environment {
  constructor(stage) {
    this.stage = stage;
    const { scene, renderer } = stage;
    this.scene = scene;
    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.exr = new EXRLoader();
    this.hdr = new Map();
    this.plates = new Map();
    this.platesHires = false;
    this.look = null;
    this.overlay = null;
    this.space = false;

    // lights
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 0.5; sc.far = 120;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 3;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 0.6);
    rim.position.set(-14, 9, -12);
    const rim2 = new THREE.DirectionalLight(0xffd9b0, 0);
    rim2.position.set(15, 6, -10);
    scene.add(key, key.target, hemi, rim, rim2);
    this.lights = { key, hemi, rim, rim2 };
    this.floods = [];
    for (const [x, z] of [[18, 14], [-16, 18], [6, -20]]) {
      const s = new THREE.SpotLight(0xdfe8ff, 0, 140, 0.32, 0.6, 1.2);
      s.position.set(x, 1.2, z);
      s.target.position.set(0, 7, 0);
      scene.add(s, s.target);
      this.floods.push(s);
    }

    // backdrops
    this.sky = new Sky();
    this.sky.scale.setScalar(1800);
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace('uniform vec3 up;', 'uniform vec3 up;\n\t\tuniform float skyFade;\n\t\tuniform float skyScale;\n\t\tuniform vec3 hazeColor;')
      .replace('gl_FragColor = vec4( retColor, 1.0 );', 'retColor = mix(retColor, hazeColor, smoothstep(0.0, -0.18, direction.y) * skyFade);\n\t\t\tgl_FragColor = vec4( retColor * skyFade * skyScale, 1.0 );');
    this.sky.material.uniforms.skyFade = { value: 1 };
    this.sky.material.uniforms.skyScale = { value: 0.3 };
    this.sky.material.uniforms.hazeColor = { value: new THREE.Color(0x6b6f80) };
    this.sky.userData.fx = true;
    this.sky.userData.noAO = true;
    this.sky.renderOrder = -10;
    this.sky.visible = false;
    scene.add(this.sky);

    this.gradient = skyDome();
    this.gradient.visible = false;
    scene.add(this.gradient);
    this.grid = gridFloor();
    this.grid.position.y = -0.37;
    this.grid.visible = false;
    scene.add(this.grid);

    this.stars = makeStars();
    scene.add(this.stars);

    // ground group: everything that should scroll away during a launch
    this.ground = new THREE.Group();
    scene.add(this.ground);
    this.showroom = new Showroom(stage);
    scene.add(this.showroom.dome);
    this.floors = { hangar: hangarFloor(), studio: studioCove(), pad: padGround(), clouds: cloudDeck(), showroom: this.showroom.group };
    for (const f of Object.values(this.floors)) { f.visible = false; this.ground.add(f); }
    this.turn = turntable();
    this.ground.add(this.turn.group);

    this.earth = null;
    this.earthAlt = 520;
    this.earthAngle = 0;
    this.earthDrift = 0;
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.3).normalize();
    this.cloudSpeed = 0;
  }

  async loadHDRI(name) {
    if (!name) return null;
    if (this.hdr.has(name)) return this.hdr.get(name);
    const p = this.exr.loadAsync(`assets/hdri/${name}.exr`).then((t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      const env = this.pmrem.fromEquirectangular(t).texture;
      return { equirect: t, env };
    }).catch((e) => { console.warn('HDRI failed', name, e); return null; });
    this.hdr.set(name, p);
    return p;
  }

  /** The backdrop photograph for an HDRI look: Poly Haven's 8K (or 4K) tonemapped render of the same
   *  panorama, far sharper than the 2K HDR that lights the scene. plateGain matches its median
   *  brightness to the HDR's, so bgIntensity means the same thing for both. */
  loadPlate(name) {
    const url = `assets/hdri/${name}-${this.platesHires ? '8k' : '4k'}.jpg`;
    if (!this.plates.has(url)) {
      this.plates.set(url, new THREE.TextureLoader().loadAsync(url).then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return t;
      }).catch((e) => { console.warn('Backdrop failed', url, e); return null; }));
    }
    return this.plates.get(url);
  }

  /** 8K backdrops and Earth maps for the 4K / Ultra presets, when the GPU takes 8K textures. */
  setDetail(hires) {
    hires = hires && this.renderer.capabilities.maxTextureSize >= 8192;
    setEarthDetail(hires);
    if (hires === this.platesHires) return;
    this.platesHires = hires;
    const L = LOOKS[this.look];
    if (L?.plate) this.showBackdrop(this.look);
  }

  /** Put an HDRI look's backdrop behind the scene (plate when it has one, else the HDR itself). */
  async showBackdrop(name) {
    const L = LOOKS[name];
    const h = await this.loadHDRI(L.hdri);
    const plate = L.plate ? await this.loadPlate(L.plate) : null;
    if (this.look !== name || this.overlay || this.space || L.background !== 'hdri') return;
    this.scene.background = plate || h?.equirect || null;
    this.scene.backgroundBlurriness = 0;
    this.bgGain = plate ? L.plateGain : 1;
    this.scene.backgroundIntensity = L.bgIntensity * this.bgGain;
    this.scene.backgroundRotation.set(0, L.bgRotation || 0, 0);
  }

  spaceEnv() {
    if (this._spaceEnv) return this._spaceEnv;
    // earthshine from below, black sky above
    const s = new THREE.Scene();
    const m = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying vec3 vP; void main(){ float y = normalize(vP).y; gl_FragColor = vec4(vec3(0.16,0.26,0.42) * smoothstep(0.1,-0.8,y) * 1.6, 1.); }',
    }));
    s.add(m);
    this._spaceEnv = this.pmrem.fromScene(s, 0).texture;
    return this._spaceEnv;
  }

  ensureEarth() {
    if (!this.earth) {
      this.earth = createEarth(1, { segments: 256, atmosphere: 1, shell: 1.016, scaleH: 0.0042 });   // ~27 km glow scale height
      // drawn as part of the backdrop: opaque queue (so it precedes every scene object), no depth,
      // alpha handled with explicit blend state rather than the transparent queue
      for (const o of [this.earth.surface, this.earth.clouds, this.earth.atmosphere]) {
        o.material.depthTest = false;
        o.material.depthWrite = false;
        o.material.transparent = false;
        o.frustumCulled = false;
      }
      for (const o of [this.earth.surface, this.earth.clouds]) {
        o.material.blending = THREE.CustomBlending;
        o.material.blendSrc = THREE.SrcAlphaFactor;
        o.material.blendDst = THREE.OneMinusSrcAlphaFactor;
      }
      this.earth.surface.renderOrder = -8;
      this.earth.clouds.renderOrder = -7;
      this.earth.atmosphere.renderOrder = -6;
      this.earth.group.visible = false;
      this.earth.group.traverse((o) => { o.userData.noAO = true; });
      this.scene.add(this.earth.group);
      // orient: Cape Canaveral (28.5 N, 80.6 W) straight down, east → +x
      const lat = THREE.MathUtils.degToRad(28.5), lon = THREE.MathUtils.degToRad(-80.6);
      const phi = lon + Math.PI;
      const s = new THREE.Vector3(-Math.cos(phi) * Math.cos(lat), Math.sin(lat), Math.sin(phi) * Math.cos(lat));
      const east = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).normalize();
      const south = new THREE.Vector3().crossVectors(east, s).normalize();
      const B = new THREE.Matrix4().makeBasis(east, s, south);
      this.earthBase = new THREE.Quaternion().setFromRotationMatrix(B.clone().transpose());
    }
    return this.earth;
  }

  /** Earth backdrop seen from altitude (km), rotated by a downrange angle (rad), faded by alpha. */
  setEarthView(altitude, angle = 0, alpha = 1) {
    const e = this.ensureEarth();
    this.earthAlt = altitude;
    this.earthAngle = angle;
    e.group.visible = alpha > 0.01;
    e.setFade(alpha);
  }

  applyLook(name) {
    const L = LOOKS[name];
    if (!L) return;
    this.look = name;
    const st = this.stage;
    for (const [k, f] of Object.entries(this.floors)) f.visible = L.floor === k;
    this.turn.group.visible = !!L.turntable;
    this.sky.visible = L.background === 'sky';
    this.showroom.dome.visible = L.background === 'showroom';
    this.gradient.visible = false;
    this.grid.visible = false;
    this.stars.material.uniforms.opacity.value = L.background === 'space' ? 1 : 0;
    this.scene.background = null;
    this.scene.backgroundBlurriness = 0;
    if (L.background === 'color') this.scene.background = new THREE.Color(L.bgColor);
    if (L.background === 'space') this.scene.background = new THREE.Color(0x000000);
    this.renderer.toneMappingExposure = L.exposure;
    this.scene.fog = L.fog ? new THREE.FogExp2(L.fog[0], L.fog[1]) : null;
    if (L.fog) this.sky.material.uniforms.hazeColor.value.set(L.fog[0]);

    // sun / key light
    const key = this.lights.key;
    key.color.set(L.key.color);
    key.intensity = L.key.intensity;
    // sun / key direction follows the HDRI's brightest light after the backdrop rotation
    let dir;
    if (L.hdriSun) {
      const az = L.hdriSun[0] - (L.bgRotation || 0), el = THREE.MathUtils.degToRad(L.hdriSun[1]);
      dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    } else dir = new THREE.Vector3(...L.sun).normalize();
    if (dir.y < 0.12) dir.y = 0.12;     // keep shadows on the ground for a sun on the horizon
    dir.normalize();
    this.sunDir.copy(dir);
    key.position.copy(dir).multiplyScalar(40);
    key.target.position.set(0, 0, 0);
    this.lights.hemi.color.set(L.hemi[0]);
    this.lights.hemi.groundColor.set(L.hemi[1]);
    this.lights.hemi.intensity = L.hemi[2];
    this.lights.rim.intensity = L.rim;
    this.lights.rim2.intensity = L.rim2 || 0;
    for (const f of this.floods) f.intensity = L.floods ? 140 : 0;
    if (L.sky) {
      const u = this.sky.material.uniforms;
      u.turbidity.value = L.sky.turbidity;
      u.rayleigh.value = L.sky.rayleigh;
      u.mieCoefficient.value = L.sky.mie;
      u.mieDirectionalG.value = L.sky.g;
      u.sunPosition.value.copy(dir);
      u.skyFade.value = 1;
    }
    st.controls.maxDistance = L.maxDistance || 220;

    // earth backdrop
    if (L.earth) {
      this.setEarthView(L.earth.altitude, 0, 1);
      this.earth.setSun(dir);
    } else if (this.earth) {
      this.earth.group.visible = false;
    }

    // image-based lighting
    this.scene.environmentIntensity = L.envIntensity;
    if (L.background === 'hdri') this.showBackdrop(name);
    if (L.hdri) {
      const req = name;
      this.loadHDRI(L.hdri).then((h) => {
        if (!h || this.look !== req) return;
        this.scene.environment = h.env;
        this.scene.environmentRotation.set(0, L.bgRotation || 0, 0);
      });
    } else if (L.env === 'showroom') {
      this.showroomEnv = this.showroomEnv || showroomEnvironment(this.pmrem);
      this.scene.environment = this.showroomEnv;
      this.scene.environmentRotation.set(0, 0, 0);
    } else {
      this.scene.environment = this.spaceEnv();
      this.scene.environmentRotation.set(0, 0, 0);
    }
    if (this.overlay) this.setOverlay(this.overlay);
  }

  /** X-ray / blueprint override the backdrop (dark hologram room or drafting blue) without forgetting the look. */
  setOverlay(kind) {
    this.overlay = kind;
    if (kind) {
      const blue = kind === 'blueprint';
      this.scene.background = null;
      this.gradient.visible = true;
      const u = this.gradient.material.uniforms;
      if (blue) { u.top.value.set(0x0a2a4c); u.horizon.value.set(0x103a64); u.bottom.value.set(0x0a2440); u.glow.value.set(0x0f3a66); }
      else { u.top.value.set(0x020407); u.horizon.value.set(0x081422); u.bottom.value.set(0x020305); u.glow.value.set(0x0b2236); }
      this.grid.visible = true;
      this.grid.material.uniforms.color.value.set(blue ? 0x8cc4ff : 0x1f5f86);
      this.sky.visible = false;
      this.showroom.dome.visible = false;
      this.stars.material.uniforms.opacity.value = 0;
      for (const f of Object.values(this.floors)) f.visible = false;
      this.turn.group.visible = false;
      this.scene.fog = null;
      if (this.earth) this.earth.group.visible = false;
    } else if (this.look) {
      const keep = this.look;
      this.look = null;
      this.applyLook(keep);
    }
  }

  /** Pure space backdrop for the Earth-centred orbit view. */
  setSpaceView(on) {
    this.space = on;
    if (on) {
      this.scene.background = new THREE.Color(0x000000);
      this.scene.backgroundBlurriness = 0;
      this.sky.visible = false;
      this.showroom.dome.visible = false;
      this.gradient.visible = false;
      this.grid.visible = false;
      this.stars.material.uniforms.opacity.value = 1;
      this.ground.visible = false;
      this.scene.fog = null;
      this.scene.environment = this.spaceEnv();
      this.scene.environmentIntensity = 0.3;
      this.renderer.toneMappingExposure = 1.0;
      if (this.earth) this.earth.group.visible = false;
      this.lights.hemi.intensity = 0.05;
      this.lights.rim.intensity = 0;
    } else {
      this.ground.visible = true;
      const keep = this.look;
      this.look = null;
      this.applyLook(keep);
    }
  }

  /**
   * Ascent backdrop: sky darkens with altitude (m), stars fade in, the pad falls away and the
   * Earth limb takes over above ~15 km, rotated by the downrange angle (rad).
   */
  setAscent(h, downrangeAngle) {
    const k = THREE.MathUtils.smoothstep(h, 4000, 70000);
    // the dawn sky thins out: fade the photographic backdrop to black as the air runs out
    this.scene.backgroundIntensity = LOOKS.pad.bgIntensity * (this.bgGain || 1) * (1 - THREE.MathUtils.smoothstep(h, 6000, 55000));
    this.stars.material.uniforms.opacity.value = THREE.MathUtils.smoothstep(h, 25000, 80000);
    this.scene.fog = h < 3000 ? this.scene.fog || new THREE.FogExp2(LOOKS.pad.fog[0], LOOKS.pad.fog[1]) : null;
    if (this.scene.fog) this.scene.fog.density = LOOKS.pad.fog[1] * (1 - h / 3000);
    const earthAlpha = THREE.MathUtils.smoothstep(h, 9000, 28000);
    if (earthAlpha > 0) {
      this.setEarthView(Math.max(h / 1000, 8), downrangeAngle, earthAlpha);
      // from altitude the Sun stands higher over the ground track than it does on the pad at dawn
      const climb = THREE.MathUtils.smoothstep(h, 15000, 140000);
      const sun = this.sunDir.clone();
      sun.y = THREE.MathUtils.lerp(sun.y, 0.62, climb);
      this.earth.setSun(sun.normalize());
    } else if (this.earth) this.earth.group.visible = false;
    this.scene.environmentIntensity = THREE.MathUtils.lerp(LOOKS.pad.envIntensity, 0.3, k);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(LOOKS.pad.exposure, 0.95, k);
    for (const f of this.floods) f.intensity = h < 600 ? 140 : 0;
  }

  update(dt, camera) {
    if (this.showroom.dome.visible || this.floors.showroom.visible) this.showroom.update(camera);
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.gradient.position.copy(camera.position);
    this.stars.material.uniforms.dpr.value = this.renderer.getPixelRatio();
    this.stars.visible = this.stars.material.uniforms.opacity.value > 0.005;
    this.turn.ringMat.emissiveIntensity = 2.4 + Math.sin(this.stage.time * 1.4) * 0.35;
    if (this.floors.clouds.visible) {
      for (const t of this.floors.clouds.userData.layers) t.offset.x -= dt * this.cloudSpeed * 0.0004;
    }
    if (this.earth && this.earth.group.visible) {
      // keep the Earth's angular radius right for the current altitude: sin ρ = R / (R + h)
      const d = 2400;
      const r = d * (R_EARTH_KM / (R_EARTH_KM + this.earthAlt));
      const g = this.earth.group;
      g.scale.setScalar(r);
      g.position.set(camera.position.x, camera.position.y - d, camera.position.z);
      if (this.look === 'orbit' && !this.space) this.earthDrift += dt * 0.0011 * 6;   // ~7.6 km/s ground speed (×6 for legibility)
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.earthAngle + this.earthDrift);
      g.quaternion.copy(q).multiply(this.earthBase);
      this.earth.update(dt);
    }
  }
}
