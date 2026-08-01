/*!
 * nodality v1.0.206
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

const IS_NODE = typeof process !== "undefined" && !!process.versions?.node;

// `nodeImport` is a Function-constructor dynamic import that webpack
// CAN'T statically analyse — neither nodality's own webpack build nor
// any consumer's webpack tries to resolve "node:fs" / "node:path" at
// bundle time. The string flows through `new Function`, which is an
// indirection webpack treats as runtime-only. `webpackIgnore` alone
// wasn't enough: the comment is dropped during nodality's bundle and
// consumer bundlers re-scan the produced code without it. (Browsers
// never reach this code because of the IS_NODE guard below.)
const nodeImport = typeof Function !== "undefined"
  ? new Function("s", "return import(s)")
  : null;

export async function loadJson(name, { fallback = undefined, quiet = false } = {}) {
  try {
    if (IS_NODE && nodeImport) {
      const fs = await nodeImport("node:fs");
      const path = await nodeImport("node:path");
      const cwd = process.cwd();
      // Look for the file under `upload/` first (the canonical
      // create-nodality layout), then plain `<name>` at project
      // root as a fallback for non-conventional projects.
      for (const rel of [path.join("upload", name), name]) {
        const abs = path.resolve(cwd, rel);
        if (fs.existsSync(abs)) {
          return JSON.parse(fs.readFileSync(abs, "utf8"));
        }
      }
      throw new Error(`loadJson: ${name} not found (tried ./upload/${name} and ./${name})`);
    }
    const res = await fetch(`./${name}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (fallback !== undefined) {
      // Soft fail — caller asked for a fallback rather than a throw.
      //
      // `quiet` is for the case this function's own docs describe: a stub
      // page whose data file does not exist YET. Warning on every build
      // for a state the author chose makes the message worthless, because
      // it no longer distinguishes "not written yet" from "the file I
      // shipped is missing or malformed" — which is the one worth seeing.
      if (!quiet && typeof console !== "undefined") {
        console.warn(`[loadJson] ${name} failed (${err?.message ?? err}) — using fallback`);
      }
      return fallback;
    }
    throw err;
  }
}
