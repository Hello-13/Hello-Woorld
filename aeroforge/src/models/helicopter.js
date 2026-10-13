// SIKORSKY UH-60M BLACK HAWK — US Army utility helicopter.
// Axes: x forward, y up, z right (starboard); metres at real scale; the ground is y = 0 and the
// main-rotor shaft passes through x = 0. Built from the modules in ./uh60/:
//   fuselage.js   parametric outer surface → skins, doors, transparencies, primary structure
//   mainRotor.js  articulated elastomeric hub, bifilar, dampers, swashplates, servos, blades
//   drive.js      T700-GE-701D engines, IPS, IR suppressors, modular transmission, shafts, APU
//   tail.js       fairings, canted pylon, stabilator, 42°/90° gearboxes, bearingless tail rotor
//   gear.js       landing gear, crash-resistant fuel cells, cargo hook
//   cabin.js      cockpit, cabin, controls, hydraulics, electrical, avionics, antennas, ECS
// Published figures: 16.36 m rotor, 4 blades, 258 rpm; 3.35 m tail rotor canted 20°; 19.76 m
// overall, 15.26 m fuselage, 5.13 m high; MTOW 9,979 kg; 2 × 1,994 shp. Masses are estimates
// unless a part names its source.

import * as THREE from 'three';
import { Assembly } from '../engine/assembly.js';
import { decal, stencilText, danger } from '../engine/decals.js';
import { decalTexture } from '../engine/surface.js';
import { DEG } from './uh60/common.js';
import { buildFuselage, surfNormal } from './uh60/fuselage.js';
import { buildMainRotor } from './uh60/mainRotor.js';
import { buildDrive } from './uh60/drive.js';
import { buildTail } from './uh60/tail.js';
import { buildGear } from './uh60/gear.js';
import { buildCabin } from './uh60/cabin.js';

const OMEGA = (258 * 2 * Math.PI) / 60;   // rad/s at 100 % Nr
const TR_RATIO = 1190 / 258;              // tail-rotor : main-rotor speed

/** "U.S. ARMY" tail-cone stencil in the low-contrast black used on Army green. */
const armyText = () => decalTexture('uh60.army', 1024, 160, (ctx, w, h) => {
  ctx.fillStyle = 'rgba(14,16,14,0.9)';
  ctx.font = '700 118px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('U.S. ARMY', w / 2, h / 2 + 6);
});

export function buildHelicopter() {
  const A = new Assembly();
  const air = new THREE.Group();          // flight pose: lift and attitude for the hover
  A.root.add(air);
  const P = (name, info, objs, parent = air) => A.part(name, info, objs, parent);

  const fus = buildFuselage({ A, P });
  const rotor = buildMainRotor({ A, parent: air });
  const drive = buildDrive({ A, P, roofY: fus.roofY });
  const tail = buildTail({ A, P, air, roofY: fus.roofY });
  const gear = buildGear({ A, P });
  const cab = buildCabin({ A, P, surfPoint: fus.surfPoint, surfNormal });

  // thermal roles for the Thermal view
  const byName = (n) => A.parts.find((p) => p.name === n);
  const role = (names, r) => { for (const n of names) { const p = byName(n); if (p) p.userData.part.thermalRole = r; } };
  role(['Main module (main transmission)', 'Input module (right)', 'Input module (left)', 'Accessory module (right)', 'Accessory module (left)', 'Intermediate gearbox (42°)', 'Tail rotor gearbox (90°)'], 'gearbox');
  role(['Transmission oil cooler & blower', 'Viscous-damped hanger bearings', 'Rotor brake'], 'warm');
  role(['Engine cowling (right)', 'Engine cowling (left)', 'Inlet particle separator (right)', 'Inlet particle separator (left)'], 'cowl');
  role(['AC generators', 'Hydraulic pump modules (No. 1 & No. 2)', 'Backup hydraulic pump', 'Primary servos', 'Tail rotor servo'], 'equipment');
  role(['Flight management & display computers', 'Embedded GPS/INS units', 'Digital AFCS computers', 'Communication radios & IFF', 'Health monitoring & data recorders', 'Power distribution & converters', 'Instrument panel & multifunction displays'], 'avionics');

  // markings
  A.root.updateMatrixWorld(true);
  const tc = byName('Tail cone skin');
  const tcMesh = tc.children.find((o) => o.isMesh);
  for (const side of [1, -1]) {
    tc.add(decal(tcMesh, armyText(), { at: [-5.3, 1.66, 0.47 * side], dir: [0, 0.05, side], size: [1.7, 0.27, 0.4], roughness: 0.8 }));
    tc.add(decal(tcMesh, danger('DANGER · TAIL ROTOR'), { at: [-8.2, 1.73, 0.3 * side], dir: [0, 0, side], size: [0.9, 0.28, 0.3], roughness: 0.7 }));
  }
  const cs = byName('Cabin skin');
  const csMesh = cs.children.find((o) => o.isMesh);
  for (const side of [1, -1]) cs.add(decal(csMesh, stencilText('NO STEP', 'rgba(14,16,14,0.85)', true), { at: [-1.2, 2.2, 0.62 * side], dir: [0, 1, 0.5 * side], size: [0.42, 0.12, 0.3] }));

  A.finalize();

  // ------------------------------------------------------------------ behaviour
  const state = {
    nr: 1, nrTarget: 1, display: 0.12,               // rotor speed fraction (0 stopped … 1 = 100 %) and display slow-motion
    psi: 0, phi: 0,
    coll: 10.7 * DEG, collTarget: 10.7 * DEG,         // collective pitch at 0.75 R
    stick: { pitch: 0, roll: 0, yaw: 0 }, stickTarget: { pitch: 0, roll: 0, yaw: 0 },
    trimLon: 0, trimLat: -3 * DEG, trPitch: 12 * DEG, cone: 3.5 * DEG,
    airspeed: 0, stab: 40 * DEG, stabTarget: 40 * DEG,
    doors: 0, doorsTarget: 0, airborne: 0, airTarget: 0,
    power: 0.75, oatK: 288.15, strobeT: 0, flight: null,
  };
  const approach = (cur, tgt, rate, dt) => cur + Math.sign(tgt - cur) * Math.min(Math.abs(tgt - cur), rate * dt);
  const ease = (cur, tgt, k) => cur + (tgt - cur) * k;

  const vehicle = {
    id: 'helicopter',
    designation: 'UH-60M',
    name: 'BLACK HAWK',
    role: 'Utility helicopter',
    tagline: 'Twin-turbine assault and utility · 11 troops or a 4-tonne sling load · built to survive',
    summary: 'The US Army\'s medium utility helicopter. A four-blade articulated rotor on elastomeric bearings, a canted tail rotor and a modular transmission fed by two T700 turboshafts lift 11 equipped troops or a 4-tonne sling load, while crashworthy seats, gear and fuel cells — and an airframe built to keep its shape in a 38 ft/s impact — are designed to bring the crew home from a crash.',
    specs: [
      ['Main rotor', '16.36 m, 4 blades, 258 rpm'], ['Tail rotor', '3.35 m, 4 blades, canted 20°'],
      ['Length', '19.76 m rotors turning · fuselage 15.26 m'], ['Height', '5.13 m'],
      ['Max take-off', '9,979 kg (10,660 kg with sling load)'], ['Empty', '5,675 kg'],
      ['Engines', '2 × GE T700-GE-701D, 1,994 shp (10 min)'], ['Transmission', '3,400 shp'],
      ['Fuel', '1,360 L (360 US gal) internal'], ['Crew', '2 pilots, 2 crew chiefs / gunners'],
      ['Cabin', '11 troops or 4 litters'], ['Cargo hook', '4,082 kg (9,000 lb)'], ['Cruise', '151 kt (280 km/h)'],
    ],
    heroStats: [['16.36', 'm', 'Rotor diameter'], ['2 × 1,994', 'shp', 'T700-701D engines'], ['9,979', 'kg', 'Max take-off']],
    sources: 'Sikorsky/Lockheed Martin UH-60M brochure; US Army aviation fact sheets; GE Aviation T700-GE-701D datasheet; NASA CR-166309 (UH-60A GenHel engineering simulation data); NASA/Army (Yeo) wide-chord-blade reports; SAE 2007-01-3301 (UH-60M rotor ice protection); Sikorsky patents on the canted tail rotor and stabilator; NASA transmission reports (20,900 → 258 rpm); museum placard data; Wikipedia',
    fleetTag: '4,082 kg hook',
    root: A.root,
    air,
    parts: A.parts,
    view: { dir: [1.0, 0.42, 1.15], fill: 1.0 },
    displaySize: 13,
    thermalRange: [240, 900],
    state,
    setStick(st) { Object.assign(state.stickTarget, st); },
    setCollective(rad) { state.collTarget = rad; },
    setRotor(on) { state.nrTarget = on ? 1 : 0; },
    setRotorDisplay(k) { state.display = k; },
    setDoors(open) { state.doorsTarget = open ? 1 : 0; },
    setBay(open) { state.doorsTarget = open ? 1 : 0; },        // tour 'bay' demo opens the cabin doors
    setAirborne(v) { state.airTarget = v ? 1 : 0; },
    /** Flight condition from the lab: { airspeedKt, collective, trimLon, trimLat, trPitch, cone, power, oatK }. */
    setFlight(f) {
      if (f.airspeedKt != null) state.airspeed = f.airspeedKt;
      if (f.collective != null) state.collTarget = f.collective;
      if (f.trimLon != null) state.trimLon = f.trimLon;
      if (f.trimLat != null) state.trimLat = f.trimLat;
      if (f.trPitch != null) state.trPitch = f.trPitch;
      if (f.cone != null) state.cone = f.cone;
      if (f.power != null) state.power = f.power;
      if (f.oatK != null) state.oatK = f.oatK;
      if (f.stab != null) state.stabTarget = f.stab;
    },
    temperatureOf(info) {
      const amb = state.oatK, p = state.power * state.nr;
      switch (info.thermalRole) {
        case 'engine': return amb + (state.nr > 0.05 ? 240 + 360 * p : 30);
        case 'suppressor': return amb + (state.nr > 0.05 ? 50 + 110 * p : 15);
        case 'cowl': return amb + 25 + 45 * p;
        case 'apu': return amb + (state.nr < 0.5 ? 220 : 10);
        case 'gearbox': return amb + 30 + 60 * p;
        case 'warm': return amb + 18 + 30 * p;
        case 'equipment': return amb + 25 * p + 10;
        case 'avionics': return amb + 16;
        default: return info.system === 'Rotor system' ? amb - 2 : amb;
      }
    },
    update(dt, t) {
      const s = state;
      s.nr = approach(s.nr, s.nrTarget, 0.25, dt);
      s.coll = ease(s.coll, s.collTarget, 1 - Math.exp(-dt * 4));
      const k = 1 - Math.exp(-dt * 6);
      for (const a of ['pitch', 'roll', 'yaw']) s.stick[a] = ease(s.stick[a], s.stickTarget[a], k);
      s.doors = approach(s.doors, s.doorsTarget, 0.6, dt);
      s.airborne = approach(s.airborne, s.airTarget, 0.35, dt);
      s.stab = ease(s.stab, s.stabTarget, 1 - Math.exp(-dt * 2));

      const w = OMEGA * s.display * s.nr;
      s.psi = (s.psi + w * dt) % (Math.PI * 2);
      s.phi = (s.phi + w * TR_RATIO * dt) % (Math.PI * 2);
      // blades rest on the droop stops when stopped; cone up with centrifugal stiffening at speed
      const nr2 = s.nr * s.nr;
      const cone = -2.2 * DEG + (s.cone + 2.2 * DEG) * nr2;
      const tilt = 6 * DEG * nr2;
      rotor.update({
        psi: s.psi,
        coll: s.coll * Math.min(1, s.nr * 3),
        lon: (s.trimLon - s.stick.pitch * tilt),
        lat: (s.trimLat * nr2 + s.stick.roll * tilt),
        cone,
        lag: 1.5 * DEG * s.nr,
      });
      tail.update(s.phi, s.trPitch - s.stick.yaw * 8 * DEG);
      tail.stabilator.rotation.z = s.stab;

      for (const d of fus.doors) { d.holder.position.x = -1.78 * s.doors; d.holder.position.z = 0.06 * d.side * Math.min(1, s.doors * 4); }
      for (const c of cab.cyclics) { c.rotation.z = s.stick.pitch * 0.2; c.rotation.x = s.stick.roll * 0.2; }
      for (const c of cab.collectives) c.rotation.z = (s.coll - 10 * DEG) * 1.6;
      for (const p of cab.pedals) p.g.position.x = 3.74 + p.side * s.stick.yaw * 0.05;   // right pedal forward = nose right
      for (const o of gear.oleos) o.pistonGroup.position.copy(o.dir).multiplyScalar(0.08 * s.airborne);

      s.strobeT += dt;
      tail.strobe.emissiveIntensity = s.nr > 0.05 && (s.strobeT % 1.1) < 0.08 ? 16 : 0;

      // hover pose: 10 ft wheel height, nose slightly up and left side a little low (tail-rotor drift trim)
      const a = s.airborne;
      air.position.y = a * 3.05 + Math.sin(t * 0.8) * 0.05 * a;
      air.rotation.z = a * (2.5 * DEG + Math.sin(t * 0.37) * 0.4 * DEG - s.stick.pitch * 3 * DEG);
      air.rotation.x = a * (-1.5 * DEG + s.stick.roll * 4 * DEG);
      air.rotation.y = -a * s.stick.yaw * 3 * DEG;
    },
  };
  vehicle.update(0, 0);
  return vehicle;
}
