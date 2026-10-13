// Exhaust effects for the Falcon Heavy: kerolox plumes with shock diamonds, the wide vacuum
// plume of the Merlin Vacuum, an additive engine glow and the pad steam cloud.
//
// The plume shader keeps brightness temporally smooth: turbulence is value noise advected down
// the plume, so detail moves with the flow while the plume as a whole never flickers or strobes.
// The model carries no punctual lights; the engine glow is an additive sprite.

import * as THREE from 'three';
import { glowTexture, smokeTexture, rng } from '../../engine/materials.js';

export function plumeMaterial({ core = 0xfff1d0, outer = 0xff7a1c, diamonds = 1, soot = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, intensity: { value: 0 }, expansion: { value: 1 }, diamonds: { value: diamonds },
      soot: { value: soot },
      coreColor: { value: new THREE.Color(core) }, outerColor: { value: new THREE.Color(outer) },
    },
    vertexShader: /* glsl */`
      uniform float time; uniform float expansion;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        float s = 1.0 - uv.y;
        vec3 p = position;
        float spread = mix(1.0, expansion, smoothstep(0.0, 0.6, s));
        p.xz *= spread * (1.0 + 0.025 * sin(time * 7.0 + s * 9.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float time; uniform float intensity; uniform float diamonds; uniform float soot;
      uniform vec3 coreColor; uniform vec3 outerColor;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        float s = clamp(1.0 - vUv.y, 0.0, 1.0);
        float facing = min(abs(dot(normalize(vN), normalize(vV))), 1.0);
        float body = pow(facing, 1.6);
        float fade = pow(1.0 - s, 1.4) * smoothstep(0.0, 0.03, s);
        float cells = 0.5 + 0.5 * cos(s * 34.0 - 1.2);
        float shock = diamonds * pow(max(cells, 0.0), 6.0) * (1.0 - smoothstep(0.1, 0.75, s));
        // advected turbulence (wraps around u = 0/1 with an integer frequency)
        vec2 q = vec2(vUv.x * 12.0, s * 7.0 - time * 5.0);
        float turb = 0.6 * vnoise(q) + 0.4 * vnoise(q * 2.3 + 7.0);
        float mottle = 0.86 + 0.14 * turb;
        vec3 col = mix(outerColor, coreColor, clamp(body * (1.2 - s) + shock, 0.0, 1.0));
        col = mix(col, col * vec3(0.55, 0.42, 0.34), soot * smoothstep(0.25, 0.9, s));
        float a = (body * fade * 0.9 + shock * 0.8) * intensity * mottle;
        gl_FragColor = vec4(col * a * 2.0, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}

/** Open cone from radius r0 at the nozzle (local y = 0) to r1 at length L along −y. */
export function plumeMesh(r0, r1, L, material, seg = 28) {
  const g = new THREE.CylinderGeometry(r0, r1, L, seg, 20, true);
  g.translate(0, -L / 2, 0);
  const m = new THREE.Mesh(g, material);
  m.userData.fx = true;
  m.renderOrder = 10;
  m.frustumCulled = false;
  m.castShadow = false; m.receiveShadow = false;
  return m;
}

/** Additive glow sprite (no light source). */
export function glowSprite(color, size) {
  const mat = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  s.userData.fx = true;
  s.renderOrder = 9;
  s.frustumCulled = false;
  return s;
}

/** Steam and smoke billowing out of both ends of the flame trench and around the mount. */
export function padSmoke({ count = 300, trenchEnd = 40, deck = 18.8, scale = 300 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), size = new Float32Array(count), alpha = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: smokeTexture() }, scale: { value: scale } },
    vertexShader: /* glsl */`
      attribute float size; attribute float alpha; varying float vA; uniform float scale;
      void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; varying float vA;
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.86, 0.85, 0.83) * t.a * vA, t.a * vA); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.fx = true;
  pts.frustumCulled = false;
  const puffs = Array.from({ length: count }, () => ({ life: 0, max: 1, v: new THREE.Vector3() }));
  const rand = rng(99);
  return {
    points: pts,
    reset() { for (const p of puffs) p.life = 0; alpha.fill(0); geo.attributes.alpha.needsUpdate = true; },
    update(dt, emit, strength = 1) {
      let spawned = 0;
      const maxSpawn = Math.round(5 * strength);
      for (let i = 0; i < count; i++) {
        const p = puffs[i];
        if (p.life <= 0 && emit && spawned < maxSpawn) {
          p.life = p.max = 5 + rand() * 6;
          const r = rand();
          if (r < 0.8) {
            // out of a trench end, rolling up and away
            const side = rand() < 0.5 ? -1 : 1;
            pos[i * 3] = (rand() - 0.5) * 14; pos[i * 3 + 1] = 2 + rand() * 6; pos[i * 3 + 2] = side * (trenchEnd + rand() * 4);
            p.v.set((rand() - 0.5) * 8, 3 + rand() * 6, side * (16 + rand() * 18));
            size[i] = 9 + rand() * 6;
          } else {
            // steam off the deluged deck
            pos[i * 3] = (rand() - 0.5) * 18; pos[i * 3 + 1] = deck + 0.5; pos[i * 3 + 2] = (rand() - 0.5) * 10;
            p.v.set((rand() - 0.5) * 6, 2 + rand() * 3, (rand() - 0.5) * 6);
            size[i] = 6 + rand() * 4;
          }
          spawned++;
        }
        if (p.life > 0) {
          p.life -= dt;
          const k = p.life / p.max;
          pos[i * 3] += p.v.x * dt; pos[i * 3 + 1] += p.v.y * dt; pos[i * 3 + 2] += p.v.z * dt;
          p.v.multiplyScalar(1 - dt * 0.3);
          p.v.y += dt * 0.8;
          size[i] += dt * 6;
          alpha[i] = Math.min(1, (1 - k) * 4) * k * 0.6;
        } else alpha[i] = 0;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
    },
  };
}
