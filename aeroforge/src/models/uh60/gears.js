// UH-60 main transmission gear data, three.js-free so the tests can check it.
// Source: NASA TP-2626 (Mitchell, Oswald & Coe, 1986), Table I(a), and NASA TP-2911 (Coe, 1989):
// three reduction stages, 81.042 : 1 overall, 20,909 rpm engine input → 258 rpm rotor, and a tail
// output at 4,117 rpm from the upper face of the main bevel gear.

export const GEARS = {
  inputPinion: 22,      // spiral-bevel input pinion (engine speed)
  inputGear: 80,        // spiral-bevel input gear, with the ramp-roller freewheel inside it
  combPinion: 17,       // combining bevel pinion (one per input module)
  mainBevelLower: 81,   // main bevel gear, lower face (combining stage)
  mainBevelUpper: 116,  // main bevel gear, upper face (drives the tail take-off)
  tailPinion: 34,       // tail output shaft pinion
  sun: 62,
  planet: 83,
  planets: 5,
  ring: 228,            // fixed ring gear
  oilGear: 152,         // on the planet carrier
  oilPinion: 12,        // lube-pump drive pinions
};

/** Stage ratios (input speed / output speed). With no argument: the overall engine → rotor ratio. */
export function ratio(stage) {
  const g = GEARS;
  const r = {
    input: g.inputGear / g.inputPinion,
    comb: g.mainBevelLower / g.combPinion,
    planetary: 1 + g.ring / g.sun,
  };
  return stage ? r[stage] : r.input * r.comb * r.planetary;
}

const INPUT_RPM = 20909;   // power-turbine / engine output speed at 100 % (NASA TP-2626)
const mainBevel = INPUT_RPM / ratio('input') / ratio('comb');
export const SPEEDS = {
  input: INPUT_RPM,
  inputGear: INPUT_RPM / ratio('input'),
  mainBevel,
  rotor: INPUT_RPM / ratio(),
  tailOutput: (mainBevel * GEARS.mainBevelUpper) / GEARS.tailPinion,
  oilPump: ((INPUT_RPM / ratio()) * GEARS.oilGear) / GEARS.oilPinion,
};
