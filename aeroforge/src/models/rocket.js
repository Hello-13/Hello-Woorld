// SpaceX Falcon Heavy (Block 5) on Launch Complex 39A.
//
// Three Falcon 9-derived first-stage cores — a reinforced centre core and two side boosters with
// composite nose cones — each with nine Merlin 1D on an Octaweb, titanium grid fins and four
// carbon landing legs; a Falcon 9 second stage with one Merlin Vacuum; the 13.1 m × 5.2 m
// composite fairing over a representative payload. Real scale in metres: y up from the
// centre-core nozzle exit plane, side boosters on ±x (see falcon/dims.js for the station plan).
// The pad (falcon/pad.js) is shown in the launch-pad look; the launch mount always.

import * as THREE from 'three';
import { Assembly } from '../engine/assembly.js';
import { BOOSTER_X, ENGINE_RING, PAD, STACK0, Y, polar } from './falcon/dims.js';
import { buildCore } from './falcon/core.js';
import { buildUpper } from './falcon/upper.js';
import { buildPad } from './falcon/pad.js';
import { plumeMaterial, plumeMesh, glowSprite, padSmoke } from './falcon/exhaust.js';

const PIVOT = 30;                 // stack-frame height of the pitch pivot (≈ centre of mass)
const FOLLOW_STACK = 35;          // camera tracks the middle of the stack…
const FOLLOW_UPPER = 56;          // …then the second stage and payload after staging
const smooth = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

export function buildRocket() {
  const A = new Assembly();
  const world = new THREE.Group();          // shifted down in looks without the hardstand
  A.root.add(world);
  const ground = new THREE.Group();         // everything on the pad; scrolls away during ascent
  const site = new THREE.Group();           // hardstand, trench, tower, TE: launch-pad look only
  const base = new THREE.Group();           // launch mount, clamps, tail service masts: always
  ground.add(site, base);
  world.add(ground);

  const rigPivot = new THREE.Group();       // rotates for pitch during ascent
  rigPivot.position.y = STACK0 + PIVOT;
  const stack = new THREE.Group();
  stack.position.y = -PIVOT;
  rigPivot.add(stack);
  world.add(rigPivot);

  const coreG = new THREE.Group();
  const boosterG = [1, -1].map((s) => { const g = new THREE.Group(); g.position.x = s * BOOSTER_X; return g; });
  const upperG = new THREE.Group();
  stack.add(coreG, ...boosterG, upperG);

  // exploded view: the vehicle rises off the mount and steps forward (+z) clear of the
  // transporter-erector; skins pull back toward their original place to bare the internals
  const centre = buildCore(A, coreG, { kind: 'centre', prefix: 'Centre core', explodeBase: [0, 3, 6], paint: { soot: 0.05, streaks: 6, seed: 5 } });
  const boosters = [
    buildCore(A, boosterG[0], { kind: 'booster', prefix: 'Side booster A', explodeBase: [7.0, 3, 6], paint: { soot: 0.2, streaks: 36, seed: 9 }, attachSide: 1 }),
    buildCore(A, boosterG[1], { kind: 'booster', prefix: 'Side booster B', explodeBase: [-7.0, 3, 6], paint: { soot: 0.22, streaks: 40, seed: 13 }, attachSide: -1 }),
  ];
  const upper = buildUpper(A, upperG, { explodeBase: [0, 14, 6] });
  const pad = buildPad(A, site, base);

  // ----------------------------------------------------------------- exhaust (effects, not parts)
  const enginePos = [[0, 0], ...Array.from({ length: 8 }, (_, k) => polar(ENGINE_RING, 22.5 + k * 45))];
  const corePlumes = (group) => {
    const jetMat = plumeMaterial({ core: 0xfff6e2, outer: 0xffa03a, diamonds: 1.4 });
    const bigMat = plumeMaterial({ core: 0xffe9c0, outer: 0xff7a1c, diamonds: 0.6, soot: 0.35 });
    const jets = enginePos.map(([x, z]) => { const m = plumeMesh(0.44, 0.78, 7.5, jetMat, 20); m.position.set(x, 0, z); group.add(m); return m; });
    const big = plumeMesh(1.75, 3.6, 36, bigMat, 32);
    big.position.y = -0.4;
    group.add(big);
    return { jetMat, bigMat, meshes: [...jets, big] };
  };
  const plumes = { core: corePlumes(coreG), boosters: boosterG.map(corePlumes) };
  const mvacMat = plumeMaterial({ core: 0xffd9b0, outer: 0xd86a4a, diamonds: 0.0 });
  const mvacPlume = plumeMesh(1.45, 16, 70, mvacMat, 40);
  mvacPlume.position.y = Y.mvacExit;
  upperG.add(mvacPlume);
  const allPlumeMats = [plumes.core.jetMat, plumes.core.bigMat, ...plumes.boosters.flatMap((p) => [p.jetMat, p.bigMat]), mvacMat];
  const allPlumeMeshes = [...plumes.core.meshes, ...plumes.boosters.flatMap((p) => p.meshes), mvacPlume];

  const engineGlow = glowSprite(0xffa04a, 30);
  engineGlow.position.y = -3;
  stack.add(engineGlow);
  const padGlow = glowSprite(0xff9a50, 48);
  padGlow.position.set(0, PAD.hardstand + PAD.mountDeck - 2, 0);
  site.add(padGlow);
  const smoke = padSmoke({ trenchEnd: 35, deck: pad.deckTop });
  ground.add(smoke.points);

  A.finalize();

  // The pad site is context, not the subject: it shows only in the launch-pad look and only while
  // the hardstand wears its studio material. X-ray, Systems, Blueprint and Thermal (and tour steps
  // that ghost the pad) then show the vehicle alone. A getter keeps this synchronous with every
  // visibility check (rendering, framing, picking) instead of lagging a frame behind mode changes.
  let probe = null;
  site.traverse((o) => { if (!probe && o.isMesh && !o.userData.fx) probe = o; });
  let onPad = true;
  const siteShown = () => onPad && (!probe || !probe.userData.studio || probe.material === probe.userData.studio);
  Object.defineProperty(site, 'visible', { get: siteShown, set() {}, configurable: true });

  const st = {
    firing: { booster: false, core: false, upper: false },
    coreThrottle: 1,
    ambient: 1,            // ambient pressure ratio p/p0
    pitch: 0,
    altitudeVis: 0,
    ignition: 0,
    launching: false,
  };
  let followY = FOLLOW_STACK;
  const fairPart = A.parts.find((p) => p.userData.part.name === 'Fairing half A');
  const exploded = () => fairPart.position.lengthSq() > 0.25;

  const allFins = [...centre.fins, ...boosters.flatMap((b) => b.fins)];
  const setFins = (fins, k) => { for (const m of fins) m.rotation.x = (-Math.PI / 2) * smooth(k); };

  const resetSeparation = () => {
    boosterG.forEach((g, i) => { g.position.set((i === 0 ? 1 : -1) * BOOSTER_X, 0, 0); g.rotation.set(0, 0, 0); g.visible = true; });
    coreG.position.set(0, 0, 0); coreG.rotation.set(0, 0, 0); coreG.visible = true;
    for (const [p, s] of [[upper.fairA, 1], [upper.fairB, -1]]) {
      p.rotation.set(0, 0, 0); p.position.set(s * 1.86, Y.fairingBase, 0); p.visible = true;
    }
    setFins(allFins, 0);
  };

  const vehicle = {
    id: 'rocket',
    designation: 'SPACEX',
    name: 'FALCON HEAVY',
    role: 'Heavy-lift launch vehicle',
    tagline: 'Three Falcon 9 cores · 27 Merlin engines · 63.8 t to low Earth orbit',
    summary: 'Falcon Heavy straps two Falcon 9 first stages beside a strengthened centre core and tops it with a standard Falcon 9 second stage. All 27 Merlin 1D engines light on the pad; the centre core throttles down so it is still burning when the side boosters separate about 2½ minutes in, and the boosters fly back to land. A single Merlin Vacuum then takes the payload to orbit. First flight: 6 February 2018 from Kennedy Space Center LC-39A.',
    specs: [
      ['Height', '70 m'], ['Width', '12.2 m'], ['Core diameter', '3.66 m'], ['Liftoff mass', '1,420,788 kg'],
      ['Liftoff thrust', '22,819 kN (27 × Merlin 1D)'], ['Vacuum thrust', '24,681 kN'], ['Merlin 1D', '845 kN SL · 914 kN vac · Isp 282 / 311 s'],
      ['Merlin Vacuum', '981 kN · Isp 348 s · 165 : 1'], ['Payload to LEO', '63,800 kg'], ['Payload to GTO', '26,700 kg'], ['Payload to Mars', '16,800 kg'],
      ['Fairing', '13.1 m × 5.2 m'], ['Propellants', 'RP-1 / LOX'], ['Pad', 'LC-39A, Kennedy Space Center'],
    ],
    heroStats: [['63.8', 't', 'Payload to LEO'], ['22,819', 'kN', 'Liftoff thrust'], ['27', '', 'Merlin engines at liftoff']],
    sources: 'SpaceX Falcon Heavy and Falcon 9 vehicle pages and Falcon User\'s Guide; NASA KSC LC-39 fact sheets (FSS, flame trench, lightning protection); NASA Commercial Crew blog (crew access arm); Spaceflight Now Falcon Heavy launch timelines; Wikipedia: Falcon Heavy, Falcon 9, SpaceX Merlin, AMOS-6 and CRS-7 investigations.',
    fleetTag: '63.8 t LEO',
    root: A.root,
    rigPivot, stack, ground,
    pivotY: STACK0 + PIVOT,
    parts: A.parts,
    // with the pad showing, frame a little tighter so the vehicle, not the hardstand, fills the view
    view: { dir: [1.0, 0.2, 1.35], get fill() { return siteShown() && !exploded() ? 0.8 : 1.0; } },
    displaySize: 13,
    thermalRange: [60, 1800],
    state: st,
    /** The pad site (hardstand, trench, tower, TE, scenery) belongs to the launch-pad look only. */
    setLook(k) {
      onPad = k === 'pad';
      // without the hardstand the launch mount stands on the floor
      world.position.y = onPad ? 0 : -PAD.hardstand;
    },
    temperatureOf(info) {
      const f = st.firing;
      const ign = st.ignition > 0.3;
      switch (info.thermalRole) {
        case 'lox': return 66;                     // densified LOX, −207 °C
        case 'rp1': return 266;                    // chilled RP-1, −7 °C
        case 'engineB': return f.booster || ign ? 950 : 290;
        case 'engineC': return f.core || ign ? 950 : 290;
        case 'engine2': return f.upper ? 900 : 290;
        case 'mvacExt': return f.upper ? 1600 : 290;
        case 'heatshield': return f.booster || f.core || ign ? 640 : 290;
        case 'fairing': return st.launching ? 290 + Math.min(150, st.altitudeVis / 400) : 290;
        case 'pad': return 300;
        default: return info.temp;
      }
    },
    /** World-space point the chase camera tracks: the stack's middle, then the second stage. */
    followPoint(out) {
      stack.updateWorldMatrix(true, false);
      return stack.localToWorld(out.set(0, followY, 0));
    },
    resetFlight() {
      followY = FOLLOW_STACK;
      st.launching = false;
      st.firing = { booster: false, core: false, upper: false };
      st.ignition = 0;
      st.pitch = 0;
      st.altitudeVis = 0;
      st.ambient = 1;
      rigPivot.rotation.set(0, 0, 0);
      rigPivot.position.y = STACK0 + PIVOT;
      ground.position.y = 0;
      smoke.reset();
      resetSeparation();
    },
    /**
     * Drive the visuals from a simulation sample. sep: seconds since each separation event
     * ({ booster, core, fairing }, null before it happens).
     */
    applyFlight(s, sep) {
      st.launching = true;
      st.firing = { ...s.enginesOn };
      st.coreThrottle = s.coreThrottle;
      st.ambient = s.ambientP / 101325;
      st.altitudeVis = s.h;
      st.pitch = s.pitch;
      rigPivot.rotation.z = -(s.pitch * Math.PI) / 180;
      // after staging the camera hands over from the full stack to the second stage
      const k = sep.core == null ? 0 : smooth(sep.core / 4);
      followY = FOLLOW_STACK + (FOLLOW_UPPER - FOLLOW_STACK) * k;
      // side boosters: pushed sideways, fall behind, then flip with grid fins out
      boosterG.forEach((g, i) => {
        const side = i === 0 ? 1 : -1;
        if (sep.booster == null) { g.position.set(side * BOOSTER_X, 0, 0); g.rotation.set(0, 0, 0); g.visible = true; setFins(boosters[i].fins, 0); return; }
        const t = sep.booster;
        g.position.set(side * (BOOSTER_X + t * 1.3 + t * t * 0.22), -t * t * 1.25, 0);
        g.rotation.z = -side * Math.min(0.9, t * 0.045 + t * t * 0.004);
        g.visible = t < 30;
        setFins(boosters[i].fins, (t - 3) / 3);
      });
      // centre core: the interstage pushers drive it back; it drops away below the second stage
      if (sep.core == null) { coreG.position.set(0, 0, 0); coreG.rotation.set(0, 0, 0); coreG.visible = true; setFins(centre.fins, 0); }
      else {
        const t = sep.core;
        coreG.position.set(-t * 0.18, -(t * 1.6 + t * t * 1.05), 0);
        coreG.rotation.z = Math.min(0.5, t * t * 0.006);
        coreG.visible = t < 30;
        setFins(centre.fins, (t - 2) / 3);
      }
      // fairing halves swing open about their base hinges, then drift clear
      for (const [p, side] of [[upper.fairA, 1], [upper.fairB, -1]]) {
        if (sep.fairing == null) { p.rotation.set(0, 0, 0); p.position.set(side * 1.86, Y.fairingBase, 0); p.visible = true; continue; }
        const t = sep.fairing;
        p.rotation.z = -side * Math.min(2.2, t * 0.42 + t * t * 0.02);
        p.position.set(side * (1.86 + t * 0.9 + t * t * 0.3), Y.fairingBase - t * t * 0.7, 0);
        p.visible = t < 16;
      }
    },
    update(dt, t) {
      const amb = Math.min(1, st.ambient);
      const ign = st.ignition;                                   // pre-liftoff ramp 0..1
      const ease = Math.min(1, dt * 6);
      const drive = (mat, target, expansion, diamonds) => {
        const u = mat.uniforms;
        u.time.value = t;
        u.intensity.value += (target - u.intensity.value) * ease;
        u.expansion.value = expansion;
        if (diamonds != null) u.diamonds.value = diamonds;
      };
      const coreOn = st.firing.core ? 0.55 + 0.45 * st.coreThrottle : ign;
      const boostOn = st.firing.booster ? 1 : ign;
      // individual jets merge into one plume as the air thins and each jet balloons outward
      const jetExp = 1 + (1 - amb) * 1.8, bigExp = 1 + (1 - amb) * 2.2;
      drive(plumes.core.jetMat, coreOn * (0.4 + 0.6 * amb), jetExp, amb * 1.4);
      drive(plumes.core.bigMat, coreOn, bigExp, amb * 0.6);
      for (const p of plumes.boosters) {
        drive(p.jetMat, boostOn * (0.4 + 0.6 * amb), jetExp, amb * 1.4);
        drive(p.bigMat, boostOn, bigExp, amb * 0.6);
      }
      drive(mvacMat, st.firing.upper ? 0.85 : 0, 1.0, 0);
      for (const m of allPlumeMeshes) m.visible = m.material.uniforms.intensity.value > 0.01;

      // engine glow: smooth, no light source and no random flicker
      const fire = Math.max(st.firing.core || st.firing.booster ? 1 : 0, ign);
      const glowTarget = fire * Math.min(1, amb * 3 + 0.15) * 0.75;
      engineGlow.material.opacity += (glowTarget - engineGlow.material.opacity) * ease;
      engineGlow.visible = engineGlow.material.opacity > 0.01;
      const nearPad = Math.max(0, 1 - st.altitudeVis / 300);
      const padTarget = Math.max(ign, st.launching ? fire * nearPad : 0) * 0.85;
      padGlow.material.opacity += (padTarget - padGlow.material.opacity) * ease;
      padGlow.visible = padGlow.material.opacity > 0.01;

      // steam and smoke out of the flame trench
      const emit = (ign > 0.2 || (st.launching && fire > 0)) && st.altitudeVis < 900;
      smoke.update(dt, emit, st.altitudeVis < 200 ? 1 : 0.5);
    },
  };
  for (const m of allPlumeMats) m.uniforms.intensity.value = 0;
  vehicle.resetFlight();
  return vehicle;
}
