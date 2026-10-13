// Subsystem vocabulary shared by every vehicle. Parts name one of these as their `system`; the
// Systems view colours each by this table (cutaway-poster convention: fuel blue, propulsion
// orange, electrical yellow, hydraulics teal, weapons red …). Unknown names get a stable hash colour.
// Neighbouring hues are kept apart so the largest spacecraft systems (payload, power, electrical,
// communications, fuel) stay distinguishable.

export const SYSTEMS = {
  'Structure':              { color: '#9aa8b6', blurb: 'Primary load-carrying structure: frames, bulkheads, spars, ribs, longerons, thrust structure.' },
  'Skin & fairings':        { color: '#8fb6d8', blurb: 'Outer mould line: skins, panels, doors and fairings.' },
  'Propulsion':             { color: '#ff8a3d', blurb: 'Engines, inlets, nozzles and their mounts.' },
  'Fuel':                   { color: '#3fa9f5', blurb: 'Tanks, lines, pumps and refuelling hardware.' },
  'Flight controls':        { color: '#b38cff', blurb: 'Control surfaces, actuators and the flight control computers that drive them.' },
  'Landing gear':           { color: '#d7dee6', blurb: 'Struts, wheels, brakes, retraction actuators and gear doors.' },
  'Hydraulics':             { color: '#2fd1c5', blurb: 'Pumps, reservoirs, accumulators and lines.' },
  'Electrical':             { color: '#fde047', blurb: 'Generation, conversion, storage and distribution of electrical power.' },
  'Avionics':               { color: '#4ade80', blurb: 'Mission computers, navigation, communications and displays processing.' },
  'Sensors':                { color: '#a3e635', blurb: 'Radar, electro-optical, infrared and air-data sensors.' },
  'Crew systems':           { color: '#f472b6', blurb: 'Cockpit, seats, controls, displays and life support.' },
  'Weapons':                { color: '#ef4444', blurb: 'Internal and external stores, launchers, guns and ammunition.' },
  'Environmental control':  { color: '#67e8f9', blurb: 'Air conditioning, cooling, pressurisation and oxygen.' },
  'Payload':                { color: '#fbbf24', blurb: 'The equipment the vehicle exists to carry or operate.' },
  'Power':                  { color: '#e879f9', blurb: 'Solar arrays, batteries and power conditioning.' },
  'Thermal control':        { color: '#fb7185', blurb: 'Radiators, heaters, insulation and heat pipes.' },
  'Attitude control':       { color: '#c084fc', blurb: 'Reaction wheels, gyros, star trackers, thrusters and magnetic torquers.' },
  'Communications':         { color: '#818cf8', blurb: 'Antennas, transponders and data links.' },
  'Optics':                 { color: '#e0f2fe', blurb: 'Mirrors, baffles, focal-plane instruments and their supports.' },
  'Rotor system':           { color: '#f59e0b', blurb: 'Blades, hubs, swashplates and rotor controls.' },
  'Drive system':           { color: '#d97706', blurb: 'Gearboxes, shafts and couplings between engines and rotors.' },
  'Recovery':               { color: '#94a3b8', blurb: 'Landing legs, grid fins, parachutes and recovery aids.' },
  'Separation':             { color: '#f97316', blurb: 'Interstages, pushers, clamps and separation devices.' },
  'Ground support':         { color: '#cbd5e1', blurb: 'Pad, tower, stands and handling equipment.' },
};

/** Display colour for a system name (falls back to a stable hue from the name). */
export function systemColor(name) {
  const s = SYSTEMS[name];
  if (s) return s.color;
  let h = 0;
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 65% 62%)`;
}
