// The sharp band of a photographic backdrop. The hangar and launch-pad looks put an 8K panorama
// behind the scene (scene.background); at 4K that is a third of a texel per pixel. This dome draws
// the same panorama over it with its central band (elevations within ±35°, where the walls and
// the horizon are) from a 16K version, shipped as two 8192 × 3200 halves
// (tools/make-plates16k.py). Outside the band, and wherever the band has not loaded, it shows the
// 8K plate, so it is a drop-in: same mapping (three's equirectangular background), same rotation
// and intensity, read from the scene each frame.

import * as THREE from 'three';

/** The band's share of the panorama's height: 3200 of the 16K version's 8192 rows. */
export const BAND_V = 3200 / 8192;

const vert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;                                   // the dome rides on the camera
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w * 0.99999;           // at the far plane
  }`;

const frag = /* glsl */`
  uniform sampler2D plate, bandA, bandB; uniform float rot, gain, hasBand;
  varying vec3 vDir;
  const float BAND_V = ${BAND_V.toFixed(6)};
  void main() {
    vec3 d = normalize(vDir);
    float u0 = (atan(d.z, d.x) + rot) / 6.2831853 + 0.5;
    float v = asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5;
    float u = fract(u0);
    // derivatives that do not see the wrap of u (or atan's own cut half a turn away): take
    // whichever of two phase-shifted copies changes less across the pixel
    float ua = fract(u0), ub = fract(u0 + 0.5);
    float dux = abs(dFdx(ua)) < abs(dFdx(ub)) ? dFdx(ua) : dFdx(ub);
    float duy = abs(dFdy(ua)) < abs(dFdy(ub)) ? dFdy(ua) : dFdy(ub);
    vec2 gx = vec2(dux, dFdx(v)), gy = vec2(duy, dFdy(v));
    vec3 col = textureGrad(plate, vec2(u, v), gx, gy).rgb;
    float vb = (v - (0.5 - BAND_V * 0.5)) / BAND_V;
    if (hasBand > 0.5 && vb > 0.0 && vb < 1.0) {
      vec2 s = vec2(2.0, 1.0 / BAND_V);
      vec3 hi = u < 0.5 ? textureGrad(bandA, vec2(u * 2.0, vb), gx * s, gy * s).rgb
                        : textureGrad(bandB, vec2(u * 2.0 - 1.0, vb), gx * s, gy * s).rgb;
      col = mix(col, hi, smoothstep(0.0, 0.03, vb) * smoothstep(1.0, 0.97, vb));
    }
    gl_FragColor = vec4(col * gain, 1.0);
  }`;

export class BackdropBand extends THREE.Mesh {
  constructor() {
    const uniforms = { plate: { value: null }, bandA: { value: null }, bandB: { value: null }, rot: { value: 0 }, gain: { value: 1 }, hasBand: { value: 0 } };
    super(new THREE.SphereGeometry(900, 64, 32), new THREE.ShaderMaterial({
      uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
    }));
    this.uniforms = uniforms;
    this.renderOrder = -11;
    this.frustumCulled = false;
    this.userData.fx = true;
    this.userData.noAO = true;
    this.visible = false;
    // centred on whichever camera is drawing (the frame's, a mirror's)
    this.onBeforeRender = (renderer, scene, camera) => { this.matrixWorld.copyPosition(camera.matrixWorld); };
  }

  /** plate: the 8K panorama the scene's background shows; a, b: the band's halves (or null). */
  set(plate, a = null, b = null) {
    const u = this.uniforms;
    u.plate.value = plate; u.bandA.value = a; u.bandB.value = b;
    u.hasBand.value = a && b ? 1 : 0;
  }

  /** Follow the scene's background: shown only while it is this dome's plate. */
  sync(scene) {
    const u = this.uniforms;
    this.visible = !!u.plate.value && u.hasBand.value > 0.5 && scene.background === u.plate.value;
    if (!this.visible) return;
    u.rot.value = scene.backgroundRotation.y;
    u.gain.value = scene.backgroundIntensity;
  }
}
