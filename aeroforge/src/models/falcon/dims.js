// Falcon Heavy station plan (metres). Stack frame: y up from the centre-core Merlin nozzle exit
// plane, side boosters on ±x, z toward the camera side. Diameters, the overall 70 m height,
// 12.2 m width and the 13.1 m × 5.2 m fairing are SpaceX figures; the station heights in between
// are estimates sized from the published propellant loads (per core 287.4 t LOX + 123.5 t RP-1,
// second stage 75.2 t + 32.3 t; densified LOX ≈ 1,240 kg/m³, chilled RP-1 ≈ 830 kg/m³) and from
// photographs. Published second-stage lengths disagree (13.8 m in the Falcon 9 stage table,
// 12.6 m in the Falcon Heavy one); the plan uses 13.8 m from the MVac exit to the stage top.

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
  s1Top: 41.0,            // top of the first-stage forward skirt
  interTop: 47.6,         // top of the interstage = stage-separation plane
  // side boosters
  adapterTop: 43.0,       // booster forward section (grid fins, thrusters, forward attach), 2 m long
  noseTip: 49.2,
  // second stage
  s2AftSkirt: 48.35,      // aft dome equator (the dome's bottom clears the separation plane)
  s2DomeDepth: 0.65,
  s2CommonDome: 52.0,
  s2LoxTop: 56.8,
  s2Top: 57.6,
  mvacExit: 43.8,         // 13.8 m below the stage top
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
