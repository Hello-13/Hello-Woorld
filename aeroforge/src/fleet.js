// The fleet: which model, lab and environment each vehicle uses, in shortcut-key order.
// Hero figures come from the vehicle's own `heroStats`; `stats` here is only a fallback.

// Each vehicle's model and lab load as separate modules (see load()), so one that fails to load or
// build is left out with an error in the console instead of stopping the whole app.
const vehicle = (id, model, build, lab, mount, rest) => ({
  id, ...rest,
  load: async () => {
    const [m, l] = await Promise.all([import(`./models/${model}`), import(`./labs/${lab}`)]);
    if (typeof m[build] !== 'function') throw new Error(`models/${model} does not export ${build}()`);
    if (typeof l[mount] !== 'function') throw new Error(`labs/${lab} does not export ${mount}()`);
    return { build: m[build], lab: l[mount] };
  },
});

export const FLEET = [
  vehicle('fighter', 'fighter.js', 'buildFighter', 'fighterLab.js', 'mountFighterLab', { labName: 'Flight envelope', lift: 1.4, looks: ['showroom', 'hangar'], stats: [['2.25', 'Mach', 'Top speed'], ['19.8', 'km', 'Service ceiling'], ['+9', 'g', 'Load limit']] }),
  vehicle('helicopter', 'helicopter.js', 'buildHelicopter', 'heliLab.js', 'mountHeliLab', { labName: 'Rotor performance', lift: 1.2, looks: ['showroom', 'hangar'], stats: [['16.36', 'm', 'Rotor diameter'], ['2 × 1,994', 'shp', 'Engines'], ['9,979', 'kg', 'Max take-off']] }),
  vehicle('uav', 'uav.js', 'buildUAV', 'uavLab.js', 'mountUavLab', { labName: 'Mission endurance', lift: 1.2, looks: ['showroom', 'hangar'], stats: [['27', 'h', 'Endurance'], ['15.2', 'km', 'Ceiling'], ['1,700', 'kg', 'Payload']] }),
  vehicle('turbofan', 'turbofan.js', 'buildTurbofan', 'engineLab.js', 'mountEngineLab', { labName: 'Brayton cycle', lift: 0.8, looks: ['showroom', 'hangar'], stats: [['513', 'kN', 'Take-off thrust'], ['3.25', 'm', 'Fan diameter'], ['42', ': 1', 'Pressure ratio']] }),
  vehicle('rocket', 'rocket.js', 'buildRocket', 'rocketLab.js', 'mountRocketLab', { labName: 'Launch simulator', lift: 5.5, looks: ['pad', 'showroom', 'hangar'], stats: [['63.8', 't', 'Payload to LEO'], ['22.8', 'MN', 'Liftoff thrust'], ['27', '', 'Engines at liftoff']] }),
  vehicle('satellite', 'satellite.js', 'buildSatellite', 'orbitLab.js', 'mountOrbitLab', { labName: 'Orbital transfer', lift: 0, looks: ['orbit', 'showroom', 'hangar'], stats: [['20,180', 'km', 'Orbit altitude'], ['55', '°', 'Inclination'], ['15', 'yr', 'Design life']] }),
  vehicle('hubble', 'hubble.js', 'buildHubble', 'hubbleLab.js', 'mountHubbleLab', { labName: 'Optics & orbit', lift: 0, looks: ['orbit', 'showroom'], stats: [['2.4', 'm', 'Primary mirror'], ['0.05', '″', 'Resolution'], ['540', 'km', 'Orbit']] }),
].map((f, i) => ({ ...f, key: String(i + 1) }));
