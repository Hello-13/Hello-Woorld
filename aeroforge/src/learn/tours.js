// Guided-tour content. Each step can focus parts (everything else is ghosted), choose a render
// mode, explode the assembly, aim the camera and run enter/exit actions on the vehicle or lab.
// `key` is the one idea to remember, usually an equation or a number with units.
//
// Step format: { title, body, key?, focus?: [part names], mode?, explode?: 0..1,
//                view?: { dir: [x, y, z], fill?, lift? }, demo?: name }
// One file per vehicle in ./tours/, keyed by the vehicle id.

import fighter from './tours/fighter.js';
import rocket from './tours/rocket.js';
import turbofan from './tours/turbofan.js';
import satellite from './tours/satellite.js';
import uav from './tours/uav.js';
import helicopter from './tours/helicopter.js';
import hubble from './tours/hubble.js';

export const TOURS = { fighter, rocket, turbofan, satellite, uav, helicopter, hubble };
