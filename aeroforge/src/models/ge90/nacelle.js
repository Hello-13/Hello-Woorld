// Boeing 777 nacelle and installation hardware: inlet, fan cowl doors with their hinges, latches
// and hold-open rods, cascade thrust reverser (translating sleeves, cascades, blocker doors and drag
// links, hinge and latch beams, hydraulic actuators with their control valves, lines and
// synchronising shafts), core cowl with its bifurcations and pressure-relief door, the pylon
// (strut) stub and the forward and aft engine mounts and thrust links. GE builds the bare engine;
// Boeing designs and supplies the nacelle, reverser and strut.

import * as THREE from 'three';
import { SKIN } from '../../engine/materials.js';
import { lathe } from '../../engine/geometry.js';
import { GM } from './materials.js';
import { NACELLE, FAN, bypassAt, FAN_NOZZLE_Y } from './layout.js';
import { cutLathe, cutPair, wall, sector, boxAt, axialCyl, radialCyl, merge, P3, kept, tube, arc, cutTube } from './geom.js';

const TAU = Math.PI * 2;
const UP = Math.PI * 1.5;          // phi of the pylon (world up)
const DOWN = Math.PI / 2;          // phi of the lower bifurcation

// The outer lines below were drawn for a 3.96 m nacelle; the published maximum is 166 in (4.22 m).
// grow(y) adds the difference over the fan cowl, fading to nothing at the inlet highlight and at
// the fan-nozzle exit, so the inlet lip, the bypass duct and the nozzle area are unchanged.
const DR = NACELLE.maxR - 1.98;
const smooth = (a, b, y) => { const t = Math.min(1, Math.max(0, (y - a) / (b - a))); return t * t * (3 - 2 * t); };
export const grow = (y) => DR * (y > 0.2 ? 1 - smooth(0.2, 1.8, y) : smooth(FAN_NOZZLE_Y, -1.9, y));
const outerLine = (line) => line.map(([y, r]) => [y, r + grow(y)]);

export function buildNacelle(ctx) {
  const { P, cut } = ctx;
  const nac = SKIN.nacelle();
  const N = { cut: 'nacelle', seg: 96 };

  // ------------------------------------------------------------------ inlet
  const lip = [[1.535, 1.56], [1.538, 1.7], [1.556, 1.77], [1.588, 1.803], [1.63, 1.814], [1.672, 1.806], [1.714, 1.784], [1.762, 1.738], [1.802, 1.66], [1.828, 1.58],
    [1.813, 1.58], [1.788, 1.652], [1.75, 1.718], [1.705, 1.764], [1.646, 1.792], [1.598, 1.782], [1.566, 1.752], [1.552, 1.69], [1.55, 1.56]]
    .map(([r, y], i) => [i >= 5 && i <= 14 ? r + grow(y) : r, y]);
  const outerSkin = wall(outerLine([[1.58, 1.825], [1.45, 1.862], [1.25, 1.902], [1.0, 1.936], [0.7, 1.958], [0.3, 1.968]]), -0.01);
  const barrel = wall([[1.56, 1.536], [1.3, 1.546], [1.0, 1.57], [0.7, 1.6], [0.45, 1.624], [NACELLE.inletAftY, FAN.caseR]], 0.04);
  const bulkheads = [[[1.55, 1.565], [1.815, 1.565], [1.815, 1.555], [1.55, 1.555]], [[1.66, 0.33], [1.958 + grow(0.33), 0.33], [1.958 + grow(0.315), 0.315], [1.66, 0.315]]];
  const inletShell = cut(cutLathe([lip, outerSkin, ...bulkheads], nac, N));
  const inletLiner = cut(cutLathe(barrel, SKIN.liner(), N));
  P('Inlet cowl', {
    system: 'Skin & fairings', skin: true, material: 'Aluminium lip, composite outer barrel, acoustic honeycomb inner barrel', mass: 380,
    explode: [0, 3.05, 0], temp: 288,
    desc: 'Boeing-supplied inlet, about 1.5 m long, that slows the air to roughly Mach 0.6 at the fan face with no separation even in crosswinds. Its lip is a D-shaped duct heated by engine bleed air for anti-icing; the inner barrel is a perforated honeycomb that absorbs fan noise.',
  }, [inletShell, inletLiner]).userData.part.stationTemp = '2';

  // ------------------------------------------------------------------ fan cowl doors
  const fanCowl = [wall(outerLine([[0.3, 1.968], [-0.2, 1.978], [-0.8, 1.98], [NACELLE.fanCowlAftY, 1.975]]), -0.02)];
  for (const y of [-0.15, -0.75, -1.3]) fanCowl.push([[1.9 + DR, y + 0.01], [1.96 + DR, y + 0.01], [1.96 + DR, y - 0.01], [1.9 + DR, y - 0.01]]);
  P('Fan cowl doors', {
    system: 'Skin & fairings', skin: true, material: 'Carbon-fibre composite sandwich', mass: 260, count: 2,
    explode: [-0.45, 0.1, -1.5], temp: 300,
    desc: 'Two large doors hinged from the strut that swing up to give mechanics access to the fan-case accessories — the gearbox, FADEC, oil tank and pumps. On this cutaway the half facing you is removed.',
  }, cut(cutLathe(fanCowl, nac, N)));
  const R_COWL = NACELLE.maxR;
  P('Fan cowl hinges', {
    system: 'Structure', material: 'Machined aluminium hinge fittings on the strut (Boeing)', mass: 12, count: 6,
    explode: [-0.55, 0.1, -1.0], temp: 300,
    desc: 'Three hinges along the top of each fan cowl door tie it to the strut, so a mechanic can swing the 130 kg door up like a gull wing.',
  }, cut(cutPair((keep) => merge([-0.6, -0.95, -1.3].flatMap((y) => [UP - 0.14, UP + 0.14].filter((p) => keep(p)).map((phi) => boxAt(2.05, y, phi, [0.06, 0.12, 0.06])))), GM.steel(), 'nacelle')));
  P('Fan cowl latches', {
    system: 'Structure', material: 'Hook latches with flush handles (count estimated)', mass: 4, count: 4,
    explode: [0.15, 0.1, -0.9], temp: 300,
    desc: 'Four hook latches join the two doors along the bottom of the nacelle. Their handles sit flush and are painted bright so an unlatched cowl stands out on the walk-round: a cowl that is not latched can tear off on take-off.',
  }, mesh0(merge([0.0, -0.4, -0.8, -1.2].map((y) => boxAt(R_COWL + 0.008, y, DOWN + 0.02, [0.025, 0.14, 0.05]))), GM.red()));
  P('Fan cowl hold-open rods', {
    system: 'Structure', material: 'Telescopic aluminium rods, stowed on clips inside each door', mass: 6, count: 4,
    explode: [-0.45, 0.1, -1.4], temp: 300,
    desc: 'Two per door. Swung out, they prop the open door against the strut so it cannot fall on the mechanic; stowed, they clip along the inside of the door.',
  }, cut(cutPair((keep) => merge([[Math.PI + 0.45, -0.25], [Math.PI + 0.45, -0.9], [-0.45, -0.25], [-0.45, -0.9]].filter(([phi]) => keep(phi)).map(([phi, y]) => {
    const a = P3(2.05, y, phi - 0.28), b = P3(2.05, y, phi + 0.28);
    return new THREE.CylinderGeometry(0.014, 0.014, 1, 8).applyMatrix4(linkMatrix(a, b));
  })), GM.aluminium(), 'nacelle')));

  // ------------------------------------------------------------------ thrust reverser
  const sleeveFwd = NACELLE.sleeveFwdY, cavityAft = -2.42;
  const duct = [];
  for (let y = cavityAft; y >= FAN_NOZZLE_Y - 1e-6; y -= 0.1) duct.push([y, bypassAt(y)[1]]);
  duct.push([FAN_NOZZLE_Y, bypassAt(FAN_NOZZLE_Y)[1]]);
  const sleeve = [
    wall(outerLine([[NACELLE.fanCowlAftY - 0.02, 1.974], [-1.9, 1.965], [-2.4, 1.93], [-2.9, 1.86], [-3.35, 1.76], [-3.7, 1.645], [FAN_NOZZLE_Y, 1.55]]), -0.012),
    wall(duct, 0.035),
    [[bypassAt(cavityAft)[1] + 0.035, cavityAft], [1.92 + grow(cavityAft), cavityAft], [1.92 + grow(cavityAft), cavityAft - 0.015], [bypassAt(cavityAft)[1] + 0.035, cavityAft - 0.015]],
    [[1.49, FAN_NOZZLE_Y], [1.545, FAN_NOZZLE_Y], [1.55, FAN_NOZZLE_Y + 0.03], [1.5, FAN_NOZZLE_Y + 0.03]],
  ];
  const sleeveGrp = cut(cutLathe(sleeve, nac, N));
  P('Thrust reverser translating sleeves', {
    system: 'Skin & fairings', skin: true, material: 'Composite outer skin, acoustic inner skin', mass: 620, count: 2,
    explode: [-0.45, -1.0, -1.35], temp: 300,
    desc: 'The aft nacelle. For reverse thrust the two sleeves slide aft (0.6 m here; the real stroke is not published), uncovering the cascades while blocker doors fold into the duct. Its trailing edge is the fan nozzle, the exit for the bypass air.',
  }, sleeveGrp);

  // cascades: rings of forward-turning vanes between axial strongbacks, behind the torque box
  const torqueBox = [[FAN.caseR + 0.01, NACELLE.fanCowlAftY], [1.95 + DR, NACELLE.fanCowlAftY], [1.95 + DR, sleeveFwd], [FAN.caseR, sleeveFwd]];
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
    desc: 'Grids of curved vanes hidden under the sleeves. When the sleeves open, bypass air blocked in the duct escapes through them and is turned forward, so the fan stream pushes the aircraft backwards.',
    callout: true, anchor: [-1.78, -2.0, -0.08],
  }, [cascRings, rails]);

  // blocker doors: hinged at their forward edge to the sleeve and flush with its inner wall when
  // stowed. A drag link of fixed length ties each door to the core cowl, so when the sleeve slides
  // aft the link pulls the door's aft end down into the duct.
  const NDOOR = 16, HINGE_R = FAN.caseR + 0.002, HINGE_Y = sleeveFwd - 0.03, DOOR_L = 0.63, LINK_A = 0.3;
  const ANCHOR = [1.0, -1.85];                       // drag-link pick-up on the core cowl (r, y)
  const TRAVEL = 0.6;                                // sleeve travel, m (modelled)
  const linkLen = Math.hypot(HINGE_R - ANCHOR[0], HINGE_Y - LINK_A - ANCHOR[1]);
  const doorAt = (theta, s) => [HINGE_R - LINK_A * Math.sin(theta), HINGE_Y - s - LINK_A * Math.cos(theta)];
  const doorAngle = (s) => {
    let lo = 0, hi = 1.5;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const [r, y] = doorAt(mid, s);
      if (Math.hypot(r - ANCHOR[0], y - ANCHOR[1]) > linkLen) lo = mid; else hi = mid;
    }
    return lo;
  };
  const doorGeo = new THREE.BoxGeometry(0.018, DOOR_L, (TAU * HINGE_R) / NDOOR - 0.03).translate(0.009, -DOOR_L / 2, 0);
  const linkGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  const doorMat = GM.casingDark(), linkMat = GM.steel();
  const doorKeep = new THREE.Group(), doorRest = new THREE.Group();
  const doorItems = [];
  for (let i = 0; i < NDOOR; i++) {
    const phi = ((i + 0.5) / NDOOR) * TAU;
    const holder = new THREE.Group();
    holder.rotation.y = phi - Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.set(HINGE_R, HINGE_Y, 0);
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.castShadow = true; door.receiveShadow = true;
    pivot.add(door);
    holder.add(pivot);
    const link = new THREE.Mesh(linkGeo, linkMat);
    link.matrixAutoUpdate = false;
    (kept(phi, 'nacelle') ? doorKeep : doorRest).add(holder, link);
    doorItems.push({ phi, pivot, link });
  }
  doorRest.visible = false;
  const doors = new THREE.Group();
  doors.add(doorKeep, doorRest);
  doors.userData.cutaway = { rest: doorRest, caps: [] };
  cut(doors);
  P('Blocker doors & drag links', {
    system: 'Propulsion', material: 'Composite doors, steel drag links (count estimated)', mass: 160, count: 16,
    explode: [-0.4, -0.85, -1.0], temp: 300,
    desc: 'Stowed, the doors form part of the bypass duct wall. As the sleeve moves aft, the drag links — which cross the duct to the core cowl — pull each door down into the airstream to block it.',
  }, doors);

  const cylinders = cut(cutPair((keep) => {
    const list = [];
    for (const phi of [-0.95, 0, 0.95, Math.PI - 0.95, Math.PI, Math.PI + 0.95]) {
      if (!keep(phi)) continue;
      list.push(axialCyl(1.895, -1.9, phi, 0.034, 0.62, 14), boxAt(1.895, -1.6, phi, [0.08, 0.06, 0.1]));
    }
    return merge(list);
  }, GM.steel(), 'nacelle'));
  // piston rods, built one metre long from the cylinder end and scaled to the sleeve position
  const rods = cut(cutPair((keep) => merge([-0.95, 0, 0.95, Math.PI - 0.95, Math.PI, Math.PI + 0.95].filter((phi) => keep(phi)).map((phi) => axialCyl(1.895, -0.5, phi, 0.014, 1, 8))), GM.bearing(), 'nacelle'));
  const ROD_Y = -2.21, ROD_L = 0.27;
  rods.position.y = ROD_Y;
  rods.scale.y = ROD_L;
  P('Thrust reverser actuators', {
    system: 'Hydraulics', material: 'Hydraulic locking actuators', mass: 60, count: 6,
    explode: [-0.55, -0.55, -1.0], temp: 300,
    desc: 'Three hydraulic actuators per reverser half drive the sleeve. Locks hold the reverser stowed in flight; the FADEC and aircraft both have to agree before it can deploy, and only on the ground.',
  }, [cylinders, rods]);

  P('Thrust reverser hinge & latch beams', {
    system: 'Structure', material: 'Machined aluminium / titanium beams with slider tracks (Boeing)', mass: 90, count: 4,
    explode: [-0.45, -0.9, -1.2], temp: 300,
    desc: 'Each reverser half (C-duct) hangs from a hinge beam along the strut and latches to its partner along a latch beam at the bottom; tracks on the beams guide the translating sleeve. Unlatched, each half swings open like a clamshell to expose the core.',
  }, cut(cutPair((keep) => merge([[UP - 0.12, 1.84], [UP + 0.12, 1.84], [DOWN + 0.1, 1.84], [DOWN - 0.1, 1.84]].filter(([phi]) => keep(phi)).flatMap(([phi, r]) => [boxAt(r, -2.3, phi, [0.12, 1.16, 0.06]), boxAt(r - 0.07, -2.3, phi, [0.03, 1.16, 0.09])])), GM.casingDark(), 'nacelle')));
  P('Thrust reverser control valve module', {
    system: 'Hydraulics', material: 'Isolation and directional-control valves in one block (Boeing)', mass: 12,
    explode: [-0.9, -0.3, -0.6], temp: 300,
    desc: 'Two independent valves stand between the 777\'s hydraulic system and the reverser: the isolation valve only opens on the ground with the thrust lever at idle, and the directional valve then sends pressure to the deploy or stow side. Three independent locks keep a fault from deploying it in flight.',
  }, mesh0(merge([boxAt(1.98, -1.3, UP - 0.14, [0.1, 0.16, 0.12]), radialCyl(2.03, 2.08, -1.3, UP - 0.14, 0.02, 8)]), GM.blue()));
  const TR_PHI = [-0.95, 0, 0.95, Math.PI - 0.95, Math.PI, Math.PI + 0.95];
  P('Thrust reverser hydraulic lines', {
    system: 'Hydraulics', material: 'Stainless deploy and stow pressure lines (Boeing)', mass: 10, count: 2,
    explode: [-0.55, -0.6, -1.05], temp: 300,
    desc: 'Deploy and stow lines run from the control valves round each reverser half to all three actuators, so the three push together; the stow side stays pressurised in flight to hold the sleeves shut.',
  }, cut(cutPair((keep) => merge([
    cutTube([P3(2.02, -1.3, UP - 0.14), P3(2.02, -1.6, UP - 0.12), ...arc(2.02, -1.82, UP - 0.12, Math.PI - 0.98, 0.08)], 0.011, keep),
    cutTube([P3(2.05, -1.3, UP - 0.12), P3(2.05, -1.62, UP - 0.1), ...arc(2.05, -1.86, UP - 0.1, Math.PI - 1.0, 0.08)], 0.011, keep),
    cutTube([...arc(2.02, -1.82, UP + 0.12, TAU + 0.98, 0.08)], 0.011, keep),
    cutTube([...arc(2.05, -1.86, UP + 0.1, TAU + 1.0, 0.08)], 0.011, keep),
    ...TR_PHI.filter((p) => keep(p)).map((phi) => radialCyl(1.93, 2.06, -1.84, phi, 0.01, 8)),
  ]), GM.steel(), 'nacelle')));
  P('Thrust reverser synchronising shafts', {
    system: 'Hydraulics', material: 'Flexible steel drive shafts in sheaths (Boeing)', mass: 6, count: 4,
    explode: [-0.5, -0.55, -1.1], temp: 300,
    desc: 'Flexible shafts gear the three actuators of each half together, so the sleeve cannot skew and jam if one actuator runs ahead of the others. They also drive the position sensors that tell the FADEC where the sleeve is.',
  }, cut(cutPair((keep) => merge([[-0.95, 0], [0, 0.95], [Math.PI - 0.95, Math.PI], [Math.PI, Math.PI + 0.95]].filter(([a, b]) => keep((a + b) / 2)).map(([a, b]) => tube(arc(1.97, -1.76, a, b, 0.06), 0.009, { seg: 24, radial: 6 }))), GM.steel(), 'nacelle')));

  // deploy the reverser: 0 stowed … 1 deployed
  ctx.reverser = {
    set(d) {
      const s = TRAVEL * d;
      sleeveGrp.position.y = -s;
      rods.scale.y = ROD_L + s;
      const theta = d > 0 ? doorAngle(s) : 0;
      const [rp, yp] = doorAt(theta, s);
      for (const it of doorItems) {
        it.pivot.position.y = HINGE_Y - s;
        it.pivot.rotation.z = -theta;
        it.link.matrix.copy(linkMatrix(P3(rp, yp, it.phi), P3(ANCHOR[0], ANCHOR[1], it.phi)));
        it.link.matrixWorldNeedsUpdate = true;
      }
    },
  };

  // ------------------------------------------------------------------ core cowl and bifurcations
  const ifs = wall([[-1.82, 0.99], [-2.6, 1.05], [-3.2, 1.06], [FAN_NOZZLE_Y, 1.04], [-4.5, 1.015], [-5.1, 0.983]], -0.02);
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
  P('Core cowl pressure-relief door', {
    system: 'Skin & fairings', skin: true, material: 'Spring-loaded composite door (Boeing)', mass: 3,
    explode: [0, -0.4, -1.75], temp: 380,
    desc: 'If a bleed duct bursts inside the core compartment, this door blows open to vent the pressure before it can damage the cowls; it stays open and shows the crew on the walk-round that something let go.',
  }, cut(cutPair((keep) => (keep(Math.PI + 0.6) ? merge([sector(1.06, 1.072, -3.05, -3.4, Math.PI + 0.48, Math.PI + 0.72, 8)]) : new THREE.BufferGeometry()), GM.red(), 'nacelle')));

  // ------------------------------------------------------------------ pylon (strut) stub
  // side profile (y, r) of the strut stub, extruded across its 0.42 m width at 12 o'clock
  const side = [[-0.55, 1.99], [-0.75, 2.2], [-1.05, 2.42], [-5.7, 2.42], [-5.7, 1.5], [-5.48, 1.07], [-5.05, 1.05], [-4.55, 1.12], [-4.1, 1.5], [-3.9, 1.99]];
  const shape = new THREE.Shape(side.map(([y, r]) => new THREE.Vector2(-r, y)));
  const pylon = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 4 });
  pylon.translate(0, 0, -0.21);
  P('Pylon (strut) stub', {
    system: 'Structure', skin: true, material: 'Titanium and steel box beam under aluminium fairings (Boeing)', mass: 900,
    explode: [-0.8, -0.2, 0], temp: 300,
    desc: 'The forward end of the 777\'s engine strut, cut off where it would join the wing. It carries thrust, weight and gust loads into the wing box, and houses the precooler and the fuel, bleed, hydraulic and electrical connections (drawn see-through in X-ray and Systems so they show). Boeing hardware, outside the engine\'s dry weight.',
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
    links.push(boxAt(0.96, -2.04, UP + s * 0.32, [0.07, 0.08, 0.07]));
  }
  P('Thrust links', {
    system: 'Structure', material: 'Forged steel links with spherical bearings (arrangement typical of GE wide-body engines)', mass: 50, count: 2,
    explode: [-0.8, -0.6, 0], temp: 450,
    desc: 'A pair of links from the fan hub frame back to the aft mount\'s evener beam carries the engine\'s 514 kN of take-off thrust into the strut, so the forward mount does not have to. Each link alone can carry it if the other fails.',
  }, mesh0(merge(links), GM.steel()));
  P('Aft engine mount', {
    system: 'Structure', material: 'Forged steel / titanium yoke and links (arrangement typical of GE wide-body engines)', mass: 70,
    explode: [-0.8, -0.95, 0], temp: 600,
    desc: 'The aft mount on the turbine rear frame takes vertical, side and roll loads. GE does not publish GE90 mount drawings, so the layout follows GE\'s patents for this class of engine.',
  }, mesh0(merge([boxAt(1.0, -5.27, UP, [0.1, 0.16, 0.5]), boxAt(1.07, -5.27, UP, [0.06, 0.1, 0.18]), ...[-0.2, 0.2].map((d) => boxAt(1.01, -5.2, UP + d, [0.05, 0.06, 0.05]))]), GM.steel()));

  void kept; void lathe; void tube; void ctx; void FAN;
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
