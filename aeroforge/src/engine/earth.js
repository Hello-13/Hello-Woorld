// Photoreal Earth from NASA Blue Marble / Black Marble imagery: lit day side with terrain
// relief, ocean sun-glint from a water mask, city lights across the terminator, a parallax
// cloud layer that shades the ground, and a two-colour Rayleigh/sunset scattering shell.

import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const load = (file, srgb, onLoad) => {
  const t = loader.load(`assets/earth/${file}`, onLoad);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  t.wrapS = THREE.RepeatWrapping;
  return t;
};
// NASA Blue Marble NG (July 2004, with relief), Black Marble 2016 night lights and the Blue Marble
// cloud composite; terrain relief and the ocean mask come from GEBCO 2008 elevation. Day, night
// and clouds come in 4K and 8K; the 8K set loads for the 4K / Ultra presets (see setEarthDetail).
let maps = null;
function earthMaps() {
  if (maps) return maps;
  maps = {
    day: load('day.jpg', true),
    night: load('night.jpg', true),
    water: load('water.png', false),
    bump: load('bump.jpg', false),
    clouds: load('clouds.jpg', false),
  };
  return maps;
}

const earths = new Set();
const HIRES = { day: ['dayMap', true], night: ['nightMap', true], clouds: ['cloudMap', false] };
let hires = null;   // { day, night, clouds } once the 8K set has loaded
let wantHires = false;

function applyMaps(e) {
  const m = wantHires && hires ? hires : earthMaps();
  e.surface.material.uniforms.dayMap.value = m.day;
  e.surface.material.uniforms.nightMap.value = m.night;
  e.surface.material.uniforms.cloudMap.value = m.clouds;
  e.clouds.material.uniforms.cloudMap.value = m.clouds;
}

/** 8K day, night and cloud maps (about 15 MB to download, 0.5 GB of GPU memory) or the 4K set. */
export function setEarthDetail(on) {
  wantHires = on;
  if (on && !hires) {
    const set = {};
    let left = 3;
    for (const [k, [, srgb]] of Object.entries(HIRES)) {
      set[k] = load(`${k}-8k.jpg`, srgb, () => {
        if (--left) return;
        hires = set;
        for (const e of earths) applyMaps(e);   // swap only when all three are ready
      });
    }
    return;
  }
  for (const e of earths) applyMaps(e);
}

// Fine detail where a map is magnified (an 8K texel spans more than a pixel, as below a spacecraft
// at 4K): three octaves of 3-D gradient noise on the sphere itself (no grid, seam or polar
// stretching) at 2–8× the 8K maps' resolution, faded out wherever the maps are minified.
const detailGLSL = /* glsl */`
  vec3 dHash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
  }
  float dGrad(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float n000 = dot(dHash(i), f), n100 = dot(dHash(i + vec3(1, 0, 0)), f - vec3(1, 0, 0));
    float n010 = dot(dHash(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), n110 = dot(dHash(i + vec3(1, 1, 0)), f - vec3(1, 1, 0));
    float n001 = dot(dHash(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), n101 = dot(dHash(i + vec3(1, 0, 1)), f - vec3(1, 0, 1));
    float n011 = dot(dHash(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), n111 = dot(dHash(i + vec3(1, 1, 1)), f - vec3(1, 1, 1));
    return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
  }
  // n: unit direction from the planet centre. Returns (detail about -0.5..0.5, strength 0..1).
  vec2 mapDetail(vec3 n, float seed) {
    float tpp = length(fwidth(n)) / 7.67e-4;           // 8K texels (2π / 8192 rad) per pixel
    float k = 1.0 - smoothstep(0.35, 1.2, tpp);
    if (k <= 0.0) return vec2(0.0);
    vec3 p = n * 2600.0 + seed;
    float v = dGrad(p) * 0.55 + dGrad(p * 2.03) * 0.3 + dGrad(p * 4.07) * 0.15;
    return vec2(v, k);
  }`;

const surfaceVert = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
  void main() {
    vUv = uv;
    vObj = position;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vP = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const surfaceFrag = /* glsl */`
  uniform sampler2D dayMap, nightMap, waterMap, bumpMap, cloudMap;
  uniform vec3 sunDir; uniform float cloudShift; uniform float bumpScale; uniform float nightGain; uniform float fade;
  varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
  ${detailGLSL}

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
    vec2 gd = mapDetail(normalize(vObj), 91.0);
    albedo *= 1.0 + gd.x * gd.y * 0.22;
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
  varying vec2 vUv; varying vec3 vN; varying vec3 vP; varying vec3 vObj;
  ${detailGLSL}
  void main() {
    vec3 N = normalize(vN);
    float mu = dot(N, normalize(sunDir));
    vec2 cuv = vUv + vec2(cloudShift, 0.0);
    float raw = texture2D(cloudMap, cuv).r;
    // the cloud map scrolls in longitude: turn the detail with it (SphereGeometry: x = -cos φ, z = sin φ)
    vec3 n = normalize(vObj);
    float ca = cos(6.2831853 * cloudShift), sa = sin(6.2831853 * cloudShift);
    vec2 dt = mapDetail(vec3(n.x * ca + n.z * sa, n.y, n.z * ca - n.x * sa), 0.0);
    raw += dt.x * dt.y * 0.55 * min(raw * 3.0, 1.0);       // break up soft edges, never on clear sky
    float c = smoothstep(0.08, 0.85, raw);
    vec3 sun = mix(vec3(1.0, 0.5, 0.28), vec3(1.0), smoothstep(0.0, 0.3, mu));
    vec3 col = vec3(0.95) * sun * (max(mu, 0.0) * 2.2 + 0.02);
    gl_FragColor = vec4(col, (c * smoothstep(-0.25, 0.05, mu) * 0.92 + c * 0.04) * fade);
  }`;

// Limb glow from the height of each view ray's closest approach to the planet: exp(-h/H) above
// the horizon (a thin bright layer fading upward, as photographed from orbit) and a short fade
// below it, where the surface shader's own aerial perspective takes over.
const atmoVert = /* glsl */`
  varying vec3 vP; varying vec3 vCenter; varying float vScale;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vP = wp.xyz;
    vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vScale = length(modelMatrix[0].xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const atmoFrag = /* glsl */`
  uniform vec3 sunDir; uniform float strength; uniform float fade;
  uniform float planetR; uniform float shellR; uniform float scaleH;
  varying vec3 vP; varying vec3 vCenter; varying float vScale;
  void main() {
    vec3 dir = normalize(vP - cameraPosition);
    vec3 oc = cameraPosition - vCenter;
    float tca = max(-dot(oc, dir), 0.0);
    vec3 T = cameraPosition + dir * tca;                    // closest approach to the centre
    float b = length(T - vCenter);
    float R = planetR * vScale, H = scaleH * vScale, S = shellR * vScale;
    float d = b - R;                                        // ray height above the surface (< 0: it hits)
    float glow = d > 0.0 ? exp(-d / H) : exp(d / (H * 0.5));
    glow *= smoothstep(S, S - 2.0 * H, b);                  // nothing at the shell's own edge
    float mu = dot(normalize(T - vCenter), normalize(sunDir));
    vec3 c = mix(vec3(1.0, 0.42, 0.18), vec3(0.3, 0.6, 1.0), smoothstep(-0.15, 0.35, mu));
    float a = glow * smoothstep(-0.35, 0.15, mu) * strength * fade;
    gl_FragColor = vec4(c * a * 1.6, a);
  }`;

/**
 * Create an Earth group of the given radius (scene units).
 * Returns { group, surface, clouds, atmosphere, setSun(dirWorld), update(dt) }.
 */
/** shell / scaleH: atmosphere shell radius and glow scale height, as fractions of the radius
 *  (thin for close orbital views, thicker for the distant globe). */
export function createEarth(radius = 2, { segments = 128, atmosphere = 1, shell = 1.035, scaleH = 0.012 } = {}) {
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
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * shell, segments, segments / 2), new THREE.ShaderMaterial({
    uniforms: {
      sunDir, fade, strength: { value: atmosphere },
      planetR: { value: radius }, shellR: { value: radius * shell }, scaleH: { value: radius * scaleH },
    },
    vertexShader: atmoVert, fragmentShader: atmoFrag,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  for (const o of [surface, clouds, atmo]) { o.userData.fx = true; o.userData.noAO = true; }
  clouds.renderOrder = 1; atmo.renderOrder = 2;
  group.add(surface, clouds, atmo);
  const earth = {
    group, surface, clouds, atmosphere: atmo,
    setSun(dir) { sunDir.value.copy(dir).normalize(); },
    setFade(a) { fade.value = a; },
    update(dt) { cloudShift.value = (cloudShift.value + dt * 0.0012) % 1; },
  };
  earths.add(earth);
  applyMaps(earth);
  return earth;
}
