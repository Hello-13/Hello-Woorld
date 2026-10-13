// Guided tour: SpaceX Falcon Heavy on LC-39A. See ../tours.js for the step format.

const CORE = 'Centre core';
const ENGINE = [
  `${CORE} Merlin 1D thrust chamber & pintle injector`, `${CORE} Merlin 1D nozzle`, `${CORE} Merlin 1D turbopump`,
  `${CORE} Merlin 1D gas generator`, `${CORE} Merlin 1D turbine exhaust duct`, `${CORE} Merlin 1D valves & TEA-TEB igniter`,
  `${CORE} Merlin 1D gimbal & TVC actuators`,
];
const MVAC = ['MVac thrust chamber & injector', 'MVac regenerative nozzle', 'MVac niobium nozzle extension', 'MVac turbopump',
  'MVac gas generator & exhaust manifold', 'MVac TVC actuators', 'MVac valves & TEA-TEB igniter'];

export default [
  {
    title: 'Three cores, one rocket',
    body: 'Falcon Heavy is three Falcon 9 first stages side by side — a strengthened centre core and two side boosters with nose cones — under one Falcon 9 second stage. All 27 Merlin 1D engines light on the pad, and the hold-down clamps let go only once every engine is confirmed healthy.',
    key: '27 × 845 kN = 22,819 kN of liftoff thrust against ≈ 1,421 t: thrust-to-weight ≈ 1.6.',
  },
  {
    title: 'Mostly tank',
    body: 'Each core is two aluminium-lithium tanks in one barrel: liquid oxygen on top, RP-1 kerosene below, split by a single common dome. In the thermal view the LOX tank is the coldest thing on the pad — SpaceX densifies it to −207 °C so more fits, and chills the RP-1 to about −7 °C.',
    key: 'Propellant is ≈ 94 % of a core\'s liftoff mass: about 278 t LOX and 118 t RP-1 (mixture ratio ≈ 2.36 by mass).',
    focus: [`${CORE} LOX tank`, `${CORE} RP-1 tank`, `${CORE} common dome`, `${CORE} forward & aft domes`, 'Second stage LOX tank', 'Second stage RP-1 tank'],
    mode: 'thermal', view: { dir: [1, 0.15, 1.3], fill: 1.05 },
  },
  {
    title: 'Inside the tank',
    body: 'With the skins see-through you can follow the propellant. LOX leaves the bottom of its tank through the downcomer, a pipe that runs straight down the middle of the RP-1 tank to the engine bay. Helium bottles (COPVs) sit submerged in the LOX; as the tanks drain, that helium keeps them pressurised so the pumps never starve and the thin walls stay stiff.',
    key: 'A tank pressurised to a few bar is stiffer than its walls alone — pressure carries part of the load.',
    focus: [`${CORE} helium COPVs`, `${CORE} LOX downcomer`, `${CORE} common dome`, `${CORE} forward & aft domes`, `${CORE} pressurisation & vent lines`, `${CORE} engine feed manifolds`, `${CORE} LOX tank`, `${CORE} RP-1 tank`],
    mode: 'xray', view: { dir: [1, 0.1, 1.2], fill: 0.95 },
  },
  {
    title: 'The Merlin 1D cycle',
    body: 'Here the centre engine is broken out. A single shaft carries the LOX pump, the RP-1 pump and a turbine. A small gas generator burns a fuel-rich trickle of both propellants to spin the turbine, and its exhaust is dumped overboard through the duct — an "open" gas-generator cycle, simpler than staged combustion at the cost of a few seconds of Isp. The pumped propellants meet at a pintle injector and burn at about 9.7 MPa.',
    key: 'Turbopump ≈ 36,000 rpm and ≈ 10,000 hp; TEA-TEB, which ignites on contact with LOX, lights the engine and allows restarts.',
    focus: ENGINE, explode: 0.85, view: { dir: [0.9, 0.05, 1.4], fill: 1.15 },
  },
  {
    title: 'Octaweb and engine-out',
    body: 'Eight Merlins ring a ninth on the Octaweb, a bolted aluminium thrust structure; two actuators per engine gimbal each nozzle for steering, using high-pressure RP-1 as hydraulic fluid. With nine engines per core, the flight computers can shut one down and let the others gimbal and burn longer to cover the loss.',
    key: 'F = ṁ·vₑ + (pₑ − pₐ)·Aₑ: back-pressure on the ≈ 0.68 m² nozzle exit costs each Merlin 69 kN at sea level (914 → 845 kN).',
    focus: [`${CORE} Octaweb`, `${CORE} Merlin 1D engines (outer ring)`, `${CORE} outer-engine TVC actuators`, `${CORE} heat shield & engine boots`, ...ENGINE],
    mode: 'systems', explode: 0.3, view: { dir: [1, -0.55, 1.1], fill: 1.1 },
  },
  {
    title: 'Holding three cores together',
    body: 'The side boosters ride on the centre core, which has thicker tank walls and carries the separation system. Two pneumatic pusher mechanisms tie each booster at the top of the LOX tanks and two more at the engine sections. About 2½ minutes in, the boosters shut down, the latches release and the pushers shove them clear.',
    key: 'Pneumatic separation gives a low-shock push over a long stroke and can be tested on the real flight hardware — explosive bolts cannot.',
    focus: [`${CORE} forward attach & pushers (A)`, `${CORE} aft attach & pushers (A)`, `${CORE} forward attach & pushers (B)`, `${CORE} aft attach & pushers (B)`, 'Side booster A nose cone', 'Side booster B nose cone', 'Side booster A LOX tank', `${CORE} LOX tank`],
    mode: 'systems', view: { dir: [0.2, 0.15, 1.4], fill: 1.0 },
  },
  {
    title: 'Coming home',
    body: 'Falcon Heavy\'s side boosters normally fly back. After separation, nitrogen cold-gas thrusters flip each booster; a boost-back burn heads it toward the landing zone; the titanium grid fins swing out to steer it through the atmosphere; then the four carbon-fibre legs unfold for a landing burn on the centre engine.',
    key: 'Recovering the boosters costs payload: 63.8 t to LEO is the fully expendable figure.',
    focus: ['Side booster A grid fins', 'Side booster A grid-fin actuators', 'Side booster A landing legs', 'Side booster A cold-gas thrusters & N₂ tanks', `${CORE} grid fins`, `${CORE} landing legs`, `${CORE} leg deployment pistons`],
    view: { dir: [1.3, 0.1, 0.9], fill: 1.0 },
  },
  {
    title: 'Interstage and second stage',
    body: 'The black carbon-composite interstage stays with the centre core and shrouds the second-stage engine. At separation latches release and pneumatic pushers part the stages. The second stage is a shorter copy of the first — LOX over RP-1, common dome, helium bottles in the LOX — with nitrogen thrusters for attitude control.',
    key: 'Staging: Δv = Isp·g₀·ln(m₀ / m_f) for each stage, and the stages add — no single stage could reach orbit with this payload.',
    focus: [`${CORE} interstage`, `${CORE} stage-separation pushers & latches`, 'Second stage LOX tank', 'Second stage RP-1 tank', 'Second stage common dome', 'Second stage forward & aft domes', 'Second stage helium COPVs', 'Second stage cold-gas thrusters', 'Second stage avionics', ...MVAC],
    mode: 'xray', explode: 0.45, view: { dir: [1, 0.15, 1.1], fill: 1.0 },
  },
  {
    title: 'A nozzle for vacuum',
    body: 'The Merlin Vacuum shares the Merlin 1D powerhead but adds a huge radiatively cooled niobium-alloy extension, expanding the exhaust 165 : 1. In vacuum the extra expansion turns more of the gas\'s heat into velocity; at sea level the same bell would over-expand and the flow would tear away from the wall. Its turbine exhaust is piped into a manifold that film-cools the extension.',
    key: 'Isp 348 s versus 311 s for the sea-level engine in vacuum; 981 kN, throttleable to ≈ 39 %, restartable.',
    focus: MVAC, explode: 0.7, view: { dir: [1, -0.2, 1.1], fill: 1.15 },
  },
  {
    title: 'Fairing and payload',
    body: 'The 13.1 m × 5.2 m carbon-composite fairing protects the payload through max-Q, then splits on its pneumatic separation system once the air is too thin to matter, about 3½ minutes in. Each half carries its own thrusters and parafoil and is recovered from the sea. Inside, the spacecraft sits on a conical adapter, held by a clamp band.',
    key: 'Dynamic pressure q = ½ ρ v² peaks about a minute after liftoff; the fairing goes once q is down to a few pascals.',
    focus: ['Fairing half A', 'Fairing half B', 'Fairing separation system', 'Fairing half A recovery system', 'Fairing half B recovery system', 'Payload attach fitting', 'Payload clamp band & separation springs', 'Payload: communications satellite', 'Payload solar arrays (stowed)', 'Payload antenna reflectors (stowed)', 'Payload apogee engine & propellant tanks'],
    explode: 0.65, view: { dir: [1, 0.2, 1.1], fill: 1.05 },
  },
  {
    title: 'Launch Complex 39A',
    body: 'Falcon Heavy flies from the pad that launched Apollo 11 and the first Space Shuttle. The transporter-erector rolls the vehicle up from the hangar and raises it on the launch mount; tail service masts and the TE arms feed it until T-0. Below, the 42 ft-deep flame trench and its V-shaped deflector carry the exhaust away, and a deluge of water absorbs heat and sound.',
    key: 'The trench is 490 ft long and 58 ft wide; the fixed service structure rises 247 ft, topped by a lightning mast.',
    focus: ['Launch mount', 'Hold-down clamps', 'Tail service masts', 'Transporter-erector strongback', 'TE umbilical & clamp arms', 'Fixed service structure', 'Crew access arm', 'Flame trench & deflector', 'Water deluge & sound suppression', 'Pad hardstand'],
    view: { dir: [1, 0.35, 1.4], fill: 1.0 },
  },
  {
    title: 'Now fly it',
    body: 'Open the launch simulator in the lab and press Launch. Watch the centre core throttle down, the side boosters separate, the centre core shut down and drop away, the Merlin Vacuum light and the fairing open. Push the payload toward 63.8 t, or change the pitch-over, and see whether it still makes orbit.',
    key: 'Orbital velocity at 200 km is ≈ 7.8 km/s; launching east from 28.6° N, Earth\'s rotation contributes ≈ 0.41 km/s.',
  },
];
