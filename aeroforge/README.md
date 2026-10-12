# AEROFORGE

An interactive aerospace & defense engineering lab that runs in the browser. Five detailed,
fully procedural 3-D vehicles sit in a hangar bay, and each one comes with an engineering lab
that runs real physics and drives the model live.

| # | Vehicle | What it is | Engineering lab |
|---|---------|-----------|-----------------|
| 1 | **AX-7 WRAITH** | Fifth-generation stealth air-superiority fighter | **Flight envelope**: ISA atmosphere, DATCOM lift slope, transonic drag rise, load factor, specific excess power (Ps) vs Mach |
| 2 | **HELIOS-H HEAVY** | Tri-core heavy-lift launcher, 27 engines at liftoff | **Launch simulator**: RK4 ascent over a rotating spherical Earth, back-pressure-dependent Isp, gravity turn + closed-loop upper-stage guidance, staging and fairing jettison, played back in 3-D |
| 3 | **TF-90 CYCLONE** | High-bypass two-spool turbofan, museum cutaway | **Brayton cycle**: non-ideal separate-exhaust turbofan cycle with fan/LPT work matching, station table and T–s diagram; drives spool speeds, combustor glow and flow particles |
| 4 | **SENTINEL-4** | Earth-observation satellite | **Orbital transfer**: Hohmann transfer with a combined apogee plane change, rocket-equation propellant budget, Kepler-timed animation around a dot-matrix Earth |
| 5 | **MQ-X KESTREL** | MALE remotely piloted aircraft | **Mission endurance**: Breguet endurance and range for a propeller aircraft, time on station, best-endurance vs best-range speed |

All five designs are fictional and modelled from public engineering principles.

## Features

- **Detailed procedural models** — no downloaded meshes. Wings are lofted from NACA 4-digit
  sections; the fighter's faceted chined fuselage, the turbofan's 22 twisted wide-chord fan blades
  and every compressor/turbine row, grid fins, landing legs, accordion solar arrays and a lattice
  launch tower are all generated in code (≈ 300 k triangles in total).
- **Moving parts** — flaperons, ailerons, all-moving stabilators, rudders, 2-D thrust-vectoring
  nozzles, landing-gear retraction, weapons-bay doors with trapeze launchers, independent N1/N2
  spools, a propeller, a gimballed EO/IR turret with laser designator, solar-array deployment.
- **Four render modes** — Studio (PBR + bloom), X-ray (fresnel hologram), Blueprint (feature edges
  on drafting blue) and Thermal (per-part temperature on an inferno scale, computed from the
  physics: stagnation heating, cycle station temperatures, cryogenic tanks, sunlit vs shadowed panels).
- **Exploded view** for every vehicle, **click-to-inspect** parts with material, mass and
  temperature, focus and isolate, plus screen-space callouts.
- **Effects** — exhaust plumes with shock diamonds that expand in vacuum, afterburners, a
  transonic vapour cone, launch smoke, an ascent sky that fades to stars.

## Run it

It is a static site with no build step. Three.js r170 loads from jsDelivr, so you need a
network connection.

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
| `1`–`5` | Switch vehicle |
| `M` | Cycle render mode |
| `X` | Toggle exploded view |
| `L` | Toggle callouts |
| `R` | Reset the camera |
| `Esc` | Clear the selection |

A vehicle can be deep-linked with `#fighter`, `#rocket`, `#turbofan`, `#satellite` or `#uav`.

## Tests

```bash
cd aeroforge
npm test
```

The physics modules are pure ES modules with no DOM dependency, checked against reference
values: 1976 Standard Atmosphere tables, the textbook LEO→GEO Hohmann Δv (3.89 km/s, 5.27 h),
Kepler's equation, launcher orbit insertion, turbofan take-off/cruise TSFC and Breguet
best-endurance speed.

## Layout

```
aeroforge/
├── index.html, styles.css
├── src/
│   ├── main.js            app shell: fleet, modes, picking, explode, inspector, labs, event log
│   ├── physics/           atmosphere, aero, launch, turbofan, orbital, endurance (no DOM)
│   ├── engine/            stage (renderer + post-processing), render modes, picking, callouts,
│   │                      geometry toolkit (loft / NACA wing / lathe / lattice), shaders, orbit scene
│   ├── models/            fighter, rocket, turbofan, satellite, uav
│   ├── labs/              one engineering lab per vehicle
│   └── ui/                controls, canvas charts, event log
└── tests/physics.test.mjs
```

## Physics notes

- **Atmosphere** — exact US Standard Atmosphere 1976 layers to 86 km, exponential above.
- **Fighter** — Helmbold/DATCOM subsonic lift slope, 4/√(M²−1) supersonic, blended through the
  transonic; parabolic polar with Mach-dependent zero-lift drag; thrust lapse with density and Mach.
- **Launcher** — 2-D point mass, RK4 at 50 ms, Earth rotation at 28.5° N, drag from a Cd(M) table.
  Stage 1 flies a pitch kick and gravity turn; the upper stage uses a linear radial-acceleration
  profile that arrives at the target altitude with zero vertical rate at circular velocity.
- **Turbofan** — station-by-station cycle with polytropic-style component efficiencies, burner
  pressure loss, HPT↔HPC and LPT↔fan+booster work balances, ideally expanded nozzles. If the LPT
  cannot deliver the requested fan work, the fan pressure ratio is bisected down to a match.
- **Orbits** — two-body Hohmann transfer, combined plane change at apoapsis, Newton–Raphson Kepler solver.
- **UAV** — constant-altitude, constant-speed Breguet endurance and range with a 5 % reserve.

These are conceptual-design models meant to show the right trends and magnitudes, not
certified performance data.
