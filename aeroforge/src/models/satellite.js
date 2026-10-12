// SENTINEL-4 — fictional Earth-observation satellite: MLI-wrapped bus with removable
// panels (internals visible in exploded view), accordion solar wings, high-gain antenna,
// off-axis telescope with an oblique sunshade and a bipropellant apogee engine.

import * as THREE from 'three';
import { Assembly, mesh } from '../engine/assembly.js';
import { lathe, rod, mergeGeometries } from '../engine/geometry.js';
import { M, SKIN } from '../engine/materials.js';
import { decal, stencilText, emblem } from '../engine/decals.js';
import { carbonWeave, decalTexture } from '../engine/surface.js';

const BX = 2.2, BY = 2.6, BZ = 2.2;   // bus dimensions (m)

function bell(throat, exit, len, seg = 24) {
  const prof = [[0.001, 0], [throat * 1.6, 0], [throat * 1.6, -len * 0.18], [throat, -len * 0.28]];
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    prof.push([throat + (exit - throat) * Math.sqrt(t), -len * 0.28 - len * 0.72 * t]);
  }
  return lathe(prof, seg);
}

export function buildSatellite({ compact = false } = {}) {
  const A = new Assembly();
  const body = new THREE.Group();
  A.root.add(body);
  const P = (name, info, objs) => A.part(name, info, objs, body);

  // ----------------------------------------------------------------- bus panels (each explodes along its normal)
  const panel = (w, h, d, mat, pos) => { const m = mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(...pos); return m; };
  const t = 0.04;
  // optical solar reflector radiator: a grid of small quartz mirror tiles
  const osrTex = decalTexture('osr', 512, 512, (ctx, w) => {
    ctx.fillStyle = '#b8c2cc'; ctx.fillRect(0, 0, w, w);
    const n = 16, c = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 190 + ((i * 7 + j * 13) % 9) * 5;
      ctx.fillStyle = `rgb(${v},${v + 6},${v + 12})`;
      ctx.fillRect(i * c + 2, j * c + 2, c - 4, c - 4);
    }
  });
  const osr = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: osrTex, metalness: 0.75, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 });
  P('Nadir deck (+X)', { system: 'Structure', material: 'Al honeycomb, MLI blanket', mass: 38, temp: 300, explode: [1.6, 0, 0], desc: 'Instrument deck. Carries the telescope and its optical bench, aligned to the star trackers within arc-seconds.' },
    panel(t, BY, BZ, SKIN.mli(), [BX / 2, 0, 0]));
  P('Aft deck (−X)', { system: 'Structure', material: 'Al honeycomb, MLI blanket', mass: 36, temp: 250, explode: [-1.5, 0, 0], desc: 'Propulsion deck: apogee engine, RCS thrusters and the fill-and-drain valves.' },
    panel(t, BY, BZ, SKIN.mli(), [-BX / 2, 0, 0]));
  P('Zenith radiator (+Y)', { system: 'Thermal control', material: 'Optical solar reflectors on Al', mass: 30, temp: 265, explode: [0, 1.7, 0], desc: 'Second-surface mirrors reject sunlight but radiate the electronics\' heat to deep space.' },
    panel(BX, t, BZ, osr, [0, BY / 2, 0]));
  P('Anti-zenith radiator (−Y)', { system: 'Thermal control', material: 'Optical solar reflectors on Al', mass: 30, temp: 240, explode: [0, -1.7, 0], desc: 'Radiator panel; heat pipes embedded in the honeycomb spread the load from the avionics boxes.' },
    panel(BX, t, BZ, osr, [0, -BY / 2, 0]));
  for (const s of [1, -1]) {
    const p = P(s > 0 ? 'Starboard side panel (+Z)' : 'Port side panel (−Z)', {
      system: 'Structure', material: 'Al honeycomb, MLI blanket', mass: 34, temp: s > 0 ? 375 : 175, explode: [0, 0, 1.4 * s],
      desc: s > 0 ? 'Sun-facing side: the gold Kapton outer layer runs hot in direct sunlight.' : 'Shadowed side: radiates to space and runs far below freezing without heaters.',
    }, panel(BX, BY, t, SKIN.mli(), [0, 0, (BZ / 2) * s]));
    p.userData.part.thermalRole = s > 0 ? 'sunlit' : 'shadow';
  }

  // ----------------------------------------------------------------- internals
  const tube = mesh(new THREE.CylinderGeometry(0.58, 0.58, BX - 0.1, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }));
  tube.rotation.z = Math.PI / 2;
  P('Central thrust tube', { system: 'Structure', material: 'Carbon-fibre cylinder', mass: 62, temp: 290, desc: 'Primary load path from the launch-vehicle adapter; the propellant tanks nest inside it.' }, tube);
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.22, metalness: 1.0 });
  const tanks = [-0.48, 0.48].map((x) => { const m = mesh(new THREE.SphereGeometry(0.48, 32, 20), tankMat); m.position.x = x; return m; });
  P('Propellant tanks', { system: 'Propulsion', material: 'Ti-6Al-4V spheres', mass: 1800, temp: 291, explode: [0, 0, 0], desc: 'MMH fuel and MON-3 oxidiser, 1,800 kg loaded. Diaphragms keep liquid at the outlets in weightlessness.', callout: true, anchor: [0.48, 0.5, 0.3] }, tanks);
  const wheels = [];
  [[0.75, 0.85, 0.75], [0.75, -0.85, -0.75], [-0.75, 0.85, -0.75], [-0.75, -0.85, 0.75]].forEach(([x, y, z]) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.lookAt(0, 0, 0);
    const housing = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24), M.gunmetal());
    housing.rotation.x = Math.PI / 2;
    const rotor = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.13, 24), M.copper());
    rotor.rotation.x = Math.PI / 2;
    g.add(housing, rotor);
    wheels.push(rotor);
    return g;
  });
  P('Reaction wheels', {
    system: 'Attitude control', material: 'Steel flywheels, magnetic bearings', mass: 48, temp: 300,
    desc: 'Four wheels in a pyramid: any three give full 3-axis control, the fourth is a spare. Spinning one faster turns the spacecraft the other way.',
    callout: true, anchor: [0.75, 0.95, 0.75],
  }, wheels.map((w) => w.parent));
  const boxes = [];
  [[0.2, 1.05, 0.7, 0.7, 0.18, 0.5], [-0.4, 1.05, -0.6, 0.6, 0.18, 0.6], [0.3, -1.05, -0.6, 0.8, 0.18, 0.5], [-0.5, -1.05, 0.55, 0.5, 0.18, 0.7]].forEach(([x, y, z, w, h, d]) => {
    boxes.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed());
  });
  P('Avionics & battery', {
    system: 'Electrical power', material: 'Li-ion cells, radiation-hardened electronics', mass: 140, temp: 296,
    desc: 'Flight computer, power conditioning and a 9 kWh battery that carries the spacecraft through each 35-minute eclipse.',
  }, mesh(mergeGeometries(boxes), new THREE.MeshStandardMaterial({ color: 0x3f4a42, roughness: 0.55, metalness: 0.4 })));

  // ----------------------------------------------------------------- telescope (+X)
  const scope = new THREE.Group();
  const barrelGeo = new THREE.CylinderGeometry(0.56, 0.56, 1.9, 48, 6, true);
  // oblique sunshade: trim the far end at 30°
  {
    const pos = barrelGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setY(i, y + ((y + 0.95) / 1.9) * 0.32 * (pos.getZ(i) / 0.56));
    }
    barrelGeo.computeVertexNormals();
  }
  const barrel = mesh(barrelGeo, SKIN.mli());
  const inner = mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, side: THREE.BackSide }));
  const mirror = mesh(new THREE.CircleGeometry(0.5, 40), new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.02, metalness: 1 }));
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -0.85;
  const secondary = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 20), M.aluminium());
  secondary.position.y = 0.3;
  const spider = mergeGeometries([0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2;
    return rod([0, 0.3, 0], [Math.cos(a) * 0.55, 0.3, Math.sin(a) * 0.55], 0.008, 4).toNonIndexed();
  }));
  scope.add(barrel, inner, mirror, secondary, mesh(spider, M.darkMetal()));
  scope.rotation.z = -Math.PI / 2;
  scope.position.x = BX / 2 + 0.95;
  P('Imaging telescope', {
    system: 'Payload', material: 'Zerodur mirrors, CFRP barrel', mass: 310, temp: 292, explode: [2.2, 0, 0],
    desc: '1.0 m Korsch telescope: 30 cm ground resolution from 500 km. The oblique sunshade blocks stray light near the terminator.',
    callout: true, anchor: [BX / 2 + 1.0, 0.75, 0],
  }, scope);

  // ----------------------------------------------------------------- high-gain antenna on a 2-axis gimbal boom
  const hga = new THREE.Group();
  hga.position.set(0.3, BY / 2, 0);
  hga.add(mesh(rod([0, 0, 0], [0, 1.0, 0], 0.05), M.aluminium()));
  const gimbal = new THREE.Group();
  gimbal.position.y = 1.05;
  const dish = mesh(lathe(Array.from({ length: 12 }, (_, i) => { const r = (i / 11) * 0.78; return [r, (r * r) / (4 * 0.42)]; }), 48), new THREE.MeshStandardMaterial({ color: 0xeceff2, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }));
  dish.rotation.z = -Math.PI / 2 + 0.5;
  const feedGroup = new THREE.Group();
  feedGroup.rotation.z = -Math.PI / 2 + 0.5;
  const feed = mesh(new THREE.ConeGeometry(0.06, 0.16, 12), M.gunmetal());
  feed.position.y = 0.42;
  feed.rotation.x = Math.PI;
  feedGroup.add(feed);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    feedGroup.add(mesh(rod([Math.cos(a) * 0.74, 0.33, Math.sin(a) * 0.74], [0, 0.42, 0], 0.01, 4), M.aluminium()));
  }
  gimbal.add(dish, feedGroup, mesh(new THREE.BoxGeometry(0.16, 0.16, 0.2), M.gunmetal()));
  hga.add(gimbal);
  P('High-gain antenna', {
    system: 'Communications', material: 'CFRP reflector, Ka-band feed', mass: 24, temp: 260, explode: [0, 1.8, 0],
    desc: '1.56 m Ka-band dish on a two-axis gimbal: tracks ground stations to downlink imagery at 3.2 Gbit/s.',
    callout: true, anchor: [0.3, BY / 2 + 1.4, 0],
  }, hga);

  // ----------------------------------------------------------------- propulsion (−X)
  const engine = mesh(bell(0.06, 0.2, 0.6, 28), M.niobium());
  engine.rotation.z = -Math.PI / 2;
  engine.position.x = -BX / 2 - 0.02;
  const rcs = [];
  for (const [y, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const r = mesh(bell(0.015, 0.05, 0.16, 12), M.niobium());
    r.rotation.z = -Math.PI / 2;
    r.position.set(-BX / 2 - 0.02, y * (BY / 2 - 0.15), z * (BZ / 2 - 0.15));
    rcs.push(r);
  }
  const eng = P('Apogee engine & RCS', {
    system: 'Propulsion', material: 'Platinum-rhodium chamber, niobium nozzle', mass: 22, explode: [-1.6, 0, 0],
    desc: '445 N bipropellant engine, Isp 321 s, for orbit raising; sixteen 10 N thrusters for attitude and station-keeping.',
    callout: true, anchor: [-BX / 2 - 0.5, 0.2, 0],
  }, [engine, ...rcs]);
  eng.userData.part.thermalRole = 'engine';

  // ----------------------------------------------------------------- star trackers & sensors
  const st = new THREE.Group();
  for (const s of [1, -1]) {
    const head = new THREE.Group();
    head.position.set(-0.7, BY / 2 + 0.12, 0.65 * s);
    head.rotation.set(0.5 * s, 0, 0.45);
    head.add(mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), M.gunmetal()));
    const baffle = mesh(new THREE.CylinderGeometry(0.11, 0.06, 0.3, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9, side: THREE.DoubleSide }));
    baffle.position.y = 0.22;
    head.add(baffle);
    st.add(head);
  }
  const omni = mesh(rod([-0.9, -BY / 2, 0.8], [-0.9, -BY / 2 - 0.5, 0.8], 0.02), M.aluminium());
  const omniCap = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), M.offWhite());
  omniCap.position.set(-0.9, -BY / 2 - 0.55, 0.8);
  P('Star trackers & omni antennas', {
    system: 'Attitude control', material: 'CMOS star cameras with stray-light baffles', mass: 9, temp: 285, explode: [-0.4, 1.3, 0],
    desc: 'Two star trackers compare the sky with an onboard catalogue ten times a second for arc-second attitude knowledge.',
  }, [st, omni, omniCap]);

  // ----------------------------------------------------------------- solar array wings (accordion)
  const arrays = [];
  const panelGeo = new THREE.BoxGeometry(0.035, 2.4, 2.0);
  panelGeo.translate(0, 0, 1.0);
  const cw = carbonWeave();
  const backMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa0a6, map: cw.map, normalMap: cw.normalMap, roughness: 0.55, metalness: 0.3, clearcoat: 0.4 });
  const cellMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: M.solar().map, roughness: 0.18, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.25, iridescenceIOR: 1.6 });
  for (const side of [1, -1]) {
    const drive = new THREE.Group();                // solar-array drive: rotates the wing to track the Sun
    drive.position.set(0.0, 0, (BZ / 2) * side);
    if (side < 0) drive.scale.z = -1;      // mirrored wing keeps its cells facing the same way
    const yoke = new THREE.Group();
    yoke.add(mesh(rod([0, 0.9, 0], [0, 0.0, 0.95], 0.03), M.aluminium()));
    yoke.add(mesh(rod([0, -0.9, 0], [0, 0.0, 0.95], 0.03), M.aluminium()));
    drive.add(yoke);
    let parent = drive;
    const hinges = [];
    for (let i = 0; i < 4; i++) {
      const hinge = new THREE.Group();
      hinge.position.z = i === 0 ? 0.95 : 2.0;
      const front = mesh(panelGeo, [cellMat, backMat, backMat, backMat, backMat, backMat]);
      hinge.add(front);
      parent.add(hinge);
      hinges.push(hinge);
      parent = hinge;
    }
    const part = P(side > 0 ? 'Solar array wing (starboard)' : 'Solar array wing (port)', {
      system: 'Electrical power', material: 'Triple-junction GaAs cells, 30 % efficient', mass: 85, explode: [0, 0, 1.4 * side],
      desc: 'Four 2.4 × 2.0 m panels per wing, 9.8 kW at beginning of life. Spring hinges unfold the stack after separation.',
      callout: side > 0, anchor: [0, 1.3, 5.0 * side],
    }, drive);
    part.userData.part.thermalRole = 'array';
    arrays.push({ drive, hinges, side });
  }

  // markings on the nadir-deck side panel
  A.root.updateMatrixWorld(true);
  const side = A.parts.find((p) => p.name === 'Starboard side panel (+Z)');
  const sideMesh = side.children[0];
  side.add(decal(sideMesh, emblem('rgba(40,30,10,0.9)'), { at: [-0.45, 0.65, BZ / 2 + 0.02], dir: [0, 0, 1], size: [0.9, 0.45, 0.2], roughness: 0.4, metalness: 0.6 }));
  side.add(decal(sideMesh, stencilText('SENTINEL-4', 'rgba(40,30,10,0.92)'), { at: [-0.3, -0.75, BZ / 2 + 0.02], dir: [0, 0, 1], size: [1.2, 0.3, 0.2], roughness: 0.4, metalness: 0.6 }));
  // separation ring / launch-vehicle adapter interface on the aft deck
  const ring = mesh(new THREE.TorusGeometry(0.6, 0.035, 10, 64), M.aluminium());
  ring.rotation.y = Math.PI / 2;
  ring.position.x = -BX / 2 - 0.04;
  A.parts.find((p) => p.name === 'Aft deck (−X)').add(ring);

  A.finalize();

  const state = { deploy: compact ? 0 : 1, deployTarget: compact ? 0 : 1, sunAngle: 0, wheelSpin: 0, burn: 0 };
  const setDeploy = (d) => {
    for (const { hinges } of arrays) {
      hinges.forEach((h, i) => {
        // accordion: first hinge folds 90°, the rest alternate ±178°
        const a = i === 0 ? -(1 - d) * (Math.PI / 2) : (i % 2 ? 1 : -1) * (1 - d) * Math.PI * 0.985;
        h.rotation.y = a;
        h.position.x = i === 0 ? 0 : (1 - d) * 0.045 * (i % 2 ? 1 : -1);
      });
    }
  };
  setDeploy(state.deploy);

  return {
    id: 'satellite',
    designation: 'SENTINEL-4',
    name: 'SENTINEL',
    role: 'Earth-observation satellite',
    tagline: '30 cm resolution · sun-synchronous LEO · 7-year design life',
    summary: 'A 4.2-tonne optical reconnaissance and mapping spacecraft. Its 1-metre telescope images a 12 km swath; reaction wheels slew it between targets, and a bipropellant engine raises the orbit from the launcher\'s drop-off point.',
    specs: [
      ['Launch mass', '4,200 kg'], ['Bus', '2.2 × 2.6 × 2.2 m'], ['Array span', '19.3 m'], ['Power', '9.8 kW (BOL)'],
      ['Aperture', '1.0 m'], ['Resolution', '0.30 m @ 500 km'], ['Propellant', '1,800 kg MMH/MON'], ['Engine', '445 N, Isp 321 s'],
    ],
    fleetTag: 'Δv lab',
    root: A.root,
    body,
    parts: A.parts,
    view: { dir: [1.15, 0.55, 1.0], fill: 0.95 },
    displaySize: 10.5,
    hover: 2.6,
    thermalRange: [150, 420],
    state,
    setDeploy(d) { state.deployTarget = d; },
    temperatureOf(info) {
      switch (info.thermalRole) {
        case 'sunlit': return 375;
        case 'shadow': return 175;
        case 'array': return 335;
        case 'engine': return 300 + state.burn * 900;
        default: return info.temp;
      }
    },
    update(dt, time) {
      if (Math.abs(state.deploy - state.deployTarget) > 1e-3) {
        state.deploy += Math.sign(state.deployTarget - state.deploy) * Math.min(Math.abs(state.deployTarget - state.deploy), dt * 0.35);
        setDeploy(state.deploy);
      }
      state.sunAngle += dt * 0.12 * state.deploy;
      for (const { drive, side } of arrays) drive.rotation.z = Math.sin(state.sunAngle) * 0.35 * side;
      for (const w of wheels) w.rotation.y += dt * 6;
      gimbal.rotation.y = Math.sin(time * 0.3) * 0.5;
      body.position.y = Math.sin(time * 0.6) * 0.12;
      body.rotation.y = Math.sin(time * 0.15) * 0.04;
    },
  };
}
