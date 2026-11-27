import { describe, expect, it } from "vitest";
import { degreeToSemitone } from "../src/audio/music";
import { TRACKS } from "../src/audio/tracks";
import { LEVEL_DEFS } from "../src/levels/all";

describe("music tracks", () => {
  for (const [name, t] of Object.entries(TRACKS)) {
    it(`${name} has bars of 16 valid steps`, () => {
      expect(t.lead.length).toBeGreaterThanOrEqual(4);
      for (const bar of t.lead) {
        expect(bar).toHaveLength(16);
        expect(bar).toMatch(/^[.0-9a-f]+$/);
      }
      expect(t.bass).toHaveLength(t.lead.length);
      expect(t.bpm).toBeGreaterThan(40);
    });
  }

  it("every level theme has a track", () => {
    for (const d of LEVEL_DEFS) expect(TRACKS[d.theme], d.theme).toBeDefined();
    expect(TRACKS.title).toBeDefined();
  });

  it("the title screen has its own 8-bar track", () => {
    expect(TRACKS.title.lead).toHaveLength(8);
    expect(TRACKS.title.lead).not.toEqual(TRACKS.temple.lead);
  });

  it("degreeToSemitone wraps into higher octaves", () => {
    const minor = [0, 2, 3, 5, 7, 8, 10];
    expect(degreeToSemitone(minor, 0)).toBe(0);
    expect(degreeToSemitone(minor, 6)).toBe(10);
    expect(degreeToSemitone(minor, 7)).toBe(12);
    expect(degreeToSemitone(minor, 10)).toBe(12 + 5);
  });
});
