import { Game } from "./core/game";
import { setupPwa } from "./pwa";

setupPwa();

const canvas = document.getElementById("game") as HTMLCanvasElement;
new Game(canvas).start();
