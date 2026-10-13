// HELIOS-H — fictional two-stage heavy-lift launcher with two strap-on side boosters.
// 27 first-stage engines on octaweb thrust structures, titanium grid fins, a carbon interstage
// shrouding the vacuum engine, and a split ogive payload fairing.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import { lathe, ogiveProfile, latticePanel, beam, rod, mergeGeometries } from '../engine/geometry.js';
import { M, SKIN, rocketBodyTexture, smokeTexture, rng } from '../engine/materials.js';
import { tankSkin } from '../engine/surface.js';
import { plumeMaterial, plumeMesh } from '../engine/effects.js';

const R = 1.85;            // core radius (m)
const MOUNT = 3.2;         // launch-mount height (m)

function bellGeometry({ throat = 0.16, exit = 0.48, chamber = 0.24, chamberLen = 0.55, len = 1.8, seg = 28 }) {
  const prof = [[0.001, 0], [chamber, 0], [chamber, -chamberLen * 0.7], [throat, -chamberLen]];
  for (let i = 1; i <= 14; i++) {
    const t = i / 14;
    prof.push([throat + (exit - throat) * Math.sqrt(t) * (0.82 + 0.18 * t), -chamberLen - len * t]);
  }
  return lathe(prof, seg);
}

function engineCluster(y0) {
  const geos = [];
  const bell = bellGeometry({});
  const place = (x, z) => { const g = bell.clone(); g.translate(x, y0, z); geos.push(g.toNonIndexed()); };
  place(0, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    place(Math.cos(a) * 1.22, Math.sin(a) * 1.22);
  }
  return mergeGeometries(geos);
}

function gridFins(y, radius, mat) {
  // stowed for ascent: lattice folded flat against the body, tangent to the skin
  const fin = latticePanel(1.25, 1.5, 0.17, 0.02, 0.1, 0.05);
  const group = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const hinge = new THREE.Group();
    hinge.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    hinge.rotation.y = Math.PI / 2 - a;      // local +z → radial
    const m = mesh(fin, mat);
    m.position.z = 0.1;
    hinge.add(m);
    group.add(hinge);
  }
  return group;
}

function legs(radius, mat) {
  const group = new THREE.Group();
  const legGeo = new THREE.BoxGeometry(0.75, 9.5, 0.16);
  legGeo.translate(0, 4.75, 0);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = mesh(legGeo, mat);
    leg.position.set(Math.cos(a) * (radius + 0.1), 0.4, Math.sin(a) * (radius + 0.1));
    leg.rotation.y = -a + Math.PI / 2;
    const foot = mesh(new THREE.BoxGeometry(0.8, 0.25, 0.3), M.darkMetal());
    foot.position.set(0, 0.1, 0.05);
    leg.add(foot);
    group.add(leg);
  }
  return group;
}

function stageBody(len, label, { soot = 0.35, band = null } = {}) {
  const sk = tankSkin();
  const normalMap = sk.normalMap.clone(); normalMap.repeat.set(10, len / 3.4); normalMap.needsUpdate = true;
  const roughnessMap = sk.roughnessMap.clone(); roughnessMap.repeat.set(4, len / 6); roughnessMap.needsUpdate = true;
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xe6e9ec, map: rocketBodyTexture(label, { soot, band }), normalMap, roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.9, metalness: 0.04, clearcoat: 0.35, clearcoatRoughness: 0.32,
  });
  return mesh(lathe([[R, 0], [R, len]], 96, Math.PI), mat);
}

/** Per-engine hardware: turbopump, gas-generator exhaust, gimbal actuators and propellant lines. */
function engineKit(y0) {
  const dark = [], copper = [];
  const positions = [[0, 0]];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; positions.push([Math.cos(a) * 1.22, Math.sin(a) * 1.22]); }
  for (const [x, z] of positions) {
    const out = Math.hypot(x, z) > 0.1 ? [x / Math.hypot(x, z), z / Math.hypot(x, z)] : [1, 0];
    const tx = -out[1], tz = out[0];                       // tangential direction
    const pump = new THREE.CylinderGeometry(0.1, 0.1, 0.34, 14).rotateZ(Math.PI / 2).rotateY(Math.atan2(tz, tx) * -1);
    pump.translate(x + tx * 0.3, y0 - 0.25, z + tz * 0.3);
    dark.push(pump.toNonIndexed());
    const gg = new THREE.CylinderGeometry(0.045, 0.06, 1.6, 10).translate(0, -0.8, 0);
    gg.translate(x + tx * 0.38, y0 - 0.45, z + tz * 0.38);
    dark.push(gg.toNonIndexed());
    for (const sgn of [1, -1]) {
      copper.push(rod([x + tx * 0.18 * sgn, y0 + 0.02, z + tz * 0.18 * sgn], [x + out[0] * 0.2, y0 - 0.5, z + out[1] * 0.2], 0.025, 6).toNonIndexed());
    }
    dark.push(rod([x - out[0] * 0.3, y0 + 0.05, z - out[1] * 0.3], [x - out[0] * 0.12, y0 - 0.42, z - out[1] * 0.12], 0.03, 6).toNonIndexed());
  }
  const g = new THREE.Group();
  g.add(mesh(mergeGeometries(dark), M.darkMetal()), mesh(mergeGeometries(copper), M.copper()));
  return g;
}

export function buildRocket() {
  const A = new Assembly();
  const rigPivot = new THREE.Group();       // rotates for pitch during ascent (pivot ≈ centre of mass)
  const PIVOT_Y = MOUNT + 32;
  rigPivot.position.y = PIVOT_Y;
  const stack = new THREE.Group();
  stack.position.y = -PIVOT_Y + MOUNT;
  rigPivot.add(stack);
  A.root.add(rigPivot);
  const UPPER_CENTRE = 56;                  // stack-frame height of the upper stage + payload
  let followY = PIVOT_Y - MOUNT;
  const P = (name, info, objs) => A.part(name, info, objs, stack);

  const finMat = new THREE.MeshStandardMaterial({ color: 0x8c847c, metalness: 1, roughness: 0.38 });
  const interMat = SKIN.carbon().clone();
  interMat.map = SKIN.carbon().map.clone(); interMat.map.repeat.set(28, 10); interMat.map.needsUpdate = true;
  interMat.normalMap = SKIN.carbon().normalMap.clone(); interMat.normalMap.repeat.set(28, 10); interMat.normalMap.needsUpdate = true;

  // ----------------------------------------------------------------- core first stage
  const coreBody = stageBody(42, 'HELIOS', { soot: 0.3 });
  const heatShield = mesh(new THREE.CylinderGeometry(R, R, 0.3, 48), M.carbon());
  heatShield.position.y = 0.15;
  const raceway = mesh(new THREE.BoxGeometry(0.22, 38, 0.18), M.offWhite());
  raceway.position.set(Math.cos(1.2) * (R + 0.06), 21, Math.sin(1.2) * (R + 0.06));
  const coreStage = P('Core stage', {
    system: 'Stage 1', material: 'Al-Li 2195 tanks, friction-stir welded', mass: 25600,
    desc: 'Centre core: LOX over RP-1 tanks, 395.7 t of propellant. Throttles to 55 % during the booster phase so it burns longer.',
    callout: true, anchor: [R + 0.2, 28, 0],
  }, [coreBody, heatShield, raceway, legs(R, SKIN.carbon())]);
  coreStage.userData.part.thermalRole = 'cryoTank';

  const coreEngines = P('Core engine cluster', {
    system: 'Propulsion', material: 'Regeneratively cooled Cu-alloy chamber, Inconel nozzle', mass: 4300, explode: [0, -5, 0],
    desc: 'Nine gas-generator engines on an octaweb: 914 kN each in vacuum, Isp 282 s at sea level → 311 s in vacuum.',
    callout: true, anchor: [0, -2.2, R],
  }, [mesh(engineCluster(0), SKIN.bell()), engineKit(0)]);
  coreEngines.userData.part.thermalRole = 'engine1';

  // ----------------------------------------------------------------- interstage
  const inter = mesh(lathe([[R, 42], [R, 48.5]], 96), interMat);
  const interPart = P('Interstage', {
    system: 'Stage 1', material: 'Carbon-fibre / aluminium honeycomb', mass: 1900, explode: [0, 4, 0],
    desc: 'Shrouds the upper-stage vacuum nozzle and carries four titanium grid fins and cold-gas attitude thrusters.',
    callout: true, anchor: [R + 0.8, 46.5, 0],
  }, [inter, gridFins(47.2, R, finMat)]);
  for (const a of [Math.PI / 4, (5 * Math.PI) / 4]) {
    const pod = mesh(new THREE.BoxGeometry(0.4, 0.6, 0.25), M.darkMetal());
    pod.position.set(Math.cos(a) * (R + 0.08), 45.2, Math.sin(a) * (R + 0.08));
    pod.rotation.y = -a;
    interPart.add(pod);
  }

  // ----------------------------------------------------------------- upper stage
  const upperBody = stageBody(12.5, 'H-02', { soot: 0 });
  upperBody.position.y = 48.5;
  const upper = P('Upper stage', {
    system: 'Stage 2', material: 'Al-Li 2195, common-dome tank', mass: 4500, explode: [0, 9, 0],
    desc: 'Single vacuum engine, 107.5 t of propellant. Flies closed-loop guidance to orbital insertion.',
    callout: true, anchor: [R + 0.2, 56, 0],
  }, upperBody);
  upper.userData.part.thermalRole = 'cryoTank';

  const mvacBell = bellGeometry({ throat: 0.22, exit: 1.55, chamber: 0.36, chamberLen: 0.9, len: 2.9, seg: 48 });
  const mvac = mesh(mvacBell, M.niobium());
  mvac.position.y = 48.5;
  const turbopump = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 16), M.copper());
  turbopump.position.set(0.45, 48.05, 0);
  const mvacPart = P('Vacuum engine', {
    system: 'Propulsion', material: 'Niobium alloy radiatively cooled extension', mass: 470, explode: [0, 6.5, 0],
    desc: '981 kN, Isp 348 s. The large-expansion nozzle (≈165:1) would flow-separate at sea level, so it only fires in near-vacuum.',
    callout: true, anchor: [1.6, 45.2, 0],
  }, [mvac, turbopump]);
  mvacPart.userData.part.thermalRole = 'engine2';

  // ----------------------------------------------------------------- payload & adapter
  const adapter = mesh(lathe([[R, 61], [1.2, 61.6], [0.9, 62]], 48), M.aluminium());
  const bus = mesh(new THREE.BoxGeometry(2.2, 3.0, 2.2), M.mli());
  bus.position.y = 63.6;
  const arrays = [1, -1].map((s) => {
    const a = mesh(new THREE.BoxGeometry(0.25, 2.8, 2.0), M.solar());
    a.position.set(1.25 * s, 63.6, 0);
    return a;
  });
  const dish = mesh(lathe([[0.001, 0], [0.4, 0.05], [0.8, 0.2]], 32), M.offWhite());
  dish.material = M.offWhite();
  dish.position.y = 65.1;
  const payload = P('Payload', {
    system: 'Payload', material: 'Spacecraft in launch configuration', mass: 15000, explode: [0, 13, 0],
    desc: 'Customer spacecraft with arrays stowed, mounted on a 1,666 mm clamp-band adapter.',
    callout: true, anchor: [1.3, 64.5, 0],
  }, [adapter, bus, ...arrays, dish]);
  payload.userData.part.temp = 293;

  // ----------------------------------------------------------------- fairing halves
  const fairProfile = [[R, 61], [2.6, 62.4], [2.6, 67.4], ...ogiveProfile(2.6, 6.8, 67.4, 20).slice(1)];
  const fairMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
  const fairing = [];
  for (const side of [1, -1]) {
    const geo = lathe(fairProfile, 48, side > 0 ? 0 : Math.PI, Math.PI);
    const hinge = new THREE.Group();
    hinge.position.set(2.0 * side, 61.4, 0);
    const m = mesh(geo, fairMat);
    m.position.set(-2.0 * side, -61.4, 0);
    hinge.add(m);
    const part = P(side > 0 ? 'Fairing half A' : 'Fairing half B', {
      system: 'Payload', material: 'Carbon composite sandwich, acoustic blankets', mass: 950, explode: [4.5 * side, 6, 0],
      desc: 'Clamshell fairing: pneumatic pushers split the halves once dynamic pressure has fallen below ≈ 5 Pa.',
      callout: side > 0, anchor: [2.7, 69, 0],
    }, hinge);
    part.userData.part.thermalRole = 'fairing';
    fairing.push({ part, hinge, side });
  }

  // ----------------------------------------------------------------- side boosters
  const boosters = [];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.x = (2 * R + 0.3) * side;
    const body = stageBody(42, 'HELIOS', { soot: 0.38 });
    const nose = mesh(lathe(ogiveProfile(R, 7.5, 42, 22), 64), new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.45, metalness: 0.05 }));
    const shield = mesh(new THREE.CylinderGeometry(R, R, 0.3, 48), M.carbon());
    shield.position.y = 0.15;
    const engines = mesh(engineCluster(0), SKIN.bell());
    engines.userData.temp = () => vehicleState.firing.booster ? 1850 : 300;
    g.add(body, nose, shield, engines, engineKit(0), gridFins(40.6, R, finMat), legs(R, SKIN.carbon()));
    for (const y of [5, 39.5]) {
      g.add(mesh(beam([-(R + 0.3) * side + (side > 0 ? 0 : 0), y, 0], [-R * side, y, 0], 0.25, 0.25), M.darkMetal()));
    }
    const part = P(side > 0 ? 'Side booster (starboard)' : 'Side booster (port)', {
      system: 'Stage 0', material: 'Al-Li tanks, composite nose cone', mass: 22200, explode: [3.2 * side, -1, 0],
      desc: 'Strap-on booster: nine engines, burns out at ≈ T+147 s and separates with pneumatic pushers.',
      callout: side > 0, anchor: [R, 30, 0],
    }, g);
    part.userData.part.thermalRole = 'cryoTank';
    boosters.push({ part, group: g, side });
  }

  // ----------------------------------------------------------------- launch mount (stays on the pad)
  const ground = new THREE.Group();
  A.root.add(ground);
  const mountParts = [];
  for (const x of [-(2 * R + 0.3), 0, 2 * R + 0.3]) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const px = x + Math.cos(a) * (R + 0.35), pz = Math.sin(a) * (R + 0.35);
      mountParts.push(beam([px, 0, pz], [px, MOUNT - 0.2, pz], 0.45, 0.45).toNonIndexed());
      const clamp = new THREE.BoxGeometry(0.5, 0.5, 0.35).translate(px * 0.92 + x * 0.08, MOUNT - 0.1, pz * 0.92);
      mountParts.push(clamp.toNonIndexed());
    }
  }
  mountParts.push(new THREE.BoxGeometry(14, 0.5, 0.6).translate(0, MOUNT - 0.6, 2.45).toNonIndexed());
  mountParts.push(new THREE.BoxGeometry(14, 0.5, 0.6).translate(0, MOUNT - 0.6, -2.45).toNonIndexed());
  const deflector = new THREE.BufferGeometry();
  {
    const w = 13, d = 4.2, h = 1.4;
    const v = [-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, h, 0, -w / 2, h, 0, -w / 2, 0, d / 2, w / 2, 0, d / 2];
    deflector.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    deflector.setIndex([0, 2, 1, 0, 3, 2, 4, 5, 2, 4, 2, 3]);
    deflector.computeVertexNormals();
  }
  const mount = mesh(mergeGeometries(mountParts), M.pad());
  const defl = mesh(deflector, new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.85, metalness: 0.2, side: THREE.DoubleSide }));
  const towerFace = latticePanel(2.4, 58, 1.7, 0.12, 0.12, 0.22);
  const towerGeos = [];
  for (let k = 0; k < 4; k++) {
    const g = towerFace.clone();
    g.translate(0, 29, 1.2);
    g.rotateY((k * Math.PI) / 2);
    towerGeos.push(g);
  }
  const umbilical = mesh(mergeGeometries(towerGeos).translate(-8, 0, -4), M.pad());
  const arm = mesh(beam([-8, 56.5, -4], [-1.9, 56.5, -0.6], 0.5, 0.6), M.pad());
  const armLight = mesh(new THREE.SphereGeometry(0.25, 10, 8), M.navRed(), { cast: false });
  armLight.position.set(-8, 58.3, -4);
  // tower service levels
  const levels = [];
  for (let y = 8; y < 58; y += 9.5) levels.push(new THREE.BoxGeometry(3.6, 0.25, 3.6).translate(-8, y, -4).toNonIndexed());
  const towerLevels = mesh(mergeGeometries(levels), M.pad());

  // lightning-protection masts joined by catenary wires, cryogenic storage spheres, a water tower and flood-light poles
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b9096, metalness: 0.7, roughness: 0.5 });
  const mastFace = latticePanel(2.6, 105, 2.0, 0.14, 0.14, 0.24);
  const masts = [[72, 58], [-74, 52], [4, -96]];
  const mastGeos = [];
  for (const [x, z] of masts) {
    for (let k = 0; k < 4; k++) mastGeos.push(mastFace.clone().translate(0, 52.5, 1.3).rotateY((k * Math.PI) / 2).translate(x, 0, z));
    mastGeos.push(new THREE.ConeGeometry(0.5, 12, 6).translate(x, 111, z).toNonIndexed());
  }
  const mastMesh = mesh(mergeGeometries(mastGeos.map((g) => (g.index ? g.toNonIndexed() : g))), steel);
  const wires = [];
  const catenary = (a, b, sag) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= sag * 4 * t * (1 - t);
      pts.push(p);
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.12, 4, false);
  };
  for (let i = 0; i < masts.length; i++) {
    const [x0, z0] = masts[i], [x1, z1] = masts[(i + 1) % masts.length];
    wires.push(catenary(new THREE.Vector3(x0, 116, z0), new THREE.Vector3(x1, 116, z1), 34));
    wires.push(catenary(new THREE.Vector3(x0, 116, z0), new THREE.Vector3(x0 * 1.6, 0, z0 * 1.6), 6));
  }
  const wireMesh = mesh(mergeGeometries(wires.map((g) => g.toNonIndexed())), M.darkMetal(), { cast: false });
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0xe8e9e6, roughness: 0.5, metalness: 0.1 });
  const tanks = new THREE.Group();
  for (const [x, z, r] of [[128, -64, 10], [-138, -44, 12]]) {
    const sph = mesh(new THREE.SphereGeometry(r, 40, 24), sphereMat);
    sph.position.set(x, r + 4, z);
    tanks.add(sph);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      tanks.add(mesh(beam([x + Math.cos(a) * r * 0.75, 0, z + Math.sin(a) * r * 0.75], [x + Math.cos(a) * r * 0.85, r + 4, z + Math.sin(a) * r * 0.85], 0.6, 0.6), steel));
    }
  }
  const water = new THREE.Group();
  {
    const x = 96, z = -158;
    const tank = mesh(new THREE.CylinderGeometry(8, 8, 9, 32), sphereMat);
    tank.position.set(x, 66, z);
    const roof = mesh(new THREE.ConeGeometry(8.4, 3, 32), sphereMat);
    roof.position.set(x, 72, z);
    water.add(tank, roof);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      water.add(mesh(beam([x + Math.cos(a) * 9, 0, z + Math.sin(a) * 9], [x + Math.cos(a) * 6.5, 62, z + Math.sin(a) * 6.5], 0.8, 0.8), steel));
    }
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xeef4ff, emissiveIntensity: 9 });
  const floods = new THREE.Group();
  for (const [x, z] of [[48, 30], [-44, 38], [30, -46], [-36, -40]]) {
    floods.add(mesh(rod([x, 0, z], [x, 34, z], 0.35, 8), steel));
    const head = mesh(new THREE.BoxGeometry(4, 1.6, 0.6), M.darkMetal());
    head.position.set(x, 34.5, z);
    head.lookAt(0, 25, 0);
    const lamps = mesh(new THREE.PlaneGeometry(3.6, 1.2), lampMat, { cast: false });
    lamps.position.set(0, 0, 0.32);
    head.add(lamps);
    floods.add(head);
  }
  const trench = mesh(new THREE.PlaneGeometry(14, 26), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 1 }));
  trench.rotation.x = -Math.PI / 2;
  trench.position.set(0, 0.02, 14);

  const padPart = A.part('Launch mount & tower', {
    system: 'Ground systems', material: 'Structural steel, refractory concrete', mass: null, explode: [0, 0, 0],
    desc: 'Hold-down clamps restrain the vehicle until all 27 engines reach full thrust; the deflector turns the exhaust into the flame trench.',
  }, [mount, defl, umbilical, towerLevels, arm, armLight], ground);
  const site = new THREE.Group();
  site.add(mastMesh, wireMesh, tanks, water, floods, trench);
  site.traverse((o) => { if (o.isMesh) o.userData.fx = true; });
  ground.add(site);
  padPart.userData.part.temp = 300;

  // ----------------------------------------------------------------- exhaust
  const plumes = { booster: [], core: null, upper: null };
  const makeCorePlume = (x) => {
    const mat = plumeMaterial({ core: 0xfff4dc, outer: 0xff8a2a, diamonds: 1.3 });
    const p = plumeMesh(1.55, 2.2, 26, mat);
    p.position.set(x, -2.3, 0);
    const inner = plumeMesh(0.9, 0.5, 9, plumeMaterial({ core: 0xffffff, outer: 0xffe0a0, diamonds: 2 }));
    inner.position.set(x, -2.3, 0);
    return { outer: p, inner };
  };
  const cp = makeCorePlume(0);
  stack.add(cp.outer, cp.inner);
  plumes.core = cp;
  for (const b of boosters) {
    const bp = makeCorePlume(0);
    b.group.add(bp.outer, bp.inner);
    plumes.booster.push(bp);
  }
  const up = plumeMesh(1.5, 9, 40, plumeMaterial({ core: 0xd8e6ff, outer: 0x6a8cff, diamonds: 0.2 }));
  up.position.y = 48.5 - 0.9 - 2.9;
  stack.add(up);
  plumes.upper = up;
  const allPlumes = [cp.outer, cp.inner, ...plumes.booster.flatMap((b) => [b.outer, b.inner]), up];

  const glow = new THREE.PointLight(0xff9a40, 0, 60, 1.6);
  glow.position.set(0, -4, 0);
  stack.add(glow);

  // smoke & steam at the pad
  const SMOKE = 260;
  const smokeGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(SMOKE * 3);
  const sSize = new Float32Array(SMOKE);
  const sAlpha = new Float32Array(SMOKE);
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  smokeGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));
  smokeGeo.setAttribute('alpha', new THREE.BufferAttribute(sAlpha, 1));
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: smokeTexture() }, scale: { value: 300 } },
    vertexShader: /* glsl */`
      attribute float size; attribute float alpha; varying float vA;
      uniform float scale;
      void main() { vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform sampler2D map; varying float vA;
      void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.82, 0.8, 0.78) * t.a * vA, t.a * vA); }`,
    transparent: true, depthWrite: false,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.userData.fx = true;
  smoke.frustumCulled = false;
  ground.add(smoke);
  const puffs = Array.from({ length: SMOKE }, () => ({ life: 0, max: 1, v: new THREE.Vector3() }));
  const rand = rng(99);

  A.finalize();

  const vehicleState = {
    firing: { booster: false, core: false, upper: false },
    coreThrottle: 1,
    ambient: 1,            // ambient pressure ratio p/p0
    boostersAttached: true, coreAttached: true, fairingAttached: true,
    sepT: { booster: 0, core: 0, fairing: 0 },
    pitch: 0,
    altitudeVis: 0,
    ignition: 0,
    launching: false,
  };

  const resetSeparation = () => {
    for (const b of boosters) {
      b.part.visible = true;
      b.group.position.set((2 * R + 0.3) * b.side, 0, 0);
      b.group.rotation.set(0, 0, 0);
    }
    for (const f of fairing) { f.part.visible = true; f.hinge.rotation.set(0, 0, 0); f.hinge.position.set(2.0 * f.side, 61.4, 0); }
    for (const p of [coreStage, coreEngines, interPart]) { p.visible = true; }
    coreGroupOffset.set(0, 0, 0);
    applyCoreOffset();
  };
  const coreGroupOffset = new THREE.Vector3();
  const coreParts = [coreStage, coreEngines, interPart];
  const applyCoreOffset = () => {
    for (const p of coreParts) p.position.copy(p.userData.base).add(coreGroupOffset);
    cp.outer.position.set(0, -2.3, 0).add(coreGroupOffset);
    cp.inner.position.set(0, -2.3, 0).add(coreGroupOffset);
  };

  const vehicle = {
    id: 'rocket',
    designation: 'HELIOS-H',
    name: 'HEAVY',
    role: 'Heavy-lift orbital launcher',
    tagline: 'Two stages + two boosters · 27 engines at liftoff · partially reusable',
    summary: 'A tri-core heavy launcher. All 27 first-stage engines light together; the centre core throttles back so it is still burning after the side boosters separate. The upper stage then flies closed-loop guidance to a circular low Earth orbit.',
    specs: [
      ['Height', '74.2 m'], ['Core diameter', '3.70 m'], ['Liftoff mass', '≈ 1,400 t'], ['Liftoff thrust', '22.8 MN'],
      ['Stage 1 Isp', '282 / 311 s'], ['Stage 2 Isp', '348 s (vac)'], ['Payload to LEO', '≈ 60 t expendable'], ['Fairing', '5.2 × 13.2 m'],
    ],
    fleetTag: '60 t LEO',
    root: A.root,
    rigPivot, stack, ground,
    /** The pad site (tower, tanks, flame trench) belongs to the launch-pad look only. */
    setLook(look) { site.visible = look === 'pad'; },
    parts: A.parts,
    view: { dir: [1.0, 0.18, 1.35], fill: 1.0 },
    displaySize: 13,
    thermalRange: [80, 2000],
    state: vehicleState,
    temperatureOf(info) {
      const f = vehicleState.firing;
      switch (info.thermalRole) {
        case 'cryoTank': return info.name.startsWith('Upper') ? 92 : 110;    // LOX-wetted skin, frost line
        case 'engine1': return f.core ? 1850 : 300;
        case 'engine2': return f.upper ? 1650 : 290;
        case 'fairing': return vehicleState.launching ? 290 + Math.min(160, vehicleState.altitudeVis / 300) : 290;
        default: return info.temp;
      }
    },
    /** World-space point the chase camera tracks: the stack's centre, then the upper stage. */
    followPoint(out) {
      stack.updateWorldMatrix(true, false);
      return stack.localToWorld(out.set(0, followY, 0));
    },
    resetFlight() {
      followY = PIVOT_Y - MOUNT;
      vehicleState.launching = false;
      vehicleState.firing = { booster: false, core: false, upper: false };
      vehicleState.ignition = 0;
      vehicleState.pitch = 0;
      rigPivot.rotation.set(0, 0, 0);
      rigPivot.position.y = PIVOT_Y;
      ground.position.y = 0;
      for (const p of puffs) p.life = 0;
      resetSeparation();
    },
    /**
     * Drive visuals from a simulation sample.
     * s: sample from simulateAscent; tSinceSep: seconds since each separation event.
     */
    applyFlight(s, sep) {
      vehicleState.launching = true;
      vehicleState.firing = { ...s.enginesOn };
      vehicleState.coreThrottle = s.coreThrottle;
      vehicleState.ambient = s.ambientP / 101325;
      vehicleState.altitudeVis = s.h;
      vehicleState.pitch = s.pitch;
      rigPivot.rotation.z = -(s.pitch * Math.PI) / 180;
      // after staging the camera hands over from the full stack to the upper stage
      const k = sep.core == null ? 0 : Math.min(1, sep.core / 4);
      followY = PIVOT_Y - MOUNT + (UPPER_CENTRE - (PIVOT_Y - MOUNT)) * k * k * (3 - 2 * k);
      // boosters drift away after separation
      for (const b of boosters) {
        if (sep.booster == null) { b.group.position.set((2 * R + 0.3) * b.side, 0, 0); b.group.rotation.set(0, 0, 0); b.part.visible = true; continue; }
        const t = sep.booster;
        b.group.position.set((2 * R + 0.3) * b.side + b.side * (t * 1.6 + t * t * 0.25), -t * t * 1.4, 0);
        b.group.rotation.z = -b.side * Math.min(0.9, t * 0.05);
        b.part.visible = t < 22;
      }
      if (sep.core == null) { coreGroupOffset.set(0, 0, 0); for (const p of coreParts) p.visible = true; }
      else {
        const t = sep.core;
        coreGroupOffset.set(-t * 0.25, -t * t * 1.1 - t * 1.5, 0);
        for (const p of coreParts) p.visible = t < 25;
      }
      applyCoreOffset();
      for (const f of fairing) {
        if (sep.fairing == null) { f.hinge.rotation.set(0, 0, 0); f.hinge.position.set(2.0 * f.side, 61.4, 0); f.part.visible = true; continue; }
        const t = sep.fairing;
        f.hinge.rotation.z = -f.side * Math.min(2.4, t * 0.5);
        f.hinge.position.set(2.0 * f.side + f.side * t * t * 0.6, 61.4 - t * t * 0.9, 0);
        f.part.visible = t < 14;
      }
    },
    update(dt, t) {
      const st = vehicleState;
      const amb = st.ambient;
      const exp = 1 + (1 - Math.min(1, amb)) * 2.6;
      const setPlume = (pl, on, k = 1) => {
        for (const m of [pl.outer, pl.inner]) {
          m.material.uniforms.time.value = t;
          m.material.uniforms.intensity.value += ((on ? k : 0) - m.material.uniforms.intensity.value) * Math.min(1, dt * 6);
          m.material.uniforms.expansion.value = exp;
          m.material.uniforms.diamonds.value = Math.min(1, amb) * 1.4;
        }
      };
      const ign = st.ignition;    // pre-liftoff ramp 0..1
      setPlume(cp, st.firing.core || ign > 0, (st.firing.core ? 0.55 + 0.45 * st.coreThrottle : ign));
      plumes.booster.forEach((bp) => setPlume(bp, st.firing.booster || ign > 0, st.firing.booster ? 1 : ign));
      const u = plumes.upper.material.uniforms;
      u.time.value = t;
      u.intensity.value += ((st.firing.upper ? 0.9 : 0) - u.intensity.value) * Math.min(1, dt * 4);
      u.expansion.value = 1.4;
      const anyFire = st.firing.core || st.firing.booster || ign > 0;
      glow.intensity = anyFire ? (400 + Math.random() * 120) * Math.max(ign, st.firing.booster ? 1 : 0.5) * Math.min(1, amb * 3 + 0.2) : 0;
      for (const m of allPlumes) m.visible = m.material.uniforms.intensity.value > 0.01;

      // pad smoke
      const near = st.launching && st.altitudeVis < 2500 ? 1 : 0;
      const emit = (ign > 0.2 || (near && (st.firing.core || st.firing.booster))) && st.altitudeVis < 900;
      let spawned = 0;
      for (let i = 0; i < SMOKE; i++) {
        const p = puffs[i];
        if (p.life <= 0 && emit && spawned < 4) {
          p.life = p.max = 4 + rand() * 5;
          const side = rand() < 0.5 ? -1 : 1;
          sPos[i * 3] = (rand() - 0.5) * 6; sPos[i * 3 + 1] = 0.8; sPos[i * 3 + 2] = side * (2 + rand() * 2);
          p.v.set((rand() - 0.5) * 5, 1 + rand() * 2.5, side * (6 + rand() * 9));
          sSize[i] = 6 + rand() * 4;
          spawned++;
        }
        if (p.life > 0) {
          p.life -= dt;
          const k = p.life / p.max;
          sPos[i * 3] += p.v.x * dt; sPos[i * 3 + 1] += p.v.y * dt; sPos[i * 3 + 2] += p.v.z * dt;
          p.v.multiplyScalar(1 - dt * 0.35);
          sSize[i] += dt * 5;
          sAlpha[i] = Math.min(1, (1 - k) * 4) * k * 0.55;
        } else sAlpha[i] = 0;
      }
      smokeGeo.attributes.position.needsUpdate = true;
      smokeGeo.attributes.size.needsUpdate = true;
      smokeGeo.attributes.alpha.needsUpdate = true;
    },
  };
  return vehicle;
}
