// Exhaust effects for the Falcon Heavy: kerolox plumes with shock diamonds, the wide vacuum
// plume of the Merlin Vacuum, an additive engine glow and the pad steam cloud.
//
// The plume shader keeps brightness temporally smooth: turbulence is value noise advected down
// the plume, so detail moves with the flow while the plume as a whole never flickers or strobes.
// At sea level a plume is one yellow-orange column: yellow-white only along its axis near the exit
// and in the shock-diamond train, orange outside, browning with soot down its length. The same
// material opens into a single wide, translucent fan as `expansion` rises with altitude (the fan
// starts at the exit and the body goes thin and faint, the way an under-expanded plume does in
// vacuum). Its output stays under the renderer's bloom threshold so the colour keeps its hue; only
// where several jets overlap does it bloom to white. The model carries no punctual lights; the
// engine glow is an additive sprite.

import * as THREE from 'three';
import { glowTexture, smokeTexture, rng } from '../../engine/materials.js';

export function plumeMaterial({ core = 0xfff1d0, outer = 0xff7a1c, diamonds = 1, soot = 0, gain = 1.3 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 }, intensity: { value: 0 }, expansion: { value: 1 }, diamonds: { value: diamonds },
      soot: { value: soot }, gain: { value: gain },
      coreColor: { value: new THREE.Color(core) }, outerColor: { value: new THREE.Color(outer) },
    },
    vertexShader: /* glsl */`
      uniform float time; uniform float expansion;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        float s = 1.0 - uv.y;
        vec3 p = position;
        // the fan opens from the exit itself once the air is thin; at sea level the column holds
        // its width for a while before it widens
        float vac = clamp((expansion - 1.0) / 2.0, 0.0, 1.0);
        float spread = mix(1.0, expansion, smoothstep(0.0, mix(0.6, 0.2, vac), s));
        p.xz *= spread * (1.0 + 0.01 * sin(time * 7.0 + s * 9.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float time; uniform float intensity; uniform float expansion; uniform float diamonds; uniform float soot;
      uniform float gain;
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
        float vac = clamp((expansion - 1.0) / 2.0, 0.0, 1.0);        // 0 at sea level, 1 in vacuum
        float facing = min(abs(dot(normalize(vN), normalize(vV))), 1.0);
        float body = pow(facing, 1.3 + 0.7 * vac);                    // thickest through the axis
        float fade = pow(1.0 - s, 1.2 + 1.2 * vac) * smoothstep(0.0, 0.02, s);
        // shock diamonds: a train of bright cells that dies out as the jet mixes with the air
        float cells = 0.5 + 0.5 * cos(s * 44.0 - 1.0);
        float shock = diamonds * pow(max(cells, 0.0), 5.0) * (1.0 - smoothstep(0.04, 0.55, s));
        // advected turbulence (wraps around u = 0/1 with an integer frequency)
        vec2 q = vec2(vUv.x * 12.0, s * 7.0 - time * 5.0);
        float turb = 0.6 * vnoise(q) + 0.4 * vnoise(q * 2.3 + 7.0);
        float mottle = 0.88 + 0.12 * turb;
        // yellow-white only along the axis near the exit and in the diamonds; orange elsewhere
        float hot = clamp(pow(facing, 3.0) * (1.0 - s * 1.3) + 0.6 * shock, 0.0, 1.0);
        vec3 col = mix(outerColor, coreColor, hot);
        col = mix(col, col * vec3(0.5, 0.36, 0.3), soot * smoothstep(0.3, 0.9, s));
        float a = body * fade * (0.8 + 0.35 * shock) * intensity * mottle * (1.0 - 0.55 * vac);
        gl_FragColor = vec4(col * a * gain, a);
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

/**
 * Steam billowing out of both ends of the flame trench: the deluge water flashes to steam under the
 * deflector and the trench turns it out at its two exits at the toes of the mound, where it rolls
 * low and sideways, away from the vehicle, before it rises. Nothing is emitted on the deck, so the
 * vehicle stays crisp at ignition. trenchEnd: z of the trench exits (pad frame).
 */
export function padSmoke({ count = 300, trenchEnd = 53, scale = 300 } = {}) {
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
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.93, 0.92, 0.9) * t.a * vA, t.a * vA); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.fx = true;
  pts.frustumCulled = false;
  const puffs = Array.from({ length: count }, () => ({ life: 0, max: 1, v: new THREE.Vector3() }));
  const rand = rng(99);
  let acc = 0;
  return {
    points: pts,
    reset() { for (const p of puffs) p.life = 0; acc = 0; alpha.fill(0); geo.attributes.alpha.needsUpdate = true; },
    update(dt, emit, strength = 1) {
      let spawned = 0;
      // emission is a rate (puffs per second), so slow frames do not thin the cloud
      acc += emit ? 45 * strength * dt : 0;
      const maxSpawn = Math.floor(acc);
      acc -= maxSpawn;
      for (let i = 0; i < count; i++) {
        const p = puffs[i];
        if (p.life <= 0 && emit && spawned < maxSpawn) {
          p.life = p.max = 6 + rand() * 5;
          // out of a trench exit, low, rolling away along the trench axis and spreading sideways
          const side = rand() < 0.5 ? -1 : 1;
          pos[i * 3] = (rand() - 0.5) * 12; pos[i * 3 + 1] = 1.5 + rand() * 7; pos[i * 3 + 2] = side * (trenchEnd - 4 + rand() * 8);
          p.v.set((rand() - 0.5) * 10, 1.5 + rand() * 2.5, side * (14 + rand() * 14));
          size[i] = 7 + rand() * 5;
          spawned++;
        }
        if (p.life > 0) {
          p.life -= dt;
          const k = p.life / p.max;
          pos[i * 3] += p.v.x * dt; pos[i * 3 + 1] += p.v.y * dt; pos[i * 3 + 2] += p.v.z * dt;
          p.v.multiplyScalar(1 - dt * 0.25);
          p.v.y += dt * 0.6;                                       // the steam lifts once it is clear of the trench
          size[i] += dt * 3.5;
          alpha[i] = Math.min(1, (1 - k) * 4) * k * 0.5;
        } else alpha[i] = 0;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      geo.attributes.alpha.needsUpdate = true;
    },
  };
}
