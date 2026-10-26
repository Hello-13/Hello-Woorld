# Modelling guide

How a vehicle is built in AEROFORGE, and the standard every model is held to. The objective
is learning: a student should be able to take a vehicle apart system by system and find every
major component where it really is, named and described correctly.

## The standard

- **Real vehicles, real numbers.** Each model represents a specific real vehicle. Overall
  dimensions, counts (engines, blades, stages, wheels, tanks, weapons stations, antennas …),
  layout and materials follow public sources: manufacturer fact sheets, USAF / Army / NASA
  fact sheets, FAA / EASA type-certificate data sheets, NASA technical reports, Wikipedia.
  List the main ones in the vehicle's `sources` string.
- **Encyclopedic level only** for military systems: what a museum placard, fact sheet or
  public cutaway shows. No operational or tactical content.
- **Honest about unknowns.** Component masses are rarely published; estimate them from size,
  material and comparable parts and leave `massSource` unset (the UI then labels them
  "≈ … (estimate)"). Only set `massSource` for a published figure. If a count or layout is
  genuinely uncertain, say so in the part's `desc` rather than inventing precision.
- **Depth: system → subsystem → component.** The model is the product, and the small details are
  what a student remembers. Break every system into its real subsystems, and every subsystem into
  the components a maintainer would name, placed where they really sit, at real size. Aim for
  150–250 parts. For example, landing gear is not one part but: shock strut (oleo), torque links,
  drag and side braces, retraction actuator, uplock and downlock, wheels, tyres, carbon brakes,
  steering actuator (nose), gear doors and their actuators, plus the hydraulic lines that serve
  them. An engine is not one part but its fan / compressor / combustor / turbine stages, shafts and
  bearings, gearbox and accessories, fuel control, igniters, sensors, mounts and nacelle doors.
- **Small details matter.** Model what a museum cutaway or a maintenance manual shows: access
  panels and their fasteners, plumbing and wiring runs between the units they connect, actuators
  at every moving surface, probes and sensors, antennas, lights, drains and vents, hinges, placard
  locations, seals. Where something is too small to model, mention it in the nearest part's desc.
- **Connected, not floating.** Systems connect: fuel lines run from tanks to pumps to the engine
  feed; hydraulic lines from pumps to actuators; wiring from generators through distribution to
  loads; ducts from intakes to engines. Model the main runs so a student can trace a system
  end to end in the Systems view.
- **Coverage.** Every major system, inside and out: structure, skins, propulsion and its modules,
  fuel, flight controls and actuators, landing gear, hydraulics, electrical, avionics, sensors,
  crew systems, environmental control, weapons/payload, and anything specific to the type (rotor
  and drive systems, separation hardware, optics, attitude control …). Internal parts are modelled
  where they really sit, at real size, so X-ray, Blueprint, Systems and Exploded views show a
  credible interior.
- **Every part teaches.** `desc` is 1–3 plain sentences: what it is, what it does, and one real
  number or fact (a pressure, a count, a temperature, a material reason).

## Coordinates and scale

Build at real scale in metres. Each existing model file documents its axes at the top (the
F-22A is nose toward +x, y up, right wing toward +z). Keep the convention of the file you are
editing; new models use x forward, y up, z right. The stage rescales the whole vehicle to its
`displaySize` and seats it on the floor, so never pre-scale.

## Parts

```js
import { Assembly, mesh } from '../engine/assembly.js';
const A = new Assembly();
A.part('Main landing gear (right)', {
  system: 'Landing gear',          // one of the names in src/engine/systems.js
  material: '300M steel strut, aluminium wheel, carbon brakes',
  mass: 260,                       // kg, estimate unless massSource is set
  massSource: null,                // e.g. 'GE Aviation fact sheet' for a published figure
  count: 1,                        // identical items the part stands for (22 fan blades …)
  skin: false,                     // true for exterior skins, panels, doors and fairings
  desc: 'Retracts forward into the fuselage …',
  explode: [0, -1.2, 0.8],         // exploded-view offset in metres
  callout: false, anchor: [x, y, z],   // a leader-line label (keep callouts to ≤ 12 key parts)
  temp: 288,                       // K, default surface temperature for Thermal view
}, [mesh(geometry, material), …], parentGroup);
A.finalize();                      // after every part is placed
```

- A part is a `THREE.Group`; give it every mesh that belongs to it. Merge static geometry within
  a part with `mergeGeometries` (from `engine/geometry.js`) to keep draw calls down.
- Use the system vocabulary in `src/engine/systems.js` exactly; the Systems view colours by it.
- Mark exterior skins, panels, doors and fairings `skin: true`. They ghost in the Systems view,
  draw faint in X-ray, and clicks pass through them in X-ray / Blueprint / Systems so internal
  parts can be picked.
- Effects (plumes, glows, labels' helpers) carry `userData.fx = true` and are not parts.
- Avoid `InstancedMesh` (render modes swap materials per mesh and Blueprint draws per-mesh
  edges); merge repeated items into one geometry instead.

## Budget

- ≤ 700 k triangles and ≤ 1,000 meshes per vehicle (a 4K frame of the current fleet costs about
  2 ms on a desktop GPU, so there is room for detail; merge static geometry within a part) (the event log prints parts and triangles
  when a vehicle comes on deck). Spend triangles where students look (silhouette, blades,
  gear, cockpit) and keep hidden internals simple but correctly sized and placed.
- Boot cost: a vehicle should build in well under a second.

## Helpers

`engine/geometry.js`: `loftRings(rings, {capStart, capEnd, closed, uvMode})`, `orientOutward`,
`orientTubeOutward`, `mirrorZ`, `naca00`, `airfoilLoop`, `wingPanel({root, tip, c0, c1, stations,
twist, camber, eta0, eta1})`, `wingPoint`, `hingedMesh(geometry, material, p0, p1)` (returns
`{ pivot, mesh, setAngle }`), `lathe(profile, segments)`, `ogiveProfile`, `beam(p0, p1, w, h)`,
`rod(p0, p1, r, seg)`, `latticePanel`, `ringArray(geometry, count, axis)`, `interpKeys`,
`mergeGeometries`, `triangleCount`.

`engine/materials.js`: shared materials `M.*` (titanium, aluminium, inconel, darkMetal,
gunmetal, copper, carbon, rubber, glass, canopy, mli, osr, solar, white, offWhite, missile,
seeker, munition, navRed, navGreen, strobe, burner, turbineGlow …) and textured skins `SKIN.*`
(stealth, stealthWing, uav, uavDark, nacelle, liner, carbon, mli). Make vehicle-specific
materials locally in the model file.

`engine/decals.js`: `decal(targetMesh, texture, {at, dir, size, angle})` with `stencilText`,
`danger`, `rescue`, `panelOutline`, `tailCode`, `emblem`. `engine/effects.js`: `plumeMaterial`,
`plumeMesh`. `engine/surface.js`: `aircraftSkin`, `tankSkin`, `mliSurface`, `carbonWeave`,
`decalTexture`.

## The vehicle object

A model returns an object with at least: `id`, `designation`, `name`, `role`, `tagline`,
`summary`, `specs` (`[label, value]` pairs), `heroStats` (three `[value, unit, label]`
figures), `sources`, `root`, `parts`, `view: { dir, fill }`, `displaySize`, `thermalRange`,
`state`, and optional `update(dt, t)`, `temperatureOf(info)`, `aero` (true for aircraft with
lifting surfaces carrying the `chord` attribute from `wingPanel`). Keep every method the
vehicle's lab, tour and the app already call on it.

## The open-sky look (in flight)

`engine/sky.js` draws the flight backdrop in one pass on a camera-centred dome: the 8K / 4K
plate of a Poly Haven pure-sky HDRI above the horizon (decoded back to HDR, so bloom sees the
sun) and a procedural, real-scale cloud deck below it, on a sphere of Earth radius so the horizon
dips with altitude. A lab that flies its vehicle sets three things on `stage.env` every frame:
`altitude` (m, from the lab's own state: it grades the zenith, the haze, the fog, the lights and
places the cloud tops about 3 km below the aircraft), `cloudSpeed` (true airspeed, m/s: the deck
scrolls aft at it, nose toward +x) and optionally `unitMetres` (metres per scene unit, i.e.
`1 / v._fitScale`). The look's lighting on the vehicle (key = the plate's sun, hemisphere = sky
above / cloud bounce below, IBL = the HDR over a lit deck) follows the same altitude, so a
vehicle's `lighting.sky` override is only needed for paint that misbehaves.

## Checking your work

```bash
cd aeroforge
for f in $(find src -name "*.js"); do node --check $f || echo FAIL $f; done
npm test
```

Screenshots use the scratchpad harness (`shot.mjs`): it serves the app, runs JavaScript steps
and saves a PNG. Inspect Studio, X-ray, Blueprint, Systems and Exploded views, the guided tour
and the lab, and read the console output it prints for errors.
