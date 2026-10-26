// The open-sky backdrop for aircraft in flight: one camera-centred dome whose shader draws, in a
// single pass, the sky above the horizon from an 8K / 4K photographic plate (Poly Haven's
// Kloofendal 43d clear pure sky, tone-mapped by assets/hdri/plates: see CREDITS.md) and, below
// it, a real-scale cloud deck on the curved Earth: cloud tops a few kilometres under the
// aircraft, reaching a horizon that dips with altitude (acos(R / (R + h))), lit by the plate's
// sun. The deck is procedural: tileable fbm noise sampled at five scales from 90 km cells down to
// 110 m detail, so detail appears as the camera comes closer and the hardware's mip filtering
// keeps the horizon still. Everything scrolls at airspeed and drifts slowly in its own right.
//
// Altitude grades the sky: the zenith darkens and saturates (deep blue at 12 km, near violet at
// 18 km), the horizon haze thins, and the aerial perspective toward the deck lengthens.
// The same grading drives the scene's fog and the lights on the aircraft (see skyGrade).

import * as THREE from 'three';
import { rng } from './materials.js';

export const R_EARTH_M = 6371000;

// The plate's highlight shoulder (plates.py): y = K + (1 - K)(1 - exp(-(x - K) / S)) above K.
const PLATE_KNEE = 0.5, PLATE_SHOULDER = 1.6;

// ------------------------------------------------------------------------------- grading
const lerp = THREE.MathUtils.lerp;
const KEYS = [   // altitude (m) → sky parameters, linear colour
  { h: 0,     zenith: [1.00, 1.00, 1.00], haze: [0.74, 0.79, 0.87], sat: 1.00, beta: 1 / 24000, ambient: [0.40, 0.54, 0.84], skyLight: 0xa6c8ff, key: 0xfff1df },
  { h: 11000, zenith: [0.56, 0.61, 0.88], haze: [0.66, 0.73, 0.84], sat: 1.18, beta: 1 / 48000, ambient: [0.34, 0.46, 0.76], skyLight: 0x7aa0ee, key: 0xfff6ea },
  { h: 18000, zenith: [0.34, 0.32, 0.64], haze: [0.52, 0.60, 0.76], sat: 1.30, beta: 1 / 85000, ambient: [0.26, 0.34, 0.64], skyLight: 0x5c6fd2, key: 0xfffaf2 },
];
const mixArr = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const mixHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

/** Sky parameters at an altitude (m): zenith multiplier, horizon haze colour, saturation boost,
 *  aerial-perspective extinction (1/m), sky light on the cloud tops, and the colours for the
 *  hemisphere and key lights on the aircraft. */
export function skyGrade(altitude) {
  const h = THREE.MathUtils.clamp(altitude || 0, 0, 20000);
  let a = KEYS[0], b = KEYS[1];
  if (h > KEYS[1].h) { a = KEYS[1]; b = KEYS[2]; }
  const t = THREE.MathUtils.smoothstep(h, a.h, b.h) * 0.5 + THREE.MathUtils.clamp((h - a.h) / (b.h - a.h), 0, 1) * 0.5;
  const ex = h > KEYS[2].h ? (h - KEYS[2].h) / 7000 : 0;     // above 18 km keep darkening gently
  return {
    zenith: mixArr(a.zenith, b.zenith, t).map((v, i) => v * (1 - ex * (i === 2 ? 0.25 : 0.4))),
    haze: mixArr(a.haze, b.haze, t),
    sat: lerp(a.sat, b.sat, t),
    beta: lerp(a.beta, b.beta, t),
    ambient: mixArr(a.ambient, b.ambient, t),
    skyLight: mixHex(a.skyLight, b.skyLight, t),
    key: mixHex(a.key, b.key, t),
  };
}

// ------------------------------------------------------------------------------- noise
// Tileable gradient (Perlin) noise summed over octaves, each octave's lattice shifted by a random
// phase, so no grid shows through: value noise on aligned lattices reads as a checkerboard of
// cells once the deck is seen in perspective.
function tileableFbm(size, { seed = 1, octaves = 7, base = 4, gain = 0.5 } = {}) {
  const r = rng(seed);
  const out = new Float32Array(size * size);
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const cells = base << o;
    if (cells > size) break;
    const gx = new Float32Array(cells * cells), gy = new Float32Array(cells * cells);
    for (let i = 0; i < gx.length; i++) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
    const ox = r() * cells, oy = r() * cells;
    const scale = cells / size;
    for (let y = 0; y < size; y++) {
      const fy = y * scale + oy, y0 = Math.floor(fy), ty = fy - y0, sy = fade(ty);
      const ya = ((y0 % cells) + cells) % cells, yb = (ya + 1) % cells;
      for (let x = 0; x < size; x++) {
        const fx = x * scale + ox, x0 = Math.floor(fx), tx = fx - x0, sx = fade(tx);
        const xa = ((x0 % cells) + cells) % cells, xb = (xa + 1) % cells;
        const i00 = ya * cells + xa, i10 = ya * cells + xb, i01 = yb * cells + xa, i11 = yb * cells + xb;
        const n00 = gx[i00] * tx + gy[i00] * ty, n10 = gx[i10] * (tx - 1) + gy[i10] * ty;
        const n01 = gx[i01] * tx + gy[i01] * (ty - 1), n11 = gx[i11] * (tx - 1) + gy[i11] * (ty - 1);
        const nx0 = n00 + (n10 - n00) * sx, nx1 = n01 + (n11 - n01) * sx;
        out[y * size + x] += amp * (nx0 + (nx1 - nx0) * sy);
      }
    }
    amp *= gain;
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo);
  return out;
}

let noiseTex = null;
/** Tileable fbm in three channels (different seeds and spectra), mip-mapped and anisotropic so
 *  the GPU filters the deck toward the horizon. */
function cloudNoise() {
  if (noiseTex) return noiseTex;
  const s = 512;
  const r = tileableFbm(s, { seed: 21, octaves: 7, base: 3, gain: 0.55 });
  const g = tileableFbm(s, { seed: 47, octaves: 7, base: 2, gain: 0.52 });
  const b = tileableFbm(s, { seed: 83, octaves: 6, base: 6, gain: 0.6 });
  const data = new Uint8Array(s * s * 4);
  for (let i = 0; i < s * s; i++) {
    data[i * 4] = Math.round(r[i] * 255);
    data[i * 4 + 1] = Math.round(g[i] * 255);
    data[i * 4 + 2] = Math.round(b[i] * 255);
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, s, s, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 16;
  t.needsUpdate = true;
  noiseTex = t;
  return t;
}

// ------------------------------------------------------------------------------- shaders
const vert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;                                   // the dome is centred on the camera
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w * 0.99999;           // always at the far plane, whatever the dome's radius
  }`;

const frag = /* glsl */`
  uniform sampler2D plate; uniform float hasPlate; uniform float plateRot; uniform float plateGain;
  uniform sampler2D noiseTex;
  uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 skyAmbient;
  uniform vec3 zenithMul; uniform vec3 hazeColor; uniform float satBoost; uniform float hazeBeta;
  uniform float camH; uniform float deckR; uniform float dip; uniform float hAmp;
  uniform vec2 camXZ; uniform vec2 shift; uniform float drift;
  uniform float coverage; uniform float detail; uniform float shadows; uniform float groundHaze;
  uniform vec3 groundColor;
  varying vec3 vDir;

  const float PI = 3.14159265;
  const float TWO_PI = 6.2831853;
  const float KNEE = ${PLATE_KNEE.toFixed(3)};
  const float SHOULDER = ${PLATE_SHOULDER.toFixed(3)};

  vec2 rot2(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

  // the plate's highlight shoulder, undone: the JPG holds radiance 1:1 below the knee and
  // compressed above it, so the sun's aureole comes back as HDR for bloom and tone mapping
  vec3 decodePlate(vec3 y) {
    vec3 hi = KNEE - SHOULDER * log(1.0 - min((y - KNEE) / (1.0 - KNEE), 0.996));
    return mix(y, min(hi, vec3(8.0)), step(KNEE, y));
  }

  vec3 skyColor(vec3 d, float e) {
    // the plate was shot at ground level with its horizon at e = 0: slide its horizon down to the
    // dipped one, the shift fading out by 30 degrees up so the zenith stays where it is
    float e2 = e + dip * (1.0 - smoothstep(0.0, 0.5, e));
    float ce = cos(e2);
    vec2 hxz = normalize(d.xz + vec2(1e-5, 0.0));
    vec3 d2 = vec3(hxz.x * ce, sin(e2), hxz.y * ce);
    float up = max(d2.y, 0.0);
    vec3 col;
    if (hasPlate > 0.5) {
      vec2 uv = vec2((atan(d2.z, d2.x) + plateRot) / TWO_PI + 0.5, e2 / PI + 0.5);
      col = decodePlate(texture2D(plate, uv).rgb) * plateGain;
    } else {
      col = mix(hazeColor, vec3(0.09, 0.17, 0.40), pow(up, 0.5));
      float g = max(dot(d2, sunDir), 0.0);
      col += vec3(1.0, 0.95, 0.85) * (pow(g, 6.0) * 0.25 + pow(g, 60.0) * 1.2);
    }
    // altitude grading: a darker, bluer zenith and a more saturated sky
    col *= mix(vec3(1.0), zenithMul, pow(up, 0.6));
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = max(mix(vec3(lum), col, satBoost), 0.0);
    // the sky just above the horizon converges on the haze colour the deck fades into
    col = mix(col, hazeColor, smoothstep(0.05, -0.01, e2) * 0.8);
    // the sun: the plate's disc is clipped, so a small HDR disc and a tight glow stand in for it
    float ca = dot(d, sunDir);
    col += sunColor * (smoothstep(0.99994, 0.99999, ca) * 40.0 + pow(max(ca, 0.0), 800.0) * 2.0);
    return col;
  }

  // the cloud field at a ground point: coverage (0 clear → 1 solid) and top height (0..1)
  vec2 cloudField(vec2 q) {
    vec2 qr = rot2(q, 0.65);
    vec2 qd = q + vec2(drift, drift * 0.4);               // the cells' own slow evolution
    float big  = texture2D(noiseTex, q / 90000.0 + 0.37).g;                 // open / closed regions
    float base = texture2D(noiseTex, qr / 12000.0).r;                       // the cells, 1–3 km
    float mid  = texture2D(noiseTex, qd / 2600.0 + 0.11).g;
    float fine = texture2D(noiseTex, rot2(qd, 0.65) / 520.0).b;
    float fine2 = 0.5;
    if (detail > 0.0) fine2 = texture2D(noiseTex, qd / 110.0 + 0.5).r;
    // coverage from the large scales (the fine ones only roughen the edges); height from all of them
    float f = base * 0.56 + mid * 0.3 + fine * 0.1 + (fine2 - 0.5) * 0.04 * detail + 0.04;
    float thr = 0.66 - coverage * 0.34 + (0.5 - big) * 0.4;
    float cov = smoothstep(thr - 0.04, thr + 0.2, f);
    float h = cov * (0.35 + 0.3 * mid + 0.35 * fine) + (fine2 - 0.5) * 0.18 * detail * cov;
    return vec2(cov, h);
  }

  vec3 deckColor(vec3 d, float t, float oc) {
    vec3 p = d * t;                                     // the cloud-top point, metres from the camera
    vec2 q = p.xz + camXZ + shift;                      // ground-fixed coordinates, scrolled at airspeed
    vec3 N0 = normalize(vec3(p.x, p.y + oc, p.z));      // the deck sphere's normal
    vec2 cf = cloudField(q);
    float cov = cf.x, h = cf.y;
    // shading normal from the height field's slope, sampled a growing step apart with distance
    // (ground-space differences: stable at every angle, unlike screen-space derivatives)
    float dq = max(45.0, t * 0.0025);
    float hx = cloudField(q + vec2(dq, 0.0)).y, hz = cloudField(q + vec2(0.0, dq)).y;
    vec3 N = normalize(N0 + vec3(-(hx - h) * hAmp / dq, 0.0, -(hz - h) * hAmp / dq));

    // lit tops: a wide soft terminator (the tops scatter), sky light from above, the hollows
    // between the lumps in shadow, darker thin edges
    float lit = smoothstep(-0.2, 0.7, dot(N, sunDir));
    float hollow = 0.5 + 0.5 * smoothstep(0.0, 0.8, h);
    vec3 cloud = sunColor * (lit * 1.1 * hollow + 0.04) + skyAmbient * (0.5 + 0.5 * N.y) * (0.35 + 0.35 * hollow);
    float thick = smoothstep(0.03, 0.7, cov);
    cloud *= mix(0.7, 1.0, thick);
    cloud = mix(cloud * vec3(0.88, 0.93, 1.0), cloud, thick);
    // silver lining: the thin edges glow when the view runs toward the sun
    float fwd = pow(max(dot(d, sunDir), 0.0), 12.0);
    cloud += sunColor * fwd * (1.0 - thick) * cov * 2.2;

    // the ground through the gaps: land / sea far below, under a deep column of hazy air, in the
    // deck's own shadow where the sun is behind cloud
    float land = texture2D(noiseTex, q / 40000.0 + 0.7).b;
    vec3 ground = mix(groundColor * 0.75, groundColor * 1.3, land);
    if (shadows > 0.5) {
      vec2 qs = q + sunDir.xz / max(sunDir.y, 0.25) * 2200.0;
      ground *= 1.0 - 0.55 * cloudField(qs).x;
    }
    ground = mix(ground, hazeColor * 0.92, groundHaze);
    vec3 col = mix(ground, cloud, smoothstep(0.0, 0.45, cov));

    // aerial perspective along the ray to the deck, out to the horizon's haze
    float fogF = 1.0 - exp(-t * hazeBeta);
    return mix(col, hazeColor, fogF);
  }

  void main() {
    vec3 d = normalize(vDir);
    float e = asin(clamp(d.y, -1.0, 1.0));
    // ray / deck-sphere: the camera sits camH above a sphere of radius deckR; a ray that misses
    // takes the tangent distance, so t is continuous across the horizon
    float oc = deckR + camH;
    float b = oc * d.y;
    float c = camH * (2.0 * deckR + camH);
    float disc = b * b - c;
    float tH = sqrt(c);
    float t = (d.y < 0.0 && disc > 0.0) ? -b - sqrt(disc) : tH;
    vec3 col;
    if (e < -dip) col = deckColor(d, t, oc);
    else col = skyColor(d, e);
    gl_FragColor = vec4(col, 1.0);
  }`;

// ------------------------------------------------------------------------------- the dome
export class SkyDome extends THREE.Mesh {
  constructor() {
    const uniforms = {
      plate: { value: null }, hasPlate: { value: 0 }, plateRot: { value: 0 }, plateGain: { value: 1 },
      noiseTex: { value: null },
      sunDir: { value: new THREE.Vector3(0.5, 0.7, 0.5).normalize() },
      sunColor: { value: new THREE.Color(1.0, 0.96, 0.9) },
      skyAmbient: { value: new THREE.Color(0.34, 0.46, 0.76) },
      zenithMul: { value: new THREE.Vector3(1, 1, 1) },
      hazeColor: { value: new THREE.Color(0.66, 0.73, 0.84) },
      satBoost: { value: 1 }, hazeBeta: { value: 1 / 48000 },
      camH: { value: 3000 }, deckR: { value: R_EARTH_M + 8000 }, dip: { value: 0.03 }, hAmp: { value: 700 },
      camXZ: { value: new THREE.Vector2() }, shift: { value: new THREE.Vector2() }, drift: { value: 0 },
      coverage: { value: 0.55 }, detail: { value: 1 }, shadows: { value: 1 }, groundHaze: { value: 0.6 },
      groundColor: { value: new THREE.Color(0.22, 0.27, 0.35) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: vert, fragmentShader: frag,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    super(new THREE.SphereGeometry(1000, 48, 24), mat);
    this.uniforms = uniforms;
    this.renderOrder = -10;
    this.frustumCulled = false;
    this.userData.fx = true;
    this.userData.noAO = true;
    this.visible = false;
    this.shift = 0;          // metres flown
    this.drift = 0;          // seconds of cloud evolution
    this.grade = skyGrade(11000);
    /** Cloud amount 0..1 (0.55: a broken stratocumulus field with open lanes). */
    this.coverage = 0.55;
    /** Cloud tops this far below the aircraft (m), clamped so the deck stays above the ground. */
    this.deckDrop = 3000;
    /** Noise tier: detail 0/1 adds the 110 m octave; shadows 0/1 adds the deck's shadow on the ground. */
    this.tier = { detail: 1, shadows: 1 };
  }

  /** The photographic plate (an sRGB equirectangular texture) and its rotation about y (rad). */
  setPlate(texture, rotation = 0) {
    const u = this.uniforms;
    u.plate.value = texture;
    u.hasPlate.value = texture ? 1 : 0;
    u.plateRot.value = rotation;
  }

  setSun(dir, color) {
    this.uniforms.sunDir.value.copy(dir).normalize();
    if (color) this.uniforms.sunColor.value.set(color);
  }

  /**
   * Per frame. altitude: aircraft altitude (m); speed: airspeed (m/s), the deck scrolls aft at it;
   * unitMetres: metres per scene unit (camera offsets become real distances); camera: the stage camera.
   */
  update(dt, camera, { altitude = 11000, speed = 0, unitMetres = 1.7 } = {}) {
    const u = this.uniforms;
    if (!u.noiseTex.value) u.noiseTex.value = cloudNoise();
    this.position.copy(camera.position);
    const g = this.grade = skyGrade(altitude);
    u.zenithMul.value.fromArray(g.zenith);
    u.hazeColor.value.setRGB(g.haze[0], g.haze[1], g.haze[2]);
    u.skyAmbient.value.setRGB(g.ambient[0], g.ambient[1], g.ambient[2]);
    u.satBoost.value = g.sat;
    u.hazeBeta.value = g.beta;
    // the deck: tops deckDrop below the aircraft, never below 400 m; the camera's own height adds on
    const deckTop = Math.max(altitude - this.deckDrop, 400);
    const camH = Math.max(altitude - deckTop + camera.position.y * unitMetres, 250);
    const deckR = R_EARTH_M + deckTop;
    u.camH.value = camH;
    u.deckR.value = deckR;
    u.dip.value = Math.acos(deckR / (deckR + camH));
    u.hAmp.value = 620 + 140 * this.tier.detail;
    u.groundHaze.value = THREE.MathUtils.clamp(0.4 + deckTop / 14000, 0.4, 0.88);
    u.camXZ.value.set(camera.position.x * unitMetres, camera.position.z * unitMetres);
    // scroll: the aircraft flies toward +x (every model's nose), so the ground passes toward -x;
    // the noise tiles every 90 km in x (the largest scale's period), so the shift wraps there
    this.shift = (this.shift + dt * speed) % 90000;
    this.drift += dt * 1.2;
    u.shift.value.set(this.shift, 0);
    u.drift.value = this.drift % 90000;
    u.coverage.value = this.coverage;
    u.detail.value = this.tier.detail;
    u.shadows.value = this.tier.shadows;
  }
}

/**
 * Image-based lighting for the sky look: the pure-sky HDR above the horizon and the lit cloud
 * deck below it (the HDR's own lower half is a mirrored sky), so the aircraft's underside picks
 * up the warm bounce of the cloud tops. Returns a PMREM texture.
 */
export function skyEnvironment(pmrem, equirect, { cloud = 0xd9d3c9, cloudGain = 0.95 } = {}) {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { map: { value: equirect }, cloud: { value: new THREE.Color(cloud).multiplyScalar(cloudGain) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform vec3 cloud; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5);
        vec3 sky = texture2D(map, uv).rgb;
        float horizon = dot(texture2D(map, vec2(uv.x, 0.505)).rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 below = cloud * clamp(horizon * 0.9, 0.5, 1.4);      // the deck is about as bright as the horizon band
        gl_FragColor = vec4(mix(sky, below, smoothstep(0.0, -0.06, d.y)), 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const t = pmrem.fromScene(scene, 0).texture;
  mat.dispose();
  return t;
}
