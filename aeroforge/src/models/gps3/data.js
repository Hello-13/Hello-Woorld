// GPS III mission and spacecraft figures shared by the model, the orbital-transfer lab and the
// tests. Plain data (no Three.js) so Node can import it.
//
// Published: launch mass, dry mass, design life, orbit, end-of-life power, signal plan.
// Estimated (not in public fact sheets): the fuel/oxidiser split, the apogee engine's thrust and
// specific impulse, and the Falcon 9 transfer-orbit perigee.

export const GPS3 = {
  launchMass: 3880,          // kg — figure quoted for GPS III (Wikipedia / Lockheed Martin); 3,680–4,400 kg reported per launch
  dryMass: 2269,             // kg
  get propellant() { return this.launchMass - this.dryMass; },   // 1,611 kg loaded at 3,880 kg
  fuelLoad: 940,             // kg hydrazine (estimate: LAE share at O/F ≈ 0.85 plus thruster reserve)
  oxLoad: 671,               // kg nitrogen tetroxide (estimate)
  laeThrust: 450,            // N — 450 N-class bipropellant apogee engine (A2100 family; GPS III engine not named publicly)
  laeIsp: 320,               // s — estimate for a hydrazine / NTO apogee engine of this class
  rcsIsp: 225,               // s — catalytic hydrazine monopropellant thrusters (typical)
  designLife: 15,            // years
  altitude: 20180,           // km, nominal circular MEO altitude (semi-major axis ≈ 26,560 km)
  inclination: 55,           // degrees
  powerEOL: 4480,            // W at end of life
  transferPerigee: 400,      // km — Falcon 9 transfer orbit for SV01 (~400 × 20,200 km, Spaceflight Now; approximate)
  clockHz: 10.23e6,          // fundamental frequency every GPS signal is a multiple of
  signals: {                 // MHz = multiple × 10.23 MHz
    L1: [1575.42, 154], L2: [1227.6, 120], L3: [1381.05, 135], L5: [1176.45, 115],
  },
};
