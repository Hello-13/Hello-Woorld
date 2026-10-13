// The fleet: which model, lab and environment each vehicle uses, in shortcut-key order.
// Hero figures come from the vehicle's own `heroStats`; `stats` here is only a fallback.

import { buildFighter } from './models/fighter.js';
import { buildRocket } from './models/rocket.js';
import { buildTurbofan } from './models/turbofan.js';
import { buildSatellite } from './models/satellite.js';
import { buildUAV } from './models/uav.js';
import { buildHelicopter } from './models/helicopter.js';
import { buildHubble } from './models/hubble.js';
import { mountFighterLab } from './labs/fighterLab.js';
import { mountRocketLab } from './labs/rocketLab.js';
import { mountEngineLab } from './labs/engineLab.js';
import { mountOrbitLab } from './labs/orbitLab.js';
import { mountUavLab } from './labs/uavLab.js';
import { mountHeliLab } from './labs/heliLab.js';
import { mountHubbleLab } from './labs/hubbleLab.js';

export const FLEET = [
  { id: 'fighter', build: buildFighter, lab: mountFighterLab, labName: 'Flight envelope', lift: 1.4, looks: ['showroom', 'hangar'], stats: [['2.25', 'Mach', 'Top speed'], ['19.8', 'km', 'Service ceiling'], ['+9', 'g', 'Load limit']] },
  { id: 'helicopter', build: buildHelicopter, lab: mountHeliLab, labName: 'Rotor performance', lift: 1.2, looks: ['showroom', 'hangar'], stats: [['16.36', 'm', 'Rotor diameter'], ['2 × 1,994', 'shp', 'Engines'], ['9,979', 'kg', 'Max take-off']] },
  { id: 'uav', build: buildUAV, lab: mountUavLab, labName: 'Mission endurance', lift: 1.2, looks: ['showroom', 'hangar'], stats: [['27', 'h', 'Endurance'], ['15.2', 'km', 'Ceiling'], ['1,700', 'kg', 'Payload']] },
  { id: 'turbofan', build: buildTurbofan, lab: mountEngineLab, labName: 'Brayton cycle', lift: 0.8, looks: ['showroom', 'hangar'], stats: [['513', 'kN', 'Take-off thrust'], ['3.25', 'm', 'Fan diameter'], ['42', ': 1', 'Pressure ratio']] },
  { id: 'rocket', build: buildRocket, lab: mountRocketLab, labName: 'Launch simulator', lift: 5.5, looks: ['pad', 'showroom', 'hangar'], stats: [['63.8', 't', 'Payload to LEO'], ['22.8', 'MN', 'Liftoff thrust'], ['27', '', 'Engines at liftoff']] },
  { id: 'satellite', build: buildSatellite, lab: mountOrbitLab, labName: 'Orbital transfer', lift: 0, looks: ['orbit', 'showroom', 'hangar'], stats: [['20,180', 'km', 'Orbit altitude'], ['55', '°', 'Inclination'], ['15', 'yr', 'Design life']] },
  { id: 'hubble', build: buildHubble, lab: mountHubbleLab, labName: 'Optics & orbit', lift: 0, looks: ['orbit', 'showroom'], stats: [['2.4', 'm', 'Primary mirror'], ['0.05', '″', 'Resolution'], ['540', 'km', 'Orbit']] },
].map((f, i) => ({ ...f, key: String(i + 1) }));
