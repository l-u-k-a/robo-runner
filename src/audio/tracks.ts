/**
 * Chiptune track data. A track is N bars of 16 steps (N = lead.length, usually 4 or 8).
 *  - `lead`: one 16-char string per bar. '.' = rest, otherwise a hex digit = scale degree
 *    (degrees past the scale length wrap into the next octave).
 *  - `bass`: scale degree of the bass root for each bar (same length as `lead`).
 */
export type DrumStyle = "none" | "sparse" | "march" | "drive";

export interface Track {
  bpm: number;
  root: number; // MIDI note of the scale root for the bass; lead plays one octave higher
  scale: number[];
  lead: string[];
  bass: number[];
  drums: DrumStyle;
  leadWave: OscillatorType;
  /** Lead note length in steps. */
  leadLen: number;
  /** Bass plays on every step multiple of this. */
  bassEvery: number;
  /** Repeat each lead note 3 steps later, quieter, for a spacious feel. */
  echo?: boolean;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];

export const TRACKS: Record<string, Track> = {
  // Grand 8-bar theme with an echo, deliberately unlike the level tracks.
  title: {
    bpm: 88,
    root: 45,
    scale: MINOR,
    lead: [
      "0...2...4...7...",
      "9...7...4...2...",
      "3...5...7...9...",
      "a...9...7...5...",
      "4...4.5.7...9...",
      "b...9...7.5.4...",
      "5...7...9...b...",
      "c.......7.......",
    ],
    bass: [0, 5, 3, 4, 0, 5, 3, 4],
    drums: "sparse",
    leadWave: "square",
    leadLen: 3,
    bassEvery: 4,
    echo: true,
  },
  matrix: {
    bpm: 118,
    root: 38,
    scale: [0, 3, 5, 6, 7, 10], // minor blues: tense, hacker feel
    lead: [
      "0..3..5..6..3..0",
      "0..3..5..8..7..5",
      "5..6..7..a..8..7",
      "6..5..3..0......",
    ],
    bass: [0, 0, 2, 4],
    drums: "drive",
    leadWave: "square",
    leadLen: 2,
    bassEvery: 2,
    echo: true,
  },
  // Triumphant 8-bar fanfare for the ending, major key with an echo.
  victory: {
    bpm: 112,
    root: 48,
    scale: [0, 2, 4, 5, 7, 9, 11],
    lead: [
      "0...2...4...7...",
      "9...7...9...b...",
      "7...9...b...c...",
      "e.......c.......",
      "9...b...c...e...",
      "f...e...c...b...",
      "9...7...9...b...",
      "c.......0.......",
    ],
    bass: [0, 3, 4, 0, 3, 4, 4, 0],
    drums: "march",
    leadWave: "square",
    leadLen: 3,
    bassEvery: 2,
    echo: true,
  },
  temple: {
    bpm: 108,
    root: 50,
    scale: [0, 1, 4, 5, 7, 8, 10], // phrygian dominant
    lead: [
      "0.1.4.1.0.1.4.5.",
      "4.5.7.5.4.1.0...",
      "7.8.7.5.4.5.4.1.",
      "0.1.0...4...0...",
    ],
    bass: [0, 0, 3, 0],
    drums: "march",
    leadWave: "square",
    leadLen: 2,
    bassEvery: 2,
  },
  ruins: {
    bpm: 124,
    root: 48,
    scale: [0, 2, 4, 7, 9], // major pentatonic
    lead: [
      "0.2.4.2.5.4.2.0.",
      "2.4.5.4.7.5.4.2.",
      "5.7.8.7.5.4.2.4.",
      "5.4.2.0.2.4.2...",
    ],
    bass: [0, 3, 4, 0],
    drums: "drive",
    leadWave: "triangle",
    leadLen: 2,
    bassEvery: 2,
  },
  fortress: {
    bpm: 92,
    root: 40,
    scale: MINOR,
    lead: [
      "0...0.2.3...2.0.",
      "0...0.2.4...3.2.",
      "5...5.4.3...2.0.",
      "2.3.4.3.2...0...",
    ],
    bass: [0, 0, 5, 4],
    drums: "march",
    leadWave: "square",
    leadLen: 3,
    bassEvery: 4,
  },
  crypt: {
    bpm: 70,
    root: 45,
    scale: [0, 1, 3, 5, 7, 8, 10], // phrygian
    lead: [
      "0.......1.......",
      "3.....2.1.......",
      "0.......4.....3.",
      "1.......0.......",
    ],
    bass: [0, 0, 1, 0],
    drums: "sparse",
    leadWave: "triangle",
    leadLen: 4,
    bassEvery: 8,
  },
  sanctum: {
    bpm: 132,
    root: 50,
    scale: MINOR,
    lead: [
      "0235753202357532",
      "0245754202457542",
      "3578a8753578a875",
      "2457975424579754",
    ],
    bass: [0, 0, 3, 4],
    drums: "drive",
    leadWave: "square",
    leadLen: 1,
    bassEvery: 2,
  },
  jungle: {
    bpm: 118,
    root: 48,
    scale: [0, 2, 4, 7, 9], // major pentatonic, tribal feel
    lead: [
      "0.0.2.4.2.0.4.2.",
      "4.4.5.7.5.4.2.0.",
      "7.5.4.5.7.8.7.5.",
      "4.2.0.2.4...0...",
    ],
    bass: [0, 3, 4, 0],
    drums: "march",
    leadWave: "triangle",
    leadLen: 2,
    bassEvery: 2,
  },
  ice: {
    bpm: 84,
    root: 57,
    scale: [0, 2, 4, 5, 7, 9, 11],
    lead: [
      "4...7...9...7...",
      "5...9...b...9...",
      "7...9...c...9...",
      "9...7...4.......",
    ],
    bass: [0, 5, 3, 4],
    drums: "sparse",
    leadWave: "triangle",
    leadLen: 3,
    bassEvery: 8,
  },
  volcano: {
    bpm: 100,
    root: 38,
    scale: [0, 1, 3, 5, 7, 8, 10], // phrygian
    lead: [
      "0.0.1.0.3.0.1.0.",
      "0.0.1.0.5.3.1.0.",
      "7.7.8.7.5.5.3.1.",
      "0.1.3.5.3.1.0...",
    ],
    bass: [0, 0, 1, 0],
    drums: "drive",
    leadWave: "square",
    leadLen: 2,
    bassEvery: 2,
  },
  atlantis: {
    bpm: 76,
    root: 52,
    scale: [0, 2, 4, 6, 7, 9, 11], // lydian
    lead: [
      "0.......4.......",
      "2.......6.....4.",
      "5.......7.......",
      "4.....2.0.......",
    ],
    bass: [0, 3, 4, 0],
    drums: "sparse",
    leadWave: "triangle",
    leadLen: 4,
    bassEvery: 8,
  },
  desert: {
    bpm: 96,
    root: 45,
    scale: [0, 1, 4, 5, 7, 8, 11], // double harmonic
    lead: [
      "0.1.4.5.4.1.0...",
      "4.5.7.8.7.5.4.1.",
      "8.7.5.4.1.0.1.4.",
      "5.4.1.0...0.....",
    ],
    bass: [0, 0, 4, 0],
    drums: "march",
    leadWave: "square",
    leadLen: 2,
    bassEvery: 2,
  },
  cyber: {
    bpm: 138,
    root: 45,
    scale: MINOR,
    lead: [
      "0472047204720472",
      "0572057205720572",
      "3a753a753a753a75",
      "2597259725972597",
    ],
    bass: [0, 0, 3, 4],
    drums: "drive",
    leadWave: "square",
    leadLen: 1,
    bassEvery: 2,
  },
  mansion: {
    bpm: 66,
    root: 43,
    scale: [0, 2, 3, 5, 7, 8, 11], // harmonic minor
    lead: [
      "4.......3.......",
      "2.......0.....1.",
      "4.....5.6.......",
      "7.......4.......",
    ],
    bass: [0, 4, 3, 0],
    drums: "sparse",
    leadWave: "triangle",
    leadLen: 4,
    bassEvery: 8,
  },
  sky: {
    bpm: 128,
    root: 55,
    scale: [0, 2, 4, 5, 7, 9, 11],
    lead: [
      "0.2.4.7.9.7.4.2.",
      "0.2.4.7.9.b.9.7.",
      "5.7.9.b.c.b.9.7.",
      "9.7.4.2.0...4...",
    ],
    bass: [0, 4, 3, 4],
    drums: "drive",
    leadWave: "square",
    leadLen: 2,
    bassEvery: 2,
  },
};
