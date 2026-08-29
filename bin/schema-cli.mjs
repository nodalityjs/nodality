// bin/schema-cli.mjs — `npx nodality schema [type] [--check]`
//
// Stage 2 of AGENTIC-FIRST-PLAN.md. The point of the subcommand is property 2
// of "agentic-first": schema ON DEMAND rather than schema in context. A model
// that can fetch one type's parameters pays for that type once, instead of
// carrying every type's vocabulary in every request.
//
// The schema is regenerated from source on each call rather than read from
// the committed schema.json, so what an agent is told can never be staler
// than the library it is talking to. `--check` compares the two and is what
// CI runs.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function runSchema(args) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const gen = path.join(here, "..", "scripts", "generate-schema.mjs");
  const type = args.find((a) => !a.startsWith("--"));
  const passthrough = args.includes("--check")
    ? ["--check"]
    : type ? ["--type", type] : ["--stdout"];

  await new Promise((resolve) => {
    const p = spawn(process.execPath, [gen, ...passthrough], { stdio: "inherit" });
    p.on("exit", (code) => { process.exitCode = code ?? 0; resolve(); });
  });
}
