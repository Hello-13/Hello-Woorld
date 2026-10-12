// Photoreal Earth from NASA Blue Marble / Black Marble imagery: lit day side with terrain
// relief, ocean sun-glint from a water mask, city lights across the terminator, a parallax
// cloud layer that shades the ground, and a two-colour Rayleigh/sunset scattering shell.

import * as THREE from 'three';

const loader = new THREE.TextureLoader();
let maps = null;
function earthMaps() {
  if (maps) return maps;
  const load = (file, srgb) => {
    const t = loader.load(`assets/earth/${file}`);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  };
  maps = {
    day: load('day.jpg', true),
    night: load('night.jpg', true),
    water: load('water.png', false),
    bump: load('bump.jpg', false),
    clouds: load('clouds.jpg', false),
  };
  return maps;
}

const surfaceVert = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const surfaceFrag = /* glsl */`
  uniform sampler2D dayMap, nightMap, waterMap, bumpMap, cloudMap;
  uniform vec3 sunDir; uniform float cloudShift; uniform float bumpScale; uniform float nightGain; uniform float fade;
  varying vec2 vUv; varying vec3 vN; varying vec3 vP;

  vec3 perturb(vec3 N, float h) {
    vec3 dpdx = dFdx(vP), dpdy = dFdy(vP);
    float dhdx = dFdx(h), dhdy = dFdy(h);
    vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
    float det = dot(dpdx, r1);
    vec3 g = sign(det) * (dhdx * r1 + dhdy * r2);
    vec3 n = abs(det) * N - bumpScale * g;
    return dot(n, n) > 1e-30 ? normalize(n) : N;
  }

  void main() {
    vec3 N0 = normalize(vN);
    float h = texture2D(bumpMap, vUv).r;
    vec3 N = perturb(N0, h);
    vec3 L = normalize(sunDir);
    vec3 V = normalize(cameraPosition - vP);
    float mu = dot(N0, L);
    float lit = max(dot(N, L), 0.0);
    float dayMix = smoothstep(-0.10, 0.18, mu);

    vec3 albedo = texture2D(dayMap, vUv).rgb;
    float water = texture2D(waterMap, vUv).r;
    float cloud = texture2D(cloudMap, vUv + vec2(cloudShift, 0.0)).r;
    float cloudShadow = texture2D(cloudMap, vUv + vec2(cloudShift + 0.0015, 0.0008)).r;
    cloud = smoothstep(0.08, 0.85, cloud);

    // warm sunlight that reddens at the terminator
    vec3 sun = mix(vec3(1.0, 0.55, 0.3), vec3(1.0, 0.97, 0.92), smoothstep(0.0, 0.35, mu)) * 2.6;
    vec3 col = albedo * lit * sun * (1.0 - smoothstep(0.1, 0.9, cloudShadow) * 0.45);
    col += albedo * 0.015;                                   // earthshine / skylight floor

    // specular glint on water (Blinn-Phong with a broad wind-roughened lobe)
    vec3 H = normalize(L + V);
    float nh = max(dot(N0, H), 0.0);
    float spec = (pow(nh, 160.0) * 1.6 + pow(nh, 18.0) * 0.18) * water * smoothstep(-0.05, 0.2, mu);
    col += spec * sun * (1.0 - cloud * 0.8);
    col = mix(col, col * vec3(0.78, 0.86, 1.0), water * 0.35);

    // city lights fade in across the terminator and are blocked by cloud
    vec3 lights = texture2D(nightMap, vUv).rgb;
    lights = pow(lights, vec3(1.6)) * vec3(1.0, 0.78, 0.5) * nightGain;
    col += lights * (1.0 - dayMix) * (1.0 - cloud * 0.75);

    // aerial perspective toward the limb
    float rim = pow(1.0 - max(dot(N0, V), 0.0), 2.4);
    vec3 haze = mix(vec3(0.95, 0.45, 0.2), vec3(0.32, 0.55, 1.0), smoothstep(-0.05, 0.3, mu));
    col = mix(col, haze * max(mu + 0.15, 0.0) * 1.4, rim * 0.55);
    gl_FragColor = vec4(col, fade);
  }`;

const cloudFrag = /* glsl */`
  uniform sampler2D cloudMap; uniform vec3 sunDir; uniform float cloudShift; uniform float fade;
  varying vec2 vUv; varying vec3 vN; varying vec3 vP;
  void main() {
    vec3 N = normalize(vN);
    float mu = dot(N, normalize(sunDir));
    float c = smoothstep(0.08, 0.85, texture2D(cloudMap, vUv + vec2(cloudShift, 0.0)).r);
    vec3 sun = mix(vec3(1.0, 0.5, 0.28), vec3(1.0), smoothstep(0.0, 0.3, mu));
    vec3 col = vec3(0.95) * sun * (max(mu, 0.0) * 2.2 + 0.02);
    gl_FragColor = vec4(col, (c * smoothstep(-0.25, 0.05, mu) * 0.92 + c * 0.04) * fade);
  }`;

const atmoFrag = /* glsl */`
  uniform vec3 sunDir; uniform float strength; uniform float fade;
  varying vec3 vN; varying vec3 vP; varying vec2 vUv;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vP);
    float ndv = dot(N, V);                    // back faces: −1 at centre → 0 at the limb
    float limb = pow(clamp(1.0 + ndv, 0.0, 1.0), 7.0);
    float mu = dot(N, normalize(sunDir));
    vec3 c = mix(vec3(1.0, 0.42, 0.18), vec3(0.3, 0.6, 1.0), smoothstep(-0.15, 0.35, mu));
    float a = limb * smoothstep(-0.35, 0.15, mu) * strength * fade;
    gl_FragColor = vec4(c * a * 1.6, a);
  }`;

/**
 * Create an Earth group of the given radius (scene units).
 * Returns { group, surface, clouds, atmosphere, setSun(dirWorld), update(dt) }.
 */
export function createEarth(radius = 2, { segments = 128, atmosphere = 1 } = {}) {
  const m = earthMaps();
  const sunDir = { value: new THREE.Vector3(1, 0.2, 0.3).normalize() };
  const cloudShift = { value: 0 };
  const fade = { value: 1 };
  const group = new THREE.Group();
  const surface = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments / 2), new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: m.day }, nightMap: { value: m.night }, waterMap: { value: m.water },
      bumpMap: { value: m.bump }, cloudMap: { value: m.clouds },
      sunDir, cloudShift, fade, bumpScale: { value: 0.012 * radius }, nightGain: { value: 2.2 },
    },
    vertexShader: surfaceVert, fragmentShader: surfaceFrag,
  }));
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.006, segments, segments / 2), new THREE.ShaderMaterial({
    uniforms: { cloudMap: { value: m.clouds }, sunDir, cloudShift, fade },
    vertexShader: surfaceVert, fragmentShader: cloudFrag,
    transparent: true, depthWrite: false,
  }));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.035, segments, segments / 2), new THREE.ShaderMaterial({
    uniforms: { sunDir, fade, strength: { value: atmosphere } },
    vertexShader: surfaceVert, fragmentShader: atmoFrag,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  for (const o of [surface, clouds, atmo]) { o.userData.fx = true; o.userData.noAO = true; }
  clouds.renderOrder = 1; atmo.renderOrder = 2;
  group.add(surface, clouds, atmo);
  return {
    group, surface, clouds, atmosphere: atmo,
    setSun(dir) { sunDir.value.copy(dir).normalize(); },
    setFade(a) { fade.value = a; },
    update(dt) { cloudShift.value = (cloudShift.value + dt * 0.0012) % 1; },
  };
}
