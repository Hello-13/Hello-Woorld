// GPS III dimensions shared by the model, its layout and the tests. No three.js here, so node --test
// can import it (kit.js re-exports everything for the building modules).
//
// Axes (metres): the GPS spacecraft body frame used by the IGS. +Z points at the Earth (nadir, the
// L-band antenna side), +Y runs along the solar-array axis (the two radiator / equipment panels),
// +X completes the right-handed set and faces the Sun's hemisphere under yaw steering. Origin at
// the centre of the bus box. Lockheed Martin's own axes are turned 180° about Z from these, so a
// unit Lockheed places on its "−Y" panel is on +Y here, and its "−X" side is +X here.
//
// Size: the U.S. Space Force fact sheet gives 97 × 70 × 134 in (2.46 × 1.78 × 3.40 m). In the
// manufacturer's scale model, photographed face by face in IGS axes (Steigenberger et al. 2020,
// Fig. 4), the ±Y radiator faces are the wider ones, and the IGS box-wing model gives an X face
// (7.5 m²) almost twice the Z face (4.0 m²). So X (Sun axis) = 2.46 m, Y (array axis) = 1.78 m, and
// the box is 3.40 m tall from the aft deck to the Earth deck; the launch adapter section below it
// and the antennas above it bring the stowed height to about 4.2 m.

export const BX = 2.46, BY = 1.78, BZ = 3.40;         // bus box (fact sheet; axes see above)
export const HX = BX / 2, HY = BY / 2, HZ = BZ / 2;
export const T = 0.025;                               // honeycomb panel thickness
export const CORE = 0.50;                             // half-width of the core box section (estimate: about 1.0 × 1.0 m)
export const BAY = 0.50;                              // the ±X tank bays run |y| < 0.5 between the shear webs
export const IX = HX - T, IY = HY - T, IZ = HZ - T;   // inner faces of the closure panels
export const DECK = HZ + 0.012;                       // top of the Earth-deck blanket
export const AFT = -HZ - 0.013;                       // outer face of the aft-deck blanket
export const ADAPTER = { r: 0.85, z0: -HZ, z1: -2.12 };   // launch adapter section (scale model: ≈ 1.7 m across, 0.5 m tall)
export const SEP_Z = -2.12;                           // top of the separation ring; the separation plane is its base
export const SADA_C = [0.1, -0.37];                   // solar-array drive axis (x, z) on both ±Y faces (scale model)

// Propellant and pressurant tanks (A2100 dual mode, Wikipedia "Lockheed Martin A2100"): one central
// hydrazine tank 0.90 m across and up to 2.0 m long on the Z axis inside the core; two nitrogen
// tetroxide tanks 0.54 m across and up to 1.65 m long, one in each ±X bay; two helium tanks above
// them (helium size and position estimated).
export const FUEL = { c: [0, 0, 0.1], r: 0.45, L: 2.0 };
export const OX = { x: 0.85, z: -0.6, r: 0.27, L: 1.5 };
export const HE = { x: 0.86, z: 0.75, r: 0.24 };

// Solar array: two wings of two panels ("2-panel Solar Array Wing (2 places)", Lockheed), four panels
// of 28.2 m² in all (IGS box-wing model). Panel and yoke sizes are estimates: the panel length is set
// so the folded stack covers the 2.46 m-wide face and the yoke reaches from the drive to the face's
// edge, which gives a 14.6 m span against the 15 m published.
export const SADA_L = 0.15;          // drive stand-off from the radiator face
export const YOKE_L = 1.33;          // yoke reach
export const PANEL_L = 2.45;         // panel length along the span
export const PANEL_W = 2.88;         // panel width (along the bus Z axis); 4 × 2.45 × 2.88 m = 28.2 m²
export const PANEL_T = 0.025;
export const GAP = 0.02;             // hinge gap between panels
export const ARRAY_SPAN = 2 * HY + 2 * (SADA_L + YOKE_L + 2 * PANEL_L + 2 * GAP);
export const ARRAY_AREA = 4 * PANEL_L * PANEL_W;
