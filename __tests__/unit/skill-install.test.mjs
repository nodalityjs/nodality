// The skills ship as a router (skills/nodality) with references, plus task
// skills beside it. These tests hold the set together: every reference the
// router names exists and every reference is named, every skill has its
// frontmatter, the combined text carries all of it, and the installer puts
// each part where each agent reads it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listSkills, combinedSkill, runSkillInstall } from "../../bin/install-skill.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKILLS = path.join(ROOT, "skills");
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");

test("the router comes first and the task skills are found", () => {
  const names = listSkills(SKILLS);
  assert.equal(names[0], "nodality");
  assert.ok(names.includes("nodality-new-page"));
  assert.ok(names.includes("nodality-edit-page"));
});

test("every skill has frontmatter whose name matches its folder", () => {
  for (const name of listSkills(SKILLS)) {
    const text = read(SKILLS, name, "SKILL.md");
    const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(fm, `${name}: no frontmatter`);
    assert.match(fm[1], new RegExp(`^name: ${name}$`, "m"), `${name}: name differs from folder`);
    assert.match(fm[1], /^description: .{40,}$/m, `${name}: description missing or too short`);
  }
});

test("the router names every reference, and every named reference exists", () => {
  const router = read(SKILLS, "nodality", "SKILL.md");
  const named = new Set([...router.matchAll(/references\/([a-z0-9-]+\.md)/g)].map((m) => m[1]));
  const onDisk = new Set(fs.readdirSync(path.join(SKILLS, "nodality", "references")));
  for (const f of named) assert.ok(onDisk.has(f), `router names references/${f}, which does not exist`);
  for (const f of onDisk) assert.ok(named.has(f), `references/${f} exists but the router never names it`);
});

test("the combined text carries the router, every reference and every task skill", () => {
  const c = combinedSkill(SKILLS);
  assert.ok(c.startsWith("---\nname: nodality\n"), "combined text must start with the router frontmatter");
  for (const f of fs.readdirSync(path.join(SKILLS, "nodality", "references"))) {
    assert.ok(c.includes(read(SKILLS, "nodality", "references", f).trimEnd()), `references/${f} missing`);
  }
  for (const name of listSkills(SKILLS).slice(1)) {
    const body = read(SKILLS, name, "SKILL.md").replace(/^---\n[\s\S]*?\n---\n/, "").trimEnd();
    assert.ok(c.includes(body), `${name} body missing`);
    assert.ok(!c.includes(`---\nname: ${name}\n`), `${name} frontmatter must be stripped`);
  }
});

test("the installer writes each target as its agent reads it", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nodality-skill-"));
  const cwd = process.cwd();
  const log = console.log;
  console.log = () => {};
  try {
    process.chdir(tmp);
    await runSkillInstall(["--claude", "--cursor", "--no-mcp", `--dir=${path.join(tmp, "custom")}`]);
  } finally {
    process.chdir(cwd);
    console.log = log;
  }
  for (const name of listSkills(SKILLS)) {
    assert.ok(fs.existsSync(path.join(tmp, ".claude", "skills", name, "SKILL.md")), `claude: ${name} missing`);
  }
  for (const f of fs.readdirSync(path.join(SKILLS, "nodality", "references"))) {
    assert.ok(fs.existsSync(path.join(tmp, ".claude", "skills", "nodality", "references", f)), `claude: references/${f} missing`);
  }
  const mdc = fs.readFileSync(path.join(tmp, ".cursor", "rules", "nodality.mdc"), "utf8");
  assert.match(mdc, /^---\ndescription: .+\nalwaysApply: false\n---\n/);
  assert.ok(mdc.includes("# Build a new Nodality page"), "cursor rule must carry the task skills");
  const custom = fs.readFileSync(path.join(tmp, "custom", "SKILL.md"), "utf8");
  assert.equal(custom, combinedSkill(SKILLS));
  assert.ok(!fs.existsSync(path.join(tmp, ".mcp.json")), "--no-mcp must not write .mcp.json");
  fs.rmSync(tmp, { recursive: true, force: true });
});
