// Launch Complex 39A as configured for Falcon Heavy: the raised hardstand bisected north–south by
// the Apollo-era flame trench (490 ft long, 58 ft wide, 42 ft deep, inverted-V deflector), the fixed
// launch mount built over it in 2015 with its hydraulic hold-down clamps and tail service masts,
// SpaceX's transporter-erector (strongback, base frame and erector cylinders, umbilical and clamp
// arms, lines, ground harness and air-conditioning duct) on rails that straddle the trench and run
// down the old crawlerway ramp, the fixed service structure (12 levels at 20 ft spacing from 27 ft,
// 247 ft tall) with its lightning mast and catenary wire and the crew access arm as it stood for
// Falcon Heavy flights from 2019 to 2025 (removed in February 2026), water deluge and water tower,
// the instrumentation bay under the hardstand and the propellant and gas farm with its trunk lines.
// Frame: z runs north (+z) – south (−z) along the trench, the transporter-erector comes up from the
// south, the side boosters stand east (+x) and west. Pad layout is compressed and simplified;
// hardware positions on the mount are estimates.

import * as THREE from 'three';
import { mesh } from '../../engine/assembly.js';
import { beam, rod } from '../../engine/geometry.js';
import { R, BOOSTER_X, PAD, STACK0, T0_Y, polar } from './dims.js';
import { merge, pipe, hoop, post, block, radialYaw } from './util.js';
import { FM } from './materials.js';

const H = PAD.hardstand;
const W = PAD.trenchHalfWidth;
const DECK = H + PAD.mountDeck;
// hardstand top half-extents, slope run and the chamfered concrete edge (compressed footprint)
const TX = 25, TZ = 23, RUN = 7.5, LIP = 1.4, LIP_DROP = 0.9;
// transporter-erector tracks: one each side of the trench (centre ±RAIL_X), rail gauge (estimates)
const RAIL_X = 10.0, GAUGE = 1.2;
// what the stage frames the vehicle on: the hardstand and the towers, not the far-reaching ramp,
// catenary wire and storage farm (see noFrame)
const FRAME_BOX = new THREE.Box3(new THREE.Vector3(-TX - RUN, 0, -TZ - RUN - 4), new THREE.Vector3(TX + RUN, 88.4, TZ + RUN));

/**
 * Leave a far-reaching ground part out of the vehicle's framing. The stage fits and frames a vehicle
 * on its meshes' bounding boxes, so a 250 m ramp or a sphere 160 m away would shrink the rocket to
 * a speck. The box the stage sees is the mesh clipped to the pad footprint (empty if wholly
 * outside it); ray casts get the real box back, so the part stays pickable.
 */
function noFrame(m) {
  const g = m.geometry;
  g.computeBoundingBox();
  const real = g.boundingBox.clone();
  const framed = real.clone().intersect(FRAME_BOX);
  g.boundingBox = framed;
  m.raycast = function raycast(rc, hits) {
    g.boundingBox = real;
    try { THREE.Mesh.prototype.raycast.call(this, rc, hits); } finally { g.boundingBox = framed; }
  };
  return m;
}

/** A strip of flat-shaded triangles between two polylines, faced away from ref; metric UVs. */
function ribbon(a, b, ref) {
  const pos = [], uv = [];
  const put = (p) => { pos.push(...p); uv.push(p[0] + p[2] * 0.0, p[2] + p[1]); };
  for (let i = 0; i < a.length - 1; i++) { put(a[i]); put(b[i]); put(a[i + 1]); put(a[i + 1]); put(b[i]); put(b[i + 1]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return faceAway(g, ref);
}

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
 * service masts). Returns { deckTop }.
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
  const clamp = [], rel = [], relLine = [];
  const stations = [[0, 90], [0, 270], [BOOSTER_X, 0], [BOOSTER_X, 90], [BOOSTER_X, 270], [-BOOSTER_X, 180], [-BOOSTER_X, 90], [-BOOSTER_X, 270]];
  for (const [cx, a] of stations) {
    const [x, z] = polar(R + 0.34, a);
    const [hx, hz] = polar(R + 0.02, a);
    clamp.push(block(cx + x, DECK + 0.35, z, 0.5, 0.7, 0.42, radialYaw(a)));
    clamp.push(beam([cx + x, DECK + 0.62, z], [cx + hx, DECK + 0.3, hz], 0.18, 0.22));
    // the release actuator: a hydraulic cylinder that pulls the jaw back at T-0, fed from a ring
    // header round each exhaust opening
    const [px, pz] = polar(R + 0.7, a);
    rel.push(rod([cx + px, DECK + 0.08, pz], [cx + x, DECK + 0.5, z], 0.075, 10), post(cx + px, pz, DECK, DECK + 0.16, 0.1, 10));
    relLine.push(post(cx + px, pz, DECK - 1.8, DECK + 0.02, 0.022, 6));            // line down through the deck
  }
  // headers under the deck, clear of the exhaust openings, and the hydraulic unit on the deck
  const yH = DECK - 1.78, zH = R + 0.7;
  for (const zz of [zH, -zH]) relLine.push(rod([-6.8, yH, zz], [6.8, yH, zz], 0.035, 6));
  for (const xx of [6.8, -6.8]) relLine.push(rod([xx, yH, -zH], [xx, yH, zH], 0.035, 6));
  const hpu = [block(-9.6, DECK + 0.55, 3.4, 1.4, 1.1, 1.0), post(-9.0, 3.4, DECK + 1.1, DECK + 1.5, 0.22, 12)];
  relLine.push(post(-9.0, 3.0, yH, DECK + 0.1, 0.035, 6), rod([-9.0, yH, 3.0], [-6.8, yH, zH], 0.035, 6));
  G('Hold-down clamps', {
    skin: true, count: stations.length, material: 'Steel clamp bodies and jaws over the hold-down fittings', mass: null,
    desc: 'Clamp the cores to the mount by their hold-down fittings while all 27 engines start and come up to full thrust; the flight computer checks ignition and full power during this hold-down before it lets go (Falcon User\'s Guide). Eight shown; the exact clamp arrangement on the Falcon Heavy mount is simplified.',
  }, mesh(merge(clamp), FM.aluDark()), base);
  G('Hold-down hydraulic release', {
    count: stations.length, material: 'Hydraulic release cylinders, under-deck headers and lines, hydraulic power unit', mass: null,
    desc: 'If every engine is healthy, the hydraulic release system is triggered at T-0 (Falcon User\'s Guide): each clamp\'s cylinder pulls its jaw clear and the vehicle rises. Lines under the deck feed the cylinders from a hydraulic unit on it. Cylinder count, sizes and routing estimated.',
  }, [mesh(merge(rel), FM.steelLine()), mesh(merge(relLine), FM.steelLine()), mesh(merge(hpu), FM.teWhite())], base);

  // tail service masts: a mast outboard of each side booster, a short retracting arm carrying the
  // ground half of the booster's T-0 plate, its lines, and the blast hood that closes after T-0
  const tsm = [], tsmLines = [], hood = [];
  const hoodMat = new THREE.MeshStandardMaterial({ color: 0x6c7176, roughness: 0.6, metalness: 0.55, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const x = s * (BOOSTER_X + R + 2.17);                                          // mast centre, clear of the clamp
    const xp = s * (BOOSTER_X + R + 0.23);                                         // carrier plate on the T-0 plate
    tsm.push(block(x, DECK + 2.2, 0, 2.0, 4.4, 2.0));
    tsm.push(block(xp, DECK + 2.0, 0, 0.2, 0.8, 1.3));                            // carrier plate
    for (const z of [-0.5, 0.5]) tsm.push(beam([x - s * 1.0, DECK + 2.3, z], [xp + s * 0.1, DECK + 2.15, z * 0.9], 0.14, 0.2));   // retract arm
    tsm.push(block(x - s * 1.05, DECK + 2.3, 0, 0.1, 0.5, 1.4));                  // arm pivot plate on the mast
    const lines = [[-0.42, 0.09], [-0.16, 0.07], [0.1, 0.035], [0.3, 0.03], [0.48, 0.04]];   // LOX, RP-1, GN₂, He, TEA-TEB
    for (const [z, r] of lines) tsmLines.push(pipe([[x - s * 0.6, DECK + 4.4, z], [x - s * 0.9, DECK + 3.4, z], [xp + s * 0.6, DECK + 2.35, z * 0.9], [xp + s * 0.11, DECK + 2.1, z * 0.85]], r, { seg: 8, tubular: 12 }));
    const h = new THREE.CylinderGeometry(0.5, 0.5, 1.6, 14, 1, true, -Math.PI / 2, Math.PI);   // half-pipe hood over the lines
    h.rotateX(-Math.PI / 2); h.translate(x - s * 0.75, DECK + 4.4, 0);
    hood.push(h);
  }
  G('Tail service masts', {
    skin: true, count: 2, material: 'Steel masts, retracting arms with umbilical carrier plates, blast hoods', mass: null,
    desc: 'Feed LOX, RP-1, helium, nitrogen, igniter fluid, power and data into the base of each side booster through its T-0 plate until liftoff; then the arm swings the carrier plate back into the mast and a hood closes over it against the exhaust. The layout of the Falcon Heavy mount\'s side-booster umbilicals is not documented publicly; shown simplified.',
  }, [mesh(merge(tsm), FM.teWhite()), mesh(merge(tsmLines), FM.water()), mesh(merge(hood), hoodMat)], base);

  // pad EGSE room: like the shuttle-era Pad Terminal Connection Room, a reinforced concrete room on
  // the west side of the trench under the hardstand fill (the hardstand ghosts in X-ray to show it)
  const bayY = H - 6.1;                                   // under ≈ 20 ft of fill
  const bay = [block(-14.0, bayY - 1.5, 0, 6.0, 3.0, 3.0)];
  const bayKit = [];
  for (const dz of [-0.9, 0, 0.9]) bayKit.push(block(-12.2, bayY - 1.6, dz, 0.6, 2.2, 0.7), block(-15.8, bayY - 1.6, dz, 0.6, 2.2, 0.7));   // equipment racks
  bayKit.push(block(-11.6, bayY - 1.0, 1.0, 0.5, 0.6, 0.6));                               // junction box on the east wall
  bayKit.push(pipe([[-11.6, bayY - 0.7, 1.0], [-11.6, H - 0.6, 0.8], [-11.2, H - 0.05, -0.6], [-11.0, H + 0.05, -1.5]], 0.06, { seg: 6, tubular: 12, tension: 0.05 }));   // conduit up to the pad surface
  G('Pad instrumentation bay', {
    material: 'Reinforced concrete room with equipment racks and a junction box', mass: null,
    desc: 'Customer payload ground equipment sits in an instrument bay beneath the pad deck (Falcon User\'s Guide), linked through a junction box and a ground harness to the transporter-erector; at LC-39A the cable run from the racks to the spacecraft is 196 m (644 ft). Shown as a room under the hardstand fill west of the trench, where the shuttle-era Pad Terminal Connection Room was (NASA LC-39 fact sheet); size estimated.',
  }, [mesh(merge(bay), FM.hardstand()), mesh(merge(bayKit), FM.padSteel())], bed);

  // ------------------------------------------------------------------ transporter-erector
  // The TE rides rails up the old crawlerway ramp from SpaceX's hangar. Like the Apollo crawler it
  // straddles the flame trench: its two tracks run on the hardstand either side of the trench, and
  // girders bridge the trench under the strongback hinge and the erector cylinders.
  const zb = -4.5, zf = -6.9, top = STACK0 + 61;
  const levels = [];
  for (let y = DECK; y <= top + 0.01; y += 3.0) levels.push(y);
  const te = truss(-1.6, zf, 3.2, zb - zf, levels, { col: 0.42, hor: 0.26, diag: 0.2, mid: false });
  G('Transporter-erector strongback', {
    material: 'Steel lattice strongback', mass: null,
    desc: 'The ≈ 212 ft spine of SpaceX\'s transporter-erector: it carries the integrated vehicle horizontally from the hangar, raises it onto the launch mount and then stands as its umbilical tower, carrying the arms, lines and ground harness. It is retracted a few degrees just before launch (Falcon User\'s Guide).',
  }, mesh(merge(te), FM.teWhite()));

  const tb = [block(0, DECK + 0.6, (zb + zf) / 2, 4.2, 1.2, 2.6)];                  // base block under the strongback
  for (const sx of [1, -1]) {
    tb.push(block(sx * 1.9, DECK + 0.7, zb + 0.1, 0.7, 1.4, 0.9));                     // erector hinge
    tb.push(block(sx * 1.9, DECK - 0.75, -4.56, 0.8, 1.3, 0.32));                      // hinge bracket on the mount's deck face
    tb.push(block(sx * RAIL_X, H + 0.98, -12.5, 0.8, 0.9, 14.5));                      // side girder over the trucks
    for (const z of [-6.4, -12.5, -18.6]) tb.push(block(sx * RAIL_X, H + 0.35, z, 1.9, 0.36, 1.6));   // rail trucks
    tb.push(beam([sx * 2.0, DECK + 0.1, -6.6], [sx * (RAIL_X - 0.3), H + 1.3, -6.6], 0.5, 0.5));
    tb.push(beam([sx * 2.0, DECK + 0.1, -5.0], [sx * (RAIL_X - 0.3), H + 1.3, -9.0], 0.4, 0.4));
  }
  for (const z of [-6.6, -16]) tb.push(beam([-RAIL_X, H + 1.0, z], [RAIL_X, H + 1.0, z], 0.9, 1.0));   // girders bridging the trench
  G('TE base frame & erector hinges', {
    material: 'Steel base frame on rail trucks, trench-spanning girders, strongback hinges', mass: null,
    desc: 'The strongback pivots on hinges bolted to the edge of the launch mount. Its base frame stands on rail trucks either side of the flame trench, the way the Apollo crawler straddled it, with two girders bridging the trench under the hinge and the erector cylinders. Layout estimated.',
  }, mesh(merge(tb), FM.teWhite()));

  const cyl = [];
  for (const sx of [1, -1]) {
    const b0 = new THREE.Vector3(sx * 2.6, H + 2.0, -16), b1 = new THREE.Vector3(sx * 1.7, STACK0 + 16, zf + 0.2);
    cyl.push(rod(b0.toArray(), b1.toArray(), 0.34, 12));                                                // ram
    cyl.push(rod(b0.toArray(), b0.clone().lerp(b1, 0.45).toArray(), 0.5, 14));                           // barrel
    cyl.push(block(sx * 2.6, H + 1.75, -16, 1.6, 0.5, 1.6));                                             // trunnion base on the girder
    cyl.push(block(sx * 1.7, STACK0 + 16, zf + 0.15, 0.8, 0.9, 0.6));                                   // clevis on the strongback
  }
  G('TE erector cylinders', {
    count: 2, material: 'Hydraulic erector cylinders, Ø ≈ 0.7 m barrels, trunnion bases', mass: null,
    desc: 'Two long hydraulic cylinders rotate the strongback and the integrated vehicle from horizontal to vertical in minutes. The vehicle is normally erected only once per campaign; after a scrub it stays vertical on the pad (Falcon User\'s Guide).',
  }, mesh(merge(cyl), FM.padSteel()));

  // second-stage umbilical arm and the vehicle clamp arms
  // each arm roots on a cross beam between the strongback's front columns and its two beams run
  // into the cradle ring
  const armAt = (ys, wrap, list) => {
    const y = STACK0 + ys;
    list.push(beam([-1.6, y, zb], [1.6, y, zb], 0.34, 0.56));
    list.push(beam([-0.9, y, zb], [-0.7, y, -R - 0.12], 0.32, 0.5), beam([0.9, y, zb], [0.7, y, -R - 0.12], 0.32, 0.5));
    const g = new THREE.TorusGeometry(R + 0.18, 0.1, 6, 24, wrap);
    g.rotateX(Math.PI / 2); g.rotateY(Math.PI / 2 + wrap / 2);       // centred on −z, facing the strongback
    g.translate(0, y, 0);
    list.push(g);
    return y;
  };
  const s2arm = [];
  const yS2 = armAt(49.9, 1.2, s2arm);
  s2arm.push(block(0, yS2, -R - 0.12, 0.9, 0.7, 0.2));                                   // carrier plate on the stage's T-0 disconnect
  G('TE second-stage umbilical arm', {
    material: 'Steel arm, quick-disconnect carrier plate', mass: null,
    desc: 'Holds the ground half of the second stage\'s T-0 quick disconnect: RP-1 and LOX fill and drain, helium, nitrogen, power, data and the payload harness. The plate pulls away as the vehicle rises.',
  }, mesh(merge(s2arm), FM.padSteel()));
  const clampArms = [];
  for (const [ys, wrap] of [[56.2, 1.0], [44.0, 0.8]]) {
    const y = armAt(ys, wrap, clampArms);
    clampArms.push(block(0, y, -R - 0.12, 0.7, 0.5, 0.16));                              // padded clamp shoe
  }
  G('TE clamp arms', {
    count: 2, material: 'Steel arms with padded clamp shoes', mass: null,
    desc: 'Cradle the stack against the strongback while it is horizontal and during erection, at the interstage and the top of the second stage, and steady it against the wind on the pad.',
  }, mesh(merge(clampArms), FM.padSteel()));

  const lines = [];
  for (const [x, r] of [[-0.48, 0.1], [-0.17, 0.14], [0.15, 0.12], [0.44, 0.09]]) {
    lines.push(pipe([[x, DECK + 1.2, zb + 0.1], [x, STACK0 + 30, zb + 0.15], [x, yS2 - 0.7, zb + 0.15], [x * 0.8, yS2 - 0.5, zb + 1.1], [x * 0.42, yS2 - 0.22, -R - 0.27]], r, { seg: 8, tubular: 60 }));
  }
  G('TE propellant & gas lines', {
    count: 4, material: 'Vacuum-jacketed LOX line, RP-1, helium and nitrogen lines', mass: null,
    desc: 'Run up the strongback from the base to the second-stage arm: LOX, RP-1, helium and nitrogen for the second stage. They come from the propellant farm through the base frame; the first stage is fed at its base. Line sizes estimated.',
  }, mesh(merge(lines), FM.water()));

  // the centre core's base umbilical: a carrier from the TE base to its T-0 plate (the routing on
  // the Falcon Heavy mount is not published)
  const t0y = STACK0 + T0_Y;
  const carrier = [block(0, t0y, -R - 0.2, 1.2, 0.8, 0.2)];
  for (const sx of [1, -1]) carrier.push(beam([sx * 0.5, DECK + 0.45, -4.4], [sx * 0.45, t0y - 0.25, -R - 0.32], 0.2, 0.3));
  const carrierLines = [];
  for (const [x, r] of [[-0.42, 0.1], [-0.21, 0.08], [0, 0.04], [0.21, 0.05], [0.42, 0.03]]) {
    carrierLines.push(pipe([[x, DECK + 0.25, -4.4], [x, DECK + 0.55, -3.2], [x, t0y - 0.1, -R - 0.32]], r, { seg: 6, tubular: 12 }));
  }
  G('TE centre-core base umbilical', {
    count: 5, material: 'Carrier plate on a short arm; LOX, RP-1, helium, nitrogen and TEA-TEB lines, power and data', mass: null,
    desc: 'The ground half of the centre core\'s T-0 plate. Spaceflight Now (2010) listed LOX, kerosene, helium, gaseous nitrogen and the TEA-TEB igniter fluid among the supplies at Falcon\'s first-stage T-0 connections; the carrier drops away at liftoff. Its routing on the Falcon Heavy mount is not published: estimated.',
  }, [mesh(merge(carrier), FM.padSteel()), mesh(merge(carrierLines), FM.water())]);

  // the ground harness: J-box on the base frame, up the strongback to the second-stage plate
  const gh = [block(-1.4, DECK + 1.5, -6.4, 0.6, 0.6, 0.5),
    pipe([[-11.0, H + 0.05, -1.5], [-11.0, H + 0.06, -4.8], [-10.4, H + 1.0, -5.9], [-9.6, H + 1.56, -6.3], [-6, H + 1.56, -6.3], [-1.6, H + 1.56, -6.3], [-1.45, DECK + 0.2, -6.3]], 0.05, { seg: 6, tubular: 40, tension: 0.05 }),
    pipe([[-1.4, DECK + 1.5, -6.1], [-1.25, DECK + 1.9, -4.3], [-1.25, DECK + 3, zb + 0.45], [-1.25, yS2 - 1.0, zb + 0.45], [-1.15, yS2 - 0.55, zb + 0.9], [-0.42, yS2 - 0.15, -R - 0.27]], 0.05, { seg: 6, tubular: 50, tension: 0.05 })];
  G('TE ground harness', {
    material: 'Shielded cable bundles, connector box on the TE base', mass: null,
    desc: 'The junction box in the instrumentation bay connects to the transporter-erector through a ground harness, and a harness runs the length of the TE to the second-stage T-0 quick disconnect, whose flight side feeds up to four payload harnesses (Falcon User\'s Guide). Routing estimated.',
  }, mesh(merge(gh), FM.cable()));

  // payload air conditioning: the pad plant's duct comes up the strongback to the fairing inlet
  const [ix, iz] = polar(2.73, 280);
  const yAc = STACK0 + 60.4;
  const acx = 1.25, acz = -4.05;
  const ac = [pipe([[ix, yAc, iz], [ix + 0.2, yAc, iz - 0.5], [acx - 0.15, yAc - 0.15, acz + 0.35], [acx, yAc - 0.6, acz], [acx, STACK0 + 30, acz], [acx, DECK + 2.2, acz], [acx, DECK + 1.45, -4.6], [acx, DECK + 1.3, -5.3]], 0.15, { seg: 12, tubular: 90, tension: 0.05 })];
  ac.push(block(acx, DECK + 1.45, -5.6, 0.7, 0.5, 0.7));                                  // connection to the ground duct
  const acd = G('TE payload air-conditioning duct', {
    system: 'Environmental control', material: 'Flexible insulated air duct, Ø ≈ 0.3 m', mass: null,
    desc: 'Once the vehicle is at the pad the payload air conditioning is reconnected through this duct, keeping the encapsulated spacecraft at 15.6–30 °C in Class 7 (10,000) clean air through liftoff (Falcon User\'s Guide). It is disconnected only briefly during rollout. Routing estimated.',
  }, mesh(merge(ac), FM.blanket()));
  acd.userData.part.temp = 293;

  // rails: two tracks straddling the trench, on the hardstand and down the ramp
  const rampL = H / Math.tan((2.9 * Math.PI) / 180);       // 2.9°: the steepest incline the vehicle sees
  const zRamp0 = -TZ, zRamp1 = -TZ - rampL;
  const rampY = (z) => (z >= zRamp0 ? H : Math.max(0, H - (zRamp0 - z) * Math.tan((2.9 * Math.PI) / 180)));
  const rails = [], railBed = [];
  for (const sx of [1, -1]) {
    for (const dx of [-GAUGE / 2, GAUGE / 2]) {
      const x = sx * RAIL_X + dx;
      rails.push(block(x, H + 0.11, (-5 + zRamp0) / 2, 0.08, 0.14, -5 - zRamp0));
      const g = new THREE.BoxGeometry(0.08, 0.14, rampL + 0.4);
      g.rotateX(-Math.atan(H / rampL));
      g.translate(x, H / 2 + 0.11, (zRamp0 + zRamp1) / 2);
      rails.push(g);
    }
    for (let z = -5.6; z > zRamp0; z -= 1.2) railBed.push(block(sx * RAIL_X, H + 0.02, z, GAUGE + 0.6, 0.06, 0.3));   // ties on the pad
  }
  const ramp = [], rampSide = [];
  for (const sx of [1, -1]) {
    const top0 = [], top1 = [], side1 = [], wall0 = [];
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const z = zRamp0 - (rampL * i) / N, y = rampY(z) + 0.02;
      top0.push([sx * (W + 0.25), y, z]); top1.push([sx * (RAIL_X + 3.2), y, z]);
      side1.push([sx * (RAIL_X + 3.2 + 1.5 * y), 0.02, z]);
      wall0.push([sx * (W + 0.25), 0.02, z]);
    }
    ramp.push(ribbon(top0, top1, new THREE.Vector3(sx * 11, -100, -140)));
    rampSide.push(ribbon(top1, side1, new THREE.Vector3(sx * 6, -50, -140)));
    ramp.push(ribbon(wall0, top0, new THREE.Vector3(sx * 40, 4, -140)));
  }
  const rp = G('TE rails & ramp', {
    count: 2, material: 'Steel rails on concrete, the Apollo / Shuttle crawlerway ramp', mass: null,
    desc: 'The transporter-erector rides rails up the old crawlerway ramp from SpaceX\'s hangar at the foot of the pad; the steepest incline the integrated vehicle sees on the way is 2.9° (Falcon User\'s Guide), so the ramp runs ≈ 250 m from the pad down to grade. The tracks straddle the flame trench as the crawler\'s did; rail spacing estimated.',
  }, [mesh(merge(rails), FM.padSteel()), mesh(merge(railBed), FM.hardstand()), mesh(merge(ramp), FM.hardstand()), mesh(merge(rampSide), FM.embankment())]);
  rp.traverse((o) => { if (o.isMesh) noFrame(o); });


  // ------------------------------------------------------------------ fixed service structure + crew access arm
  const fx0 = -24.2, fz0 = -17.4, fw = 12.2;           // west of the TE's west track
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
  const wd = [], rings = [];
  for (const x of [-BOOSTER_X, 0, BOOSTER_X]) rings.push(hoop(2.25, 0.07, DECK + 0.08, { x, seg: 48, tube: 6 }));
  G('Deck water-spray rings', {
    count: 3, material: 'Perforated steel spray rings round the exhaust openings', mass: null,
    desc: 'Ring the three exhaust openings on the mount deck and spray water across them at ignition, the first layer of the sound-suppression deluge. Ring size estimated.',
  }, mesh(merge(rings), FM.water()), base);
  for (const [x, z] of [[13, 8], [-13, 8], [13, -9], [-19, 2]]) {
    wd.push(post(x, z, H, H + 3.4, 0.32, 12));
    wd.push(pipe([[x, H + 3.2, z], [x * 0.94, H + 3.9, z * 0.92], [x * 0.86, H + 4.0, z * 0.86]], 0.28, { seg: 10, tubular: 8 }));
    wd.push(pipe([[x, H + 0.3, z], [x, H + 0.3, z + Math.sign(z) * 8], [x * 1.5, H + 0.3, z + Math.sign(z) * 8]], 0.3, { seg: 8, tubular: 16, tension: 0 }));
  }
  G('Water deluge & sound suppression', {
    material: 'Steel headers and "rainbird" nozzles', mass: null,
    desc: 'At ignition water floods the mount, the trench and the deck from big rainbird nozzles fed by these headers. Turning to steam absorbs heat and damps the acoustic energy that would otherwise reflect back onto the vehicle. The water is stored in the pad\'s 290 ft water tower.',
  }, mesh(merge(wd), FM.water()));

  // ------------------------------------------------------------------ lightning protection, water tower, propellant farm
  // These reach far beyond the hardstand, so they are left out of the vehicle's framing (noFrame).
  const fssTop = fl[fl.length - 1];
  const fx = fx0 + fw / 2, fz = fz0 + fw / 2;
  const mastGeo = merge([post(fx, fz, fssTop, fssTop + 6, 0.9, 12, 0.5), post(fx, fz, fssTop + 6, fssTop + 30.5, 0.5, 10, 0.18)]);
  const wire = (a, b, sag) => {
    const pts = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48; const p = new THREE.Vector3().lerpVectors(a, b, t); p.y -= sag * 4 * t * (1 - t); pts.push(p); }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.09, 4, false);
  };
  const tip = new THREE.Vector3(fx, fssTop + 30.5, fz);
  const anchors = [1, -1].map((s) => block(fx, 0.8, fz + s * 335, 3.0, 1.6, 3.0));
  const lp = G('Lightning mast & catenary wire', {
    material: 'Fibreglass mast on the tower roof, one-inch stainless-steel cable, concrete anchors', mass: null,
    desc: 'The pad\'s overhead-wire lightning protection (Falcon User\'s Guide): an 80 ft fibreglass mast on the tower roof, 347 ft above the ground at its tip, carries a one-inch stainless-steel cable from an anchor south of the tower up over the mast and down to an anchor to the north (NASA LC-39 fact sheet). It gives a strike a preferred path, so lightning neither attaches to the vehicle and ground systems nor side-flashes to them.',
  }, [mesh(mastGeo, new THREE.MeshStandardMaterial({ color: 0xd9d4c6, roughness: 0.7, metalness: 0.05 }), { cast: false }),
    mesh(merge([wire(tip, new THREE.Vector3(fx, 1.6, fz + 335), 22), wire(tip, new THREE.Vector3(fx, 1.6, fz - 335), 22)]), FM.black(), { cast: false }),
    mesh(merge(anchors), FM.hardstand(), { cast: false })]);
  lp.traverse((o) => { if (o.isMesh) noFrame(o); });

  const white = new THREE.MeshStandardMaterial({ color: 0xe7e8e4, roughness: 0.55, metalness: 0.1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b9096, metalness: 0.7, roughness: 0.5 });
  const wt = [post(-110, -150, 70, 88, 9, 32), new THREE.ConeGeometry(9.4, 3.2, 32).translate(-110, 89.6, -150)];
  const legsW = [];
  for (let k = 0; k < 6; k++) { const [x, z] = polar(10, k * 60); const [x1, z1] = polar(7, k * 60); legsW.push(beam([-110 + x, 0, -150 + z], [-110 + x1, 70, -150 + z1], 0.9, 0.9)); }
  G('Water tower', {
    material: 'Elevated steel water tank on a braced tower', mass: null,
    desc: 'Holds 300,000 gallons on a 290 ft tower (NASA LC-39 fact sheet), enough head for the deluge to reach full flow within seconds of ignition. Position compressed.',
  }, [mesh(merge(wt), white, { cast: false }), mesh(merge(legsW), steel, { cast: false })]).traverse((o) => { if (o.isMesh) noFrame(o); });

  // kept behind the tower, on the right of the default view, so they never sit under the hero text
  const LOXS = [-30, -160, 9.33];
  const sl = [];
  for (let k = 0; k < 8; k++) { const [a, b] = polar(LOXS[2] * 0.8, k * 45); sl.push(beam([LOXS[0] + a, 0, LOXS[1] + b], [LOXS[0] + a * 1.05, LOXS[2] + 3, LOXS[1] + b * 1.05], 0.5, 0.5)); }
  G('LOX storage sphere', {
    material: 'Double-walled vacuum-insulated sphere on steel columns', mass: null,
    desc: 'The Apollo-era liquid-oxygen sphere holds about 900,000 US gallons (≈ 3,400 m³, ≈ 18.7 m across). It works as a huge vacuum bottle, keeping the LOX below −183 °C, and pumps of 1,300 gal/min move it to the pad through vacuum-jacketed lines (NASA LC-39 fact sheet). It stands on the pad\'s north-west corner; the position here is compressed.',
  }, [mesh(new THREE.SphereGeometry(LOXS[2], 40, 24).translate(LOXS[0], LOXS[2] + 3, LOXS[1]), white, { cast: false }), mesh(merge(sl), steel, { cast: false })]).traverse((o) => { if (o.isMesh) noFrame(o); });

  const rpT = [], rpS = [];
  for (const dx of [-6, 0, 6]) {
    const g = new THREE.CapsuleGeometry(2.4, 13.2, 6, 24); g.rotateX(Math.PI / 2); g.translate(60 + dx, 3.4, -150); rpT.push(g);
    for (const dz of [-5.5, 0, 5.5]) rpS.push(block(60 + dx, 0.6, -150 + dz, 3.6, 1.2, 0.8));
  }
  G('RP-1 storage tanks', {
    material: 'Horizontal steel tanks on saddles', mass: null,
    desc: 'Kerosene for both stages is stored in a tank farm on the pad perimeter and pumped to the vehicle through the transporter-erector. SpaceX\'s RP-1 storage at LC-39A is not described publicly: count, size and position estimated.',
  }, [mesh(merge(rpT), white, { cast: false }), mesh(merge(rpS), FM.hardstand(), { cast: false })]).traverse((o) => { if (o.isMesh) noFrame(o); });

  const gb = [], gf = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const g = new THREE.CylinderGeometry(0.6, 0.6, 12, 16); g.rotateX(Math.PI / 2); g.translate(116 + i * 1.5, 1.4 + j * 1.4, -85); gb.push(g);
  }
  for (const dz of [-5, 0, 5]) gf.push(block(118.25, 2.3, -85 + dz, 6.6, 4.6, 0.3));
  G('Helium & nitrogen storage', {
    material: 'High-pressure gas storage tubes in steel frames', mass: null,
    desc: 'Helium for the tanks, COPVs and pneumatic systems and nitrogen for purges and the cold-gas thrusters are stored as high-pressure gas in banks of tubes and fed to the transporter-erector. Layout estimated.',
  }, [mesh(merge(gb), steel, { cast: false }), mesh(merge(gf), FM.padSteel(), { cast: false })]).traverse((o) => { if (o.isMesh) noFrame(o); });

  // trunk lines: from the farm onto the east ramp, up it beside the rails, along the pad and over a
  // pipe bridge into the TE base (vacuum-jacketed LOX, RP-1, nitrogen, helium; routing estimated)
  const onRamp = (x, z, r) => [x, rampY(z) + r + 0.15, z];
  const trunk = [];
  const run = (pts, r) => {
    for (let i = 1; i < pts.length; i++) trunk.push(rod(pts[i - 1], pts[i], r, 10));
    for (let i = 1; i < pts.length - 1; i++) trunk.push(new THREE.SphereGeometry(r * 1.02, 10, 6).translate(...pts[i]));
  };
  const toPad = (x, z0, r, yb) => {
    const pts = [];
    for (const z of [z0, -120, -80, -50, -23]) if (z >= z0) pts.push(onRamp(x, z, r));
    pts.push([x, H + r + 0.15, -8.5], [x, yb, -8.5], [2.4, yb, -8.5], [1.6, yb, -6.9]);
    return pts;
  };
  const toe = (z) => RAIL_X + 3.2 + 1.5 * rampY(z);
  run([[LOXS[0], 3.0, LOXS[1]], [LOXS[0], 0.55, LOXS[1]], [-20, 0.55, -152], [toe(-152), 0.55, -152], [RAIL_X + 3.25, rampY(-152) + 0.55, -152], ...toPad(11.45, -152, 0.25, 19.05)], 0.25);
  run([[54, 1.2, -148], [toe(-148), 0.35, -148], [RAIL_X + 3.25, rampY(-148) + 0.35, -148], ...toPad(11.95, -148, 0.15, 19.55)], 0.15);
  run([[116, 0.4, -86], [toe(-86), 0.25, -86], [RAIL_X + 3.25, rampY(-86) + 0.25, -86], ...toPad(12.25, -86, 0.06, 19.78)], 0.06);
  run([[116, 0.4, -84], [toe(-84), 0.25, -84], [RAIL_X + 3.25, rampY(-84) + 0.25, -84], ...toPad(12.45, -84, 0.05, 19.93)], 0.05);
  const tl = G('Propellant & gas trunk lines', {
    count: 4, material: 'Vacuum-jacketed LOX line, RP-1 line, nitrogen and helium lines on sleepers', mass: null,
    desc: 'Carry LOX, RP-1, nitrogen and helium from the farm up the ramp beside the rails and over a pipe bridge into the transporter-erector\'s base, which feeds the first stage at its base and the second stage up the strongback. Routing estimated.',
  }, mesh(merge(trunk), FM.water()));
  tl.traverse((o) => { if (o.isMesh) noFrame(o); });

  return { deckTop: DECK };
}
