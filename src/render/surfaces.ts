import type { Theme } from "../game/types";

/** Look of the diggable floor ('#'). */
export type GroundStyle =
  | "earth"
  | "mud"
  | "sand"
  | "tile"
  | "tileIce"
  | "tileDark"
  | "redbrick"
  | "iron"
  | "circuit"
  | "circuitGreen"
  | "circuitViolet";

/** Look of the undiggable floor ('@'). Tech themes get heavy armour plating. */
export type StoneStyle = "stone" | "armor";

export interface Surface {
  ground: GroundStyle;
  stone: StoneStyle;
}

export const GROUND_STYLES: GroundStyle[] = [
  "earth",
  "mud",
  "sand",
  "tile",
  "tileIce",
  "tileDark",
  "redbrick",
  "iron",
  "circuit",
  "circuitGreen",
  "circuitViolet",
];

/** Every theme picks its floor material. The Record type forces new themes to choose one. */
export const THEME_SURFACE: Record<Theme, Surface> = {
  temple: { ground: "sand", stone: "stone" },
  ruins: { ground: "earth", stone: "stone" },
  fortress: { ground: "redbrick", stone: "stone" },
  crypt: { ground: "tileDark", stone: "stone" },
  sanctum: { ground: "circuitViolet", stone: "armor" },
  jungle: { ground: "mud", stone: "stone" },
  ice: { ground: "tileIce", stone: "stone" },
  volcano: { ground: "iron", stone: "stone" },
  atlantis: { ground: "tile", stone: "stone" },
  desert: { ground: "sand", stone: "stone" },
  cyber: { ground: "circuit", stone: "armor" },
  mansion: { ground: "tile", stone: "stone" },
  sky: { ground: "earth", stone: "stone" },
  matrix: { ground: "circuitGreen", stone: "armor" },
};

/** Colours used inside a pit: the cavity wall and the material that refills it. */
export const PIT_COLORS: Record<GroundStyle, { fill: string; cavity: string }> =
  {
    earth: { fill: "#7b4a24", cavity: "#1a0d05" },
    mud: { fill: "#4a3320", cavity: "#150d06" },
    sand: { fill: "#dcbc72", cavity: "#5a4420" },
    tile: { fill: "#d9a85a", cavity: "#3a2810" },
    tileIce: { fill: "#bfe6f5", cavity: "#1a3a4a" },
    tileDark: { fill: "#3e4a4c", cavity: "#080c0c" },
    redbrick: { fill: "#b0442c", cavity: "#2a0e08" },
    iron: { fill: "#5c6672", cavity: "#0c0e12" },
    circuit: { fill: "#1a222c", cavity: "#04080c" },
    circuitGreen: { fill: "#1a2c22", cavity: "#030a06" },
    circuitViolet: { fill: "#241a34", cavity: "#07040c" },
  };

export const spriteKeyGround = (style: GroundStyle, top: boolean): string =>
  `tile.${style}.${top ? "top" : "mid"}`;
export const spriteKeyStone = (style: StoneStyle): string => `tile.${style}`;
