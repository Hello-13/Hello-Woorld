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

`engine/skyvol.js` draws the flight backdrop as a real place: a spherical Earth with an ocean at
sea level, a layer of volumetric cumulus between 1.2 and 4.6 km, a cirrus veil at 12.6 km and an
atmosphere computed for the aircraft's altitude. Nothing follows the aircraft: climb, and the
clouds fall away, the horizon dips (acos(R / (R + h))) and the sky darkens; descend into the layer
and the field opens around the aircraft; lower still and it flies under the bases, over the sea.

- **Atmosphere** (`skymath.js` `ATM2`, `inscatter2`; the shader's `inscatter()` is the same
  arithmetic): Rayleigh and Mie single scattering and ozone absorption with the standard sea-level
  coefficients, integrated along the view ray, the sun's optical depth from the Kasten-Young
  airmass, and the higher orders as an isotropic source in proportion to the local scattering.
  Nothing is clipped or tinted. The same function gives the aerial perspective over every distance
  (to the clouds, to the sea).
- **Clouds**: density from two tileable 3-D noise volumes (`assets/sky`, made by
  `tools/make-cloud-noise.py`) and the 2-D weather map of `clouds.js`, after Schneider's Horizon
  Zero Dawn cloudscapes: a Perlin-Worley base shape cut by local coverage and a height profile
  (flat bases, domed tops, taller at the convection cells' cores), eroded at the edges by lobes a
  few hundred metres across and by fine cellular detail. The march through the layer's shell
  strides through clear air by the distance the field implies, finds each cloud face by bisection
  (so silhouettes are the field's, not the sampling's), reads the field at the pixel's own
  footprint for the first samples behind a face, and integrates each step's in-scattering exactly.
  Light: a second short march toward the sun for Beer's law, three octaves of a dual-lobe
  Henyey-Greenstein phase for the multiple scattering, sky light from above and the sea's bounce
  from below. The pass renders at a fraction of the frame (`VOL_TIERS`: steps, sun steps, scale by
  preset) from inside the dome's own draw, and the dome composites it bicubically, so the horizon,
  sun and sea stay at full resolution.
- **Sea**: Fresnel reflection of the sky, the sun's glitter path (Cox-Munk slopes for a 7 m/s
  wind), deep-water blue between, the clouds' shadows, wind streaks.
- **Sun**: `stage.env.setFlightSun({ elevation, azimuth })` (degrees; the Film menu's sliders;
  saved as `aeroforge.sun`). Its colour at the aircraft, the clouds and the sea comes from the
  path through the air (`sunTransmittance`). Each frame `environment.js` takes the key light (the
  sun as it reaches the aircraft), the hemisphere fill (the mean sky above) and the image-based
  lighting (`sky.environment(pmrem)`: the same sky rendered to a PMREM map, without the sun's disc
  and with the cloud field as its average) from the sky, so a vehicle's `lighting.sky` override is
  only needed for paint that misbehaves.

A lab that flies its vehicle sets three things on `stage.env` every frame: `altitude` (m),
`cloudSpeed` (true airspeed, m/s: the world passes aft at it, nose toward +x) and optionally
`unitMetres` (metres per scene unit, i.e. `1 / v._fitScale`).

Safety nets: the sky checks its shaders' compile results after a few frames (`sky.failed`); if the
dome's failed, `environment.js` swaps in the earlier dome, and if only the cloud pass failed the
clouds switch off. With `sky.adaptive` (on by default) the march budget steps down when frames
take longer than 1/40 s in flight and back up when they are short again. `?sky=classic` or the
Film menu's "Volumetric clouds" keeps the earlier dome (`engine/sky.js`: the Poly Haven plate
above a ray-marched cloud-deck height field, budgeted by `SKY_TIERS`, with its own `simple`
fallback).

Contrails: `effects.js` exports `contrailMesh()` (a ribbon in the vehicle's metres, aft along −x
from its origin: add it to a nozzle group at the exit plane) and `contrailFactor(altitude,
{ running })` (0 below 7.6 km, 1 above 9.6 km). Call `mesh.setContrail({ strength, dt, speed })`
each frame with the lab's altitude and airspeed; pass `light` / `ambient` (the key and hemisphere
light colours) so the trail is lit like the aircraft.

## Film mode, lens and grade

`engine/film.js` is the cinematic camera: the **Film** button (nav bar) or `F` runs a slow,
continuous program per vehicle — a low reveal, a low-angle orbit, push-ins to three details with
the focus pulled to them, a high wide, and back — as a closed Hermite spline in (azimuth,
elevation, log distance, target, focus) space, so it never stops and loops seamlessly. The details
come from `DETAIL_SHOTS` (name patterns over `userData.part.name`: the F-22A inlet and canopy, the
GE90 fan, the Black Hawk rotor head, the Falcon octaweb, Hubble's aperture door, the GPS III
antenna farm…); add a vehicle there, or it falls back to the nose, top and tail of its bounds. Any
drag, scroll or key hands the camera back; tours, the quiz, orbit mode and a launch keep their own
camera (Film yields to them). Shift+F is full screen. `tests/film.test.mjs` checks the path.

The lens (`Stage.setFocus`) is three's `BokehPass` in the normal composer order, HDR before bloom,
with a scatter-as-gather tap weight so a sharp subject never halos into the background and a pixel
in focus is an exact copy of the beauty frame; its depth render is full resolution on the presets
that carry it. The blur follows a thin-lens 42 mm-equivalent at the shot's f-number using the
vehicle's real scale (`1 / _fitScale`). It is off unless Film mode or a tour step with focus parts
asks for it, and absent on Balanced / Performance. The final grade (`GRADES` in `stage.js`) has a
small tone curve per look — showroom neutral with a soft shoulder, hangar warm, sky clean
daylight (the atmosphere supplies the haze), pad golden, orbit with a true-black toe — eased between looks; AgX is untouched, shadows
are only lifted, never crushed, and the grain is held at one 8-bit step as a dither. The showroom's
mirror floor blurs each reflection by the reflected part's height above the floor (read from the
Reflector's oblique depth) and the studio IBL has a feathered key softbox, a cool rim and a fill.

Switches: URL flags `?film=0`, `?dof=0`, `?grade=0`, `?sweep=0`, `?drift=0`, `?tourDof=1`,
`?studio=1` (the depth-blurred floor; off by default, as is depth of field in tours, until both
are confirmed on real GPUs), `?sky=classic`, the Film button's menu (saved as `aeroforge.fx`), and
`__aeroforge.stage.fx` in the console. Off, each reverts to the earlier behaviour.

## Checking your work

```bash
cd aeroforge
for f in $(find src -name "*.js"); do node --check $f || echo FAIL $f; done
npm test
```

Screenshots use the scratchpad harness (`shot.mjs`): it serves the app, runs JavaScript steps
and saves a PNG. Inspect Studio, X-ray, Blueprint, Systems and Exploded views, the guided tour
and the lab, and read the console output it prints for errors.
