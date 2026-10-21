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
  'MVac gas generator & exhaust manifold', 'MVac TVC actuators', 'MVac TVC supply & return lines', 'MVac valves & TEA-TEB igniter', 'MVac engine controller'];
const OUTER = (who) => ['thrust chambers & nozzles', 'turbopumps', 'gas generators', 'turbine exhaust ducts', 'propellant ducts & valves'].map((c) => `${who} outer Merlin 1D ${c}`);

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
    body: 'With the skins see-through you can follow the propellant. LOX leaves its tank through a double-walled transfer tube straight down the middle of the RP-1 tank — the gap keeps the 66 K oxygen from freezing the 266 K kerosene — to a ring manifold in the engine bay; RP-1 leaves the aft dome through nine lines, each with a prevalve. Helium bottles (COPVs) on one manifold sit in the LOX; warmed in the engine bay, their gas keeps both tanks pressurised as they drain.',
    key: 'The LOX tank is a monocoque and the RP-1 tank is skin-and-stringer; a tank pressurised to a few bar is stiffer than its walls alone, because pressure carries part of the load.',
    focus: [`${CORE} helium COPVs`, `${CORE} forward dome`, `${CORE} double-wall LOX transfer tube`, `${CORE} helium COPV manifold & fill line`, `${CORE} pressurisation lines`, `${CORE} helium heat exchanger`, `${CORE} common dome`, `${CORE} aft dome`, `${CORE} LOX distribution manifold`, `${CORE} RP-1 feed lines`, `${CORE} prevalves`, `${CORE} RP-1 tank stringers`],
    mode: 'xray', view: { dir: [1, 0.1, 1.2], fill: 1.2, lift: 0.16 },
  },
  {
    title: 'Loading on the pad',
    body: 'Early in the count the ground feeds each core through its T-0 plate: LOX through a fill-and-drain valve into the feed manifold and up the transfer tube, RP-1 into the bottom of the fuel tank, helium to the COPVs. Densified LOX keeps boiling off, so the vent valve at the top of the tank breathes vapour overboard and LOX is topped up to the last minutes. Seven minutes out, bleed valves chill every turbopump and nitrogen purges the engine bay.',
    key: 'Densified LOX at 66 K holds ≈ 1,240 kg/m³ against ≈ 1,140 kg/m³ at its normal boiling point: ≈ 8 % more oxidiser in the same tank, at the price of loading it late and continuously.',
    focus: [`${CORE} T-0 umbilical plate`, `${CORE} LOX fill & drain valve`, `${CORE} RP-1 fill & drain valve`, `${CORE} LOX vent & relief valve`, `${CORE} RP-1 vent valve`,
      `${CORE} helium COPV manifold & fill line`, `${CORE} engine-chill bleed valves & lines`, `${CORE} GN₂ purge manifold`, `${CORE} LOX distribution manifold`, `${CORE} double-wall LOX transfer tube`],
    mode: 'systems', view: { dir: [0.35, 0.12, -1.3], fill: 1.15, lift: 0.1 },
  },
  {
    title: 'The Merlin 1D cycle',
    body: 'Here the centre engine is broken out. One shaft carries the LOX pump, the RP-1 pump and a turbine, which a small gas generator spins by burning a fuel-rich trickle of both propellants; its exhaust is dumped overboard — an open gas-generator cycle, simpler than staged combustion for a few seconds of Isp. Past the main valves (a servo butterfly valve trims the mixture) the propellants meet at a pintle injector and burn at about 9.7 MPa. The steering actuators run on high-pressure RP-1 from the same pump.',
    key: 'One shaft, two impellers, one turbine. The often-quoted 36,000 rpm and ≈ 10,000 hp are the Merlin 1C pump\'s; no Merlin 1D figure is published. TEA-TEB, which ignites on contact with LOX, lights the engine and allows restarts.',
    focus: ENGINE, explode: 0.85, view: { dir: [0.85, 0.42, 1.4], fill: 1.15 },
  },
  {
    title: 'Octaweb and engine-out',
    body: 'Eight Merlins ring a ninth on the Octaweb, a bolted aluminium thrust structure; two actuators per engine gimbal each nozzle for steering, using high-pressure RP-1 as hydraulic fluid, and each engine has its own controller. With nine engines per core, the flight computers can shut one down, close its prevalves and let the others gimbal and burn longer to cover the loss.',
    key: 'F = ṁ·vₑ + (pₑ − pₐ)·Aₑ: back-pressure on the ≈ 0.68 m² nozzle exit costs each Merlin 69 kN at sea level (914 → 845 kN).',
    focus: [`${CORE} Octaweb`, ...OUTER(CORE), `${CORE} outer-engine TVC actuators`, `${CORE} TVC hydraulic supply & return lines`, `${CORE} engine controllers`, `${CORE} heat shield & engine boots`, ...ENGINE],
    mode: 'systems', explode: 0.3, view: { dir: [1, -0.55, 1.1], fill: 1.1 },
  },
  {
    title: 'Brains, nerves and eyes',
    body: 'Each stage flies itself. Three flight computers vote on every decision, fed by an inertial unit and GPS, and two independent flight-safety computers would end the flight on their own if it left its corridor. Cables cannot cross the propellant, so they run up the outside of the tanks in the raceway — black on Block 5 — and branch off in harness rings at both ends, one lead to each engine controller. S-band transmitters send telemetry and camera views down, even after separation.',
    key: 'Triple redundancy: if each computer fails with probability p, two-out-of-three voting fails with ≈ 3p² — for p = 10⁻³ that is 3 × 10⁻⁶.',
    focus: [`${SBA} flight computers`, `${SBA} IMU & GPS navigation unit`, `${SBA} autonomous flight-safety system`, `${SBA} batteries & power distribution`, `${SBA} S-band transmitters`,
      `${SBA} raceway`, `${SBA} wiring harnesses`, `${SBA} engine controllers`, `${SBA} S-band telemetry antennas`, `${SBA} GPS antennas`, `${SBA} forward camera`, `${SBA} engine-section camera`, `${SBA} forward-skirt avionics brackets`],
    mode: 'systems', view: { dir: [1.3, 0.2, 0.9], fill: 1.0, lift: 0.08 },
  },
  {
    title: 'Holding three cores together',
    body: 'The side boosters ride on the centre core, which has thicker tank walls and a reinforced interstage. Each booster is held at two levels: two pneumatic pusher mechanisms fasten it to the top of the centre core\'s LOX tank (shown here), and two more join the engine sections at the base engine mounts. About 2½ minutes in, the boosters shut down, the fittings release and the pushers shove them clear; each booster takes its half of the fittings with it.',
    key: 'Pneumatic separation gives a low-shock push over a long stroke and can be tested on the real flight hardware — explosive bolts cannot. The 2 + 2 count is the Falcon User\'s Guide\'s; the fittings\' shape and helium supply are estimates.',
    focus: [`${CORE} forward attach & pushers (A)`, `${CORE} forward attach & pushers (B)`, `${SBA} forward attach fitting`, 'Side booster B forward attach fitting', `${CORE} forward booster-separation helium bottles`],
    mode: 'systems', view: { dir: [0.25, 0.3, 1.4], fill: 1.5 },
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
    body: 'For the landing burn the centre engine relights, sometimes with two neighbours, on TEA-TEB fed from the engine-bay tank. In the last seconds the four legs swing down (watch): each is an A-frame whose diagonal is a nested, telescoping piston, driven out by high-pressure helium from the engine-bay bottles to a stance about 18 m across. A collet locks each piston at full stroke, and a crush core inside it soaks up a hard landing.',
    key: 'On Jason-3 (January 2016) the stage touched down softly, but one lock-out collet failed to latch, the leg folded and the stage tipped over. Recovering the boosters costs payload: 63.8 t to LEO is the fully expendable figure.',
    focus: [`${SBA} landing legs`, `${SBA} leg telescoping pistons`, `${SBA} leg lock-out collets`, `${SBA} leg-deployment helium lines`, `${SBA} pneumatic helium bottles`,
      `${SBA} Merlin 1D thrust chamber & pintle injector`, `${SBA} Merlin 1D nozzle`, `${SBA} Merlin 1D valves & TEA-TEB igniter`, `${SBA} TEA-TEB ignition tank`, `${SBA} TEA-TEB relight lines`],
    // low side view: the legs swing out to ≈ 9 m from the booster axis, so frame wider than the
    // stowed subject; the launch mount steps aside while the legs are out
    mode: 'systems', demo: 'deploy', view: { dir: [1.3, 0.06, 0.85], fill: 1.7 },
  },
  {
    title: 'Interstage and second stage',
    body: 'The 4.5 m composite interstage — white-grey on Falcon Heavy centre cores — stays with the centre core and shrouds the second-stage engine. At separation helium opens three latches through redundant actuators and four pneumatic pushers, one a redundant centre pusher, part the stages. The second stage is a shorter copy of the first — LOX over RP-1, common dome, helium bottles in the LOX — with nitrogen thrusters for attitude control and, on most Falcon Heavy flights, a mission-extension kit for long coasts.',
    key: 'Staging: Δv = Isp·g₀·ln(m₀ / m_f) for each stage, and the stages add — no single stage could reach orbit with this payload.',
    focus: [`${CORE} interstage`, `${CORE} stage-separation latches`, `${CORE} stage-separation pneumatic pushers`, `${CORE} stage-separation helium bottle & lines`, 'Second stage LOX tank', 'Second stage RP-1 tank', 'Second stage common dome', 'Second stage forward dome', 'Second stage aft dome', 'Second stage helium COPVs', 'Second stage cold-gas thrusters', 'Second stage nitrogen tanks', 'Second stage flight computers', 'Second stage IMU & GPS unit', 'Second stage flight-termination system', 'Second stage mission-extension kit band', 'Second stage mission-extension kit COPVs', 'Second stage mission-extension kit batteries & TEA-TEB', ...MVAC],
    mode: 'xray', explode: 0.45, view: { dir: [1, 0.15, 1.1], fill: 1.25, lift: 0.2 },
  },
  {
    title: 'A nozzle for vacuum',
    body: 'The Merlin Vacuum shares the Merlin 1D powerhead but adds a huge radiatively cooled niobium-alloy extension, expanding the exhaust 165 : 1 to a 3.3 m exit. In vacuum the extra expansion turns more of the gas\'s heat into velocity; at sea level the same bell would over-expand and the flow would tear away from the wall. Its turbine exhaust is piped into a manifold that film-cools the extension.',
    key: 'Isp 348 s versus 311 s for the sea-level engine in vacuum; 981 kN (SpaceX\'s Falcon Heavy page lists 934 kN), throttleable to ≈ 64 % (Falcon User\'s Guide; Wikipedia: 39 %), restartable. Since 2023 lighter missions fly a shorter extension.',
    focus: MVAC, explode: 0.7, view: { dir: [1, -0.2, 1.1], fill: 1.15 },
  },
  {
    title: 'Fairing and payload',
    body: 'The 13.2 m × 5.2 m composite fairing protects the payload through max-Q, its blankets damping the roar; pad air conditioning flows in through an inlet on its side until liftoff. About 4 minutes in, helium opens the latches along its vertical seams and four pneumatic pushers split it. Each half carries its own nitrogen thrusters, avionics, GPS and parafoil and is recovered from the sea. Inside, the spacecraft sits on an adapter on the 1,575 mm attach fitting, held by a clamp band.',
    key: 'Dynamic pressure q = ½ρv² peaks about a minute after liftoff; the fairing waits until the free-molecular heating ½ρv³ drops below the Falcon User\'s Guide limit, high in the thermosphere.',
    focus: ['Fairing half A', 'Fairing half B', 'Fairing half A acoustic blankets', 'Fairing half A seam latches', 'Fairing half A pneumatic pushers', 'Fairing half A helium bottle & lines', 'Fairing half A recovery thrusters', 'Fairing half A recovery N₂ tank & lines', 'Fairing half A recovery avionics & GPS', 'Fairing half A parafoil', 'Fairing access door', 'Fairing air-conditioning inlet', 'Payload attach fitting', 'PAF close-out plate', 'Payload adapter (1,666 mm)', 'Payload clamp band & separation springs', 'Payload: communications satellite', 'Payload solar arrays (stowed)', 'Payload antenna reflectors (stowed)', 'Payload apogee engine & propellant tanks'],
    explode: 0.65, view: { dir: [1, 0.2, 1.1], fill: 1.1, lift: 0.06 },
  },
  {
    title: 'Launch Complex 39A — now fly it',
    body: 'Falcon Heavy flies from the pad of Apollo 11 and the first Shuttle. The transporter-erector rolls the vehicle up the old crawlerway ramp on rails straddling the flame trench, raises it onto the launch mount and stays as its umbilical tower, feeding the centre core\'s base and the second stage; tail service masts feed the side boosters. Hydraulic clamps hold all 27 engines until T-0, water deluges the deck and a wire from the lightning mast shields the pad. Then open the lab and press Launch.',
    key: 'The trench is 490 ft long, 58 ft wide and 42 ft deep. Orbital velocity at 200 km is ≈ 7.8 km/s; launching east from 28.6° N, Earth\'s rotation gives ≈ 0.41 km/s of it.',
    // no focus: the whole vehicle stands on the pad (ghosting it would leave the pad empty)
    view: { dir: [0.75, 0.16, 1.4], fill: 0.95, lift: 0.12 },
  },
];
