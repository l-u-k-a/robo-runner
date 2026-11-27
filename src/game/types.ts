export type Tile =
  "empty" | "ground" | "stone" | "ladder" | "rope" | "zipR" | "zipL";
export type ToolKind =
  "shock" | "decoy" | "emp" | "boots" | "smoke" | "glue" | "bomb";
export type Theme =
  | "temple"
  | "ruins"
  | "fortress"
  | "crypt"
  | "sanctum"
  | "jungle"
  | "ice"
  | "volcano"
  | "atlantis"
  | "desert"
  | "cyber"
  | "mansion"
  | "sky"
  | "matrix";

export interface Pos {
  x: number;
  y: number;
}

export interface LevelDef {
  name: string;
  theme: Theme;
  map: string[];
}

export interface ParsedLevel {
  name: string;
  theme: Theme;
  tiles: Tile[][];
  gold: Pos[];
  diamonds: Pos[];
  items: (Pos & { kind: ToolKind })[];
  hero: Pos;
  guards: Pos[];
  exit: Pos;
}

export const isHang = (t: Tile): boolean =>
  t === "rope" || t === "zipR" || t === "zipL";
export const isZip = (t: Tile): boolean => t === "zipR" || t === "zipL";
