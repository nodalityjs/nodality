// bin/schema-cli.mjs — `npx nodality schema [type] [--check]`
//
// Stage 2 of AGENTIC-FIRST-PLAN.md. The point of the subcommand is property 2
// of "agentic-first": schema ON DEMAND rather than schema in context. A model
// that can fetch one type's parameters pays for that type once, instead of
// carrying every type's vocabulary in every request.
//
// TWO SOURCES, in order, because the first one is not always there.
//
// In a checkout the generator runs and the schema is rebuilt from source, so
// what an agent is told cannot be staler than the library it is talking to.
// In an INSTALLED package it is read from the shipped schema.json instead.
//
// That second path is not belt-and-braces, it is a bug fix. `schema.json` and
// `scripts/` were both outside package.json's `files`, so neither reached the
// tarball, and `npx nodality schema` failed with MODULE_NOT_FOUND for every
// consumer while working perfectly in the dev tree — property 2 shipped as
// nothing at all. Both are packaged now, and `packaging/smoke.mjs` runs this
// subcommand against the packed tarball so the surface cannot regress
// invisibly again.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export async function runSchema(args) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const gen = path.join(here, "..", "scripts", "generate-schema.mjs");
  const committed = path.join(here, "..", "schema.json");
  const type = args.find((a) => !a.startsWith("--"));

  if (existsSync(gen)) {
    const passthrough = args.includes("--check")
      ? ["--check"]
      : type ? ["--type", type] : ["--stdout"];
    await new Promise((resolve) => {
      const p = spawn(process.execPath, [gen, ...passthrough], { stdio: "inherit" });
      p.on("exit", (code) => { process.exitCode = code ?? 0; resolve(); });
    });
    return;
  }

  if (!existsSync(committed)) {
    console.error("[nodality] no schema available: neither scripts/generate-schema.mjs");
    console.error("           nor schema.json is present in this installation.");
    process.exitCode = 1;
    return;
  }

  // `--check` asks whether the committed copy matches what the source would
  // produce. Without the generator that question cannot be answered, and
  // answering "yes" from the file being checked would be circular.
  if (args.includes("--check")) {
    console.error("[nodality] --check needs scripts/generate-schema.mjs, which is not");
    console.error("           present in an installed package. Run it from a checkout.");
    process.exitCode = 1;
    return;
  }

  const schema = JSON.parse(readFileSync(committed, "utf8"));
  if (type) {
    const entry = schema.types?.[type];
    if (!entry) {
      console.error(`unknown type "${type}"`);
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({ type, ...entry }, null, 2));
    return;
  }
  process.stdout.write(JSON.stringify(schema, null, 2) + "\n");
}
