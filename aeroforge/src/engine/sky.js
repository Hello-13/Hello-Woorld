// The open-sky backdrop for aircraft in flight: one camera-centred dome whose shader draws, in a
// single pass, the sky above the horizon from an 8K / 4K photographic plate (Poly Haven's
// Kloofendal 43d clear pure sky, tone-mapped by assets/hdri/plates: see CREDITS.md) and, below
// it, a real-scale cloud deck on the curved Earth: cloud tops a few kilometres under the
// aircraft, reaching a horizon that dips with altitude (acos(R / (R + h))), lit by the plate's
// sun, whose disc and aureole the shader adds in HDR (the plate's are clipped).
//
// The deck is a height field in metres (clouds.js: Worley convection cells at 1.5 km and 300 m,
// fbm between them, cauliflower at 60 m and 12 m near the camera, rare towering cumulus up to
// 1.7 km above the deck). Where the pixel footprint resolves it, the shader ray-marches the view
// ray against the top-height field (a few steps between the highest tops and the deck base, then
// a linear refinement), shades the hit with a soft-terminator multiple-scattering approximation,
// sky light that darkens in the hollows, a short march toward the sun for self-shadowing, silver
// lining on thin edges toward the sun and blue-grey undersides in the gaps, then fades it into the
// haze with the altitude's aerial perspective. A thin cirrus veil sits above the aircraft while it
// flies below 12.6 km, the sun gets a disc, an aureole and a gentle veiling glare when it nears
// the frame edge, and everything scrolls at airspeed and evolves in two slow noise phases.
//
// Quality: SkyDome.tier budgets the deck (relief steps, shadow steps, detail octave, cirrus,
// ground shadow, flare); environment.js maps the presets to it. `dome.simple = true` recompiles
// the shader without relief, self-shadow, cirrus and flare: the plate plus a flat shaded deck,
// the path that was proven on real GPUs before this version.
//
// Altitude grades the sky: the zenith darkens and saturates (deep blue at 12 km, near violet at
// 18 km), the horizon haze thins, and the aerial perspective toward the deck lengthens.
// The same grading drives the scene's fog and the lights on the aircraft (see skyGrade).

import * as THREE from 'three';
import { cloudNoise, CLOUD_FIELD_GLSL, WRAP, DRIFT_WRAP } from './clouds.js';
import { ATM, SKY_TIERS, skyRadiance } from './skymath.js';

export { SKY_TIERS, skyRadiance };

export const R_EARTH_M = 6371000;
/** Cirrus veil altitude (m): the aircraft flies under it below this height. */
export const CIRRUS_ALT = 12600;

// The plate's highlight shoulder (plates.py): y = K + (1 - K)(1 - exp(-(x - K) / S)) above K.
const PLATE_KNEE = 0.5, PLATE_SHOULDER = 1.6;

// ------------------------------------------------------------------------------- grading
const lerp = THREE.MathUtils.lerp;
const KEYS = [   // altitude (m) → sky parameters, linear colour
  { h: 0,     zenith: [1.00, 1.00, 1.00], haze: [0.74, 0.79, 0.87], sat: 1.00, beta: 1 / 24000, ambient: [0.40, 0.54, 0.84], skyLight: 0xa6c8ff, key: 0xfff1df },
  { h: 11000, zenith: [0.54, 0.60, 0.90], haze: [0.68, 0.75, 0.86], sat: 1.20, beta: 1 / 52000, ambient: [0.36, 0.48, 0.78], skyLight: 0x7aa0ee, key: 0xfff6ea },
  { h: 18000, zenith: [0.32, 0.31, 0.64], haze: [0.54, 0.62, 0.78], sat: 1.32, beta: 1 / 90000, ambient: [0.27, 0.35, 0.66], skyLight: 0x5c6fd2, key: 0xfffaf2 },
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

// ------------------------------------------------------------------------------- shaders
const vert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;                                   // the dome is centred on the camera
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w * 0.99999;           // always at the far plane, whatever the dome's radius
  }`;

// Single-scattering atmosphere (Rayleigh + Mie) on the spherical Earth, with the sun's optical
// depth from the Chapman / Kasten-Young airmass, marched in a handful of steps: the sky at any
// altitude and the aerial perspective toward the deck. The constants are sea-level values; the
// camera's altitude thins the air above it. SUN_E scales the sun's irradiance into the scene's
// linear units (the zenith at sea level comes out near the plate's).
export const ATMOSPHERE_GLSL = /* glsl */`
  const float R_E = 6371000.0;
  const float H_ATM = 80000.0;
  const vec3 BETA_R = vec3(${ATM.betaR.map((v) => v.toExponential(2)).join(', ')});
  const float H_R = ${ATM.HR.toFixed(1)};
  const float BETA_M = ${ATM.betaM.toExponential(2)};
  const float H_M = ${ATM.HM.toFixed(1)};
  const float MIE_G = ${ATM.g.toFixed(3)};
  const float SUN_E = ${ATM.E.toFixed(2)};
  const float SS_CLIP = ${ATM.clip.toFixed(3)};
  const float MIE_BG = ${ATM.bg.toFixed(4)};
  const float K_MS = ${ATM.kms.toFixed(3)};
  const vec3 MS_COL = vec3(${ATM.ms.map((v) => v.toFixed(3)).join(', ')});

  float airmass(float sinE) {
    float e = degrees(asin(clamp(sinE, -1.0, 1.0)));
    return 1.0 / max(sinE + 0.15 * pow(max(e + 3.885, 0.1), -1.253), 0.02);
  }

  // in-scattered light along d from the camera to distance tEnd (or the top of the atmosphere),
  // n samples; transm returns the transmittance over that path
  vec3 inscatter(vec3 d, float tEnd, int n, out vec3 transm) {
    float r0 = R_E + camAlt;
    float b = r0 * d.y;
    float c = r0 * r0 - (R_E + H_ATM) * (R_E + H_ATM);
    float tTop = -b + sqrt(max(b * b - c, 0.0));
    float len = min(tEnd, tTop);
    float cosT = dot(d, sunDir);
    float pr = 0.0596831 * (1.0 + cosT * cosT);
    float g2 = MIE_G * MIE_G;
    float pm = 0.0795775 * (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * MIE_G * cosT, 1e-4), 1.5);
    float xs = airmass(sunDir.y);
    vec3 tau = vec3(0.0), LR = vec3(0.0); float LM = 0.0;
    float dt = len / float(max(n, 1));
    for (int i = 0; i < 10; i++) {
      if (i >= n) break;
      float t = (float(i) + 0.5) * dt;
      float h = max(sqrt(max(r0 * r0 + t * t + 2.0 * r0 * t * d.y, 0.0)) - R_E, 0.0);
      float rhoR = exp(-h / H_R);
      float rhoM = exp(-h / H_M) + MIE_BG * exp(-h / 25000.0);      // the thin background aerosol
      vec3 ext = BETA_R * rhoR + vec3(BETA_M * 1.1 * rhoM);
      vec3 tauSun = (BETA_R * H_R * rhoR + vec3(BETA_M * 1.1 * H_M * rhoM)) * xs;
      tau += ext * dt * 0.5;
      vec3 T = exp(-(tau + tauSun));
      LR += T * BETA_R * rhoR * pr * dt;
      LM += T.g * BETA_M * rhoM * pm * dt;
      tau += ext * dt * 0.5;
    }
    transm = exp(-(tau + K_MS * tau.g));
    // the higher orders of scattering: the Rayleigh light is soft-clipped (a deep path whitens and
    // dims), the Mie aureole stays HDR for the bloom, a pale lift grows with the optical depth
    vec3 ss = LR * SUN_E;
    ss = SS_CLIP * (1.0 - exp(-ss / SS_CLIP));
    return (ss + vec3(LM * SUN_E) + (1.0 - transm) * MS_COL) * sunColor;
  }
`;

const frag = /* glsl */`
  uniform sampler2D plate; uniform float hasPlate; uniform float plateRot; uniform float plateGain;
  uniform sampler2D noiseTex;
  uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 skyAmbient;
  uniform vec3 zenithMul; uniform vec3 hazeColor; uniform float satBoost; uniform float hazeBeta;
  uniform float camH; uniform float oc; uniform float dip; uniform float hAmp; uniform float towerAmp;
  uniform vec2 camXZ; uniform vec2 shift; uniform vec2 drift1; uniform vec2 drift2;
  uniform float coverage; uniform float towers; uniform float detail; uniform float groundHaze;
  uniform vec3 groundColor; uniform float pixAngle; uniform vec2 resolution;
  uniform int reliefSteps; uniform int shadowSteps; uniform float groundShadow;
  uniform float cirrus; uniform float cirrusH; uniform float flare; uniform vec3 sunNdc;
  uniform float camAlt; uniform float plateW; uniform float hazeGain;
  varying vec3 vDir;

  const float PI = 3.14159265;
  const float TWO_PI = 6.2831853;
  const float KNEE = ${PLATE_KNEE.toFixed(3)};
  const float SHOULDER = ${PLATE_SHOULDER.toFixed(3)};
  const float SUN_R = 0.00465;                         // the sun's angular radius (rad)

  ${CLOUD_FIELD_GLSL}
  ${ATMOSPHERE_GLSL}

  // the plate's highlight shoulder, undone: the JPG holds radiance 1:1 below the knee and
  // compressed above it, so the sun's aureole comes back as HDR for bloom and tone mapping
  vec3 decodePlate(vec3 y) {
    vec3 hi = KNEE - SHOULDER * log(1.0 - min((y - KNEE) / (1.0 - KNEE), 0.996));
    return mix(y, min(hi, vec3(8.0)), step(KNEE, y));
  }

  // ---------------------------------------------------------------- the ray and the deck sphere
  // Heights are measured above the deck's base sphere (radius oc - camH); the camera is camH above
  // it. Along the ray, to second order in t / R (exact to a metre out to the horizon):
  float rayH(float t, float dy) { return camH + dy * t + t * t * (1.0 - dy * dy) / (2.0 * oc); }

  // Distance along a descending ray (dy < 0) to the height hr < camH; the tangent distance when
  // the ray never gets down to it, so t is continuous across the horizon.
  float rayT(float hr, float dy) {
    float a = (1.0 - dy * dy) / (2.0 * oc);
    float c = camH - hr;
    float disc = dy * dy - 4.0 * a * c;
    if (disc < 0.0) return -dy / max(2.0 * a, 1e-12);
    return 2.0 * c / max(-dy + sqrt(disc), 1e-6);
  }

  // the pixel's footprint on the deck at distance t: its size there, stretched by the grazing
  // angle (geometric mean of along- and across-view, as anisotropic filtering would keep it)
  float footAt(float t, float dy) {
    float graz = max(-(dy + t / oc), 0.02);
    return t * pixAngle / sqrt(graz);
  }

  // ---------------------------------------------------------------- the sky
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
    // altitude grading: a darker, bluer zenith and a more saturated sky; the thin bright band
    // just above the horizon stays (it is the air below the aircraft, lit from above)
    col *= mix(vec3(1.0), zenithMul, pow(up, 0.6));
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = max(mix(vec3(lum), col, satBoost), 0.0);
    // the sky just above the horizon converges on the haze colour the deck fades into
    col = mix(col, hazeColor, smoothstep(0.05, -0.01, e2) * 0.8);
#ifdef SIMPLE
    return col;
#else
    if (plateW >= 0.999) return col;
    // at altitude the sky is computed: Rayleigh and Mie single scattering through the air above
    // the aircraft, so it is as dark, blue and clear as the altitude makes it, with the horizon
    // band that the dense air below lays along the limb
    vec3 tr;
    vec3 sky = inscatter(d, 1e9, 10, tr);
    return mix(sky, col, plateW);
#endif
  }

  // The sun: a limb-darkened disc of the true angular size, antialiased over a pixel, and a
  // circumsolar aureole (forward Mie scattering by the air column) that the plate's own wide glow
  // continues outward. sin of the angle from the cross product: precise where dot() is not.
  vec3 sunDisc(vec3 d) {
    float ca = dot(d, sunDir);
    if (ca < 0.9) return vec3(0.0);
    float ang = length(cross(d, sunDir));
    float disc = 1.0 - smoothstep(SUN_R - pixAngle, SUN_R + pixAngle, ang);
    float u = clamp(ang / SUN_R, 0.0, 1.0);
    float limb = 1.0 - 0.55 * (1.0 - sqrt(max(1.0 - u * u, 0.0)));
    float r = ang / 0.012;
    float aureole = 0.9 / (1.0 + r * r) + 0.12 / (1.0 + 0.1 * r * r);
    return sunColor * (disc * limb * 60.0 + aureole * (1.0 - disc));
  }

  // A thin cirrus veil far above the aircraft: fibrous, streaked along the wind, patchy, brighter
  // toward the sun, thinning into the haze toward the horizon.
  vec3 cirrusLayer(vec3 d, vec3 col) {
    if (cirrus < 0.5 || cirrusH < 300.0 || d.y < 0.004) return col;
    float t = cirrusH / max(d.y, 0.004);
    vec2 q = d.xz * t + camXZ + shift;
    float foot = t * pixAngle / sqrt(max(d.y, 0.03));
    float mask = nz(q + 21000.0, T_REGION, foot).r;
    vec4 S = nz(vec2(q.x * 0.5, q.y * 2.0) + 777.0, T_CIRRUS, foot);
    // fibres: the same streaked lookup at 3 km and 600 m, so the veil keeps structure up close
    float fib = nz(vec2(q.x * 0.25, q.y * 2.0) + 311.0, T_CFIBRE, foot).b;
    float fib2 = nz(vec2(q.x * 0.25, q.y * 2.0) + 97.0, T_CFINE, foot).g;
    float a = smoothstep(0.46, 0.82, S.b * 0.42 + S.g * 0.14 + mask * 0.3 + fib * 0.1 + fib2 * 0.04) * 0.34;
    a *= smoothstep(300.0, 1800.0, cirrusH) * smoothstep(0.004, 0.05, d.y);
    float fwd = pow(max(dot(d, sunDir), 0.0), 8.0);
    vec3 cc = sunColor * (0.78 + 0.9 * fwd) + skyAmbient * 0.35;
    float fog = 1.0 - exp(-t * hazeBeta * 0.5);
    cc = mix(cc, hazeColor, fog);
    return mix(col, cc, a * (1.0 - 0.8 * fog));
  }

  // ---------------------------------------------------------------- the deck
  vec3 deckColor(vec3 d, float e) {
    float dy = d.y;
    float t0 = rayT(0.0, dy);                                    // the deck's base
    vec2 q0 = d.xz * t0 + camXZ + shift;                         // ground-fixed metres, scrolled at airspeed
    float foot0 = footAt(t0, dy);
    vec2 reg = fieldRegion(q0, foot0);
    float tHit = t0;
    vec2 qh = q0;
    float footH = foot0;
#ifndef SIMPLE
    // relief: march the ray against the top-height field where the deck is close enough to
    // resolve it (full by 3.4 degrees below the horizon, none at grazing angles)
    float w = smoothstep(0.012, 0.06, -(e + dip));
    if (reliefSteps > 0 && w > 0.001) {
      float Hmax = hAmp * 1.05 + reg.y * towerAmp;
      float tA = rayT(Hmax, dy);
      float dA = Hmax - fieldCoarse(d.xz * tA + camXZ + shift, footAt(tA, dy), reg).y;
      float tB = t0, dB = -1.0;
      bool hit = false;
      for (int i = 1; i <= 8; i++) {
        if (i > reliefSteps) break;
        float fr = float(i) / float(reliefSteps);
        float hr = Hmax * pow(1.0 - fr, 1.4);                   // steps crowd toward the deck
        tB = rayT(hr, dy);
        dB = hr - fieldCoarse(d.xz * tB + camXZ + shift, footAt(tB, dy), reg).y;
        if (dB < 0.0) { hit = true; break; }
        tA = tB; dA = dB;
      }
      if (hit) {
        // linear refinement between the last sample above the field and the first below it
        float k = clamp(dA / max(dA - dB, 1e-3), 0.0, 1.0);
        float tR = mix(tA, tB, k);
        float dR = rayH(tR, dy) - fieldCoarse(d.xz * tR + camXZ + shift, footAt(tR, dy), reg).y;
        if (dR < 0.0) { k = clamp(dA / max(dA - dR, 1e-3), 0.0, 1.0); tR = mix(tA, tR, k); }
        else { k = clamp(dR / max(dR - dB, 1e-3), 0.0, 1.0); tR = mix(tR, tB, k); }
        tHit = mix(t0, tR, w);
      }
      qh = d.xz * tHit + camXZ + shift;
      footH = footAt(tHit, dy);
    }
#endif
    vec3 F = fieldFull(qh, footH, reg);
    float cov = F.x, h = F.y;
    // shading normal from the height field's slope, sampled a footprint apart (ground-space
    // differences: stable at every angle, unlike screen-space derivatives)
    float dq = max(25.0, footH * 1.5);
    float hx = fieldFull(qh + vec2(dq, 0.0), footH, reg).y;
    float hz = fieldFull(qh + vec2(0.0, dq), footH, reg).y;
    vec3 N = normalize(vec3(-(hx - h), dq, -(hz - h)));
    float ndl = dot(N, sunDir);

    // self-shadowing: a short march toward the sun over the coarse field
    float sh = 1.0;
#ifndef SIMPLE
    if (shadowSteps > 0) {
      vec2 run = sunDir.xz / max(sunDir.y, 0.15);
      float occ = 0.0;
      for (int i = 1; i <= 4; i++) {
        if (i > shadowSteps) break;
        float rise = 40.0 + 60.0 * float(i * i);                 // 100, 280, 580, 1000 m up the sun ray
        float hs = fieldCoarse(qh + run * rise, footH + rise * 0.4, reg).y;
        occ += clamp((hs - (h + rise)) / 160.0, 0.0, 1.0);
      }
      sh = 1.0 - 0.72 * clamp(occ, 0.0, 1.0);
    }
#endif

    // multiple scattering: a wide soft terminator (lit tops are bright and low-contrast), sky
    // light from above that the hollows between the lumps lose, the powder darkening of creases
    // seen toward the sun
    float lit = 0.2 + 0.8 * smoothstep(-0.25, 0.7, ndl);
    float ao = 0.42 + 0.58 * smoothstep(0.0, 1.0, h / max(hAmp, 1.0));
    float fwd = pow(max(dot(d, sunDir), 0.0), 6.0);
    float powder = 1.0 - 0.3 * fwd * (1.0 - ao);
    vec3 cloud = sunColor * (lit * sh * 1.2 * (0.72 + 0.28 * ao) * powder) + skyAmbient * (0.5 + 0.5 * N.y) * (0.26 + 0.34 * ao);
    // thin edges: the cloud's shaded flanks and base show through them, blue-grey; toward the
    // sun the edges light up (silver lining)
    float thick = smoothstep(0.12, 0.7, cov);
    vec3 baseCol = skyAmbient * 0.95 + sunColor * 0.16;
    cloud = mix(baseCol, cloud, thick);
    float fwd2 = pow(max(dot(d, sunDir), 0.0), 10.0);
    cloud += sunColor * fwd2 * (1.0 - thick) * smoothstep(0.0, 0.3, cov) * 2.0;

    // the ground through the gaps: land / sea far below under a deep column of hazy air, in the
    // deck's own shadow where the sun is behind cloud
    float land = nz(q0 + 0.7 * T_LAND, T_LAND, foot0).b;
    vec3 ground = mix(groundColor * 0.7, groundColor * 1.25, land);
    if (groundShadow > 0.5) {
      vec2 qs = q0 + sunDir.xz / max(sunDir.y, 0.25) * 1800.0;
      ground *= 1.0 - 0.5 * fieldCoarse(qs, foot0, reg).x;
    }
    ground = mix(ground, hazeColor * 0.88, groundHaze);
    vec3 col = mix(ground, cloud, smoothstep(0.0, 0.3, cov));

#ifdef SIMPLE
    // aerial perspective along the ray to the hit, out to the horizon's haze
    float fogF = 1.0 - 0.9 * exp(-tHit * hazeBeta);
    return mix(col, hazeColor, fogF);
#else
    // aerial perspective: the deck seen through the air between it and the aircraft, attenuated
    // and veiled by the same scattering as the sky, so the far deck dissolves into the horizon band
    vec3 tr;
    vec3 air = inscatter(d, tHit, 6, tr);
    tr = pow(tr, vec3(hazeGain));
    return col * tr + air * hazeGain;
#endif
  }

  // A gentle lens response when the sun nears the frame edge: veiling glare falling off across
  // the frame and one soft ghost on the far side of the centre. Nothing when the sun is well
  // inside the frame or far outside it.
  vec3 lensFlare(vec3 col) {
    if (flare < 0.5 || sunNdc.z < 0.5) return col;
    float edge = max(abs(sunNdc.x), abs(sunNdc.y));
    float k = smoothstep(0.55, 1.0, edge) * (1.0 - smoothstep(1.15, 1.7, edge));
    if (k <= 0.0) return col;
    vec2 res = max(resolution, vec2(1.0));
    vec2 fc = gl_FragCoord.xy / res * 2.0 - 1.0;
    float aspect = res.x / res.y;
    vec2 dv = (fc - sunNdc.xy) * vec2(aspect, 1.0);
    col += sunColor * k * 0.09 / (1.0 + 2.5 * dot(dv, dv));
    vec2 g = (fc + sunNdc.xy * 0.55) * vec2(aspect, 1.0);
    col += vec3(0.85, 0.93, 1.0) * k * 0.05 * smoothstep(0.17, 0.02, length(g));
    return col;
  }

  void main() {
    vec3 d = normalize(vDir);
    float e = asin(clamp(d.y, -1.0, 1.0));
    vec3 col;
    if (e < -dip) {
      col = deckColor(d, e);
    } else {
      col = skyColor(d, e);
#ifndef SIMPLE
      col = cirrusLayer(d, col);
#endif
      col += sunDisc(d);
    }
#ifndef SIMPLE
    col = lensFlare(col);
#endif
    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }`;

// ------------------------------------------------------------------------------- the dome
export class SkyDome extends THREE.Mesh {
  constructor() {
    const uniforms = {
      plate: { value: null }, hasPlate: { value: 0 }, plateRot: { value: 0 }, plateGain: { value: 1 },
      noiseTex: { value: null },
      sunDir: { value: new THREE.Vector3(0.5, 0.7, 0.5).normalize() },
      sunColor: { value: new THREE.Color(1.0, 0.96, 0.9) },
      skyAmbient: { value: new THREE.Color(0.36, 0.48, 0.78) },
      zenithMul: { value: new THREE.Vector3(1, 1, 1) },
      hazeColor: { value: new THREE.Color(0.68, 0.75, 0.86) },
      satBoost: { value: 1 }, hazeBeta: { value: 1 / 52000 },
      camH: { value: 3000 }, oc: { value: R_EARTH_M + 11000 }, dip: { value: 0.03 }, hAmp: { value: 700 }, towerAmp: { value: 1700 },
      camXZ: { value: new THREE.Vector2() }, shift: { value: new THREE.Vector2() },
      drift1: { value: new THREE.Vector2() }, drift2: { value: new THREE.Vector2() },
      coverage: { value: 0.55 }, towers: { value: 1 }, detail: { value: 1 }, groundHaze: { value: 0.6 },
      groundColor: { value: new THREE.Color(0.2, 0.25, 0.34) }, pixAngle: { value: 5e-4 },
      resolution: { value: new THREE.Vector2(1920, 1080) },
      reliefSteps: { value: 6 }, shadowSteps: { value: 4 }, groundShadow: { value: 1 },
      cirrus: { value: 1 }, cirrusH: { value: 1600 }, flare: { value: 1 }, sunNdc: { value: new THREE.Vector3(0, 0, 0) },
      camAlt: { value: 11000 }, plateW: { value: 0 }, hazeGain: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, vertexShader: vert, fragmentShader: frag, defines: {},
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
    this.drift1 = new THREE.Vector2();   // the two noise phases (m)
    this.drift2 = new THREE.Vector2();
    this.grade = skyGrade(11000);
    /** Cloud amount 0..1 (0.55: a broken stratocumulus field with open lanes). */
    this.coverage = 0.55;
    /** Cloud tops this far below the aircraft (m), clamped so the deck stays above the ground. */
    this.deckDrop = 3000;
    /** Towering cumulus islands on (1) or off (0). */
    this.towers = 1;
    /** Quality tier (see SKY_TIERS). */
    this.tier = { ...SKY_TIERS.ultra };
    this._simple = false;
    // the proven fallback can be forced without code: localStorage 'aeroforge.simplesky' = '1'
    let forced = false;
    try { forced = localStorage.getItem('aeroforge.simplesky') === '1'; } catch { /* storage blocked */ }
    if (forced || SkyDome.simpleDefault) this.simple = true;
    this._sunWorld = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
    /** Aerial perspective gain (1 = the model's own; above it, a stronger veil toward the deck). */
    this.hazeGain = 1.4;
  }

  /** Fallback: the plate and a flat shaded deck only (no relief march, self-shadow, cirrus or
   *  flare), compiled as a separate shader variant. */
  get simple() { return this._simple; }
  set simple(v) {
    v = !!v;
    if (v === this._simple) return;
    this._simple = v;
    if (v) this.material.defines.SIMPLE = 1; else delete this.material.defines.SIMPLE;
    this.material.needsUpdate = true;
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
   * unitMetres: metres per scene unit (camera offsets become real distances); camera: the stage
   * camera; pixels / width: the frame's height and width in device pixels.
   */
  update(dt, camera, { altitude = 11000, speed = 0, unitMetres = 1.7, pixels = 1080, width = 1920 } = {}) {
    const u = this.uniforms;
    if (!u.noiseTex.value) u.noiseTex.value = cloudNoise();
    dt = Math.min(Math.max(dt || 0, 0), 0.25);
    this.position.copy(camera.position);
    const g = this.grade = skyGrade(altitude);
    u.zenithMul.value.fromArray(g.zenith);
    u.hazeColor.value.setRGB(g.haze[0], g.haze[1], g.haze[2]);
    u.skyAmbient.value.setRGB(g.ambient[0], g.ambient[1], g.ambient[2]);
    u.satBoost.value = g.sat;
    u.hazeBeta.value = g.beta;
    // the deck: tops deckDrop below the aircraft, never below 400 m; the camera's own height adds on
    const camAlt = altitude + camera.position.y * unitMetres;
    const deckTop = Math.max(altitude - this.deckDrop, 400);
    const camH = Math.max(camAlt - deckTop, 250);
    const deckR = R_EARTH_M + deckTop;
    u.camH.value = camH;
    u.oc.value = deckR + camH;
    u.dip.value = Math.acos(Math.min(deckR / (deckR + camH), 1));
    u.hAmp.value = 620 + 120 * this.tier.detail;
    u.towerAmp.value = 1700;
    u.towers.value = this.towers;
    u.groundHaze.value = THREE.MathUtils.clamp(0.4 + deckTop / 14000, 0.4, 0.88);
    u.camXZ.value.set(camera.position.x * unitMetres, camera.position.z * unitMetres);
    const fullH = camera.view?.enabled ? camera.view.fullHeight : pixels;    // a view-offset tile keeps the full frame's pixel angle
    u.pixAngle.value = (camera.fov * Math.PI / 180) / Math.max(fullH, 1);
    u.resolution.value.set(Math.max(width, 1), Math.max(pixels, 1));
    u.cirrusH.value = CIRRUS_ALT - camAlt;
    u.camAlt.value = camAlt;
    // the plate (a ground-level photograph) carries the sky near the ground; from 2.5 km up the
    // computed atmosphere takes over, fully by 7 km
    const aw = THREE.MathUtils.smoothstep(camAlt, 2500, 7000);
    u.plateW.value = 1 - aw;
    u.hazeGain.value = this.hazeGain;
    if (aw > 0) {
      // the horizon colour (for the scene fog) and the sky light on the cloud tops, from the same model
      const sun = u.sunDir.value, sc = u.sunColor.value;
      const hz = skyRadiance(this._tmpDir.set(-sun.x, 0, -sun.z).normalize().setY(0.03).normalize(), sun, camAlt, sc);
      const z = skyRadiance(this._tmpDir.set(0, 1, 0), sun, camAlt, sc);
      const m = skyRadiance(this._tmpDir.set(sun.x, 0.5, sun.z).normalize(), sun, camAlt, sc);
      const amb = [0, 1, 2].map((i) => (z[i] * 0.3 + m[i] * 0.4 + hz[i] * 0.3) * 1.6);
      g.haze = g.haze.map((v, i) => lerp(v, hz[i], aw));
      g.ambient = g.ambient.map((v, i) => lerp(v, amb[i], aw));
      u.hazeColor.value.setRGB(g.haze[0], g.haze[1], g.haze[2]);
      u.skyAmbient.value.setRGB(g.ambient[0], g.ambient[1], g.ambient[2]);
    }
    // scroll: the aircraft flies toward +x (every model's nose), so the ground passes toward -x;
    // every noise tile divides the wrap period, so the wrap is invisible
    this.shift = (this.shift + dt * speed) % WRAP;
    u.shift.value.set(this.shift, 0);
    // two phases of slow evolution: the lumps move against the cells at about a metre a second
    const wrap = (v, p) => ((v % p) + p) % p;
    this.drift1.set(wrap(this.drift1.x + dt * 0.9, DRIFT_WRAP.mid), wrap(this.drift1.y + dt * 0.35, DRIFT_WRAP.mid));
    this.drift2.set(wrap(this.drift2.x - dt * 0.25, DRIFT_WRAP.cells), wrap(this.drift2.y + dt * 0.5, DRIFT_WRAP.cells));
    u.drift1.value.copy(this.drift1);
    u.drift2.value.copy(this.drift2);
    u.coverage.value = this.coverage;
    // tiers
    const t = this.tier;
    u.reliefSteps.value = Math.min(Math.max(t.relief | 0, 0), 8);
    u.shadowSteps.value = Math.min(Math.max(t.shadow | 0, 0), 4);
    u.detail.value = t.detail ? 1 : 0;
    u.groundShadow.value = t.groundShadow ? 1 : 0;
    u.cirrus.value = t.cirrus ? 1 : 0;
    u.flare.value = t.flare ? 1 : 0;
    // the sun on screen (NDC), for the lens response
    const s = this._sunWorld.copy(u.sunDir.value).multiplyScalar(1000).add(camera.position).project(camera);
    const front = s.z < 1 && s.z > -1 && Number.isFinite(s.x) && Number.isFinite(s.y);
    u.sunNdc.value.set(front ? s.x : 0, front ? s.y : 0, front ? 1 : 0);
  }
}
/** Construct every dome in the simple fallback (set before the stage boots). */
SkyDome.simpleDefault = false;

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
