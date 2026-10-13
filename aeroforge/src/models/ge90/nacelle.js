// Boeing 777 nacelle and installation hardware: inlet, fan cowl doors, cascade thrust reverser
// (translating sleeves, cascades, blocker doors and drag links, hydraulic actuators), core cowl
// with its bifurcations, the pylon (strut) stub and the forward and aft engine mounts. GE builds
// the bare engine; Boeing designs and supplies the nacelle, reverser and strut.

import * as THREE from 'three';
import { SKIN } from '../../engine/materials.js';
import { lathe } from '../../engine/geometry.js';
import { GM } from './materials.js';
import { NACELLE, FAN, bypassAt, FAN_NOZZLE_Y } from './layout.js';
import { cutLathe, cutPair, wall, sector, boxAt, axialCyl, merge, P3, kept, tube } from './geom.js';

const TAU = Math.PI * 2;
const UP = Math.PI * 1.5;          // phi of the pylon (world up)
const DOWN = Math.PI / 2;          // phi of the lower bifurcation

export function buildNacelle(ctx) {
  const { P, cut } = ctx;
  const nac = SKIN.nacelle();
  const N = { cut: 'nacelle', seg: 96 };

  // ------------------------------------------------------------------ inlet
  const lip = [[1.535, 1.56], [1.538, 1.7], [1.556, 1.77], [1.588, 1.803], [1.63, 1.814], [1.672, 1.806], [1.714, 1.784], [1.762, 1.738], [1.802, 1.66], [1.828, 1.58],
    [1.813, 1.58], [1.788, 1.652], [1.75, 1.718], [1.705, 1.764], [1.646, 1.792], [1.598, 1.782], [1.566, 1.752], [1.552, 1.69], [1.55, 1.56]];
  const outerSkin = wall([[1.58, 1.825], [1.45, 1.862], [1.25, 1.902], [1.0, 1.936], [0.7, 1.958], [0.3, 1.968]], -0.01);
  const barrel = wall([[1.56, 1.536], [1.3, 1.546], [1.0, 1.57], [0.7, 1.6], [0.45, 1.624], [NACELLE.inletAftY, FAN.caseR]], 0.04);
  const bulkheads = [[[1.55, 1.565], [1.815, 1.565], [1.815, 1.555], [1.55, 1.555]], [[1.66, 0.33], [1.958, 0.33], [1.958, 0.315], [1.66, 0.315]]];
  const inletShell = cut(cutLathe([lip, outerSkin, ...bulkheads], nac, N));
  const inletLiner = cut(cutLathe(barrel, SKIN.liner(), N));
  P('Inlet cowl', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium lip, composite outer barrel, acoustic honeycomb inner barrel', mass: 380,
    explode: [0, 2.4, 0], temp: 288,
    desc: 'Boeing-supplied inlet, about 1.5 m long, that slows the air to roughly Mach 0.6 at the fan face with no separation even in crosswinds. Its lip is a D-shaped duct heated by engine bleed air for anti-icing; the inner barrel is a perforated honeycomb that absorbs fan noise.',
  }, [inletShell, inletLiner]).userData.part.stationTemp = '2';

  // ------------------------------------------------------------------ fan cowl doors
  const fanCowl = [wall([[0.3, 1.968], [-0.2, 1.978], [-0.8, 1.98], [NACELLE.fanCowlAftY, 1.975]], -0.02)];
  for (const y of [-0.15, -0.75, -1.3]) fanCowl.push([[1.9, y + 0.01], [1.96, y + 0.01], [1.96, y - 0.01], [1.9, y - 0.01]]);
  P('Fan cowl doors', {
    system: 'Skin & fairings', skin: true, material: 'Carbon-fibre composite sandwich', mass: 260, count: 2,
    explode: [-0.9, 0.1, -1.1], temp: 300,
    desc: 'Two large doors hinged from the strut that swing up to give mechanics access to the fan-case accessories — the gearbox, FADEC, oil tank and pumps. On this cutaway the half facing you is removed.',
  }, cut(cutLathe(fanCowl, nac, N)));

  // ------------------------------------------------------------------ thrust reverser
  const sleeveFwd = NACELLE.sleeveFwdY, cavityAft = -2.42;
  const duct = [];
  for (let y = cavityAft; y >= FAN_NOZZLE_Y - 1e-6; y -= 0.1) duct.push([y, bypassAt(y)[1]]);
  duct.push([FAN_NOZZLE_Y, bypassAt(FAN_NOZZLE_Y)[1]]);
  const sleeve = [
    wall([[NACELLE.fanCowlAftY - 0.02, 1.974], [-1.9, 1.965], [-2.4, 1.93], [-2.9, 1.86], [-3.35, 1.76], [-3.7, 1.645], [FAN_NOZZLE_Y, 1.55]], -0.012),
    wall(duct, 0.035),
    [[bypassAt(cavityAft)[1] + 0.035, cavityAft], [1.92, cavityAft], [1.92, cavityAft - 0.015], [bypassAt(cavityAft)[1] + 0.035, cavityAft - 0.015]],
    [[1.49, FAN_NOZZLE_Y], [1.545, FAN_NOZZLE_Y], [1.55, FAN_NOZZLE_Y + 0.03], [1.5, FAN_NOZZLE_Y + 0.03]],
  ];
  P('Thrust reverser translating sleeves', {
    system: 'Skin & fairings', skin: true, material: 'Composite outer skin, acoustic inner skin', mass: 620, count: 2,
    explode: [-0.6, -1.0, -1.2], temp: 300,
    desc: 'The aft nacelle. For reverse thrust the two sleeves slide about half a metre aft, opening a gap over the cascades, while blocker doors fold into the duct. Its trailing edge is the fan nozzle, the exit for the bypass air.',
  }, cut(cutLathe(sleeve, nac, N)));

  // cascades: rings of forward-turning vanes between axial strongbacks, behind the torque box
  const torqueBox = [[FAN.caseR + 0.01, NACELLE.fanCowlAftY], [1.95, NACELLE.fanCowlAftY], [1.95, sleeveFwd], [FAN.caseR, sleeveFwd]];
  const slats = [];
  for (let k = 0; k < 9; k++) {
    const y = sleeveFwd - 0.06 - k * 0.075;
    slats.push([[1.7, y - 0.03], [1.71, y - 0.03], [1.86, y + 0.025], [1.85, y + 0.025]]);
  }
  slats.push([[1.7, cavityAft + 0.02], [1.86, cavityAft + 0.02], [1.86, cavityAft + 0.005], [1.7, cavityAft + 0.005]]);
  const cascRings = cut(cutLathe([torqueBox, ...slats], GM.cascade(), N));
  const rails = cut(cutPair((keep) => {
    const list = [];
    for (let i = 0; i < 40; i++) { const phi = (i / 40) * TAU; if (keep(phi)) list.push(boxAt(1.78, (sleeveFwd + cavityAft) / 2, phi, [0.16, sleeveFwd - cavityAft, 0.012])); }
    return merge(list);
  }, GM.cascade(), 'nacelle'));
  P('Thrust reverser cascades', {
    system: 'Propulsion', material: 'Carbon-fibre cascade vane boxes on an aluminium torque box', mass: 260,
    explode: [-0.5, -0.55, -1.0], temp: 300,
    desc: 'Grids of curved vanes hidden under the sleeves. When the sleeves open, bypass air blocked in the duct escapes through them and is turned forward, so the fan stream pushes the aircraft backwards — up to about a third of take-off thrust on the landing roll.',
    callout: true, anchor: [-1.78, -2.0, -0.08],
  }, [cascRings, rails]);

  // blocker doors flush in the sleeve's inner wall, each tied to the core cowl by a drag link
  const doors = cut(cutPair((keep) => {
    const list = [];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const phi = ((i + 0.5) / n) * TAU;
      if (!keep(phi)) continue;
      const d = sector(FAN.caseR + 0.002, FAN.caseR + 0.02, sleeveFwd - 0.03, cavityAft + 0.04, phi - Math.PI / n + 0.015, phi + Math.PI / n - 0.015, 4);
      list.push(d);
      list.push(new THREE.CylinderGeometry(0.012, 0.012, 1, 6).applyMatrix4(linkMatrix(P3(FAN.caseR, cavityAft + 0.1, phi), P3(1.055, -2.7, phi))));
    }
    return merge(list);
  }, GM.casingDark(), 'nacelle'));
  P('Blocker doors & drag links', {
    system: 'Propulsion', material: 'Composite doors, steel drag links (count estimated)', mass: 160, count: 16,
    explode: [-0.4, -0.85, -1.0], temp: 300,
    desc: 'Stowed, the doors form part of the bypass duct wall. As the sleeve moves aft, the drag links — which cross the duct to the core cowl — pull each door down into the airstream to block it.',
  }, doors);

  const actuators = cut(cutPair((keep) => {
    const list = [];
    for (const phi of [-0.95, 0, 0.95, Math.PI - 0.95, Math.PI, Math.PI + 0.95]) {
      if (!keep(phi)) continue;
      list.push(axialCyl(1.895, -1.9, phi, 0.034, 0.62, 14), axialCyl(1.895, -2.3, phi, 0.014, 0.36, 8), boxAt(1.895, -1.6, phi, [0.08, 0.06, 0.1]));
    }
    return merge(list);
  }, GM.steel(), 'nacelle'));
  P('Thrust reverser actuators', {
    system: 'Hydraulics', material: 'Hydraulic locking actuators', mass: 60, count: 6,
    explode: [-0.55, -0.55, -1.0], temp: 300,
    desc: 'Three hydraulic actuators per reverser half drive the sleeve. Locks hold the reverser stowed in flight; the FADEC and aircraft both have to agree before it can deploy, and only on the ground.',
  }, actuators);

  // ------------------------------------------------------------------ core cowl and bifurcations
  const ifs = wall([[-1.95, 1.0], [-2.6, 1.05], [-3.2, 1.06], [FAN_NOZZLE_Y, 1.04], [-4.5, 1.015], [-5.1, 0.983]], -0.02);
  const bif = cut(cutPair((keep) => {
    const list = [];
    for (const phi of [UP, DOWN]) {
      const lo = keep(phi - 0.06), hi = keep(phi + 0.06);
      if (lo && hi) list.push(boxAt(1.32, -2.9, phi, [0.56, 1.8, 0.16]));
      else if (lo || hi) list.push(boxAt(1.32, -2.9, phi + (hi ? 0.03 : -0.03), [0.56, 1.8, 0.08]));
    }
    return merge(list);
  }, GM.coreCowl(), 'nacelle'));
  P('Core cowl & bifurcations', {
    system: 'Skin & fairings', skin: true, material: 'Composite inner fixed structure with fire-resistant blankets', mass: 300,
    explode: [0, -0.4, -1.6], temp: 380,
    desc: 'The inner wall of the bypass duct and the fireproof box round the core. The upper and lower bifurcations are walls across the duct that carry the strut, pipes and wiring between core and nacelle.',
  }, [cut(cutLathe(ifs, GM.coreCowl(), N)), bif]);

  // ------------------------------------------------------------------ pylon (strut) stub
  // side profile (y, r) of the strut stub, extruded across its 0.42 m width at 12 o'clock
  const side = [[-0.55, 1.99], [-0.75, 2.2], [-1.05, 2.42], [-5.7, 2.42], [-5.7, 1.5], [-5.48, 1.07], [-5.05, 1.05], [-4.55, 1.12], [-4.1, 1.5], [-3.9, 1.99]];
  const shape = new THREE.Shape(side.map(([y, r]) => new THREE.Vector2(-r, y)));
  const pylon = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 4 });
  pylon.translate(0, 0, -0.21);
  P('Pylon (strut) stub', {
    system: 'Structure', material: 'Titanium and steel box beam (Boeing)', mass: 900,
    explode: [-1.3, -0.2, 0], temp: 300,
    desc: 'The forward end of the 777\'s engine strut, cut off where it would join the wing. It carries thrust, weight and gust loads into the wing box, and houses the precooler and the fuel, bleed and electrical connections.',
  }, mesh0(pylon, GM.painted()));

  // ------------------------------------------------------------------ mounts and thrust links
  const fwdMount = merge([boxAt(1.8, -1.75, UP, [0.12, 0.3, 0.46]), boxAt(1.75, -1.68, UP + 0.12, [0.06, 0.08, 0.05]), boxAt(1.75, -1.68, UP - 0.12, [0.06, 0.08, 0.05]), boxAt(1.75, -1.82, UP, [0.06, 0.08, 0.12])]);
  P('Forward engine mount', {
    system: 'Structure', material: 'Forged steel yoke and links', mass: 85,
    explode: [-0.9, 0, 0], temp: 300,
    desc: 'Ties the fan frame to the strut at 12 o\'clock and takes vertical and side loads. Engine mounts have redundant, fail-safe load paths so that no single crack can let the engine go.',
  }, mesh0(fwdMount, GM.steel()));
  const links = [];
  for (const s of [-1, 1]) {
    const a = P3(0.96, -2.04, UP + s * 0.32), b = P3(1.02, -5.16, UP + s * 0.11);
    links.push(new THREE.CylinderGeometry(0.03, 0.03, 1, 10).applyMatrix4(linkMatrix(a, b)));
  }
  links.push(boxAt(1.0, -5.27, UP, [0.1, 0.16, 0.5]), boxAt(1.07, -5.27, UP, [0.06, 0.1, 0.18]));
  P('Aft engine mount & thrust links', {
    system: 'Structure', material: 'Forged steel / titanium (arrangement typical of GE wide-body engines)', mass: 120,
    explode: [-0.8, -0.95, 0], temp: 600,
    desc: 'The aft mount on the turbine rear frame takes vertical, side and roll loads; a pair of thrust links runs forward to the fan hub frame and carries the engine\'s 513 kN of thrust into the strut. GE does not publish GE90 mount drawings, so the layout follows GE\'s patents for this class of engine.',
  }, mesh0(merge(links), GM.steel()));

  void kept; void lathe; void tube; void ctx;
}

/** Matrix that stretches a unit Y-axis cylinder between points a and b. */
export function linkMatrix(a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
  return m;
}

function mesh0(g, mat) {
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
