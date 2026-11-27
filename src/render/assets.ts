import type { Theme } from "../game/types";
import { buildBackground } from "./backgrounds";
import { buildSprites } from "./sprites";

/**
 * Everything the renderer needs to draw. To use real art, implement this interface
 * (e.g. load PNG sprite sheets) and pass it to the Renderer instead of GeneratedAssets.
 *
 * Sprite keys: hero|guard . idle|run|climb|hang|fall|zip|pit . frame,
 * tile.<groundStyle>.top|mid (see surfaces.ts), tile.stone|armor, tile.ladder|rope|zipR|zipL, gold.0-3,
 * item.shock|decoy|emp|boots.
 */
export interface AssetProvider {
  sprite(key: string): CanvasImageSource;
  background(theme: Theme): CanvasImageSource;
}

export class GeneratedAssets implements AssetProvider {
  private sprites = buildSprites();
  private bgs = new Map<Theme, HTMLCanvasElement>();

  sprite(key: string): CanvasImageSource {
    const s = this.sprites.get(key);
    if (!s) throw new Error(`Missing sprite: ${key}`);
    return s;
  }

  background(theme: Theme): CanvasImageSource {
    let b = this.bgs.get(theme);
    if (!b) {
      b = buildBackground(theme);
      this.bgs.set(theme, b);
    }
    return b;
  }
}
