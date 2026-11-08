// bin/install-skill.mjs — `npx nodality skill`: install the Nodality
// skills into agent IDEs, the way `npx motion-ai` does for Motion.
//
// The skills live in skills/<name>/SKILL.md (since 1.5.0 more than one):
//   • nodality             — the router: workflow, house rules, an index,
//                            and references/*.md read on demand.
//   • nodality-new-page    — build a page from a brief in validated steps.
//   • nodality-edit-page   — change one thing on a rendered page.
//
// Targets:
//   • Claude Code — copies every skill folder (references included) to
//     <scope>/.claude/skills/<name>/, where scope is the project (cwd) or
//     the home directory (--global).
//   • Cursor — writes ONE rule, .cursor/rules/nodality.mdc, holding the
//     combined text (project only: Cursor has no global rules
//     *directory*; global guidance there is a settings field, not a file
//     this installer may write).
//   • Anything else — --dir=<path> writes the combined text as SKILL.md
//     wherever a custom agent reads its instructions from: one file, so
//     an agent that cannot follow references still gets all of it.
//
// combinedSkill() is exported: the eval solver builds its prompt from it,
// so what the evals measure is what this installer ships.
//
// Unless --no-mcp is passed, project installs also register the MCP
// server (`npx nodality mcp`) in .mcp.json (Claude Code) and
// .cursor/mcp.json (Cursor), merging into whatever is already there.
// A global Claude install prints the `claude mcp add` line instead:
// the global registry lives inside ~/.claude.json alongside unrelated
// state, and this installer does not edit a file it does not own.
//
// Re-running upgrades in place: the skill file is overwritten, the MCP
// entry re-merged, and each line reports "installed" or "updated".

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SKILLS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "skills");
const ROUTER = "nodality";
const SKILL_SRC = path.join(SKILLS_DIR, ROUTER, "SKILL.md");

// Every skill folder, router first, the rest by name, so output order
// never depends on the file system.
export function listSkills(skillsDir = SKILLS_DIR) {
  const names = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(skillsDir, d.name, "SKILL.md")))
    .map((d) => d.name)
    .sort();
  return [ROUTER, ...names.filter((n) => n !== ROUTER)].filter((n) => names.includes(n));
}

function stripFrontmatter(text) {
  const m = text.match(/^---\n[\s\S]*?\n---\n/);
  return m ? text.slice(m[0].length) : text;
}

// One self-contained text: the router (frontmatter kept), then its
// references in the order the router's index names them, then the task
// skills without frontmatter. Each part is marked with its path, so a
// reader of the combined file can still tell where a rule came from.
export function combinedSkill(skillsDir = SKILLS_DIR) {
  const routerDir = path.join(skillsDir, ROUTER);
  const router = fs.readFileSync(path.join(routerDir, "SKILL.md"), "utf8");
  const refsDir = path.join(routerDir, "references");
  const onDisk = fs.existsSync(refsDir) ? fs.readdirSync(refsDir).filter((f) => f.endsWith(".md")) : [];
  const named = [...router.matchAll(/references\/([a-z0-9-]+\.md)/g)].map((m) => m[1]);
  const order = [...new Set([...named.filter((f) => onDisk.includes(f)), ...onDisk.sort()])];
  const parts = [router.trimEnd()];
  for (const f of order) {
    parts.push(`<!-- ${ROUTER}/references/${f} -->\n\n${fs.readFileSync(path.join(refsDir, f), "utf8").trimEnd()}`);
  }
  for (const name of listSkills(skillsDir).slice(1)) {
    const text = fs.readFileSync(path.join(skillsDir, name, "SKILL.md"), "utf8");
    parts.push(`<!-- ${name}/SKILL.md -->\n\n${stripFrontmatter(text).trimEnd()}`);
  }
  return parts.join("\n\n---\n\n") + "\n";
}

// Copy a skill folder recursively, one installed/updated line per file.
function placeDir(srcDir, destDir) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) placeDir(s, d);
    else if (entry.isFile()) place(s, d);
  }
}

const MCP_ENTRY = { command: "npx", args: ["nodality", "mcp"] };

// ─── helpers ────────────────────────────────────────────────────

function log(line) {
  console.log(`[nodality] ${line}`);
}

// Copy with an installed/updated verdict so re-runs read as upgrades.
function place(src, dest, content) {
  const existed = fs.existsSync(dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (content !== undefined) fs.writeFileSync(dest, content);
  else fs.copyFileSync(src, dest);
  log(`${existed ? "updated  " : "installed"} ${dest}`);
}

// Merge our server into an existing config without touching anything
// else in it. A file that exists but does not parse is left alone and
// reported — clobbering a hand-edited config is worse than skipping.
export function registerMcp(configPath, entry = MCP_ENTRY) {
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
      log(`SKIPPED ${configPath} — existing file is not valid JSON; add this by hand:`);
      log(`  "mcpServers": { "nodality": ${JSON.stringify(entry)} }`);
      return;
    }
  }
  const existed = fs.existsSync(configPath);
  config.mcpServers = { ...config.mcpServers, nodality: entry };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  log(`${existed ? "updated  " : "installed"} ${configPath} (mcpServers.nodality)`);
}

// The Cursor variant of the skill: same body, Cursor's rule
// frontmatter. `alwaysApply: false` plus a description makes it an
// agent-requested rule, matching how the skill triggers in Claude Code.
function toCursorRule(skillText) {
  const m = skillText.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`no frontmatter in ${SKILL_SRC}`);
  const desc = m[1].match(/^description:\s*(.+)$/m);
  if (!desc) throw new Error(`no description in ${SKILL_SRC} frontmatter`);
  const body = skillText.slice(m[0].length);
  return `---\ndescription: ${desc[1]}\nalwaysApply: false\n---\n${body}`;
}

function ask(rl, question, def) {
  return new Promise((resolve) => {
    rl.question(`${question} [${def}] `, (a) => resolve(a.trim() || def));
  });
}

// ─── entry ──────────────────────────────────────────────────────

export async function runSkillInstall(args) {
  if (!fs.existsSync(SKILL_SRC)) {
    console.error(`[nodality] skill source missing: ${SKILL_SRC}`);
    process.exitCode = 1;
    return;
  }

  const flags = new Set(args.filter((a) => !a.startsWith("--dir=")));
  const dirFlag = args.find((a) => a.startsWith("--dir="));
  let claude = flags.has("--claude");
  let cursor = flags.has("--cursor");
  let global = flags.has("--global");
  const customDir = dirFlag ? dirFlag.slice("--dir=".length) : null;
  const wireMcp = !flags.has("--no-mcp");

  // Interactive only when the user picked nothing and a human is
  // attached; agents and CI get the full default install silently.
  const chose = claude || cursor || customDir !== null;
  if (!chose && process.stdin.isTTY && !flags.has("--yes")) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const which = await ask(rl, "Install for which agents? (both / claude / cursor)", "both");
    claude = which === "both" || which === "claude";
    cursor = which === "both" || which === "cursor";
    if (claude) {
      const scope = await ask(rl, "Claude Code scope? (project / global)", "project");
      global = scope === "global";
    }
    rl.close();
  } else if (!chose) {
    claude = true;
    cursor = true;
  }

  const skillText = combinedSkill();

  if (claude) {
    const root = global ? os.homedir() : process.cwd();
    for (const name of listSkills()) {
      placeDir(path.join(SKILLS_DIR, name), path.join(root, ".claude", "skills", name));
    }
    if (wireMcp) {
      if (global) {
        // ~/.claude.json holds per-project state beside the MCP
        // registry; the supported route in is the CLI, so hand it over.
        log("global MCP registration: run this once yourself:");
        log("  claude mcp add nodality -s user -- npx nodality mcp");
      } else {
        registerMcp(path.join(process.cwd(), ".mcp.json"));
      }
    }
  }

  if (cursor) {
    if (global) {
      log("SKIPPED Cursor — rules are per-project; re-run without --global inside a project.");
    } else {
      place(SKILL_SRC, path.join(process.cwd(), ".cursor", "rules", "nodality.mdc"), toCursorRule(skillText));
      if (wireMcp) registerMcp(path.join(process.cwd(), ".cursor", "mcp.json"));
    }
  }

  if (customDir) {
    place(SKILL_SRC, path.join(path.resolve(customDir), "SKILL.md"), skillText);
  }

  log("done. Re-run this command after upgrading nodality to refresh the skill.");
}
