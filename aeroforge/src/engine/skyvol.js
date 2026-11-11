// The open sky for aircraft in flight, as a real place: a spherical Earth with an ocean at sea
// level, a layer of volumetric cumulus between 1.2 and 4.6 km, a cirrus veil at 12.6 km, and the
// atmosphere of skymath.js (Rayleigh + Mie single scattering) for the sky and for the aerial
// perspective over every distance. Nothing follows the aircraft: climb, and the clouds fall away
// below, the horizon dips and the sky darkens; descend through 4 km and the aircraft flies between
// the clouds (the field opens around it), then below their bases over the sea.
//
// Clouds. Density comes from two tileable 3-D noise volumes (assets/sky, tools/make-cloud-noise.py)
// and a 2-D weather map (clouds.js), after Schneider's Horizon Zero Dawn cloudscapes: a
// Perlin-Worley base shape, dilated by cellular fbm, cut by the local coverage and a height
// profile that gives flat bases and domed tops, then eroded at the edges by fine cellular noise.
// A ray-march through the layer's spherical shell accumulates light and transmittance: coarse
// steps through clear air, fine steps (growing with distance) inside cloud; at each lit sample a
// short second march toward the sun gives the optical depth for Beer's law, summed over three
// octaves of a dual-lobe Henyey-Greenstein phase function for the multiple scattering (Wrenninge's
// approximation, as in Hillaire's Frostbite sky), plus sky light from above and the sea's bounce
// from below. The march runs in its own pass at a fraction of the frame (the clouds are soft; the
// horizon, sun and sea are drawn at full resolution by the dome) and the dome composites it with
// a bicubic filter.
//
// Sea. The ocean sphere reflects the sky by Fresnel, carries the sun's glitter path (Cox-Munk
// slope statistics for a 7 m/s wind), shows the deep-water blue between, and lies in the clouds'
// shadows.
//
// The class has SkyDome's interface (sky.js), so environment.js can use either.

import * as THREE from 'three';
import { SKY_TIERS, ATM2, skyRadiance2 as skyRadiance, sunTransmittance, WRAP } from './skymath.js';
import { cloudNoise } from './clouds.js';
import { skyGrade, CIRRUS_ALT } from './sky.js';

/** The cumulus layer (m above sea level). */
export const CLOUD_BASE = 1200;
export const CLOUD_TOP = 4600;
/** Tiles of the two noise volumes (m); both divide the scroll's wrap. */
export const SHAPE_TILE = WRAP / 8;         // 11.25 km over 128 voxels
export const DETAIL_TILE = WRAP / 60;       // 1.5 km over 64 voxels

/** March budget by graphics preset: view steps, sun steps (and how many of them read the full
 *  detail, so the lobes shade each other), and the pass's share of the frame. */
export const VOL_TIERS = {
  '4k':        { steps: 112, light: 6, full: 3, scale: 0.5 },
  ultra:       { steps: 112, light: 6, full: 3, scale: 0.6 },
  high:        { steps: 88, light: 5, full: 3, scale: 0.5 },
  balanced:    { steps: 64, light: 4, full: 1, scale: 0.4 },
  performance: { steps: 44, light: 3, full: 1, scale: 0.33 },
};

// ------------------------------------------------------------------------------- noise volumes
let volumes = null;
function atlasToVolume(img, n, cols) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const src = g.getImageData(0, 0, c.width, c.height).data;
  const out = new Uint8Array(n * n * n * 4);
  for (let z = 0; z < n; z++) {
    const ox = (z % cols) * n, oy = Math.floor(z / cols) * n;
    for (let y = 0; y < n; y++) {
      const s = ((oy + y) * c.width + ox) * 4;
      out.set(src.subarray(s, s + n * 4), (z * n + y) * n * 4);
    }
  }
  const t = new THREE.Data3DTexture(out, n, n, n);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}
/** The two noise volumes, loaded once: { shape, detail } (3-D textures). */
export function cloudVolumes() {
  if (!volumes) {
    const load = (url) => new THREE.ImageLoader().loadAsync(url);
    volumes = Promise.all([load('assets/sky/cloud-shape.png'), load('assets/sky/cloud-detail.png')])
      .then(([a, b]) => ({ shape: atlasToVolume(a, 128, 16), detail: atlasToVolume(b, 64, 8) }));
  }
  return volumes;
}

// ------------------------------------------------------------------------------- GLSL: atmosphere
// skymath.js's second model (ATM2, inscatter2), term for term.
const f = (v) => (Math.abs(v) < 1e-2 ? v.toExponential(4) : v.toFixed(Number.isInteger(v) ? 1 : 4));
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;
const ATMOSPHERE_GLSL = /* glsl */`
  const float R_E = ${f(ATM2.R)};
  const float H_ATM = ${f(ATM2.H)};
  const vec3 BETA_R = ${v3(ATM2.betaR)};
  const float H_R = ${f(ATM2.HR)};
  const float BETA_MS = ${f(ATM2.betaMs)};
  const float BETA_ME = ${f(ATM2.betaMe)};
  const float H_M = ${f(ATM2.HM)};
  const float MIE_G = ${f(ATM2.g)};
  const vec3 BETA_O = ${v3(ATM2.betaO)};
  const float O_ALT = ${f(ATM2.ozoneAlt)};
  const float O_HALF = ${f(ATM2.ozoneHalf)};
  const float SUN_E = ${f(ATM2.E)};
  const vec3 MS_PSI = ${v3(ATM2.ms)};

  float airmass(float sinE) {
    float e = degrees(asin(clamp(sinE, -1.0, 1.0)));
    return 1.0 / max(sinE + 0.15 * pow(max(e + 3.885, 0.1), -1.253), 0.02);
  }

  // light scattered into the ray d between the camera and distance tEnd (or the top of the
  // atmosphere), in n samples; transm returns the transmittance over that path
  vec3 inscatter(vec3 d, float tEnd, int n, out vec3 transm) {
    float r0 = R_E + camAlt;
    float b = r0 * d.y;
    float c = (camAlt - H_ATM) * (2.0 * R_E + camAlt + H_ATM);
    float len = min(tEnd, -b + sqrt(max(b * b - c, 0.0)));
    float cosT = dot(d, sunDir);
    float pr = 0.0596831 * (1.0 + cosT * cosT);
    float g2 = MIE_G * MIE_G;
    float pm = 0.0795775 * (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * MIE_G * cosT, 1e-4), 1.5);
    float xs = airmass(sunDir.y);
    vec3 tau = vec3(0.0), L = vec3(0.0);
    float dt = len / float(max(n, 1));
    for (int i = 0; i < 16; i++) {
      if (i >= n) break;
      float t = (float(i) + 0.5) * dt;
      float h = max(sqrt(max(r0 * r0 + t * t + 2.0 * r0 * t * d.y, 0.0)) - R_E, 0.0);
      float rhoR = exp(-h / H_R), rhoM = exp(-h / H_M);
      float rhoO = max(0.0, 1.0 - abs(h - O_ALT) / O_HALF);
      float colO = O_HALF * clamp((O_ALT + O_HALF - h) / (2.0 * O_HALF), 0.0, 1.0);
      vec3 ext = BETA_R * rhoR + vec3(BETA_ME * rhoM) + BETA_O * rhoO;
      vec3 tauSun = (BETA_R * (H_R * rhoR) + vec3(BETA_ME * H_M * rhoM) + BETA_O * colO) * xs;
      tau += ext * dt * 0.5;
      vec3 scat = BETA_R * (rhoR * pr) + vec3(BETA_MS * rhoM * pm);
      vec3 msr = (BETA_R * rhoR + vec3(BETA_MS * rhoM)) * MS_PSI;
      L += (exp(-(tau + tauSun)) * scat + exp(-(tau + tauSun * 0.35)) * msr) * dt;
      tau += ext * dt * 0.5;
    }
    transm = exp(-tau);
    return L * SUN_E * sunColor;
  }
`;

// ------------------------------------------------------------------------------- GLSL: the world
// Shared by the cloud pass and the dome. Positions are metres: x and z horizontal (the camera's
// offset from the origin plus the distance flown), y the altitude above sea level.
const WORLD_GLSL = /* glsl */`
  precision highp sampler3D;
  uniform highp sampler3D shapeTex; uniform highp sampler3D detailTex; uniform sampler2D weatherTex;
  uniform vec3 sunDir; uniform vec3 sunColor; uniform float camAlt;
  uniform vec2 camXZ; uniform vec2 shift; uniform vec3 wind;
  uniform float coverage; uniform float cloudBase; uniform float cloudTop; uniform float clearR;
  uniform float cloudsOn;

  ${ATMOSPHERE_GLSL}

  const float SHAPE_TILE = ${SHAPE_TILE.toFixed(1)};
  const float DETAIL_TILE = ${DETAIL_TILE.toFixed(1)};
  const float SIGMA = 0.024;                             // extinction of dense cloud (1/m)

  float sat(float x) { return clamp(x, 0.0, 1.0); }

  // altitude at distance t along a ray whose vertical direction cosine is dy (exact on the sphere,
  // arranged so nothing cancels: the altitudes are metres on a 6371 km radius)
  float rayAlt(float t, float dy) {
    float r0 = R_E + camAlt;
    float num = camAlt * (2.0 * R_E + camAlt) + 2.0 * r0 * t * dy + t * t;
    return num / (sqrt(max(r0 * r0 + 2.0 * r0 * t * dy + t * t, 1.0)) + R_E);
  }

  // distances along the ray to the sphere at altitude hs: (near, far); near > far when it misses
  vec2 hitAlt(float hs, float dy) {
    float r0 = R_E + camAlt;
    float b = r0 * dy;
    float c = (camAlt - hs) * (2.0 * R_E + camAlt + hs);
    float disc = b * b - c;
    if (disc < 0.0) return vec2(1.0, -1.0);
    float s = sqrt(disc);
    float q = b > 0.0 ? -b - s : -b + s;
    float t2 = abs(q) > 1e-6 ? c / q : 0.0;
    return vec2(min(q, t2), max(q, t2));
  }

  // the weather at a ground position: x = local coverage 0..1, y = how far up the layer the tops
  // reach here (0..1). foot is the sample's footprint in metres (it picks the mip level).
  vec2 weatherAt(vec2 p, float foot) {
    vec2 q = p + shift;
    vec4 a = textureLod(weatherTex, q / 90000.0, max(log2(foot / 176.0), 0.0));
    vec4 b = textureLod(weatherTex, q.yx / 30000.0 + vec2(0.37, 0.11), max(log2(foot / 59.0), 0.0));
    // convection cells 4.5 km across (the texture's cellular channel, domed: 1 at a cell's centre)
    float cell = textureLod(weatherTex, q / 45000.0 + vec2(0.5, 0.2), max(log2(foot / 88.0), 0.0)).a;
    float m = a.r * 0.52 + b.g * 0.26 + cell * 0.22;
    float thr = mix(0.72, 0.28, coverage);
    float cov = smoothstep(thr - 0.09, thr + 0.11, m);
    // tops: low over most of the field, towering where a region is convective and at its cells' cores
    float region = smoothstep(0.34, 0.68, a.b * 0.65 + b.r * 0.35);
    float top = (0.3 + 0.7 * region * (0.25 + 0.75 * cell)) * mix(0.7, 1.0, cov);
    // flying inside the layer: the field opens around the aircraft
    if (clearR > 0.0) cov *= smoothstep(clearR * 0.3, clearR, length(p - camXZ));
    return vec2(cov, top);
  }

  // The cloud's base shape as a signed field: positive inside; outside, the shortfall, which
  // grows by about 1 per 600 m from the nearest cloud (the march strides by it). hr returns the
  // height within this cloud's own depth.
  float shapeAt(vec3 p, vec2 wx, float foot, out float hr) {
    float hf = (p.y - cloudBase) / (cloudTop - cloudBase);
    hr = hf / wx.y;
    if (hf <= 0.0 || hf >= 1.0 || wx.x <= 0.002) return -1.0;
    // above this cloud's top: the height above it
    if (hr >= 1.0) return -min(0.1 + (hf - wx.y) * (cloudTop - cloudBase) / 1000.0, 1.2);
    // flat base, widest low down, narrowing to a domed top
    float prof = smoothstep(0.0, 0.07, hr) * mix(1.0, 0.0, smoothstep(0.18, 1.0, hr) * 0.78);
    vec3 q = vec3(p.x + shift.x, p.y, p.z + shift.y);
    vec4 s = textureLod(shapeTex, q / SHAPE_TILE, max(log2(foot / 88.0), 0.0));
    float base = (s.r - (s.g - 1.0)) / (2.0 - s.g);         // Perlin-Worley dilated by the cellular fbm
    return base * prof - (1.0 - wx.x * 0.62);
  }

  // Extinction (1/m) from the base shape (raw > 0), eroded at the edges: lobes a few hundred
  // metres across (the shape volume again at four times the frequency), then the fine cellular
  // detail, wispy at the base and billowing on top. Both fade out as the footprint outgrows them.
  float erodeAt(vec3 p, float raw, vec2 wx, float foot, float hr) {
    float d = min(raw / (wx.x * 0.62 * 0.8), 1.0);
    vec3 q = vec3(p.x + shift.x, p.y, p.z + shift.y);
    float ml = log2(max(foot, 1.0) / 22.0);
    float k2 = 1.0 - sat(ml / 5.0);
    float w = k2 > 0.0 ? mix(0.48, textureLod(shapeTex, q.zxy / (SHAPE_TILE * 0.25) + 0.37, max(ml, 0.0)).g, k2) : 0.48;
    float e2 = sat((0.74 - w) * 1.6) * 0.7;                          // (its mean stands in once the lobes are too small to see)
    d = (d - e2) / (1.0 - e2);
    if (d <= 0.0) return 0.0;
    float k3 = 0.42 * (1.0 - sat(ml / 4.5));
    if (k3 > 0.0) {
      vec3 e = textureLod(detailTex, (q + wind) / DETAIL_TILE, max(ml, 0.0)).rgb;
      float f = e.r * 0.5 + e.g * 0.3 + e.b * 0.2;
      // and the same volume five times finer, for the cloud a kilometre or two away
      float k4 = 1.0 - sat((ml + 2.3) / 3.0);
      if (k4 > 0.0) f = mix(f, f * 0.72 + textureLod(detailTex, (q.yzx + wind.zxy) / (DETAIL_TILE * 0.2) + 0.19, max(ml + 2.3, 0.0)).g * 0.28, k4);
      float m = mix(f, 1.0 - f, sat(hr * 3.0)) * k3 + 0.2 * (0.42 - k3) / 0.42 * 0.42;
      d = (d - m) / (1.0 - m);
    } else {
      d = (d - 0.2) / 0.8;
    }
    return sat(d * 2.6) * SIGMA * mix(0.75, 1.0, hr);
  }

  // extinction at p. cheap: the erosion's mean in place of its noise (one texture read), for the
  // light samples and the shadows on the sea.
  float densityAt(vec3 p, vec2 wx, float foot, bool cheap) {
    float hr;
    float raw = shapeAt(p, wx, foot, hr);
    if (raw <= 0.0) return 0.0;
    if (!cheap) return erodeAt(p, raw, wx, foot, hr);
    float d = (min(raw / (wx.x * 0.62 * 0.8), 1.0) - 0.42) / 0.58;
    return sat(d * 2.6) * SIGMA * mix(0.75, 1.0, hr);
  }
`;

// ------------------------------------------------------------------------------- GLSL: cloud pass
const cloudVert = /* glsl */`
  uniform mat4 invProj; uniform mat4 camWorld;
  varying vec3 vRay;
  void main() {
    vec4 v = invProj * vec4(position.xy, 1.0, 1.0);
    vRay = mat3(camWorld) * (v.xyz / v.w);
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }`;

const cloudFrag = /* glsl */`
  ${WORLD_GLSL}
  uniform int steps; uniform int lightSteps; uniform int lightFull; uniform float pixAngle;
  uniform vec3 ambTop; uniform vec3 ambBot; uniform float cloudSun; uniform vec3 sunAtCloud;
  varying vec3 vRay;

  const float PI = 3.14159265;
  float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5)); }
  float phase(float c, float k) { return mix(hg(c, 0.78 * k), hg(c, -0.28 * k), 0.28); }

  // optical depth from p toward the sun: steps that lengthen with distance, through the layer
  float sunDepth(vec3 p, vec2 wx, float foot) {
    float od = 0.0, l = 0.0, st = 60.0;
    for (int i = 0; i < 6; i++) {
      if (i >= lightSteps) break;
      vec3 pp = p + sunDir * (l + st * 0.5);
      // the far samples reach other clouds: read their own weather
      vec2 w = i < 3 ? wx : weatherAt(pp.xz, max(foot, st));
      od += densityAt(pp, w, max(foot, st * 0.5), i >= lightFull) * st * 1.4;
      l += st; st *= 1.95;
    }
    return od;
  }

  vec3 posAt(vec3 rd, float t) { return vec3(camXZ.x + rd.x * t, rayAlt(t, rd.y), camXZ.y + rd.z * t); }

  void main() {
    vec3 rd = normalize(vRay);
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    if (cloudsOn < 0.5) return;
    // the part of the ray inside the layer's shell
    vec2 o = hitAlt(cloudTop, rd.y), n = hitAlt(cloudBase, rd.y), g = hitAlt(0.0, rd.y);
    bool sea = g.x <= g.y && g.x > 0.0;
    bool inner = n.x <= n.y && n.x > 0.0;
    float tA, tB;
    if (camAlt >= cloudTop) {
      if (o.x > o.y || o.y <= 0.0) return;
      tA = max(o.x, 0.0); tB = inner ? n.x : o.y;
    } else if (camAlt > cloudBase) {
      tA = 0.0; tB = inner ? n.x : o.y;
    } else {
      if (sea) return;
      tA = max(n.y, 0.0); tB = o.y;
    }
    tB = min(tB, 260000.0);
    if (tB <= tA) return;

    float cosT = dot(rd, sunDir);
    float ph0 = phase(cosT, 1.0), ph1 = phase(cosT, 0.5), ph2 = phase(cosT, 0.25);
    vec3 sunL = sunAtCloud * cloudSun;
    float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float t = tA + jitter * max(24.0, tA * 0.0062);
    float T = 1.0; vec3 L = vec3(0.0);
    float tw = 0.0, ww = 0.0;
    bool prevEmpty = true; float last = 0.0;
    for (int k = 0; k < 160; k++) {
      if (k >= steps || t >= tB || T < 0.012) break;
      // the stride inside cloud grows with distance, and again as the budget runs out
      float df = max(24.0, t * 0.0062) * (1.0 + 3.0 * smoothstep(0.7, 1.0, float(k) / float(steps)));
      float foot = max(df * 0.5, t * pixAngle);
      vec3 p = posAt(rd, t);
      vec2 wx = weatherAt(p.xz, foot);
      float hr;
      float raw = shapeAt(p, wx, foot, hr);
      if (raw <= 0.0) {
        // clear air: stride by the distance to the nearest cloud the field implies
        last = clamp(-raw * 600.0, df, max(700.0, t * 0.05));
        t += last; prevEmpty = true;
        continue;
      }
      float d = erodeAt(p, raw, wx, foot, hr);
      if (d > 0.0 && prevEmpty && last > 0.0) {
        // the cloud's face lies between the last clear sample and this one: find it, so the
        // silhouette is the field's own and not the sampling's
        float lo = t - last, hi = t;
        for (int j = 0; j < 5; j++) {
          float tm = 0.5 * (lo + hi);
          vec3 pm = posAt(rd, tm);
          if (densityAt(pm, weatherAt(pm.xz, foot), foot, false) > 0.0) hi = tm; else lo = tm;
        }
        t = hi + df * 0.5;
        p = posAt(rd, t);
        wx = weatherAt(p.xz, foot);
        d = densityAt(p, wx, foot, false);
      }
      prevEmpty = d <= 0.0;
      if (d > 0.0) {
        float od = sunDepth(p, wx, foot);
        float hf = sat((p.y - cloudBase) / (cloudTop - cloudBase));
        // multiple scattering as octaves: each deeper order sees less extinction and a rounder phase
        float sun = exp(-od) * ph0 + 0.44 * exp(-od * 0.42) * ph1 + 0.16 * exp(-od * 0.16) * ph2;
        // sky light from above (less of it deep in the layer), the sea's and lower clouds' bounce from below
        float open = mix(0.25, 1.0, hf) * mix(1.0, 0.35, sat(d / SIGMA));
        vec3 amb = ambTop * open + ambBot * mix(0.9, 0.25, hf);
        vec3 S = (sunL * sun + amb) * d;
        float Tr = exp(-d * df);
        vec3 Si = (S - S * Tr) / d;                        // the step's in-scattering, integrated exactly
        L += T * Si;
        float wgt = T * (1.0 - Tr);
        tw += wgt * t; ww += wgt;
        T *= Tr;
      }
      last = df;
      t += df;
    }
    if (ww <= 0.0) return;
    // aerial perspective: the cloud as seen through the air in front of it
    T = (T - 0.012) / (1.0 - 0.012);
    vec3 tr;
    vec3 air = inscatter(rd, tw / ww, 6, tr);
    gl_FragColor = vec4(max(L * tr + air * (1.0 - T), 0.0), sat(T));
  }`;

// ------------------------------------------------------------------------------- GLSL: the dome
const domeVert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;                                   // the dome is centred on the camera
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w * 0.99999;           // always at the far plane
  }`;

const domeFrag = /* glsl */`
  ${WORLD_GLSL}
  uniform sampler2D cloudTex; uniform vec2 resolution; uniform vec2 cloudSize;
  uniform float pixAngle; uniform vec3 skyZen0; uniform vec3 skyHor0; uniform float sunGain;
  uniform float cirrus; uniform float flare; uniform vec3 sunNdc; uniform float seaWind;
  uniform vec3 sunAtCam; uniform vec3 sunAtSea; uniform vec3 envCloud; uniform vec3 envBase; uniform float envCover;
  varying vec3 vDir;

  const float PI = 3.14159265;
  const float SUN_R = 0.00465;                         // the sun's angular radius (rad)

  // The sun: a limb-darkened disc of the true angular size, antialiased over a pixel, and the
  // circumsolar aureole of forward scattering.
  vec3 sunDisc(vec3 d) {
    float ca = dot(d, sunDir);
    if (ca < 0.9) return vec3(0.0);
    float ang = length(cross(d, sunDir));
    float disc = 1.0 - smoothstep(SUN_R - pixAngle, SUN_R + pixAngle, ang);
    float u = clamp(ang / SUN_R, 0.0, 1.0);
    float limb = 1.0 - 0.55 * (1.0 - sqrt(max(1.0 - u * u, 0.0)));
    float r = ang / 0.012;
    float aureole = 0.9 / (1.0 + r * r) + 0.12 / (1.0 + 0.1 * r * r);
    return sunAtCam * (disc * limb * 60.0 + aureole * (1.0 - disc));
  }

  // The cirrus veil far above: fibrous, streaked along the wind, patchy, bright toward the sun.
  vec3 cirrusLayer(vec3 d, vec3 col) {
    float hc = ${CIRRUS_ALT.toFixed(1)};
    if (cirrus < 0.5 || camAlt > hc - 300.0 || d.y < 0.0) return col;
    float t = hitAlt(hc, d.y).y;
    if (t <= 0.0 || t > 400000.0) return col;
    vec2 q = camXZ + d.xz * t + shift;
    float foot = t * pixAngle / max(d.y + t / R_E, 0.03);
    float l = log2(max(foot, 1.0));
    float mask = textureLod(weatherTex, q / 90000.0 + 0.23, max(l - 7.5, 0.0)).g;
    vec4 S = textureLod(weatherTex, vec2(q.x * 0.5, q.y * 2.0) / 45000.0 + 0.61, max(l - 6.5, 0.0));
    float fib = textureLod(weatherTex, vec2(q.x * 0.25, q.y * 2.0) / 3000.0 + 0.3, max(l - 2.5, 0.0)).b;
    float a = smoothstep(0.47, 0.84, S.b * 0.44 + S.g * 0.14 + mask * 0.3 + fib * 0.12) * 0.3;
    a *= smoothstep(300.0, 1800.0, hc - camAlt);
    float fwd = pow(max(dot(d, sunDir), 0.0), 8.0);
    vec3 tr;
    vec3 air = inscatter(d, t, 4, tr);
    vec3 cc = (sunAtCam * (0.8 + 0.9 * fwd) + skyZen0 * 0.6) * tr + air;
    return mix(col, cc, a);
  }

  // The sea at distance t along d.
  vec3 seaColor(vec3 d, float t) {
    float r0 = R_E + camAlt;
    vec3 up = normalize(vec3(d.x * t, r0 + d.y * t, d.z * t));
    float cosV = max(dot(-d, up), 0.001);
    vec2 pw = camXZ + d.xz * t;                          // ground position (m)
    vec2 q = pw + shift;
    float foot = t * pixAngle / sqrt(cosV);
    float l = log2(max(foot, 0.01));
    // the swell and the wind sea, as slopes; each fades out as its wavelength shrinks below a pixel
    // (and before its tile, repeating, could show as a grid)
    vec2 s1 = textureLod(weatherTex, q / 250.0 + wind.xz / 1500.0, max(l + 1.0, 0.0)).rg - 0.5;
    vec2 s2 = textureLod(weatherTex, q.yx / 30.0 - wind.zx / 187.5, max(l + 4.1, 0.0)).gb - 0.5;
    vec2 slope = s1 * (0.5 * (1.0 - smoothstep(1.0, 4.0, foot))) + s2 * (0.55 * (1.0 - smoothstep(0.12, 0.5, foot)));
    vec3 tx = normalize(cross(vec3(0.0, 0.0, 1.0), up)), tz = cross(up, tx);
    vec3 nw = normalize(up - tx * slope.x - tz * slope.y);
    float cosN = max(dot(-d, nw), 0.0);
    // Fresnel, with the roughness of the unresolved waves keeping the grazing reflectance below 1
    float F = 0.02 + 0.98 * pow(1.0 - mix(cosN, cosV, 0.5), 5.0);
    F = min(F, 0.62);
    vec3 R = reflect(d, nw);
    float ry = abs(dot(R, up));
    vec3 skyR = mix(skyHor0, skyZen0, pow(ry, 0.42));
    // the clouds' shadow, and their reflection's share of the sky
    float shade = 1.0, over = 0.0;
    if (cloudsOn > 0.5) {
      float od = 0.0;
      float f2 = max(foot, 260.0);
      for (int i = 0; i < 3; i++) {
        float hh = cloudBase + (cloudTop - cloudBase) * (0.14 + 0.2 * float(i));
        vec2 pp = pw + sunDir.xz * (hh / max(sunDir.y, 0.12));
        od += densityAt(vec3(pp.x, hh, pp.y), weatherAt(pp, f2), f2, true);
      }
      od *= (cloudTop - cloudBase) * 0.2 / max(sunDir.y, 0.12);
      shade = mix(0.16, 1.0, exp(-od * 0.5));
      over = weatherAt(pw, max(foot, 400.0)).x;
    }
    // the water body: what comes back up out of deep ocean water
    vec3 E = sunAtSea * (sunGain * sunDir.y * shade) + skyZen0 * 2.2;
    vec3 body = vec3(0.0035, 0.016, 0.034) * E;
    // overcast patches reflect cloud base, not blue sky
    skyR = mix(skyR, vec3(dot(skyR, vec3(0.3333))) * 0.8, over * 0.6);
    // the glitter path: Cox-Munk slope distribution about the mean surface
    vec3 h = normalize(sunDir - d);
    float zh = max(dot(h, mix(up, nw, 0.35)), 0.05);
    float tan2 = (1.0 - zh * zh) / (zh * zh);
    float s2w = 0.003 + 0.00512 * seaWind;
    float P = exp(-tan2 / s2w) / (PI * s2w);
    float Fh = 0.02 + 0.98 * pow(1.0 - max(dot(-d, h), 0.0), 5.0);
    vec3 glint = sunAtSea * (sunGain * Fh * P / (4.0 * max(cosV, 0.06) * zh * zh * zh * zh)) * shade;
    vec3 col = body * (1.0 - F) + skyR * F + min(glint, vec3(14.0));
    vec3 tr;
    vec3 air = inscatter(d, t, 8, tr);
    return col * tr + air;
  }

  // the cloud pass, bicubic (Catmull-Rom, 9 bilinear taps) so its edges stay crisp when enlarged
  vec4 clouds(vec2 uv) {
    vec2 sp = uv * cloudSize;
    vec2 c = floor(sp - 0.5) + 0.5;
    vec2 f = sp - c;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 o12 = w2 / w12;
    vec2 p0 = (c - 1.0) / cloudSize, p3 = (c + 2.0) / cloudSize, p12 = (c + o12) / cloudSize;
    vec4 r = texture2D(cloudTex, vec2(p0.x, p0.y)) * (w0.x * w0.y) + texture2D(cloudTex, vec2(p12.x, p0.y)) * (w12.x * w0.y) + texture2D(cloudTex, vec2(p3.x, p0.y)) * (w3.x * w0.y)
           + texture2D(cloudTex, vec2(p0.x, p12.y)) * (w0.x * w12.y) + texture2D(cloudTex, vec2(p12.x, p12.y)) * (w12.x * w12.y) + texture2D(cloudTex, vec2(p3.x, p12.y)) * (w3.x * w12.y)
           + texture2D(cloudTex, vec2(p0.x, p3.y)) * (w0.x * w3.y) + texture2D(cloudTex, vec2(p12.x, p3.y)) * (w12.x * w3.y) + texture2D(cloudTex, vec2(p3.x, p3.y)) * (w3.x * w3.y);
    return vec4(max(r.rgb, 0.0), clamp(r.a, 0.0, 1.0));
  }

  // A gentle lens response when the sun nears the frame edge: veiling glare and one soft ghost.
  vec3 lensFlare(vec3 col) {
    if (flare < 0.5 || sunNdc.z < 0.5) return col;
    float edge = max(abs(sunNdc.x), abs(sunNdc.y));
    float k = smoothstep(0.55, 1.0, edge) * (1.0 - smoothstep(1.15, 1.7, edge));
    if (k <= 0.0) return col;
    vec2 res = max(resolution, vec2(1.0));
    vec2 fc = gl_FragCoord.xy / res * 2.0 - 1.0;
    float aspect = res.x / res.y;
    vec2 dv = (fc - sunNdc.xy) * vec2(aspect, 1.0);
    col += sunAtCam * k * 0.09 / (1.0 + 2.5 * dot(dv, dv));
    vec2 g = (fc + sunNdc.xy * 0.55) * vec2(aspect, 1.0);
    col += vec3(0.85, 0.93, 1.0) * k * 0.05 * smoothstep(0.17, 0.02, length(g));
    return col;
  }

  void main() {
    vec3 d = normalize(vDir);
    vec2 g = hitAlt(0.0, d.y);
    vec3 col;
    if (g.x <= g.y && g.x > 0.0) {
      col = seaColor(d, g.x);
    } else {
      vec3 tr;
      col = inscatter(d, 1e9, 12, tr);
      col = cirrusLayer(d, col);
#ifndef ENV
      col += sunDisc(d);
#endif
    }
#ifdef ENV
    // For image-based lighting (the key light is the sun, so no disc here) the cloud field is its
    // average: lit tops spread below the aircraft, grey bases overhead when it flies under them.
    float topAlt = cloudBase + (cloudTop - cloudBase) * 0.4;
    if (envCover > 0.0 && camAlt > topAlt) {
      vec2 c = hitAlt(topAlt, d.y);
      if (c.x <= c.y && c.x > 0.0) {
        float sinV = clamp((camAlt - topAlt) / c.x, 0.06, 1.0);
        vec3 tr;
        vec3 air = inscatter(d, c.x, 4, tr);
        col = mix(col, envCloud * tr + air, 1.0 - pow(1.0 - envCover, 1.0 / sinV));
      }
    } else if (envCover > 0.0 && camAlt < cloudBase && d.y > 0.0) {
      float t = hitAlt(cloudBase, d.y).y;
      float sinV = clamp((cloudBase - camAlt) / max(t, 1.0), 0.06, 1.0);
      vec3 tr;
      vec3 air = inscatter(d, t, 4, tr);
      col = mix(col, envBase * tr + air, 1.0 - pow(1.0 - envCover, 1.0 / sinV));
    }
#else
    if (cloudsOn > 0.5) {
      vec4 c = clouds(gl_FragCoord.xy / max(resolution, vec2(1.0)));
      col = col * c.a + c.rgb;
    }
    col = lensFlare(col);
#endif
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;

// ------------------------------------------------------------------------------- the sky
const wrap = (v, p) => ((v % p) + p) % p;

export class VolumetricSky extends THREE.Mesh {
  constructor() {
    const world = {
      shapeTex: { value: null }, detailTex: { value: null }, weatherTex: { value: null },
      sunDir: { value: new THREE.Vector3(0.5, 0.7, 0.5).normalize() },
      sunColor: { value: new THREE.Color(1.0, 0.96, 0.9) },
      camAlt: { value: 11000 }, camXZ: { value: new THREE.Vector2() }, shift: { value: new THREE.Vector2() },
      wind: { value: new THREE.Vector3() },
      coverage: { value: 0.5 }, cloudBase: { value: CLOUD_BASE }, cloudTop: { value: CLOUD_TOP }, clearR: { value: 0 },
      cloudsOn: { value: 0 }, sunGain: { value: 3.6 },
    };
    const uniforms = {
      ...world,
      cloudTex: { value: null }, resolution: { value: new THREE.Vector2(1920, 1080) }, cloudSize: { value: new THREE.Vector2(960, 540) },
      pixAngle: { value: 5e-4 }, skyZen0: { value: new THREE.Color(0.1, 0.2, 0.45) }, skyHor0: { value: new THREE.Color(0.6, 0.7, 0.8) },
      cirrus: { value: 1 }, flare: { value: 1 }, sunNdc: { value: new THREE.Vector3() }, seaWind: { value: 7 },
      sunAtCam: { value: new THREE.Color(1, 0.96, 0.9) }, sunAtSea: { value: new THREE.Color(1, 0.9, 0.75) },
      envCloud: { value: new THREE.Color(0.9, 0.9, 0.9) }, envBase: { value: new THREE.Color(0.3, 0.32, 0.35) }, envCover: { value: 0.45 },
      plateGain: { value: 1 },                       // SkyDome's interface; unused here
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: domeVert, fragmentShader: domeFrag,
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    super(new THREE.SphereGeometry(1000, 48, 24), mat);
    this.uniforms = uniforms;
    this.renderOrder = -10;
    this.frustumCulled = false;
    this.userData.fx = true;
    this.userData.noAO = true;
    this.visible = false;
    this.isVolumetricSky = true;

    // the cloud pass: one triangle over the frame, into its own half-float target
    this.cloudUniforms = {
      ...world,
      invProj: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() },
      steps: { value: 96 }, lightSteps: { value: 6 }, lightFull: { value: 3 }, pixAngle: { value: 1e-3 },
      ambTop: { value: new THREE.Color(0.3, 0.4, 0.6) }, ambBot: { value: new THREE.Color(0.1, 0.12, 0.15) },
      cloudSun: { value: 16 }, sunAtCloud: { value: new THREE.Color(1, 0.95, 0.85) },      // the sun on the clouds: calibrates the scattering approximation so thick sunlit cloud is about as bright as white paint
    };
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this._quad = new THREE.Mesh(tri, new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms, vertexShader: cloudVert, fragmentShader: cloudFrag, depthTest: false, depthWrite: false, fog: false,
    }));
    this._quad.frustumCulled = false;
    this._scene = new THREE.Scene();
    this._scene.add(this._quad);
    this._cam = new THREE.Camera();
    this.cloudTarget = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    });
    uniforms.cloudTex.value = this.cloudTarget.texture;

    this.shift = 0;                 // metres flown
    this.wind = new THREE.Vector3();
    this.grade = skyGrade(11000);
    /** Cloud amount 0..1. */
    this.coverage = 0.5;
    /** March budget (VOL_TIERS) and the deck switches of SkyDome's tiers (cirrus, flare). */
    this.tier = { ...SKY_TIERS.ultra };
    this.quality = 'high';
    /** Clouds on or off (off: the sky, sun and sea only). */
    this.clouds = true;
    this.ready = false;
    this._dirty = false;
    this._sunWorld = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._size = new THREE.Vector2();
    this._ambKey = '';
    cloudVolumes().then((v) => {
      world.shapeTex.value = v.shape;
      world.detailTex.value = v.detail;
      this.ready = true;
    }).catch((e) => { console.warn('AEROFORGE: cloud volumes did not load; the sky is drawn without clouds', e); });

    // The cloud pass is rendered from inside the dome's own draw (as a mirror renders its
    // reflection), once per frame, with the camera the frame is drawn with.
    this.onBeforeRender = (renderer, scene, camera) => {
      const rt = renderer.getRenderTarget();
      if (rt) uniforms.resolution.value.set(rt.width, rt.height);
      else uniforms.resolution.value.copy(renderer.getDrawingBufferSize(this._size));
      if (!this._dirty || world.cloudsOn.value < 0.5) return;
      this._dirty = false;
      const cu = this.cloudUniforms;
      cu.invProj.value.copy(camera.projectionMatrixInverse);
      cu.camWorld.value.copy(camera.matrixWorld);
      const xr = renderer.xr.enabled, shadows = renderer.shadowMap.autoUpdate;
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this.cloudTarget);
      renderer.render(this._scene, this._cam);
      renderer.xr.enabled = xr;
      renderer.shadowMap.autoUpdate = shadows;
      renderer.setRenderTarget(rt);
      const vp = camera.viewport;
      if (vp !== undefined) renderer.state.viewport(vp);
    };
  }

  /** SkyDome's interface: this sky needs no photographic plate. */
  setPlate() {}

  setSun(dir, color) {
    this.uniforms.sunDir.value.copy(dir).normalize();
    if (color) this.uniforms.sunColor.value.set(color);
  }

  /**
   * Per frame. altitude: the aircraft's altitude (m); speed: airspeed (m/s), the world passes aft
   * at it; unitMetres: metres per scene unit; pixels / width: the frame in device pixels.
   */
  update(dt, camera, { altitude = 11000, speed = 0, unitMetres = 1.7, pixels = 1080, width = 1920 } = {}) {
    const u = this.uniforms, cu = this.cloudUniforms;
    if (!u.weatherTex.value) u.weatherTex.value = cloudNoise();
    dt = Math.min(Math.max(dt || 0, 0), 0.25);
    this.position.copy(camera.position);
    const camAlt = Math.max(altitude + camera.position.y * unitMetres, 3);
    u.camAlt.value = camAlt;
    u.camXZ.value.set(camera.position.x * unitMetres, camera.position.z * unitMetres);
    // the aircraft flies toward +x (every model's nose), so the world passes toward -x
    this.shift = (this.shift + dt * speed) % WRAP;
    u.shift.value.set(this.shift, 0);
    // the fine structure drifts and rises slowly through the shapes
    this.wind.set(wrap(this.wind.x + dt * 4.0, DETAIL_TILE), wrap(this.wind.y + dt * 0.6, DETAIL_TILE), wrap(this.wind.z + dt * 1.5, DETAIL_TILE));
    u.wind.value.copy(this.wind);
    u.coverage.value = this.coverage;
    // inside the layer the field opens around the aircraft (fully between 300 m inside either face)
    const inLayer = THREE.MathUtils.smoothstep(camAlt, CLOUD_BASE - 500, CLOUD_BASE + 200) * (1 - THREE.MathUtils.smoothstep(camAlt, CLOUD_TOP - 200, CLOUD_TOP + 700));
    u.clearR.value = inLayer > 0.01 ? 2600 * inLayer : 0;

    // budget
    const vt = VOL_TIERS[this.quality] || VOL_TIERS.high;
    cu.steps.value = vt.steps;
    cu.lightSteps.value = vt.light;
    cu.lightFull.value = vt.full;
    const fullH = camera.view?.enabled ? camera.view.fullHeight : pixels;      // a view-offset tile keeps the frame's pixel angle
    const fovRad = camera.fov * Math.PI / 180;
    u.pixAngle.value = fovRad / Math.max(fullH, 1);
    const cw = Math.max(Math.round(width * vt.scale), 8), ch = Math.max(Math.round(pixels * vt.scale), 8);
    if (this.cloudTarget.width !== cw || this.cloudTarget.height !== ch) this.cloudTarget.setSize(cw, ch);
    u.cloudSize.value.set(cw, ch);
    cu.pixAngle.value = fovRad / Math.max(fullH * vt.scale, 1);
    u.cloudsOn.value = this.clouds && this.ready ? 1 : 0;
    u.cirrus.value = this.tier.cirrus ? 1 : 0;
    u.flare.value = this.tier.flare ? 1 : 0;
    this._dirty = true;

    // lights that depend on the sun and the altitude: the sky's colours for the clouds and the sea
    const sun = u.sunDir.value, sc = u.sunColor.value;
    const key = `${sun.x.toFixed(3)},${sun.y.toFixed(3)},${sun.z.toFixed(3)},${sc.getHex()}`;
    // the sun at the camera, and the sky as a light on the aircraft: redone when the sun moves or
    // the altitude changes by 250 m
    const altKey = `${key},${Math.round(camAlt / 250)}`;
    if (altKey !== this._altKey) {
      this._altKey = altKey;
      const tc = sunTransmittance(sun.y, camAlt);
      this.sunAtCam = [sc.r * tc[0], sc.g * tc[1], sc.b * tc[2]];
      u.sunAtCam.value.setRGB(...this.sunAtCam);
      const acc = [0, 0, 0];
      const sa = Math.atan2(sun.z, sun.x);
      const dirs = [[1.45, 0], [0.8, sa + 2.1], [0.8, sa - 2.1], [0.8, sa + Math.PI], [0.3, sa + 1.6], [0.3, sa - 1.6], [0.3, sa + Math.PI], [0.3, sa]];
      for (const [e, az] of dirs) {
        const r = skyRadiance(this._tmp.set(Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az)), sun, camAlt, sc);
        for (let i = 0; i < 3; i++) acc[i] += r[i] / dirs.length;
      }
      /** Mean radiance of the sky above the aircraft (linear rgb): the colour of its fill light. */
      this.skyAmbient = acc;
      /** Changes whenever the image-based lighting should be rebuilt (environment()). */
      this.envKey = altKey + `,${this.coverage.toFixed(2)},${u.cloudsOn.value}`;
    }
    if (key !== this._ambKey) {
      this._ambKey = key;
      const t1 = sunTransmittance(sun.y, 2500), t0 = sunTransmittance(sun.y, 0);
      cu.sunAtCloud.value.setRGB(sc.r * t1[0], sc.g * t1[1], sc.b * t1[2]);
      u.sunAtSea.value.setRGB(sc.r * t0[0], sc.g * t0[1], sc.b * t0[2]);
      const at = (alt, e, az) => skyRadiance(this._tmp.set(Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az)), sun, alt, sc);
      const sa = Math.atan2(sun.z, sun.x);
      const mean = (alt) => {
        const acc = [0, 0, 0];
        const dirs = [[1.45, 0], [0.8, sa + 2.1], [0.8, sa - 2.1], [0.8, sa + Math.PI], [0.3, sa + 1.6], [0.3, sa - 1.6], [0.3, sa + Math.PI]];
        for (const [e, az] of dirs) { const r = at(alt, e, az); for (let i = 0; i < 3; i++) acc[i] += r[i] / dirs.length; }
        return acc;
      };
      const top = mean(3000);
      cu.ambTop.value.setRGB(top[0] * 0.75, top[1] * 0.75, top[2] * 0.75);
      // from below: the sea and the lower clouds return a grey-blue fraction of what falls on them
      const lum = (top[0] + top[1] + top[2]) / 3 + 0.28 * sun.y;
      cu.ambBot.value.setRGB(lum * 0.42, lum * 0.46, lum * 0.52);
      const z0 = at(0, 1.5, 0), h0 = at(0, 0.06, sa + Math.PI * 0.6);
      u.skyZen0.value.setRGB(z0[0], z0[1], z0[2]);
      u.skyHor0.value.setRGB(h0[0], h0[1], h0[2]);
      // the cloud field as image-based lighting sees it: sunlit tops, sky-lit bases
      const lit = 0.9 * (0.3 + 0.7 * Math.sqrt(Math.max(sun.y, 0)));
      u.envCloud.value.setRGB(sc.r * t1[0] * lit + top[0] * 0.5, sc.g * t1[1] * lit + top[1] * 0.5, sc.b * t1[2] * lit + top[2] * 0.5);
      u.envBase.value.setRGB(lum * 0.5, lum * 0.52, lum * 0.56);
    }
    u.envCover.value = this.clouds ? THREE.MathUtils.clamp(this.coverage * 0.95, 0, 0.9) : 0;

    // the grade carried to the scene: fog toward the horizon's colour, the lights on the aircraft
    const g = this.grade = skyGrade(altitude);
    const hz = skyRadiance(this._tmp.set(-sun.x, 0, -sun.z).normalize().setY(0.03).normalize(), sun, camAlt, sc);
    g.haze = [hz[0], hz[1], hz[2]];

    // the sun on screen (NDC), for the lens response
    const s = this._sunWorld.copy(sun).multiplyScalar(1000).add(camera.position).project(camera);
    const front = s.z < 1 && s.z > -1 && Number.isFinite(s.x) && Number.isFinite(s.y);
    u.sunNdc.value.set(front ? s.x : 0, front ? s.y : 0, front ? 1 : 0);
  }

  /**
   * Image-based lighting from this sky as it is now (sun, altitude, cloud cover): the aircraft is
   * lit by, and reflects, the sky it flies in. Returns a PMREM texture; the previous one is freed.
   */
  environment(pmrem) {
    if (!this._envScene) {
      this._envScene = new THREE.Scene();
      this._envMat = new THREE.ShaderMaterial({
        uniforms: this.uniforms, vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: domeFrag, defines: { ENV: 1 }, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), this._envMat);
      m.frustumCulled = false;
      this._envScene.add(m);
    }
    const rt = pmrem.fromScene(this._envScene, 0, 0.1, 100);
    this._envTarget?.dispose();
    this._envTarget = rt;
    return rt.texture;
  }

  dispose() {
    this.cloudTarget.dispose();
    this._envTarget?.dispose();
    this._envMat?.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this._quad.material.dispose();
    this._quad.geometry.dispose();
  }
}
