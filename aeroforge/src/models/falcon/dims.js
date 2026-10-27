// Falcon Heavy station plan (metres). Stack frame: y up from the centre-core Merlin nozzle exit
// plane, side boosters on ±x, z toward the camera side. Diameters, the overall 70 m height,
// 12.2 m width, the 4.5 m interstage and the 13.2 m × 5.2 m fairing are published figures (SpaceX;
// Espace & Exploration no. 51 via Wikipedia's specification table: first-stage core 42.6 m,
// interstage 4.5 m, second stage 12.6 m, fairing 13.2 m). The station heights in between are
// estimates sized from the published propellant loads (per core 287.4 t LOX + 123.5 t RP-1, second
// stage 75.2 t + 32.3 t; densified LOX ≈ 1,240 kg/m³, chilled RP-1 ≈ 830 kg/m³) and from
// photographs. The first stage runs 43.1 m from the nozzle exits to the interstage (0.5 m over the
// published 42.6 m, so that the separation plane stays where the 70 m overall height puts it): the
// LOX tank's forward skirt carries the interstage and, on the centre core, the forward booster
// attach fittings. The Merlin Vacuum's nozzle hangs 4.5 m into the interstage.

export const R = 1.83;                 // 3.66 m core and second-stage diameter
export const BOOSTER_X = 4.27;         // side-booster axis offset → 2 × 4.27 + 3.66 = 12.2 m overall width
export const ENGINE_RING = 1.3;        // radius of the eight outer Merlin 1D on the Octaweb

export const Y = {
  nozzleExit: 0,
  throat: 1.18,
  heatShield: 1.3,        // bottom of the engine section
  engineTop: 2.0,         // Merlin gimbal block
  engSectionTop: 3.6,     // top of the Octaweb / RP-1 tank aft equator
  domeDepth: 0.8,         // ellipsoidal bulkhead depth (estimate)
  commonDome: 17.6,       // RP-1 / LOX common bulkhead equator (≈ 146 m³ of RP-1 below, ≈ 240 m³ of LOX above)
  loxTop: 39.6,           // LOX barrel top (forward dome equator)
  s1Top: 43.1,            // top of the LOX tank's forward skirt (estimate; see above)
  fwdAvionics: 42.4,      // first-stage avionics ring in the forward skirt, above the forward dome
  interTop: 47.6,         // top of the 4.5 m interstage = stage-separation plane
  // side boosters
  adapterTop: 45.1,       // booster forward section (grid fins, thrusters), 2 m long (estimate)
  noseTip: 51.3,
  // second stage
  s2AftSkirt: 48.35,      // aft dome equator (the dome's bottom clears the separation plane)
  s2DomeDepth: 0.65,
  s2CommonDome: 52.0,
  s2LoxTop: 56.8,
  s2Top: 57.6,
  mvacExit: 43.1,         // MVac exit: a ≈ 2.75 m niobium extension below the joint (estimate)
  // payload section
  fairingBase: 56.9,
  pafTop: 58.3,
  fairingTop: 70.0,
};

// Ground frame (the pad group): y = 0 at the foot of the hardstand / flame-trench floor.
export const PAD = {
  hardstand: 12.8,        // 42 ft: LC-39A flame-trench depth below the pad surface
  mountDeck: 6.0,         // launch-mount deck above the pad surface (estimate)
  trenchHalfWidth: 8.84,  // 58 ft wide trench
};
// world height of the stack frame's y = 0 when the vehicle stands on the mount
// (the heat shield sits on the mount deck, the nozzles hang into the exhaust openings)
export const STACK0 = PAD.hardstand + PAD.mountDeck - Y.heatShield;
// stack-frame height where the tail-service-mast umbilicals meet the side boosters
export const T0_Y = 3.3;

/** [x, z] on a circle of radius r at azimuth a (degrees, from +x toward +z). */
export function polar(r, aDeg) {
  const a = (aDeg * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
