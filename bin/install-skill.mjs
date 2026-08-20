// bin/install-skill.mjs — `npx nodality skill`: install the /nodality
// skill into agent IDEs, the way `npx motion-ai` does for Motion.
//
// Targets:
//   • Claude Code — copies skills/nodality/SKILL.md to
//     <scope>/.claude/skills/nodality/SKILL.md, where scope is the
//     project (cwd) or the home directory (--global).
//   • Cursor — writes .cursor/rules/nodality.mdc (project only: Cursor
//     has no global rules *directory*; global guidance there is a
//     settings field, not a file this installer may write).
//   • Anything else — --dir=<path> copies SKILL.md verbatim wherever a
//     custom agent reads its instructions from.
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

const SKILL_SRC = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "skills",
  "nodality",
  "SKILL.md",
);

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
function registerMcp(configPath) {
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
      log(`SKIPPED ${configPath} — existing file is not valid JSON; add this by hand:`);
      log(`  "mcpServers": { "nodality": ${JSON.stringify(MCP_ENTRY)} }`);
      return;
    }
  }
  const existed = fs.existsSync(configPath);
  config.mcpServers = { ...config.mcpServers, nodality: MCP_ENTRY };
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

  const skillText = fs.readFileSync(SKILL_SRC, "utf8");

  if (claude) {
    const root = global ? os.homedir() : process.cwd();
    place(SKILL_SRC, path.join(root, ".claude", "skills", "nodality", "SKILL.md"));
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
    place(SKILL_SRC, path.join(path.resolve(customDir), "SKILL.md"));
  }

  log("done. Re-run this command after upgrading nodality to refresh the skill.");
}
