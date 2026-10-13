// Guided tour: SpaceX Falcon Heavy on LC-39A. See ../tours.js for the step format.
// Each step frames only the parts it teaches; view.lift raises the camera target (in units of the
// focus radius) so tall subjects sit below the toolbars at the top right.

const CORE = 'Centre core';
const SBA = 'Side booster A';
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
    key: '27 × 845 kN ≈ 22,819 kN of liftoff thrust against ≈ 1,421 t plus payload (≈ 14,100 kN of weight with a 15 t payload): thrust-to-weight ≈ 1.6.',
    view: { lift: 0.14 },
  },
  {
    title: 'Mostly tank',
    body: 'Each core is two aluminium-lithium tanks in one barrel: liquid oxygen on top, RP-1 kerosene below, split by a single common dome. In the thermal view the LOX tank is the coldest thing on the pad — SpaceX densifies it to −207 °C so more fits, and chills the RP-1 to about −7 °C.',
    key: 'Per core ≈ 287 t of LOX and ≈ 124 t of RP-1 (mixture ratio ≈ 2.33 by mass): propellant is ≈ 95 % of a fuelled core.',
    focus: [`${CORE} LOX tank`, `${CORE} RP-1 tank`, `${CORE} forward dome`, `${CORE} common dome`, `${CORE} aft dome`, 'Second stage LOX tank', 'Second stage RP-1 tank'],
    mode: 'thermal', view: { dir: [1, 0.15, 1.3], fill: 1.18, lift: 0.14 },
  },
  {
    title: 'Inside the tank',
    body: 'With the skins see-through you can follow the propellant. LOX leaves the bottom of its tank through the downcomer, a pipe that runs straight down the middle of the RP-1 tank to a ring manifold in the engine bay; RP-1 leaves the aft dome through nine lines, and each engine inlet has a prevalve. Helium bottles (COPVs) sit submerged in the LOX; as the tanks drain, warmed helium keeps them pressurised so the pumps never starve.',
    key: 'The LOX tank is a monocoque and the RP-1 tank is skin-and-stringer; a tank pressurised to a few bar is stiffer than its walls alone, because pressure carries part of the load.',
    focus: [`${CORE} helium COPVs`, `${CORE} forward dome`, `${CORE} LOX downcomer`, `${CORE} common dome`, `${CORE} aft dome`, `${CORE} LOX distribution manifold`, `${CORE} RP-1 feed lines`, `${CORE} prevalves`, `${CORE} RP-1 tank stringers`],
    mode: 'xray', view: { dir: [1, 0.1, 1.2], fill: 1.2, lift: 0.16 },
  },
  {
    title: 'The Merlin 1D cycle',
    body: 'Here the centre engine is broken out. A single shaft carries the LOX pump, the RP-1 pump and a turbine. A small gas generator burns a fuel-rich trickle of both propellants to spin the turbine, and its exhaust is dumped overboard through the duct — an "open" gas-generator cycle, simpler than staged combustion at the cost of a few seconds of Isp. The pumped propellants meet at a pintle injector and burn at about 9.7 MPa.',
    key: 'Turbopump ≈ 36,000 rpm and ≈ 10,000 hp; TEA-TEB, which ignites on contact with LOX, lights the engine and allows restarts.',
    focus: ENGINE, explode: 0.85, view: { dir: [0.85, 0.42, 1.4], fill: 1.15 },
  },
  {
    title: 'Octaweb and engine-out',
    body: 'Eight Merlins ring a ninth on the Octaweb, a bolted aluminium thrust structure; two actuators per engine gimbal each nozzle for steering, using high-pressure RP-1 as hydraulic fluid, and each engine has its own controller. With nine engines per core, the flight computers can shut one down, close its prevalves and let the others gimbal and burn longer to cover the loss.',
    key: 'F = ṁ·vₑ + (pₑ − pₐ)·Aₑ: back-pressure on the ≈ 0.68 m² nozzle exit costs each Merlin 69 kN at sea level (914 → 845 kN).',
    focus: [`${CORE} Octaweb`, `${CORE} Merlin 1D engines (outer ring)`, `${CORE} outer-engine TVC actuators`, `${CORE} engine controllers`, `${CORE} heat shield & engine boots`, ...ENGINE],
    mode: 'systems', explode: 0.3, view: { dir: [1, -0.55, 1.1], fill: 1.1 },
  },
  {
    title: 'Holding three cores together',
    body: 'The side boosters ride on the centre core, which has thicker tank walls and a reinforced interstage. Attach fittings join them at two levels — between each booster\'s forward section and the base of the centre interstage (shown here), and between the engine sections at the Octawebs — with pneumatic pushers at each. About 2½ minutes in, the boosters shut down, the fittings release and the pushers shove them clear; each booster takes its half of the fittings with it.',
    key: 'Pneumatic separation gives a low-shock push over a long stroke and can be tested on the real flight hardware — explosive bolts cannot. The exact number and layout of the attachments are not published.',
    focus: [`${CORE} forward attach & pushers (A)`, `${CORE} forward attach & pushers (B)`, `${SBA} forward attach fitting`, 'Side booster B forward attach fitting'],
    mode: 'systems', view: { dir: [0.25, 0.3, 1.4], fill: 1.6 },
  },
  {
    title: 'Coming home: fins and thrusters',
    body: 'Falcon Heavy\'s side boosters normally fly back. Moments after separation, nitrogen cold-gas thrusters flip each booster and the four titanium grid fins swing out. Three engines relight for a boost-back burn toward the landing zone, and again for an entry burn that slows the booster through the upper atmosphere, while the fins steer it — driven by a closed-loop hydraulic unit in the forward section.',
    key: 'Grid fins work like a lattice of small wings: they stay effective from supersonic speeds down to landing, where a flat fin would stall.',
    focus: [`${SBA} grid fins`, `${SBA} grid-fin actuators`, `${SBA} grid-fin hydraulic power unit`, `${SBA} cold-gas thrusters`, `${SBA} nitrogen tanks`],
    mode: 'xray', view: { dir: [1.3, 0.25, 0.9], fill: 1.5 },
  },
  {
    title: 'Coming home: legs and the landing burn',
    body: 'For the landing burn the centre engine relights, sometimes with two neighbours, on TEA-TEB from the engine-bay tank. In the last seconds the four carbon-fibre legs swing down, pushed out by telescoping pistons on high-pressure helium, to a stance about 18 m across.',
    key: 'Recovering the boosters costs payload: 63.8 t to LEO is the fully expendable figure, and expended cores fly without legs or grid fins.',
    focus: [`${SBA} landing legs`, `${SBA} leg deployment pistons`, `${SBA} pneumatic helium bottles`, `${SBA} Merlin 1D centre engine`, `${SBA} TEA-TEB ignition tank`],
    // low side view, close: the legs fill the frame left of the Systems legend, and the leg callout
    // (anchored on the 45° leg, just left of the subject's centre) reads up-right, clear of the legend
    mode: 'systems', view: { dir: [1.3, 0.06, 0.85], fill: 1.05 },
  },
  {
    title: 'Interstage and second stage',
    body: 'The carbon-composite interstage — on Falcon Heavy centre cores its black thermal layer is painted white-grey — stays with the centre core and shrouds the second-stage engine. At separation three collets open and pneumatic pushers part the stages. The second stage is a shorter copy of the first — LOX over RP-1, common dome, helium bottles in the LOX — with nitrogen thrusters for attitude control and, on most Falcon Heavy flights, a grey band over the RP-1 tank for long coasts.',
    key: 'Staging: Δv = Isp·g₀·ln(m₀ / m_f) for each stage, and the stages add — no single stage could reach orbit with this payload.',
    focus: [`${CORE} interstage`, `${CORE} stage-separation collets & pushers`, 'Second stage LOX tank', 'Second stage RP-1 tank', 'Second stage common dome', 'Second stage forward dome', 'Second stage aft dome', 'Second stage helium COPVs', 'Second stage cold-gas thrusters', 'Second stage nitrogen tanks', 'Second stage avionics', 'Second stage mission-extension kit', ...MVAC],
    mode: 'xray', explode: 0.45, view: { dir: [1, 0.15, 1.1], fill: 1.25, lift: 0.2 },
  },
  {
    title: 'A nozzle for vacuum',
    body: 'The Merlin Vacuum shares the Merlin 1D powerhead but adds a huge radiatively cooled niobium-alloy extension, expanding the exhaust 165 : 1 to a 3.3 m exit. In vacuum the extra expansion turns more of the gas\'s heat into velocity; at sea level the same bell would over-expand and the flow would tear away from the wall. Its turbine exhaust is piped into a manifold that film-cools the extension.',
    key: 'Isp 348 s versus 311 s for the sea-level engine in vacuum; 981 kN (SpaceX\'s Falcon Heavy page lists 934 kN), throttleable to ≈ 39 %, restartable.',
    focus: MVAC, explode: 0.7, view: { dir: [1, -0.2, 1.1], fill: 1.15 },
  },
  {
    title: 'Fairing and payload',
    body: 'The 13.1 m × 5.2 m carbon-composite fairing protects the payload through max-Q, its acoustic blankets damping the roar. About 4 minutes in, once aerodynamic heating on the payload has fallen to a low level, its pneumatic latches and pushers split it in two. Each half carries its own thrusters and parafoil and is recovered from the sea. Inside, the spacecraft sits on a conical adapter, held by a clamp band.',
    key: 'Dynamic pressure q = ½ρv² peaks about a minute after liftoff; the fairing waits until the free-molecular heating ½ρv³ drops below the Falcon User\'s Guide limit, high in the thermosphere.',
    focus: ['Fairing half A', 'Fairing half B', 'Fairing half A acoustic blankets', 'Fairing half A separation pushers', 'Fairing half A recovery system', 'Fairing half A parafoil', 'Payload attach fitting', 'Payload clamp band & separation springs', 'Payload: communications satellite', 'Payload solar arrays (stowed)', 'Payload antenna reflectors (stowed)', 'Payload apogee engine & propellant tanks'],
    explode: 0.65, view: { dir: [1, 0.2, 1.1], fill: 1.1, lift: 0.06 },
  },
  {
    title: 'Launch Complex 39A — now fly it',
    body: 'Falcon Heavy flies from the pad that launched Apollo 11 and the first Space Shuttle. The transporter-erector rolls the vehicle up from the hangar and sets it on the launch mount built over the old flame trench; tail service masts and the TE arms feed it until T-0, and a deluge of water absorbs heat and sound. (The crew access arm on the tower was removed in February 2026.) Then open the launch simulator in the lab and press Launch.',
    key: 'The trench is 490 ft long, 58 ft wide and 42 ft deep. Orbital velocity at 200 km is ≈ 7.8 km/s; launching east from 28.6° N, Earth\'s rotation gives ≈ 0.41 km/s of it.',
    // no focus: the whole vehicle stands on the pad (ghosting it would leave the pad empty)
    view: { dir: [0.75, 0.16, 1.4], fill: 0.95, lift: 0.12 },
  },
];
