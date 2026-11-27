import { describe, expect, it } from "vitest";
import { Menu } from "../src/core/menu";
import {
  clampVolume,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from "../src/core/settings";

describe("Menu", () => {
  it("wraps in both directions", () => {
    const m = new Menu(3);
    m.up();
    expect(m.index).toBe(2);
    m.down();
    m.down();
    expect(m.index).toBe(1);
    m.reset(2);
    expect(m.index).toBe(0);
    m.up();
    expect(m.index).toBe(1);
  });
});

describe("settings", () => {
  const store = (initial?: string) => {
    let v = initial;
    return {
      getItem: () => v ?? null,
      setItem: (_k: string, val: string) => {
        v = val;
      },
    };
  };

  it("defaults when nothing is saved or the data is broken", () => {
    expect(loadSettings(store())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(store("not json"))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(store('{"music":"yes","musicVolume":"loud"}'))).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it("round-trips and clamps volume", () => {
    const s = store();
    saveSettings({ music: false, sfx: true, musicVolume: 8, golden: true }, s);
    expect(loadSettings(s)).toEqual({
      music: false,
      sfx: true,
      musicVolume: 8,
      golden: true,
    });
    expect(loadSettings(store('{"musicVolume":99}')).musicVolume).toBe(10);
    expect(clampVolume(-3)).toBe(0);
  });
});
