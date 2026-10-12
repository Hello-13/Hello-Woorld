// Shader effects: x-ray fresnel, exhaust plumes with shock diamonds, transonic vapour cone,
// sky dome, analytic floor grid, starfield and the dot-matrix Earth.

import * as THREE from 'three';
import { rng } from './materials.js';

// ------------------------------------------------------------------------------- x-ray
export function xrayMaterial(color = 0x5fd4ff, power = 2.2, base = 0.035) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, base: { value: base } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 color; uniform float power; uniform float base;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), power);
        float a = clamp(f + base, 0.0, 1.0);
        gl_FragColor = vec4(color * (f * 1.6 + base), a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}

// ------------------------------------------------------------------------------- thermal
const INFERNO = [
  [0.0, [0.001, 0.0, 0.014]], [0.15, [0.12, 0.04, 0.29]], [0.3, [0.34, 0.06, 0.43]],
  [0.45, [0.55, 0.15, 0.40]], [0.6, [0.76, 0.27, 0.28]], [0.75, [0.93, 0.45, 0.13]],
  [0.88, [0.98, 0.68, 0.06]], [1.0, [0.99, 1.0, 0.64]],
];
export function inferno(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < INFERNO.length; i++) {
    if (x <= INFERNO[i][0]) {
      const [x0, c0] = INFERNO[i - 1], [x1, c1] = INFERNO[i];
      const f = (x - x0) / (x1 - x0);
      return new THREE.Color().setRGB(c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f, THREE.SRGBColorSpace);
    }
  }
  return new THREE.Color(1, 1, 0.64);
}
export const INFERNO_CSS = INFERNO.map(([s, c]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')}) ${s * 100}%`).join(', ');

// ------------------------------------------------------------------------------- plume
/**
 * Exhaust plume on a cone that starts at the nozzle (local y = 0) and extends toward −y.
 * Uniforms: intensity, length, expansion (vacuum spread), diamonds (shock-cell strength), hue.
 */
export function plumeMaterial({ core = 0xfff1d0, outer = 0xff7a1c, diamonds = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      intensity: { value: 0 },
      expansion: { value: 1 },
      diamonds: { value: diamonds },
      coreColor: { value: new THREE.Color(core) },
      outerColor: { value: new THREE.Color(outer) },
    },
    vertexShader: /* glsl */`
      uniform float time; uniform float expansion;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        float s = 1.0 - uv.y;                       // 0 at nozzle → 1 at tail
        vec3 p = position;
        float spread = mix(1.0, expansion, smoothstep(0.0, 0.6, s));
        p.xz *= spread * (1.0 + 0.05 * sin(time * 40.0 + s * 18.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float time; uniform float intensity; uniform float diamonds;
      uniform vec3 coreColor; uniform vec3 outerColor;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float s = clamp(1.0 - vUv.y, 0.0, 1.0);    // MSAA can extrapolate uv past the edge
        float facing = min(abs(dot(normalize(vN), normalize(vV))), 1.0);
        float body = pow(facing, 1.6);
        float fade = pow(1.0 - s, 1.4) * smoothstep(0.0, 0.03, s);
        float cells = 0.5 + 0.5 * cos(s * 34.0 - 1.2);
        float shock = diamonds * pow(max(cells, 0.0), 6.0) * (1.0 - smoothstep(0.1, 0.75, s));
        float flick = 0.85 + 0.15 * hash(vec2(floor(time * 30.0), floor(vUv.x * 12.0)));
        vec3 col = mix(outerColor, coreColor, clamp(body * (1.2 - s) + shock, 0.0, 1.0));
        float a = (body * fade * 0.9 + shock * 0.8) * intensity * flick;
        gl_FragColor = vec4(col * a * 2.2, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}

/** A plume mesh: open cone from radius r0 at the nozzle to r1 at length L along −y. */
export function plumeMesh(r0, r1, L, material) {
  const g = new THREE.CylinderGeometry(r0, r1, L, 32, 24, true);
  g.translate(0, -L / 2, 0);
  const mesh = new THREE.Mesh(g, material);
  mesh.userData.fx = true;
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  return mesh;
}

// ------------------------------------------------------------------------------- vapour cone
export function vaporConeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0 }, time: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float strength; uniform float time;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float n(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        float rim = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 1.3);
        float along = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
        float grain = 0.75 + 0.25 * n(floor(vUv * vec2(90.0, 40.0)) + floor(time * 20.0));
        float a = strength * (0.18 + rim * 0.6) * along * grain;
        gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * a, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}

// ------------------------------------------------------------------------------- sky
export function skyDome() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(0x05080d) },
      horizon: { value: new THREE.Color(0x15202c) },
      bottom: { value: new THREE.Color(0x06090d) },
      glow: { value: new THREE.Color(0x2a3a4c) },
      glowDir: { value: new THREE.Vector3(0.4, 0.15, -1).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 glow; uniform vec3 glowDir;
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 c = y > 0.0 ? mix(horizon, top, pow(y, 0.55)) : mix(horizon, bottom, pow(-y, 0.4));
        c += glow * pow(max(dot(vDir, glowDir), 0.0), 6.0) * 0.6;
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  mesh.renderOrder = -10;
  mesh.userData.fx = true;
  return mesh;
}

// ------------------------------------------------------------------------------- floor grid
export function gridFloor(size = 400) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      minor: { value: 1.0 }, major: { value: 5.0 },
      color: { value: new THREE.Color(0x3c5878) }, accent: { value: new THREE.Color(0xffb000) },
      fadeDist: { value: 70.0 }, opacity: { value: 1.0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float minor; uniform float major; uniform vec3 color; uniform vec3 accent; uniform float fadeDist; uniform float opacity;
      varying vec3 vW;
      float line(vec2 p, float s, float w) {
        vec2 g = abs(fract(p / s - 0.5) - 0.5) / max(fwidth(p / s), vec2(1e-6));
        return 1.0 - min(min(g.x, g.y) / w, 1.0);
      }
      void main() {
        vec2 p = vW.xz;
        float d = length(p);
        float l1 = line(p, minor, 1.0) * 0.35;
        float l2 = line(p, major, 1.4) * 0.8;
        float axis = (1.0 - min(abs(p.x) / max(fwidth(p.x), 1e-6) / 1.5, 1.0)) + (1.0 - min(abs(p.y) / max(fwidth(p.y), 1e-6) / 1.5, 1.0));
        float fade = 1.0 - smoothstep(fadeDist * 0.35, fadeDist, d);
        vec3 c = color * max(l1, l2) + accent * clamp(axis, 0.0, 1.0) * 0.25;
        float a = clamp(max(max(l1, l2), axis * 0.5), 0.0, 1.0) * fade * opacity;
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData.fx = true;
  return mesh;
}

// ------------------------------------------------------------------------------- stars
export function starfield(count = 2500, radius = 800) {
  const r = rng(42);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([radius * s * Math.cos(th), radius * u, radius * s * Math.sin(th)], i * 3);
    const warm = r();
    const b = 0.4 + r() * 0.6;
    col.set([b * (0.8 + warm * 0.2), b * 0.9, b * (1.0 - warm * 0.25)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const pts = new THREE.Points(g, m);
  pts.userData.fx = true;
  pts.renderOrder = -9;
  return pts;
}

// ------------------------------------------------------------------------------- earth
// Coarse continental outlines (lon, lat) — enough for a dot-matrix tactical globe.
const LAND = [
  // North America
  [[-168, 66], [-162, 70], [-140, 70], [-125, 70], [-110, 73], [-95, 72], [-80, 73], [-75, 68], [-64, 60], [-56, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 31], [-80, 25], [-82, 27], [-84, 30], [-90, 29], [-97, 27], [-97, 22], [-92, 18], [-87, 21], [-88, 15], [-83, 10], [-79, 8], [-80, 7], [-85, 11], [-92, 14], [-105, 20], [-110, 24], [-112, 30], [-115, 31], [-117, 33], [-121, 35], [-124, 40], [-124, 48], [-130, 54], [-140, 60], [-150, 60], [-158, 57], [-165, 60]],
  // Hudson Bay is carved out by drawing it as water afterwards
  // Greenland
  [[-55, 60], [-45, 60], [-20, 70], [-18, 80], [-40, 83], [-62, 82], [-72, 78], [-58, 70]],
  // South America
  [[-80, 9], [-75, 11], [-62, 11], [-52, 4], [-50, 0], [-35, -5], [-38, -13], [-41, -22], [-48, -26], [-53, -34], [-58, -38], [-65, -41], [-68, -50], [-70, -55], [-75, -50], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -5], [-80, 0], [-77, 4]],
  // Eurasia
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [10, 58], [5, 62], [15, 69], [25, 71], [40, 68], [60, 70], [70, 73], [80, 73], [100, 78], [110, 74], [140, 72], [160, 70], [180, 68], [180, 65], [170, 60], [160, 55], [156, 51], [142, 47], [135, 43], [129, 35], [126, 38], [121, 31], [120, 24], [110, 20], [108, 15], [105, 9], [100, 13], [100, 3], [104, 1], [98, 8], [97, 16], [92, 21], [88, 22], [80, 15], [77, 8], [73, 17], [72, 21], [66, 25], [57, 25], [56, 27], [51, 25], [52, 17], [44, 12], [43, 15], [35, 28], [34, 31], [36, 36], [27, 37], [26, 40], [22, 37], [20, 40], [13, 45], [18, 40], [15, 38], [12, 42], [9, 44], [3, 43], [-1, 37], [-6, 36]],
  // Africa
  [[-17, 21], [-17, 15], [-12, 8], [-8, 4], [5, 5], [9, 4], [10, -2], [13, -6], [12, -17], [15, -27], [18, -34], [25, -34], [32, -28], [35, -24], [40, -15], [40, -5], [43, 0], [51, 11], [43, 12], [37, 20], [33, 31], [25, 32], [20, 31], [10, 37], [0, 36], [-6, 36], [-10, 30], [-13, 27]],
  // Australia
  [[114, -22], [114, -34], [118, -35], [124, -33], [132, -31], [138, -35], [141, -38], [147, -39], [150, -37], [153, -30], [153, -25], [146, -19], [142, -11], [136, -12], [131, -11], [125, -15]],
  // Islands
  [[-5, 50], [1, 51], [2, 53], [-2, 56], [-3, 58.5], [-6, 58], [-5, 55], [-3, 54], [-5, 52]],
  [[-10, 52], [-6, 52], [-6, 55], [-10, 54]],
  [[-24, 64], [-14, 64], [-15, 66], [-22, 66]],
  [[130, 31], [135, 34], [140, 35], [142, 40], [141, 45], [145, 44], [140, 41], [136, 36], [132, 34]],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  [[95, 5], [98, 4], [106, -6], [102, -4]],
  [[109, 1], [117, 7], [119, 5], [116, -4], [110, -3]],
  [[131, -1], [141, -3], [150, -10], [143, -9], [138, -8], [132, -4]],
  [[166, -46], [172, -41], [175, -37], [178, -38], [174, -42], [169, -47]],
  [[120, 23], [122, 25], [121, 22]],
  [[-85, 22], [-74, 20], [-77, 18], [-84, 21]],
  [[80, 6], [82, 7], [81, 9], [79, 8]],
];

function landMask() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  const X = (lon) => ((lon + 180) / 360) * c.width;
  const Y = (lat) => ((90 - lat) / 180) * c.height;
  ctx.fillStyle = '#fff';
  for (const poly of LAND) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => (i ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat))));
    ctx.closePath();
    ctx.fill();
  }
  // Hudson Bay, Black/Caspian seas as water
  ctx.fillStyle = '#000';
  for (const poly of [
    [[-95, 60], [-82, 64], [-78, 58], [-82, 52], [-92, 57]],
    [[28, 42], [41, 42], [38, 46], [31, 46]],
    [[47, 37], [54, 38], [53, 45], [48, 46], [47, 42]],
    [[-6, 36], [35, 36], [30, 31], [12, 33], [0, 36]],
  ]) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => (i ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat))));
    ctx.closePath();
    ctx.fill();
  }
  // Antarctica
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, Y(-70), c.width, c.height - Y(-70));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function earthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      land: { value: landMask() },
      sunDir: { value: new THREE.Vector3(1, 0.25, 0.4).normalize() },
      time: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vNw; varying vec3 vV;
      void main() {
        vUv = uv;
        vNw = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D land; uniform vec3 sunDir; uniform float time;
      varying vec2 vUv; varying vec3 vNw; varying vec3 vV;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
      void main() {
        float rows = 150.0;
        float cols = rows * 2.0;
        vec2 grid = vec2(vUv.x * cols, vUv.y * rows);
        vec2 cell = floor(grid) + 0.5;
        vec2 f = fract(grid) - 0.5;
        float lat = (vUv.y - 0.5) * 3.14159;
        f.x *= max(cos(lat), 0.15);
        float isLand = texture2D(land, cell / vec2(cols, rows)).r;
        float dotMask = 1.0 - smoothstep(0.22, 0.34, length(f));
        float day = smoothstep(-0.15, 0.25, dot(normalize(vNw), sunDir));
        vec3 ocean = mix(vec3(0.01, 0.025, 0.05), vec3(0.03, 0.09, 0.16), day);
        vec3 landDay = vec3(0.45, 0.8, 1.0);
        vec3 landNight = vec3(0.07, 0.12, 0.18);
        vec3 c = ocean;
        c += dotMask * isLand * mix(landNight, landDay, day);
        // city lights on the night side
        float city = step(0.86, hash(cell)) * isLand * (1.0 - day) * dotMask;
        c += city * vec3(1.0, 0.62, 0.22) * 1.4;
        // graticule every 30°
        vec2 deg = vec2(vUv.x * 360.0, vUv.y * 180.0);
        vec2 gl = abs(fract(deg / 30.0 + 0.5) - 0.5) * 30.0 / max(fwidth(deg), vec2(1e-6));
        float grat = 1.0 - min(min(gl.x, gl.y), 1.0);
        c += grat * vec3(0.12, 0.22, 0.32) * 0.6;
        float rim = pow(1.0 - max(dot(normalize(vNw), vV), 0.0), 3.0);
        c += rim * vec3(0.2, 0.5, 0.9) * 0.28;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

export function atmosphereShell(radius) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(0x4aa8ff) } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 color; varying vec3 vN; varying vec3 vV;
      void main() {
        float d = dot(normalize(vN), normalize(vV));
        float a = pow(clamp(1.0 + d, 0.0, 1.0), 6.0) * 0.9;
        gl_FragColor = vec4(color * a, a);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 64, 32), mat);
  m.userData.fx = true;
  return m;
}
