export type ToolId = 'tuner' | 'metronome' | 'chords' | 'scales' | 'jam' | 'changes' | 'hunt' | 'ear' | 'piano';

export interface ToolInfo {
  id: ToolId;
  name: string;
  /** Model number printed on the pedal. */
  code: string;
  color: string;
  /** Dark text on a light enclosure. */
  lightEnclosure?: boolean;
  blurb: string;
  knobs: string[];
}

export const TOOLS: ToolInfo[] = [
  {
    id: 'tuner',
    name: 'Tuner',
    code: 'ST-01',
    color: 'var(--p-tuner)',
    blurb: 'Tune with the mic or by ear. Strobe and needle, ten tunings.',
    knobs: ['Pitch', 'Cal'],
  },
  {
    id: 'metronome',
    name: 'Metronome',
    code: 'ST-02',
    color: 'var(--p-metro)',
    blurb: 'A steady click with accents, subdivisions and a speed trainer.',
    knobs: ['Tempo', 'Beat', 'Sub'],
  },
  {
    id: 'chords',
    name: 'Chord Lab',
    code: 'ST-03',
    color: 'var(--p-chords)',
    lightEnclosure: true,
    blurb: 'Every chord with fingered shapes up the neck. Or tap frets and it names the chord.',
    knobs: ['Root', 'Type'],
  },
  {
    id: 'scales',
    name: 'Scale Map',
    code: 'ST-04',
    color: 'var(--p-scales)',
    blurb: 'Light up any scale across the neck, one hand position at a time.',
    knobs: ['Key', 'Mode'],
  },
  {
    id: 'jam',
    name: 'Backing Band',
    code: 'ST-05',
    color: 'var(--p-jam)',
    blurb: 'Drums and strummed chords to play along with. Pick a progression or write your own.',
    knobs: ['Key', 'Tempo', 'Feel'],
  },
  {
    id: 'changes',
    name: 'Chord Changes',
    code: 'ST-06',
    color: 'var(--p-changes)',
    blurb: 'The one-minute changes drill. Switch between two chords and beat your best.',
    knobs: ['Time', 'Count'],
  },
  {
    id: 'hunt',
    name: 'Note Hunt',
    code: 'ST-07',
    color: 'var(--p-hunt)',
    blurb: 'A 60-second game for learning every note on the neck. Tap it, or play it.',
    knobs: ['Speed', 'Score'],
  },
  {
    id: 'ear',
    name: 'Ear Trainer',
    code: 'ST-08',
    color: 'var(--p-ear)',
    blurb: 'Intervals, chord qualities and single notes, with songs to remember them by.',
    knobs: ['Gain', 'Tone'],
  },
  {
    id: 'piano',
    name: 'Piano Bridge',
    code: 'ST-09',
    color: 'var(--p-piano)',
    lightEnclosure: true,
    blurb: 'Play what you know on the keys and see where it lives on the fretboard.',
    knobs: ['Keys', 'Neck'],
  },
];

export function toolInfo(id: ToolId): ToolInfo {
  return TOOLS.find((t) => t.id === id)!;
}
