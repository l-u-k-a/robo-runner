/**
 * Installable web app support: registers the service worker (production builds only) and keeps the
 * browser's install prompt so the title menu can offer "INSTALL APP".
 */

/** Chrome/Edge/Android event, not in the standard DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;

/** True when the game is already running as an installed app. */
export function runningInstalled(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function setupPwa(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for our own menu item instead of the mini-infobar
    deferred = e as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
  });
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }
}

/** The browser is ready to install the game (and it is not installed yet). */
export function canInstall(): boolean {
  return !!deferred && !installed && !runningInstalled();
}

/** Opens the browser's install dialog. Must run soon after a key press or click. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null; // the event can only be used once
  await e.prompt();
  const choice = await e.userChoice;
  if (choice.outcome === "accepted") installed = true;
  return choice.outcome === "accepted";
}
