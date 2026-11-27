import type { ToolKind } from "../game/types";

export const ALL_TOOLS: ToolKind[] = [
  "shock",
  "decoy",
  "emp",
  "boots",
  "smoke",
  "glue",
  "bomb",
];

export interface DebugState {
  guards: boolean;
  invincible: boolean;
}

export interface DebugActions {
  /** Called whenever a switch changes. */
  onChange(state: DebugState): void;
  isSfxOn(): boolean;
  isMusicOn(): boolean;
  setSfx(on: boolean): void;
  setMusic(on: boolean): void;
  levelNames: string[];
  /** Puts a tool in the hero's hand (debug). */
  giveTool(kind: ToolKind): void;
  currentLevel(): number;
  jumpToLevel(index: number): void;
  restartLevel(): void;
  collectAll(): void;
}

/** Floating DOM panel for exploring levels. Toggle with ` (backquote) or F2. */
export class DebugPanel {
  readonly state: DebugState = { guards: true, invincible: false };
  private root: HTMLDivElement;
  private select: HTMLSelectElement;
  private sfxBox: HTMLInputElement;
  private musicBox: HTMLInputElement;

  constructor(private actions: DebugActions) {
    this.root = document.createElement("div");
    this.root.id = "debug-panel";
    this.root.hidden = !new URLSearchParams(window.location.search).has(
      "debug",
    );
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Debug panel");
    Object.assign(this.root.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      width: "210px",
      padding: "10px 12px",
      background: "rgba(16, 10, 6, 0.92)",
      border: "2px solid #ff9a1f",
      color: "#ffe9b0",
      font: '12px "Courier New", monospace',
      zIndex: "10",
    });

    const title = document.createElement("div");
    title.textContent = "DEBUG  (` or F2 to hide)";
    title.style.cssText = "color:#ff9a1f;font-weight:bold;margin-bottom:8px";
    this.root.append(title);

    this.root.append(
      this.checkbox(
        "Guards enabled",
        this.state.guards,
        (v) => (this.state.guards = v),
      ),
      this.checkbox(
        "Invincible hero",
        this.state.invincible,
        (v) => (this.state.invincible = v),
      ),
    );
    const sfx = this.checkbox(
      "Sound effects",
      actions.isSfxOn(),
      (v) => actions.setSfx(v),
      false,
    );
    const music = this.checkbox(
      "Music",
      actions.isMusicOn(),
      (v) => actions.setMusic(v),
      false,
    );
    this.sfxBox = sfx.querySelector("input")!;
    this.musicBox = music.querySelector("input")!;
    this.root.append(sfx, music);

    this.select = document.createElement("select");
    this.select.setAttribute("aria-label", "Jump to level");
    this.select.style.cssText = "width:100%;margin:8px 0 6px;font:inherit";
    actions.levelNames.forEach((n, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${i + 1}. ${n}`;
      this.select.append(o);
    });
    this.select.addEventListener("change", () => {
      this.actions.jumpToLevel(Number(this.select.value));
      this.select.blur();
    });
    this.root.append(this.select);

    const tools = document.createElement("select");
    tools.setAttribute("aria-label", "Give tool");
    tools.style.cssText = "width:100%;margin:0 0 6px;font:inherit";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Give tool...";
    tools.append(placeholder);
    for (const t of ALL_TOOLS) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      tools.append(o);
    }
    tools.addEventListener("change", () => {
      if (tools.value) this.actions.giveTool(tools.value as ToolKind);
      tools.value = "";
      tools.blur();
    });
    this.root.append(tools);

    this.root.append(
      this.button("Restart level", () => this.actions.restartLevel()),
      this.button("Collect all gold", () => this.actions.collectAll()),
    );
    document.body.append(this.root);

    window.addEventListener("keydown", (e) => {
      if (e.code === "Backquote" || e.code === "F2") {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  toggle(): void {
    this.root.hidden = !this.root.hidden;
    if (!this.root.hidden)
      this.select.value = String(this.actions.currentLevel());
  }

  /** Keeps the level dropdown in sync when the level changes outside the panel. */
  sync(): void {
    this.sfxBox.checked = this.actions.isSfxOn();
    this.musicBox.checked = this.actions.isMusicOn();
    if (!this.root.hidden)
      this.select.value = String(this.actions.currentLevel());
  }

  private checkbox(
    label: string,
    initial: boolean,
    set: (v: boolean) => void,
    notify = true,
  ): HTMLLabelElement {
    const l = document.createElement("label");
    l.style.cssText =
      "display:flex;gap:8px;align-items:center;margin:4px 0;cursor:pointer";
    const c = document.createElement("input");
    c.type = "checkbox";
    c.checked = initial;
    c.addEventListener("change", () => {
      set(c.checked);
      if (notify) this.actions.onChange(this.state);
      c.blur(); // keep Space/arrows for the game
    });
    l.append(c, label);
    return l;
  }

  private button(label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText =
      "display:block;width:100%;margin:4px 0;font:inherit;cursor:pointer";
    b.addEventListener("click", () => {
      fn();
      b.blur();
    });
    return b;
  }
}
