import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** Files that are on the site but not needed to play, so they are not precached. */
const SKIP = new Set(["sw.js", "robots.txt", "sitemap.xml", "og-image.png", "screenshot-wide.png"]);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * Writes dist/sw.js from pwa/sw.template.js after the build, with the real (hashed) file names to
 * precache and a version derived from their contents, so every deploy gets a fresh cache.
 */
function serviceWorker(): Plugin {
  let outDir = "dist";
  return {
    name: "robo-runner-service-worker",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((f) => relative(outDir, f).split(sep).join("/"))
        .filter((f) => !SKIP.has(f))
        .sort();
      const hash = createHash("sha256");
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest("hex").slice(0, 12);
      const urls = ["/", ...files.filter((f) => f !== "index.html").map((f) => `/${f}`)];
      const sw = readFileSync("pwa/sw.template.js", "utf8")
        .replaceAll("__VERSION__", version)
        .replaceAll("__PRECACHE__", JSON.stringify(urls, null, 2));
      if (sw.includes("__")) throw new Error("sw.js: a __PLACEHOLDER__ was left unreplaced");
      writeFileSync(join(outDir, "sw.js"), sw);
      this.info?.(`sw.js: version ${version}, ${urls.length} files precached`);
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
});
