// Guided tour: uav. See ../tours.js for the step format.

export default [
  {
    title: 'Built to stay up, not to go fast',
    body: 'KESTREL is designed for loiter: it can circle over one spot for more than a day while its sensors watch the ground. Almost every design choice — the long wing, the pusher turboprop, the slim fuselage — follows from that.',
    key: 'Endurance scales with (η/c)·(C_L^1.5 / C_D): efficiency, not speed.',
  },
  {
    title: 'A long, thin wing',
    body: 'Induced drag — the cost of making lift — falls as span grows. At aspect ratio 16.8 this wing reaches a lift-to-drag ratio near 20 at loiter speed. Pressure view shows the suction peak spread along the span.',
    key: 'Induced drag C_Di = C_L² / (π e AR).',
    mode: 'pressure', focus: ['Starboard wing', 'Port wing', 'Y-tail & ruddervators'], view: { dir: [0.3, 1, 0.6], fill: 1.1 },
  },
  {
    title: 'Pusher turboprop',
    body: 'Mounting the propeller at the back keeps the nose clear for sensors and the satellite dish. A turboprop is most efficient at moderate speed: the propeller turns about 80 % of the shaft power into thrust.',
    key: 'Power required P = D · V / η_prop; best endurance comes at the minimum-power speed.',
    focus: ['Turboprop & propeller'], view: { dir: [-1, 0.4, 0.8] },
  },
  {
    title: 'The sensor turret',
    body: 'A gyro-stabilised ball carries daylight and infrared cameras and a laser that both measures range and marks targets for guided weapons. Stabilisation keeps the image steady from kilometres away while the aircraft bumps through air.',
    key: 'The laser pulses at a coded rate so a weapon only follows its own spot.',
    focus: ['EO/IR sensor turret'], view: { dir: [1, -0.2, 0.7] }, demo: 'laser',
  },
  {
    title: 'Flying from another continent',
    body: 'Beyond radio line-of-sight the aircraft is flown through a geostationary satellite, via the Ku-band dish in the nose bulge. The round trip adds about 0.6 s of delay — too slow for a hand-flown landing, so take-off and landing use a local line-of-sight link.',
    key: 'Up to GEO and back: 4 × 35,786 km ÷ c ≈ 0.48 s, plus processing.',
    focus: ['Ku-band satcom antenna', 'Satcom radome'], mode: 'xray', view: { dir: [1, 0.5, 0.6] },
  },
  {
    title: 'Payload on the wings',
    body: 'Four hardpoints carry guided weapons or sensor pods. Every kilogram of stores is a kilogram of fuel left behind, so mission planners trade payload against time on station — try it in the endurance lab.',
    key: 'MTOW 4,760 kg = empty 2,223 kg + fuel + payload.',
    focus: ['Starboard stores', 'Port stores'], view: { dir: [0.6, -0.4, 1] },
  },
];
