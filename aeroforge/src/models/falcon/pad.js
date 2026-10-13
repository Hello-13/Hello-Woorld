// Launch Complex 39A as configured for Falcon Heavy: the raised hardstand cut by the Apollo-era
// flame trench (490 ft long, 58 ft wide, 42 ft deep, inverted-V deflector), the fixed launch mount
// built over it in 2015 with its hold-down clamps and tail service masts, SpaceX's
// transporter-erector, the fixed service structure (12 levels at 20 ft spacing from 27 ft, 247 ft
// tall) with the crew access arm as it stood for Falcon Heavy flights from 2019 to 2025 (removed in
// February 2026), water deluge, and site scenery. Pad layout is compressed and simplified;
// hardware positions on the mount are estimates.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { beam, rod } from '../../engine/geometry.js';
import { R, BOOSTER_X, PAD, STACK0, Y, polar } from './dims.js';
import { merge, pipe, hoop, post, block, radialYaw } from './util.js';
import { FM } from './materials.js';

const H = PAD.hardstand;
const W = PAD.trenchHalfWidth;
const DECK = H + PAD.mountDeck;
// hardstand top half-extents, slope run and the chamfered concrete edge (compressed footprint)
const TX = 22.5, TZ = 23, RUN = 7.5, LIP = 1.4, LIP_DROP = 0.9;

// Profile of the hardstand edge, [outward offset, height] from the top edge: a rounded concrete lip
// (the first four points), then a grassed embankment that steepens near the top and flattens out
// toward its toe, like the real mound's slopes.
const LIP_PROFILE = [[0, H], [0.35, H - 0.06], [0.85, H - 0.38], [LIP, H - LIP_DROP]];
const SLOPE_PROFILE = [];
for (let i = 0; i <= 9; i++) {
  const u = i / 9;
  SLOPE_PROFILE.push([LIP + (RUN - LIP) * u, (H - LIP_DROP) * Math.pow(1 - u, 1.35)]);
}

/**
 * One half of the hardstand (s = +1 east of the trench, −1 west): the edge path runs from the
 * trench along the −z side, round the outer corners and back along +z; the profile is swept along
 * it with rounded corners and smooth normals. Returns { top, lip, slope }.
 */
function moundHalf(s) {
  // path samples: [x, z, nx, nz, length]; corners repeat their point with a turning normal
  const path = [];
  const push = (x, z, nx, nz) => {
    const prev = path[path.length - 1];
    if (prev && Math.abs(prev[0] - x) + Math.abs(prev[1] - z) + Math.abs(prev[2] - nx) + Math.abs(prev[3] - nz) < 1e-6) return;
    const len = prev ? prev[4] + Math.hypot(x - prev[0], z - prev[1]) + 0.35 * Math.hypot(nx - prev[2], nz - prev[3]) : 0;
    path.push([x, z, nx, nz, len]);
  };
  const corner = (x, z, a0, a1) => { for (let k = 0; k <= 6; k++) { const a = a0 + ((a1 - a0) * k) / 6; push(x, z, Math.cos(a), Math.sin(a)); } };
  const outA = s > 0 ? 0 : Math.PI;                 // outward normal of the outer (x) side
  const span = (x0, x1, z, nz) => { for (let k = 0; k <= 6; k++) push(x0 + ((x1 - x0) * k) / 6, z, 0, nz); };
  span(s * W, s * TX, -TZ, -1);
  corner(s * TX, -TZ, -Math.PI / 2, s > 0 ? 0 : -Math.PI);
  for (let k = 1; k < 8; k++) push(s * TX, -TZ + (2 * TZ * k) / 8, Math.cos(outA), 0);
  corner(s * TX, TZ, s > 0 ? 0 : Math.PI, Math.PI / 2);
  span(s * TX, s * W, TZ, 1);
  const sweep = (prof) => {
    const pos = [], uv = [], idx = [];
    for (const [x, z, nx, nz, len] of path) {
      let acc = 0;
      prof.forEach(([d, y], j) => {
        if (j) acc += Math.hypot(d - prof[j - 1][0], y - prof[j - 1][1]);
        pos.push(x + nx * d, y, z + nz * d);
        uv.push(len, acc);
      });
    }
    const n = prof.length;
    for (let i = 0; i < path.length - 1; i++) for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = a + n;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // wind outward and up: the normal of the first top-edge quad must point away from the pad centre
    const nrm = g.attributes.normal;
    const probe = new THREE.Vector3(nrm.getX(1), nrm.getY(1), nrm.getZ(1));
    if (probe.y < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    return g;
  };
  const top = new THREE.PlaneGeometry(TX - W, 2 * TZ).rotateX(-Math.PI / 2).translate(s * (TX + W) / 2, H, 0);
  // metric UVs on the top so its concrete tile matches the lip
  const tp = top.attributes.position, tu = top.attributes.uv;
  for (let i = 0; i < tp.count; i++) tu.setXY(i, tp.getX(i), tp.getZ(i));
  return { top, lip: sweep(LIP_PROFILE), slope: sweep(SLOPE_PROFILE) };
}

/** The trench wall under one half: the top edge, then down both ends along the mound profile. */
function trenchWall(s) {
  const prof = [...LIP_PROFILE, ...SLOPE_PROFILE.slice(1)];
  const pts = [];
  for (const [d, y] of prof) pts.push(new THREE.Vector2(TZ + d, y));
  for (const [d, y] of [...prof].reverse()) pts.push(new THREE.Vector2(-TZ - d, y));
  const tris = THREE.ShapeUtils.triangulateShape(pts, []);
  const pos = [];
  const x = s * (W - 0.05);
  for (const t of tris) for (const k of t) pos.push(x, pts[k].y, pts[k].x);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  return faceAway(g, new THREE.Vector3(s * 30, H / 2, 0));       // face into the trench
}

/** Ensure a flat-shaded geometry's faces point away from a reference point. */
function faceAway(g, ref) {
  const p = g.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.subVectors(b, a).cross(m.subVectors(c, a));
    const centre = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    if (n.dot(centre.sub(ref)) < 0) { p.setXYZ(i + 1, c.x, c.y, c.z); p.setXYZ(i + 2, b.x, b.y, b.z); }
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** A lattice-truss tower face set: columns, level beams and alternating diagonals. */
function truss(x0, z0, w, d, levels, { col = 0.5, hor = 0.35, diag = 0.25, mid = true } = {}) {
  const g = [];
  const xs = mid ? [x0, x0 + w / 2, x0 + w] : [x0, x0 + w];
  const zs = mid ? [z0, z0 + d / 2, z0 + d] : [z0, z0 + d];
  const perim = [];
  for (const x of xs) perim.push([x, z0]);
  for (const z of zs.slice(1)) perim.push([x0 + w, z]);
  for (const x of xs.slice(0, -1).reverse()) perim.push([x, z0 + d]);
  for (const z of zs.slice(1, -1).reverse()) perim.push([x0, z]);
  const top = levels[levels.length - 1];
  for (const [x, z] of perim) g.push(beam([x, levels[0], z], [x, top, z], col, col));
  for (let li = 0; li < levels.length; li++) {
    const y = levels[li];
    for (let i = 0; i < perim.length; i++) {
      const a = perim[i], b = perim[(i + 1) % perim.length];
      g.push(beam([a[0], y, a[1]], [b[0], y, b[1]], hor, hor));
      if (li > 0) {
        const y0 = levels[li - 1];
        const flip = (li + i) % 2 === 0;
        g.push(beam([flip ? a[0] : b[0], y0, flip ? a[1] : b[1]], [flip ? b[0] : a[0], y, flip ? b[1] : a[1]], diag, diag));
      }
    }
  }
  return g;
}

/**
 * Build the pad. bed: the hardstand and flame trench, shown in the launch-pad look in every render
 * mode so the vehicle always stands on it there. site: the towers, TE, deluge and scenery, shown
 * only in the launch-pad look's studio rendering. base: always shown (launch mount, clamps, tail
 * service masts). Returns { scenery, deckTop }.
 */
export function buildPad(A, site, base, bed) {
  const G = (name, info, objs, grp = site) => {
    const p = A.part(name, { system: 'Ground support', ...info }, objs, grp);
    p.userData.part.temp = info.temp ?? 300;
    p.userData.part.thermalRole = 'pad';
    return p;
  };

  // ------------------------------------------------------------------ hardstand and flame trench
  const halves = [moundHalf(1), moundHalf(-1)];
  G('Pad hardstand', {
    skin: true, material: 'Reinforced concrete pad on a raised, grassed earth-and-fill mound', mass: null,
    desc: 'LC-39A stands on a raised hardstand built for Saturn V. Its surface is about 48 ft above sea level, high enough for the 42 ft-deep flame trench to drain at grade. Footprint compressed here.',
  }, [mesh(merge(halves.flatMap((h) => [h.top, h.lip])), FM.hardstand()), mesh(merge(halves.map((h) => h.slope)), FM.embankment())], bed);

  const lining = [trenchWall(1), trenchWall(-1)];
  const floor = new THREE.PlaneGeometry(2 * W, 2 * (TZ + RUN)).rotateX(-Math.PI / 2).translate(0, 0.04, 0);
  // inverted-V flame deflector under the vehicle: ridge across the trench, slopes toward both ends
  const defl = new THREE.BufferGeometry();
  {
    const hR = 8.6, run = 15;
    const v = [];
    for (const s of [1, -1]) {
      const a = [-W, hR, 0], b = [W, hR, 0], c = [W, 0, s * run], d = [-W, 0, s * run];
      v.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
    defl.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    defl.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((v.length / 3) * 2).fill(0), 2));
    faceAway(defl, new THREE.Vector3(0, -5, 0));
  }
  G('Flame trench & deflector', {
    skin: true, material: 'Refractory-brick lining, steel deflector faced with high-temperature concrete',
    desc: 'The Apollo-era trench is 490 ft long, 58 ft wide and 42 ft deep. An inverted-V deflector under the vehicle splits the 27-engine exhaust and turns it along the trench toward both ends.',
  }, [mesh(merge(lining), FM.refractory()), mesh(floor, FM.refractory()), mesh(defl, FM.deflector())], bed);

  // ------------------------------------------------------------------ launch mount (always shown)
  const shape = new THREE.Shape();
  shape.moveTo(-10.6, -4.4); shape.lineTo(10.6, -4.4); shape.lineTo(10.6, 4.4); shape.lineTo(-10.6, 4.4); shape.closePath();
  for (const x of [-BOOSTER_X, 0, BOOSTER_X]) { const h = new THREE.Path(); h.absarc(x, 0, 1.96, 0, Math.PI * 2, true); shape.holes.push(h); }
  const deck = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, curveSegments: 20 });
  deck.rotateX(-Math.PI / 2);
  deck.translate(0, DECK - 1.6, 0);
  const legs = [];
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    legs.push(block(sx * 9.8, (H + DECK - 1.6) / 2, sz * 3.3, 1.2, DECK - 1.6 - H, 1.2));
    legs.push(beam([sx * 9.8, H + 0.6, sz * 3.3], [sx * 9.8, DECK - 2.0, -sz * 3.3], 0.35, 0.35));
  }
  for (const x of [-BOOSTER_X, 0, BOOSTER_X]) legs.push(hoop(1.96, 0.18, DECK - 1.7, { x, seg: 40, tube: 6 }));
  G('Launch mount', {
    skin: true, material: 'Welded steel deck on four legs straddling the flame trench', mass: null,
    desc: 'Fixed steel launch mount built on the pad in 2015 over the Apollo / Shuttle flame trench, with an exhaust opening under each core; the transporter-erector sets the vehicle down on it and its hold-downs.',
  }, [mesh(deck, FM.padSteel()), mesh(merge(legs), FM.padSteel())], base);

  // hold-down clamps: around each core where the deck allows (simplified count)
  const clamp = [];
  const stations = [[0, 90], [0, 270], [BOOSTER_X, 0], [BOOSTER_X, 90], [BOOSTER_X, 270], [-BOOSTER_X, 180], [-BOOSTER_X, 90], [-BOOSTER_X, 270]];
  for (const [cx, a] of stations) {
    const [x, z] = polar(R + 0.34, a);
    const [hx, hz] = polar(R + 0.02, a);
    clamp.push(block(cx + x, DECK + 0.35, z, 0.5, 0.7, 0.42, radialYaw(a)));
    clamp.push(beam([cx + x, DECK + 0.62, z], [cx + hx, DECK + 0.3, hz], 0.18, 0.22));
    const [px, pz] = polar(R + 0.7, a);
    clamp.push(rod([cx + px, DECK + 0.05, pz], [cx + x, DECK + 0.5, z], 0.08, 8));
  }
  G('Hold-down clamps', {
    skin: true, count: stations.length, material: 'Hydraulically released steel clamps', mass: null,
    desc: 'Clamp the cores to the mount while all 27 engines start and come up to full thrust; the computers check every engine before the clamps release. Eight shown; the exact clamp arrangement on the Falcon Heavy mount is simplified.',
  }, mesh(merge(clamp), FM.aluDark()), base);

  const tsm = [];
  for (const s of [1, -1]) {
    const x = s * (BOOSTER_X + R + 1.55);
    tsm.push(block(x, DECK + 2.2, 0, 2.0, 4.4, 2.0));
    tsm.push(block(x - s * 0.95, DECK + 2.0, 0, 0.3, 0.9, 1.2));                 // umbilical carrier plate
    tsm.push(pipe([[x, DECK + 3.6, 0.6], [x - s * 0.6, DECK + 3.0, 0.6], [s * (BOOSTER_X + R + 0.04), DECK + 2.0, 0.55]], 0.09, { seg: 8 }));
    tsm.push(pipe([[x, DECK + 3.6, -0.6], [x - s * 0.6, DECK + 3.0, -0.6], [s * (BOOSTER_X + R + 0.04), DECK + 2.0, -0.55]], 0.11, { seg: 8 }));
  }
  G('Tail service masts', {
    skin: true, count: 2, material: 'Steel masts with retracting umbilical plates', mass: null,
    desc: 'Feed RP-1, LOX, helium and power into the base of each side booster until T-0, then retract and close a protective hood against the exhaust. The layout of the Falcon Heavy mount\'s side-booster umbilicals is not documented publicly; shown simplified.',
  }, mesh(merge(tsm), FM.teWhite()), base);

  // ------------------------------------------------------------------ transporter-erector
  const zb = -4.5, zf = -6.9, top = STACK0 + 61;
  const levels = [];
  for (let y = DECK; y <= top + 0.01; y += 3.0) levels.push(y);
  const te = truss(-1.6, zf, 3.2, zb - zf, levels, { col: 0.42, hor: 0.26, diag: 0.2, mid: false });
  te.push(block(0, DECK + 0.6, (zb + zf) / 2, 4.2, 1.2, 2.6));
  for (const sx of [1, -1]) {
    te.push(block(sx * 1.9, DECK + 0.7, zb + 0.1, 0.7, 1.4, 0.9));                        // erector hinge
    te.push(rod([sx * 2.6, H + 0.2, -16], [sx * 1.7, STACK0 + 16, zf + 0.2], 0.34, 12));    // hydraulic erector pistons
    te.push(rod([sx * 2.6, H + 0.2, -16], [sx * 2.4, H + 9, -13.2], 0.5, 12));
    te.push(block(sx * 2.6, H + 0.5, -16, 1.6, 1.0, 1.6));
  }
  G('Transporter-erector strongback', {
    material: 'Steel truss strongback, hydraulic erector pistons', mass: null,
    desc: 'SpaceX\'s transporter-erector carries the integrated vehicle horizontally from the hangar up the ramp, raises it on the mount and serves as its umbilical tower; it tilts back a few degrees just before launch.',
  }, mesh(merge(te), FM.teWhite()));

  const arms = [];
  for (const [ys, wrap] of [[49.9, 1.2], [56.2, 1.0], [44.0, 0.8]]) {
    const y = STACK0 + ys;
    arms.push(beam([-0.9, y, zb], [-0.7, y, -R - 0.25], 0.32, 0.5), beam([0.9, y, zb], [0.7, y, -R - 0.25], 0.32, 0.5));
    const arc = new THREE.TorusGeometry(R + 0.18, 0.1, 6, 24, wrap);
    arc.rotateX(Math.PI / 2); arc.rotateY(Math.PI / 2 + wrap / 2);       // centred on −z, facing the strongback
    arc.translate(0, y, 0);
    arms.push(arc);
    arms.push(block(0, y, -R - 0.12, 0.9, 0.7, 0.2));                                    // umbilical carrier plate
  }
  for (const [x, r] of [[-0.9, 0.1], [-0.6, 0.14], [0.6, 0.12], [0.9, 0.09]]) {
    arms.push(pipe([[x, DECK + 0.4, zb + 0.05], [x, STACK0 + 30, zb + 0.15], [x, STACK0 + 49.4, zb + 0.15], [x * 0.8, STACK0 + 49.7, zb + 1.1]], r, { seg: 8, tubular: 60 }));
  }
  G('TE umbilical & clamp arms', {
    material: 'Steel arms, quick-disconnect umbilical plates, propellant and gas lines', mass: null,
    desc: 'Arms on the strongback steady the vehicle and connect the second-stage umbilicals — propellant, helium, nitrogen, power and data — which pull away at liftoff.',
  }, mesh(merge(arms), FM.padSteel()));

  // ------------------------------------------------------------------ fixed service structure + crew access arm
  const fx0 = -21.8, fz0 = -17.4, fw = 12.2;
  const fl = [H];
  for (let i = 0; i < 12; i++) fl.push(H + 8.23 + i * 6.096);
  const fss = truss(fx0, fz0, fw, fw, fl, { col: 0.62, hor: 0.42, diag: 0.3 });
  for (const y of fl.slice(1)) fss.push(block(fx0 + fw / 2, y - 0.12, fz0 + fw / 2, fw - 0.4, 0.22, fw - 0.4));
  fss.push(block(fx0 + 3, (H + fl[fl.length - 1]) / 2, fz0 + 3, 2.6, fl[fl.length - 1] - H, 2.6));   // elevator shaft
  G('Fixed service structure', {
    skin: true, material: 'Steel lattice tower', mass: null,
    desc: 'The shuttle-era tower, 247 ft tall with 12 levels 20 ft apart. A 24 m fibreglass lightning mast on its roof carries a catenary wire anchored about 335 m north and south, protecting the whole pad.',
  }, mesh(merge(fss), FM.fssSteel()));

  const caaY = H + 66.1;
  const cx = fx0 + fw, cz = fz0 + fw;           // pivot on the corner facing the vehicle
  const caa = [];
  const L = 25.9;
  for (const [dy, dx] of [[0, -1.2], [0, 1.2], [3, -1.2], [3, 1.2]]) caa.push(beam([cx + dx + 1.4, caaY + dy, cz], [cx + dx + 1.4, caaY + dy, cz - L], 0.28, 0.28));
  for (let s = 0; s <= L; s += 2.6) {
    caa.push(beam([cx + 0.2, caaY, cz - s], [cx + 2.6, caaY + 3, cz - s], 0.18, 0.18));
    caa.push(block(cx + 1.4, caaY - 0.05, cz - s, 2.4, 0.1, 2.6));
  }
  caa.push(block(cx + 1.4, caaY + 1.6, cz - L - 1.6, 3.6, 3.4, 3.4));               // white room
  caa.push(block(cx + 0.6, caaY + 1.5, cz + 0.4, 1.2, 4.0, 1.2));                   // slew bearing / hinge
  G('Crew access arm', {
    material: 'Steel truss walkway with an environmental "white room"', mass: null,
    desc: 'Installed in August 2018 on a new level at 217 ft for Crew Dragon; 85 ft long, and retracted for uncrewed Falcon Heavy flights (shown swung back along the tower). SpaceX lowered it by crane into storage in February 2026, when crew launches moved to SLC-40 and 39A was refocused on Falcon Heavy and Starship.',
  }, mesh(merge(caa), FM.teWhite()));

  // ------------------------------------------------------------------ water deluge / sound suppression
  const wd = [];
  for (const x of [-BOOSTER_X, 0, BOOSTER_X]) wd.push(hoop(2.25, 0.07, DECK + 0.08, { x, seg: 48, tube: 6 }));
  for (const [x, z] of [[13, 8], [-13, 8], [13, -9], [-19, 2]]) {
    wd.push(post(x, z, H, H + 3.4, 0.32, 12));
    wd.push(pipe([[x, H + 3.2, z], [x * 0.94, H + 3.9, z * 0.92], [x * 0.86, H + 4.0, z * 0.86]], 0.28, { seg: 10, tubular: 8 }));
    wd.push(pipe([[x, H + 0.3, z], [x, H + 0.3, z + Math.sign(z) * 8], [x * 1.5, H + 0.3, z + Math.sign(z) * 8]], 0.3, { seg: 8, tubular: 16, tension: 0 }));
  }
  G('Water deluge & sound suppression', {
    material: 'Steel headers, deck spray rings and "rainbird" nozzles', mass: null,
    desc: 'At ignition water floods the mount, the trench and the deck from big rainbird nozzles. Turning to steam absorbs heat and damps the acoustic energy that would otherwise reflect back onto the vehicle. The water is stored in the pad\'s 290 ft water tower.',
  }, mesh(merge(wd), FM.water()));

  // ------------------------------------------------------------------ scenery (launch-pad look only, not parts)
  const scenery = new THREE.Group();
  const fssTop = fl[fl.length - 1];
  const fx = fx0 + fw / 2, fz = fz0 + fw / 2;
  const mastGeo = merge([post(fx, fz, fssTop, fssTop + 6, 0.9, 12, 0.5), post(fx, fz, fssTop + 6, fssTop + 30.5, 0.5, 10, 0.18)]);
  scenery.add(mesh(mastGeo, new THREE.MeshStandardMaterial({ color: 0xd9d4c6, roughness: 0.7, metalness: 0.05 }), { cast: false }));
  const wire = (a, b, sag) => {
    const pts = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48; const p = new THREE.Vector3().lerpVectors(a, b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.09, 4, false);
  };
  const tip = new THREE.Vector3(fx, fssTop + 30.5, fz);
  scenery.add(mesh(merge([wire(tip, new THREE.Vector3(fx, 0, fz + 335), 22), wire(tip, new THREE.Vector3(fx, 0, fz - 335), 22)]), FM.black(), { cast: false }));
  const white = new THREE.MeshStandardMaterial({ color: 0xe7e8e4, roughness: 0.55, metalness: 0.1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b9096, metalness: 0.7, roughness: 0.5 });
  // water tower (≈ 290 ft) and propellant storage spheres
  const wt = [post(-110, -150, 70, 88, 9, 32), new THREE.ConeGeometry(9.4, 3.2, 32).translate(-110, 89.6, -150)];
  const legsW = [];
  for (let k = 0; k < 6; k++) { const [x, z] = polar(10, k * 60); const [x1, z1] = polar(7, k * 60); legsW.push(beam([-110 + x, 0, -150 + z], [-110 + x1, 70, -150 + z1], 0.9, 0.9)); }
  scenery.add(mesh(merge(wt), white), mesh(merge(legsW), steel));
  // kept behind the tower, on the right of the default view, so they never sit under the hero text
  for (const [x, z, r] of [[-30, -160, 9.3], [60, -150, 7.5], [120, -85, 4.2]]) {
    scenery.add(mesh(new THREE.SphereGeometry(r, 40, 24).translate(x, r + 3, z), white));
    const sl = [];
    for (let k = 0; k < 8; k++) { const [a, b] = polar(r * 0.8, k * 45); sl.push(beam([x + a, 0, z + b], [x + a * 1.05, r + 3, z + b * 1.05], 0.5, 0.5)); }
    scenery.add(mesh(merge(sl), steel));
  }
  scenery.traverse((o) => { if (o.isMesh) { o.userData.fx = true; o.userData.scenery = true; } });
  site.add(scenery);
  return { scenery, deckTop: DECK };
}
