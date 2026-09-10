// Bundles the FIT-import Web Worker into public/workers/ as a plain,
// browser-loadable ES module.
//
// Next.js/Turbopack's `new Worker(new URL('./x.ts', import.meta.url))`
// pattern does not currently produce a compiled worker chunk for this
// project's dependency graph (it emits an uncompiled copy of the .ts
// source, which the browser cannot execute) - see the note in
// lib/import/fitZipImport.ts. Bundling it ourselves with esbuild and
// serving it as a static asset sidesteps that entirely, and is a
// well-established pattern for framework + Web Worker setups.
//
// Runs automatically before `next dev`/`next build` (see package.json
// "predev"/"prebuild"). Output is gitignored - always regenerated from source.

import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const entryPoint = fileURLToPath(new URL("../lib/import/fitWorker.ts", import.meta.url));
const outfile = fileURLToPath(new URL("../public/workers/fit-worker.js", import.meta.url));

await build({
  entryPoints: [entryPoint],
  outfile,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: process.env.NODE_ENV === "production",
});

console.log("Built FIT worker -> public/workers/fit-worker.js");
