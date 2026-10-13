# AEROFORGE

An interactive aerospace engineering lab that runs in the browser. Seven real vehicles are
modelled in depth, system by system, so a student can take each one apart and find every major
component where it really sits, named and described. Each vehicle comes with an engineering lab
that runs real physics and drives the model live.

| # | Vehicle | What it is | Engineering lab |
|---|---------|-----------|-----------------|
| 1 | **F-22A Raptor** | Twin-engine stealth air-dominance fighter | **Flight envelope**: ISA atmosphere, lift/drag polar, load factor, specific excess power (Ps) vs Mach for the published weights and F119 thrust |
| 2 | **UH-60M Black Hawk** | Twin-turbine utility helicopter | **Rotor performance**: momentum-theory hover, forward-flight power polar, engine power lapse, hover ceilings in and out of ground effect, top-speed limits, autorotation |
| 3 | **MQ-9A Reaper** | Medium-altitude long-endurance remotely piloted aircraft | **Mission endurance**: Breguet endurance and range for a propeller aircraft, stores weight and drag, power available at altitude, time on station |
| 4 | **GE90-115B** | High-bypass two-spool turbofan of the Boeing 777 | **Brayton cycle**: non-ideal separate-exhaust cycle solved per ARP755 station, fan/LPT work matching, T–s diagram; drives spool speeds, combustor glow and flow particles |
| 5 | **Falcon Heavy** | Three-core heavy-lift launcher on LC-39A, 27 Merlin engines at liftoff | **Launch simulator**: RK4 ascent over a rotating spherical Earth, back-pressure-dependent thrust, side-booster and core separation, fairing jettison and the Merlin Vacuum burn, played back in 3-D |
| 6 | **GPS III** | Navigation satellite in medium Earth orbit | **Orbital transfer**: transfer orbit to 20,180 km with the satellite's apogee burns, rocket-equation propellant budget, the relativistic clock correction |
| 7 | **Hubble Space Telescope** | 2.4 m Ritchey–Chrétien observatory, as left by the last servicing mission (2009) | **Optics & orbit**: the diffraction limit against ground seeing, light grasp, the two-mirror design and its 1990 flaw, the orbit and its decay |

Dimensions, counts, layouts and materials follow public sources (manufacturer, USAF, Army, NASA and
FAA/EASA documents, technical reports); each vehicle lists its sources in the app. Military
vehicles stay at the level of public fact sheets and museum cutaways. Component masses are
estimates unless a published figure is cited, and the inspector says which.

## Learn with it

- **Guided tours** — every vehicle has a step-by-step lesson. Each step flies the camera, ghosts
  everything except the parts it is talking about, switches render mode or explodes the vehicle,
  and runs a live demonstration on the model: control surfaces sweeping through roll, pitch and
  yaw, thrust vectoring, the weapons bays opening, the rotor's swashplate tilting, the thrust
  reverser deploying, solar arrays turning, flow through the engine. The step card can be folded
  away to see the whole model.
- **Systems view** — every part belongs to a real system (structure, propulsion, fuel, flight
  controls, hydraulics, electrical, avionics, rotor and drive, optics, attitude control …),
  coloured by system with a legend; click a system to isolate it and trace it end to end.
- **Force vectors** — lift, weight, thrust and drag drawn to scale from the physics, with
  magnitudes in kN, for the fighter, the launcher (through the whole ascent) and the UAV.
- **Pressure view** — the surface pressure coefficient on the wings from thin-airfoil theory,
  corrected for compressibility (Prandtl–Glauert subsonic, Ackeret supersonic) and stall; it
  follows angle of attack and Mach live.
- **Engine station planes** — the SAE ARP755 stations (2, 13, 19, 3, 4, 45, 5) as glowing planes
  in the cutaway, each labelled with the cycle's total temperature and pressure, shown in a side
  elevation like a textbook station diagram.

## Features

- **Detailed procedural models** — no downloaded meshes. Every vehicle is generated in code at
  real scale, broken down system → subsystem → component (about 150–250 named parts each): the
  F-22A's chined fuselage, internal bays and F119s; the Black Hawk's rotor head, gearboxes and
  T700s; the GE90's 22 swept composite fan blades and every compressor and turbine row; the
  Falcon Heavy's 27 Merlins and the LC-39A tower; GPS III's payload and arrays; Hubble's optical
  telescope assembly and instruments. See [`docs/MODELING.md`](docs/MODELING.md) for the standard.
- **Moving parts** — flaperons, ailerons, all-moving stabilators, rudders, 2-D thrust-vectoring
  nozzles, landing-gear retraction, weapons-bay doors and launchers, main and tail rotors with
  collective and cyclic, independent N1/N2 spools, a thrust reverser, a propeller, a gimballed
  sensor turret, solar arrays and the aperture door.
- **Showroom** — the default stage for the aircraft and the engine: a graphite cyclorama, a
  polished floor carrying a blurred mirror reflection of the vehicle and soft contact shadows,
  and reflections from a procedurally built softbox studio. Selecting a vehicle opens with a
  slow camera reveal, the way a product film does.
- **Photographic rendering** — image-based lighting from real HDR environment maps, a physically
  based sky, AgX tone mapping, multisampled HDR post-processing with ground-truth ambient occlusion,
  bloom on emissives only, and procedural PBR surfaces (panel lines, rivets, weathering, carbon
  weave, multi-layer insulation, concrete) with decals and stencils, and a final grade (gentle
  S-curve, split toning, lens fall-off).
- **4K rendering** — Ultra and High draw at the screen's native resolution (3840 × 2160 on a 4K
  display); the **4K** preset supersamples a 3840 × 2160 frame onto smaller screens for extra-clean
  edges. At Ultra and 4K the aircraft and rocket skins and all stencils are painted at twice the
  texture resolution. The nav shows the frame size being drawn. Presets (4K, Ultra, High,
  Balanced, Performance) also scale MSAA, ambient occlusion, mirror reflections and shadow maps;
  Ultra is the default on desktops with 8+ cores, automatic mode steps up to 4K when the GPU has
  headroom, and steps down if the frame rate drops.
- **Environments** — showroom, hangar, open sky above a cloud deck, a dawn launch pad with
  floodlights, and orbit (low Earth orbit for Hubble, medium Earth orbit for GPS III, with the
  Earth at its true angular size for the altitude). During a launch the sky darkens with altitude, the stars come
  out and the curved Earth (NASA Blue Marble by day, city lights by night, clouds and an
  atmospheric rim) rises into view at its true angular size for the current altitude.
- **Six render modes** — Studio, X-ray (fresnel hologram), Blueprint (feature edges on drafting
  blue), Thermal (per-part temperature on an inferno scale, computed from the physics: stagnation
  heating, cycle station temperatures, cryogenic tanks, sunlit vs shadowed panels) and Pressure
  (surface Cp on the aircraft), plus Systems (above).
- **Exploded view** for every vehicle, **click-to-inspect** parts with material, mass and
  temperature, focus and isolate, plus screen-space callouts.
- **Effects** — exhaust plumes with shock diamonds that expand in vacuum, afterburners, a
  transonic vapour cone, launch smoke, an ascent sky that fades to stars.

## Run it

It is a static site with no build step. Three.js r170 loads from jsDelivr, so you need a
network connection; the HDR environments and Earth textures ship in `assets/` (about 55 MB with the 8K
backdrops and Earth maps; below the 4K and Ultra presets only the 4K copies load).

```bash
cd aeroforge
npm start          # serves on http://localhost:8080
```

Any static server works (`python3 -m http.server` too). Opening `index.html` straight from the
file system will not work because browsers block ES modules on `file://`.

## Controls

| Input | Action |
|-------|--------|
| Drag / scroll / pinch | Orbit and zoom |
| Click a part or its callout | Inspect it |
| `1`–`7` | Switch vehicle |
| `M` | Cycle render mode |
| `X` | Toggle exploded view |
| `L` | Toggle callouts |
| `R` | Reset the camera |
| `Esc` | Clear the selection, then close the engineering dossier |
| **Start guided tour** | Step through the vehicle's lesson (Back / Next, or click a progress dot) |
| **Engineering lab** / **Specifications** / **Mission log** | Open the dossier panel on that section |

A vehicle can be deep-linked with `#fighter`, `#helicopter`, `#uav`, `#turbofan`, `#rocket`,
`#satellite` or `#hubble`.

## Tests

```bash
cd aeroforge
npm test
```

The physics modules are pure ES modules with no DOM dependency, checked against reference
values: 1976 Standard Atmosphere tables, Hohmann transfers and Kepler's equation, Falcon Heavy
orbit insertion, GE90-115B take-off thrust and station temperatures, Breguet best-endurance speed,
rotor hover power and the diffraction limit. Each vehicle's tests also check its model against
published dimensions and counts, and that every tour step points at real parts.

## Layout

```
aeroforge/
├── index.html, styles.css
├── src/
│   ├── main.js            app shell: fleet, modes, picking, explode, inspector, labs, event log
│   ├── fleet.js           the vehicles, their labs and environments (each loads as its own module)
│   ├── physics/           atmosphere, aero, launch, turbofan, orbital, endurance, rotor, optics (no DOM)
│   ├── engine/            stage (renderer + post-processing), environments, showroom, Earth, render modes,
│   │                      picking, callouts, force arrows, decals, procedural surfaces,
│   │                      geometry toolkit (loft / NACA wing / lathe / lattice), shaders, orbit scene
│   ├── models/            one entry file per vehicle, with its subsystems in f22/, uh60/, mq9/,
│   │                      ge90/, falcon/, gps3/, hst/
│   ├── labs/              one engineering lab per vehicle
│   ├── learn/             guided-tour player and one tour per vehicle (learn/tours/)
│   └── ui/                controls, canvas charts, event log
├── assets/                HDR environments, Earth textures (see assets/CREDITS.md)
├── docs/MODELING.md       the modelling standard every vehicle is held to
└── tests/                 physics and per-vehicle model tests (node --test)
```

## Physics notes

- **Atmosphere** — exact US Standard Atmosphere 1976 layers to 86 km, exponential above.
- **F-22A** — Helmbold/DATCOM subsonic lift slope, 4/√(M²−1) supersonic, blended through the
  transonic; parabolic polar with Mach-dependent zero-lift drag; thrust lapse with density and Mach.
- **Falcon Heavy** — 2-D point mass, RK4, Earth rotation at LC-39A's latitude (28.6° N), drag from a
  Cd(M) table, Merlin thrust falling with back-pressure on the nozzle exit. The boosters fly a
  pitch kick and gravity turn; the upper stage uses a linear radial-acceleration profile that
  arrives at the target altitude with zero vertical rate at circular velocity.
- **GE90-115B** — station-by-station cycle with polytropic-style component efficiencies, burner
  pressure loss, HPT↔HPC and LPT↔fan+booster work balances, ideally expanded nozzles. If the LPT
  cannot deliver the requested fan work, the fan pressure ratio is bisected down to a match.
- **GPS III** — two-body Hohmann transfer, combined plane change at apoapsis, Newton–Raphson
  Kepler solver, special- and general-relativistic clock rates.
- **MQ-9A** — constant-altitude, constant-speed Breguet endurance and range with a 5 % reserve.
- **UH-60M** — momentum theory with a figure of merit, blade-element profile power, engine power
  lapse with density and temperature.
- **Hubble** — Rayleigh diffraction limit, light-gathering area, two-body orbit with an
  illustrative drag decay.

These are conceptual-design models meant to show the right trends and magnitudes, not
certified performance data.

## Credits

The 3-D models are all procedural. Image assets come from public-domain and CC0 sources; see
[`assets/CREDITS.md`](assets/CREDITS.md).
