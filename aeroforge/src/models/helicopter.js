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
// overall, 15.26 m fuselage, 5.13 m high; MTOW 9,979 kg; 2 × 1,994 shp. Part masses are estimates
// (except the T700 modules, which add up to GE's published 207 kg per engine); after the build the
// estimates are scaled together so the whole aircraft sums to the published 5,675 kg empty weight.

import * as THREE from 'three';
import { Assembly } from '../engine/assembly.js';
import { decalTexture } from '../engine/surface.js';
import { DEG, TAIL } from './uh60/common.js';
import { buildFuselage, surfNormal, stencil } from './uh60/fuselage.js';
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
  const cab = buildCabin({ A, P, surfPoint: fus.surfPoint, surfNormal, roofY: fus.roofY, servoInputs: rotor.servoInputs, servoBases: rotor.servoBases });

  // thermal roles for the Thermal view
  const byName = (n) => A.parts.find((p) => p.name === n);
  const role = (names, r) => { for (const n of names) { const p = byName(n); if (p) p.userData.part.thermalRole = r; } };
  role(['Main module (main transmission)', 'Main bevel gear & combining pinions', 'Planetary reduction stage', 'Main transmission oil pumps', 'Main transmission oil filter', 'Input module (right)', 'Input module (left)', 'Input bevel gears (right)', 'Input bevel gears (left)', 'Freewheel unit (right)', 'Freewheel unit (left)', 'Accessory module (right)', 'Accessory module (left)', 'Intermediate gearbox (42°)', 'Tail rotor gearbox (90°)'], 'gearbox');
  role(['Transmission oil cooler & blower', 'Oil cooler lines & thermostatic valve', 'Viscous-damped hanger bearings', 'Rotor brake', 'Generator cooling-oil lines', 'Pneumatic start ducts', 'Bleed-air check & shutoff valves', 'Heater mixing valve & overtemperature sensors'], 'warm');
  role(['Engine cowling (right)', 'Engine cowling (left)', 'Inlet particle separator (right)', 'Inlet particle separator (left)'], 'cowl');
  role(['AC generators', 'APU generator', 'No. 1 hydraulic pump module (left)', 'No. 2 hydraulic pump module (right)', 'Backup hydraulic pump', 'Primary servos', 'Tail rotor servo', 'Boost servos', 'AVCS force generators', 'Ventilation blower'], 'equipment');
  role(['Flight management & display computers', 'Embedded GPS/INS units', 'Digital AFCS computers', 'Communication radios & IFF', 'Health monitoring & data recorders', 'AC/DC converters', 'Power distribution panels', 'Generator control units', 'Instrument panel & multifunction displays', 'AVCS controller', 'CMWS electronic control unit', 'APU electronic sequence unit', 'Blade de-ice controller & junction box', 'Hydraulic logic modules'], 'avionics');

  // X-ray: dim the stacked hardware round the rotor head and the thin runs so the control chain
  // (blades, swashplates, horns, pitch rods, servos) stays the brightest thing in the view
  const xw = { 'Blade cuffs & quick-release pins': 0.6, 'Blade spindles': 0.6, 'Lead-lag dampers': 0.6, 'Droop stops & flap restrainers': 0.5,
    'Main rotor de-ice harness': 0.5, 'Main rotor blade heater blankets': 0.5, 'Main rotor slip ring': 0.6, 'De-ice distributor': 0.6, 'Main rotor shaft': 0.6,
    'Swashplate guide': 0.5, 'Uniball & sliding sleeve': 0.5, 'Swashplate duplex bearing': 0.5, 'Rotating scissors': 0.7, 'Stationary scissors': 0.7,
    'Generator feeders, current transformers & limiters': 0.6, 'Generator cooling-oil lines': 0.6, 'Oil cooler lines & thermostatic valve': 0.6,
    'Fire extinguisher discharge lines': 0.6, 'Tail drive shaft disc couplings': 0.6, 'Control bellcranks & cable pulleys': 0.7, 'Cabin door posts': 0.4,
    'Nose avionics racks': 0.6 };
  for (const [n, w] of Object.entries(xw)) { const p = byName(n); if (p) p.userData.part.xrayWeight = w; }

  // estimated masses scaled together to the published 5,675 kg empty weight (GE's engine figure kept)
  const fixed = (p) => /^T700 |^Inlet particle separator/.test(p.userData.part.name);
  const sum = (list) => list.reduce((a, p) => a + (p.userData.part.mass || 0), 0);
  const est = A.parts.filter((p) => !fixed(p) && p.userData.part.mass);
  const kMass = (5675 - sum(A.parts.filter(fixed))) / sum(est);
  for (const p of est) { const m = p.userData.part.mass * kMass; p.userData.part.mass = m >= 3 ? Math.round(m) : Math.max(0.5, Math.round(m * 2) / 2); }

  // markings: painted straight onto the tail-cone surface
  const tc = byName('Tail cone skin');
  for (const side of [1, -1]) tc.add(stencil(armyText(), { x0: -6.15, x1: -4.45, a0: -0.12, a1: 0.42, side }));

  A.finalize();

  // ------------------------------------------------------------------ behaviour
  const state = {
    nr: 1, nrTarget: 1, display: 0.12,               // rotor speed fraction (0 stopped … 1 = 100 %) and display slow-motion
    psi: 0, phi: 0,
    coll: 10.7 * DEG, collTarget: 10.7 * DEG,         // collective pitch at 0.75 R
    stick: { pitch: 0, roll: 0, yaw: 0 }, stickTarget: { pitch: 0, roll: 0, yaw: 0 },
    trimLon: 0, trimLat: -3 * DEG, trPitch: 12 * DEG, cone: 3.5 * DEG,
    airspeed: 0, stab: 40 * DEG, stabTarget: 40 * DEG,
    doors: 0, doorsTarget: 0, airborne: 0, airTarget: 0, hook: 0, hookTarget: 0,
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
    summary: 'The US Army\'s medium utility helicopter. A four-blade articulated rotor on elastomeric bearings, a canted tail rotor and a modular transmission fed by two T700 turboshafts lift 11 equipped troops or a 4-tonne sling load, while crashworthy seats, gear and fuel cells — and an airframe built to keep its shape in a severe impact — are designed to bring the crew home from a crash.',
    specs: [
      ['Main rotor', '16.36 m, 4 blades, 258 rpm'], ['Tail rotor', '3.35 m, 4 blades, canted 20°'],
      ['Length', '19.76 m rotors turning · fuselage 15.26 m'], ['Height', '5.13 m'],
      ['Max take-off', '9,979 kg (10,660 kg with sling load)'], ['Empty', '5,675 kg'],
      ['Engines', '2 × GE T700-GE-701D, 1,994 shp (10 min)'], ['Transmission', '3,400 shp'],
      ['Fuel', '1,360 L (360 US gal) internal'], ['Crew', '2 pilots, 2 crew chiefs / gunners'],
      ['Cabin', '11 troops or 4 litters'], ['Cargo hook', '4,082 kg (9,000 lb)'], ['Cruise', '151 kt (280 km/h) at 16,800 lb, 4,000 ft / 95 °F, 100 % MCP'],
    ],
    heroStats: [['16.36', 'm', 'Rotor diameter'], ['2 × 1,994', 'shp', 'T700-701D engines'], ['9,979', 'kg', 'Max take-off']],
    sources: 'Sikorsky/Lockheed Martin UH-60M brochure; TM 1-1520-237-10 operator\'s manual (UH-60A/L); US Army aviation fact sheets; GE Aviation T700-GE-701D datasheet; NASA CR-166309 (UH-60A GenHel engineering simulation data); NASA/Army (Yeo) wide-chord-blade reports; SAE 2007-01-3301 (UH-60M rotor ice protection); Sikorsky patents on the canted tail rotor and stabilator; NASA TP-2626 transmission tests (20,909 → 258 rpm, 565 kg); NASA TM-85890 (Hilbert UH-60 model: tail rotor 124.62 rad/s); museum placard data; Wikipedia',
    fleetTag: '4,082 kg hook',
    root: A.root,
    air,
    trHub: TAIL.hub,
    parts: A.parts,
    view: { dir: [1.0, 0.42, 1.15], fill: 1.0 },
    displaySize: 13,
    thermalRange: [260, 700],
    state,
    setStick(st) { Object.assign(state.stickTarget, st); },
    setCollective(rad) { state.collTarget = rad; },
    setRotor(on) { state.nrTarget = on ? 1 : 0; },
    setRotorDisplay(k) { state.display = k; },
    setDoors(open) { state.doorsTarget = open ? 1 : 0; },
    setBay(open) { state.doorsTarget = open ? 1 : 0; state.hookTarget = open ? 1 : 0; },   // tour 'bay' demo: doors open, hook down
    setHook(down) { state.hookTarget = down ? 1 : 0; },
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
        case 'compressor': return amb + (state.nr > 0.05 ? 60 + 140 * p : 12);
        case 'suppressor': return amb + (state.nr > 0.05 ? 70 + 150 * p : 15);
        case 'cowl': return amb + 35 + 70 * p;
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
      s.hook = approach(s.hook, s.hookTarget, 0.8, dt);
      gear.setHook(s.hook);
      s.stab = ease(s.stab, s.stabTarget, 1 - Math.exp(-dt * 2));

      const w = OMEGA * s.display * s.nr;
      s.psi = (s.psi + w * dt) % (Math.PI * 2);
      // the tail rotor turns 4.6× faster: above ~35° a frame its four blades would seem to run
      // backwards (wagon-wheel effect), so cap the visible step
      s.phi = (s.phi + Math.min(w * TR_RATIO * dt, 35 * DEG)) % (Math.PI * 2);
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
