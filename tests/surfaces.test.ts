import { describe, expect, it } from "vitest";
import { TRACKS } from "../src/audio/tracks";
import { LEVEL_DEFS } from "../src/levels/all";
import {
  GROUND_STYLES,
  PIT_COLORS,
  THEME_SURFACE,
  spriteKeyGround,
  spriteKeyStone,
} from "../src/render/surfaces";

const THEMES = Object.keys(TRACKS).filter(
  (k) => k !== "title" && k !== "victory",
);

describe("surface styles", () => {
  it("every theme has a floor material, and every level theme is covered", () => {
    for (const t of THEMES)
      expect(THEME_SURFACE[t as keyof typeof THEME_SURFACE], t).toBeDefined();
    for (const d of LEVEL_DEFS)
      expect(THEME_SURFACE[d.theme], d.theme).toBeDefined();
  });

  it("only uses known styles, each with pit colours and distinct sprite keys", () => {
    const keys = new Set<string>();
    for (const s of GROUND_STYLES) {
      expect(PIT_COLORS[s], s).toBeDefined();
      keys.add(spriteKeyGround(s, true));
      keys.add(spriteKeyGround(s, false));
    }
    expect(keys.size).toBe(GROUND_STYLES.length * 2);
    for (const t of THEMES) {
      expect(GROUND_STYLES).toContain(
        THEME_SURFACE[t as keyof typeof THEME_SURFACE].ground,
      );
    }
  });

  it("offers a real variety of materials", () => {
    const used = new Set(
      THEMES.map((t) => THEME_SURFACE[t as keyof typeof THEME_SURFACE].ground),
    );
    for (const wanted of ["mud", "sand", "redbrick", "iron"] as const)
      expect(used.has(wanted), wanted).toBe(true);
    expect([...used].some((s) => s.startsWith("tile"))).toBe(true);
    expect(used.size).toBeGreaterThanOrEqual(7);
  });

  it("tech themes use iron or circuit floors and armoured undiggable plating", () => {
    for (const t of ["cyber", "matrix", "sanctum"] as const) {
      expect(THEME_SURFACE[t].stone).toBe("armor");
      expect(THEME_SURFACE[t].ground).toMatch(/^(iron|circuit)/);
    }
    expect(spriteKeyStone("armor")).not.toBe(spriteKeyStone("stone"));
  });
});
