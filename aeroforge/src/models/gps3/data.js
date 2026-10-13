// GPS III mission and spacecraft figures shared by the model, the orbital-transfer lab and the
// tests. Plain data (no Three.js) so Node can import it.
//
// Published (U.S. Space Force GPS III fact sheet): launch weight 8,115 lb, on-orbit weight
// 4,764 lb, size 97 × 70 × 134 in, 15-year design life. Also published: orbit, end-of-life power,
// signal plan. Lockheed Martin's 2014 fact sheet quoted 3,880 kg at launch, and the masses reported
// for individual launches run higher still (≈ 4,300–4,400 kg), so the propellant load varies by
// mission; this model uses the Space Force figures.
// Estimated (not in public sources): the fuel/oxidiser split (within the A2100 tank maxima of 1,368 kg
// of hydrazine and 627 kg of oxidiser), the identity of the apogee engine (LEROS 1c figures used), and
// the Falcon 9 transfer-orbit perigee.

export const GPS3 = {
  launchMass: 3681,          // kg — 8,115 lb, USSF fact sheet
  dryMass: 2161,             // kg — 4,764 lb "on-orbit weight", USSF fact sheet; used as the dry mass
                             //      (the true dry mass is a little lower: it still holds the reserve)
  get propellant() { return this.launchMass - this.dryMass; },   // 1,520 kg loaded
  fuelLoad: 900,             // kg hydrazine (estimate: apogee-engine share at O/F ≈ 0.85 plus thruster reserve)
  oxLoad: 620,               // kg nitrogen tetroxide (estimate)
  laeThrust: 460,            // N — LEROS 1c, the A2100's apogee engine (hydrazine / MON); GPS III's is given only as a
                             //      "100-lb" (445 N) apogee engine, so "LEROS-1c class (unconfirmed)"
  laeIsp: 325,               // s — LEROS 1c (Moog / Nammo data via Wikipedia "LEROS")
  rcsIsp: 225,               // s — catalytic hydrazine monopropellant thrusters (typical)
  thrusterLarge: 22,         // N — the "5-lbf" thrusters for large on-orbit manoeuvres (Marquis & Shaw 2011)
  thrusterSmall: 0.9,        // N — the "0.2-lbf" thrusters for attitude and station-keeping
  designLife: 15,            // years
  altitude: 20180,           // km, nominal circular MEO altitude (semi-major axis ≈ 26,560 km)
  inclination: 55,           // degrees
  powerEOL: 4480,            // W at end of life
  size: [2.46, 1.78, 3.40],  // m — 97 × 70 × 134 in (USSF fact sheet): X (Sun axis) × Y (array axis) × Z
  arraySpan: 15,             // m tip to tip (Steigenberger et al. 2020, Table 1)
  arrayArea: 28.2,           // m² — IGS box-wing model (307 ft² ≈ 28.5 m² reported)
  transferPerigee: 400,      // km — Falcon 9 transfer orbit for SV01 (~400 × 20,200 km, Spaceflight Now; approximate)
  clockHz: 10.23e6,          // fundamental frequency every GPS signal is a multiple of
  signals: {                 // MHz = multiple × 10.23 MHz
    L1: [1575.42, 154], L2: [1227.6, 120], L3: [1381.05, 135], L5: [1176.45, 115],
  },
};
