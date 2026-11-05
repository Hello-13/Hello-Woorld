// NASA/ESA HUBBLE SPACE TELESCOPE — post-Servicing-Mission-4 configuration (May 2009).
//
// Axes: optical axis along +x (= +V1) with the aperture door forward; y up (= +V3, the Sun side,
// where the door hinges); z right as seen looking forward (= −V2: the V frame is right-handed, and
// V2 is the solar-array axis). Metres, x = 0 at the aft bulkhead.
//
// Built from four modules in ./hst/: the Optical Telescope Assembly (mirrors from the
// Ritchey–Chrétien design solved in physics/optics.js), the Support Systems Module (shells,
// equipment bays, aft shroud, servicing hardware), the focal-plane instruments, and the
// deployable appendages. The light-path overlay shows in X-ray, Systems and Blueprint while the
// optics sit at their assembled positions (it is hidden in the exploded view, where the rays would
// no longer meet the mirrors).

import * as THREE from 'three';
import { Assembly } from '../engine/assembly.js';
import { buildOTA } from './hst/ota.js';
import { buildSSM } from './hst/ssm.js';
import { buildInstruments, labelInstruments } from './hst/instruments.js';
import { buildAppendages } from './hst/appendages.js';
import { buildWiring } from './hst/wiring.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SUN_TILT = -0.45;            // array angle about the mast that faces the lighting rigs' Sun

export function buildHubble() {
  const A = new Assembly();
  const body = new THREE.Group();
  body.name = 'HST';
  A.root.add(body);
  const P = (name, info, objs, parent) => A.part(name, info, objs, parent || body);

  const ota = buildOTA(P);
  const ssm = buildSSM(P);
  const si = buildInstruments(P, body);
  const app = buildAppendages(P, body);
  const wiring = buildWiring(P, { oes: ssm.oes });
  body.add(ota.lightPath);

  A.root.updateMatrixWorld(true);
  labelInstruments(si.labels);
  A.finalize();

  // ------------------------------------------------------------------ state and animation
  const state = { deploy: 1, deployTarget: 1, door: 1, doorTarget: 1, lightPath: false, redeploy: 0 };
  const applyDeploy = (f) => {
    const mast = smooth(0, 0.4, f);          // array masts and antenna masts swing out
    const turn = smooth(0.35, 0.65, f);      // wings rotate from edge-on to face the Sun
    const unfold = smooth(0.6, 1, f);        // outer half-panels unfold
    for (const a of app.arrays) {
      a.pivot.rotation.y = a.s * (Math.PI / 2) * (1 - mast);
      a.track.rotation.z = (Math.PI / 2) * (1 - turn) + SUN_TILT * turn;
      a.hinge.rotation.x = -a.s * Math.PI * (1 - unfold) * 0.995;
    }
    const hm = smooth(0.05, 0.55, f);
    for (const h of app.hgas) {
      h.pivot.rotation.z = -h.s * (Math.PI / 2) * (1 - hm);
      h.gimbal.rotation.z = h.s * (Math.PI / 2) * (1 - hm);
    }
  };
  const applyDoor = (d) => { ssm.doorPivot.rotation.z = THREE.MathUtils.degToRad(105) * d; };
  applyDeploy(1);
  applyDoor(1);

  const probe = ota.pm.children[0];
  const OVERLAY = new Set(['xray', 'systems', 'blueprint']);
  // internal parts carry callouts for the guided tour only: outside a tour step that focuses them
  // their labels would point at parts hidden behind the skins
  const tourLabels = [];
  for (const p of A.parts) if (p.userData.part.tourLabel) tourLabels.push(p);
  const exploded = () => ota.pm.position.distanceToSquared(ota.pm.userData.base) > 1e-6 || ota.sm.position.distanceToSquared(ota.sm.userData.base) > 1e-6;

  return {
    id: 'hubble',
    designation: 'HST',
    name: 'HUBBLE',
    role: 'Space telescope',
    tagline: 'NASA/ESA · 2.4 m Ritchey–Chrétien, f/24 · in orbit since 1990 · serviced five times',
    summary: 'The first large telescope designed to be repaired in space. Above the blurring of the atmosphere its 2.4 m mirror reaches the diffraction limit — 0.05″ in visible light — and sees ultraviolet the air absorbs. Shown as left by the fifth and last servicing mission in May 2009: Wide Field Camera 3 and the Cosmic Origins Spectrograph new, ACS and STIS repaired, new batteries, gyros and a soft-capture ring.',
    specs: [
      ['Launched', '24 Apr 1990, STS-31 Discovery'],
      ['Length × diameter', '13.2 m × 4.2 m'],
      ['Mass', '≈ 12,200 kg (11,110 kg at launch)'],
      ['Primary mirror', '2.4 m ULE glass, 828 kg'],
      ['Optics', 'Ritchey–Chrétien, f/24, 57.6 m focal length'],
      ['Diffraction limit', '0.052″ at 500 nm'],
      ['Pointing stability', '0.007″ over 24 h'],
      ['Orbit', '28.5° inclination, ≈ 95 min; ≈ 565 km in 2009 (562 × 568 km), ≈ 540 km by 2022, below 500 km by 2026'],
      ['Power', 'Two SA3 wings ≈ 5.3 kW; six NiH₂ batteries'],
      ['Communications', 'S-band through TDRS: 2 high-gain, 2 low-gain antennas'],
      ['Instruments', 'WFC3, ACS, COS, STIS, NICMOS (dormant); 3 FGS'],
      ['Servicing missions', '1993, 1997, 1999, 2002, 2009'],
    ],
    heroStats: [['2.4', 'm', 'Primary mirror'], ['0.05', '″', 'Resolution at 500 nm'], ['57.6', 'm', 'Focal length, f/24']],
    sources: 'NASA Hubble fact sheets and Servicing Mission media reference guides (SM3A 1999, SM3B 2002, SM4 2009); NASA Science Hubble observatory pages (optics, pointing control, electrical power, communications); STScI HST Primer and instrument handbooks; ESA/Hubble instrument pages; L. Allen et al., The Hubble Space Telescope Optical Systems Failure Report (NASA, 1990); D. Schroeder, Astronomical Optics (Ritchey–Chrétien design); D. Vallado, Fundamentals of Astrodynamics (thermosphere densities).',
    fleetTag: 'Optics lab',
    root: A.root,
    body,
    parts: A.parts,
    view: { dir: [0.6, 0.58, 1.0], fill: 0.84 },
    displaySize: 11,
    thermalRange: [120, 340],
    state,
    lightPath: ota.lightPath,
    wiring: wiring.length,
    railLength: ssm.railLength,

    /**
     * Tour 'deploy' hook: a lower value snaps to the stowed launch configuration and the release
     * then plays by itself after 1.5 s (even if a slow frame skips the tour's own trigger); a
     * higher value animates the release.
     */
    setDeploy(d) {
      if (d < state.deploy - 0.05) { state.deploy = d; applyDeploy(d); state.redeploy = 1.5; }
      else state.redeploy = 0;
      state.deployTarget = d;
    },
    /** Animate the arrays and antenna masts to d (0 stowed … 1 deployed). */
    animateDeploy(d) { state.redeploy = 0; state.deployTarget = d; },
    /** Open (true) or close the aperture door. */
    setAperture(open) { state.doorTarget = open ? 1 : 0; },
    /** Force the light-path overlay on in every render mode. */
    setLightPath(on) { state.lightPath = !!on; },
    /** Tour 'bay' hook: open the door and trace the light path. */
    setBay(on) { state.lightPath = !!on; if (on) state.doorTarget = 1; },

    temperatureOf(info) {
      switch (info.thermalRole) {
        case 'array': return state.deploy > 0.6 ? 330 : 260;
        case 'blanket': return info.temp;
        default: return info.temp;
      }
    },

    update(dt, t) {
      if (state.redeploy > 0 && (state.redeploy -= dt) <= 0) state.deployTarget = 1;
      if (Math.abs(state.deploy - state.deployTarget) > 1e-4) {
        const step = dt * 0.28;
        state.deploy += Math.sign(state.deployTarget - state.deploy) * Math.min(step, Math.abs(state.deployTarget - state.deploy));
        applyDeploy(state.deploy);
      }
      if (Math.abs(state.door - state.doorTarget) > 1e-4) {
        state.door += Math.sign(state.doorTarget - state.door) * Math.min(dt * 0.45, Math.abs(state.doorTarget - state.door));
        applyDoor(state.door);
      }
      // the wheels never stop: they hold the telescope still against small disturbance torques
      for (const [i, w] of ssm.wheels.entries()) w.rotation.y += dt * (2.2 + i * 0.35);
      const hd = smooth(0.5, 0.6, state.deploy);
      // both gimbal axes follow a TDRS relay across the sky
      for (const h of app.hgas) { h.g2.rotation.x = Math.sin(t * 0.07 + h.s) * 0.35 * hd; h.ax1.rotation.z = Math.sin(t * 0.05 + 2 * h.s) * 0.3 * hd; }
      // light path: in the analysis views while the door is open (unless a tour step is focused on
      // parts outside the optics), and on request in Studio
      const modes = globalThis.__aeroforge?.modes;
      const mode = modes?.mode;
      const analysis = mode ? OVERLAY.has(mode) : probe.material !== probe.userData.studio && !!probe.userData.studio;
      let optics = true;
      if (modes?.focus) { optics = false; for (const p of modes.focus) if (p.userData.part?.system === 'Optics') { optics = true; break; } }
      ota.lightPath.visible = state.door > 0.6 && !exploded() && (state.lightPath || (analysis && optics));
      const touring = !!globalThis.document?.body?.classList?.contains('is-touring');
      for (const p of tourLabels) {
        if (touring && modes?.focus?.has(p)) continue;
        for (const c of p.children) if (c.isCSS2DObject) c.visible = false;
      }
    },
  };
}
