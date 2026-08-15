// mcp.test.mjs — the agent harness, driven the way a host drives it.
//
// The server is spawned as a subprocess and spoken to over stdio in
// newline-delimited JSON-RPC, rather than imported and called directly.
// That distinction is the point: importing the implementations would
// exercise them while skipping the framing, the handshake and the
// envelope — precisely the layer that is hand-rolled here, and therefore
// the layer most likely to be wrong.
//
// The suggestion test is the one that matters most. The whole
// justification for this server is that an agent which writes "dithr"
// gets back "dither" and repairs itself in one turn. A report that is
// correct inside the process but flattened, stringified or swallowed on
// the way out through the envelope would be useless, and would look fine
// in every other test here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SERVER = fileURLToPath(new URL("../../bin/mcp-server.mjs", import.meta.url));

/** A live server plus the minimum client needed to talk to it. */
function client() {
  const child = spawn(process.execPath, [SERVER], { stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  let buffer = "";
  let stderr = "";

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (d) => { stderr += d; });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      const resolve = pending.get(msg.id);
      if (resolve) { pending.delete(msg.id); resolve(msg); }
    }
  });

  let id = 0;
  const send = (method, params) => new Promise((resolve, reject) => {
    const mine = ++id;
    pending.set(mine, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: mine, method, params }) + "\n");
    setTimeout(() => reject(new Error(
      `timed out waiting for ${method}; stderr was: ${stderr || "(empty)"}`)), 30000).unref();
  });

  const notify = (method, params) =>
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");

  return { send, notify, kill: () => child.kill() };
}

/** Tool results carry their payload as JSON in a text content block. */
const payload = (result) => JSON.parse(result.content[0].text);

const ELEMENTS = [
  { id: "topnav", type: "nav" },
  { id: "about", type: "wrap", children: [{ id: "about-t", type: "h3", text: "About" }] },
];

const NODES = [
  { op: { name: "shadow" }, target: ["about"] },
  { op: "dither", target: ["topnav"], levels: 6, size: 2, amount: 0.28 },
  { op: "morph", from: "topnav", to: { About: "about" },
    effect: "t-vhs", duration: 900, back: true },
];

/** Set up a client, complete the handshake, hand it back. */
async function ready() {
  const c = client();
  await c.send("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
  return c;
}

test("handshake: initialize answers with capabilities and server identity", async () => {
  const c = client();
  try {
    const res = await c.send("initialize", {
      protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    assert.equal(res.error, undefined, `initialize errored: ${JSON.stringify(res.error)}`);
    assert.equal(res.result.protocolVersion, "2025-06-18",
      "a recognised protocol version must be echoed back");
    assert.deepEqual(res.result.capabilities, { tools: {} });
    assert.equal(res.result.serverInfo.name, "nodality-morph");
    assert.match(res.result.serverInfo.version, /^\d+\.\d+\.\d+/);

    const other = await c.send("initialize", { protocolVersion: "1999-01-01" });
    assert.equal(other.result.protocolVersion, "2025-06-18",
      "an unrecognised version must get ours, not an echo");
  } finally { c.kill(); }
});

test("notifications/initialized draws no reply and does not desynchronise", async () => {
  const c = await ready();
  try {
    c.notify("notifications/initialized");
    // Had the server answered, that stray message would sit in the
    // stream and this request would resolve against it instead.
    const res = await c.send("tools/list", {});
    assert.ok(Array.isArray(res.result.tools), "tools/list did not get its own reply");
  } finally { c.kill(); }
});

test("tools/list advertises the three tools, each with a schema", async () => {
  const c = await ready();
  try {
    const { result } = await c.send("tools/list", {});
    assert.deepEqual(result.tools.map((t) => t.name).sort(),
      ["list_ops", "preview", "validate_nodes"]);
    for (const t of result.tools) {
      assert.ok(t.description && t.description.length > 40,
        `${t.name} needs a description an agent can act on`);
      assert.equal(t.inputSchema.type, "object", `${t.name} needs an object schema`);
    }
  } finally { c.kill(); }
});

test("list_ops returns the live vocabulary, not a hand-maintained copy", async () => {
  const c = await ready();
  try {
    const { result } = await c.send("tools/call", { name: "list_ops", arguments: {} });
    const v = payload(result);
    assert.ok(v.ops.length > 10, `expected the full op registry, got ${v.ops.length}`);
    assert.ok(v.drivers.length > 0 && v.easings.length > 0 && v.units.length > 0);

    const dither = v.ops.find((o) => o.op === "dither");
    assert.ok(dither, "dither is missing from the advertised vocabulary");
    assert.ok(dither.stage.length > 0, "an op must advertise its pipeline stage");
    const names = dither.params.map((p) => p.name);
    assert.ok(names.includes("levels"),
      `dither should advertise its own params, got ${names.join(", ")}`);
    // Shared params are listed separately so an agent can tell what it
    // may write on ANY node from what belongs to this one.
    assert.ok(v.shared.some((s) => s.name === "target"),
      "the inherited params are missing");
  } finally { c.kill(); }
});

test("validate_nodes accepts a real chain including the morph node", async () => {
  const c = await ready();
  try {
    const { result } = await c.send("tools/call",
      { name: "validate_nodes", arguments: { nodes: NODES, elements: ELEMENTS } });
    assert.notEqual(result.isError, true, `unexpected error: ${result.content[0].text}`);
    const report = payload(result);
    assert.equal(report.ok, true, `valid nodes were rejected: ${JSON.stringify(report.errors)}`);
    assert.deepEqual(report.errors, []);
  } finally { c.kill(); }
});

test("a misspelled op surfaces its suggestion THROUGH the envelope", async () => {
  // The repair loop is the reason this server exists.
  const c = await ready();
  try {
    const { result } = await c.send("tools/call", {
      name: "validate_nodes",
      arguments: { nodes: [{ op: "dithr", target: ["topnav"] }], elements: ELEMENTS },
    });
    const report = payload(result);
    assert.equal(report.ok, false, "a misspelled op must not validate");

    const err = report.errors.find((e) => e.code === "UNKNOWN_OP");
    assert.ok(err, `expected UNKNOWN_OP, got ${JSON.stringify(report.errors)}`);
    assert.ok(err.suggestions.includes("dither"),
      `"dither" did not survive the envelope: ${JSON.stringify(err)}`);
    // Structure, not just presence: an agent repairs by reading fields.
    assert.equal(err.path, "nodes[0].op");
    assert.equal(err.got, "dithr");
    assert.ok(Array.isArray(err.valid) && err.valid.length > 0,
      "the error lost the valid vocabulary for its position");
  } finally { c.kill(); }
});

test("a misspelled PARAMETER and a dead target are both caught", async () => {
  // Two different silent failures: a parameter that is simply ignored,
  // and a correctly spelled op aimed at an element that is not there.
  const c = await ready();
  try {
    const { result } = await c.send("tools/call", {
      name: "validate_nodes",
      arguments: {
        nodes: [{ op: "dither", target: ["nope"], levles: 6 }],
        elements: ELEMENTS,
      },
    });
    const report = payload(result);
    assert.equal(report.ok, false);
    const param = report.errors.find((e) => e.code === "UNKNOWN_PARAM");
    assert.ok(param && param.suggestions.includes("levels"),
      `expected a suggestion of "levels", got ${JSON.stringify(report.errors)}`);
    assert.ok(report.errors.some((e) => e.code === "UNKNOWN_TARGET"),
      "an op aimed at a non-existent id must not pass silently");
  } finally { c.kill(); }
});

test("a morph node missing `from` is reported rather than ignored", async () => {
  const c = await ready();
  try {
    const { result } = await c.send("tools/call", {
      name: "validate_nodes",
      arguments: { nodes: [{ op: "morph", to: { About: "about" } }], elements: ELEMENTS },
    });
    const report = payload(result);
    assert.equal(report.ok, false);
    const err = report.errors.find((e) => e.path === "nodes[0].from");
    assert.ok(err, `expected an error on .from, got ${JSON.stringify(report.errors)}`);
    assert.equal(err.code, "MISSING_FIELD");
  } finally { c.kill(); }
});

test("a typo'd MORPH parameter is caught, not silently ignored", async () => {
  // Found by driving the published server end to end. The raster branch
  // checked unknown parameters; the morph branch did not, so `duraton`
  // produced a transition at the default speed and reported nothing —
  // the exact silent failure this server exists to remove, in the one
  // node an agent is most likely to be writing.
  const c = await ready();
  try {
    const { result } = await c.send("tools/call", {
      name: "validate_nodes",
      arguments: {
        nodes: [{ op: "morph", from: "topnav", to: { About: "about" }, duraton: 900 }],
        elements: ELEMENTS,
      },
    });
    const report = payload(result);
    assert.equal(report.ok, false, "an unknown morph parameter must not validate");
    const err = report.errors.find((e) => e.path === "nodes[0].duraton");
    assert.ok(err, `expected an error on .duraton, got ${JSON.stringify(report.errors)}`);
    assert.ok(err.suggestions.includes("duration"),
      `expected a suggestion of "duration", got ${JSON.stringify(err.suggestions)}`);
  } finally { c.kill(); }
});

test("every real morph field is still accepted — the fix must not over-reject",
  async () => {
    const c = await ready();
    try {
      const { result } = await c.send("tools/call", {
        name: "validate_nodes",
        arguments: {
          nodes: [{
            op: "morph", from: "topnav", to: { About: "about" },
            effect: "t-vhs", duration: 900, back: true, live: true, fade: "morph",
          }],
          elements: ELEMENTS,
        },
      });
      const report = payload(result);
      assert.equal(report.ok, true,
        `a fully-specified morph was rejected: ${JSON.stringify(report.errors)}`);
    } finally { c.kill(); }
  });

test("preview writes an HTML file and states what has NOT run", async () => {
  const c = await ready();
  try {
    const { result } = await c.send("tools/call",
      { name: "preview", arguments: { elements: ELEMENTS, nodes: NODES } });
    assert.notEqual(result.isError, true, `preview failed: ${result.content[0].text}`);
    const out = payload(result);
    assert.match(out.path, /\.html$/);
    assert.ok(out.bytes > 0, "preview reported an empty file");
    // An agent cannot see the result; without this it would report a
    // shader that never ran as working.
    assert.match(out.note, /browser/i, "preview must state the GPU boundary");

    const { readFile } = await import("node:fs/promises");
    const html = await readFile(out.path, "utf8");
    assert.match(html, /<html/i, "preview output is not an HTML document");
  } finally { c.kill(); }
});

test("preview refuses invalid nodes with the report, not a crash", async () => {
  const c = await ready();
  try {
    const { result } = await c.send("tools/call", {
      name: "preview",
      arguments: { elements: ELEMENTS, nodes: [{ op: "dithr" }] },
    });
    assert.equal(result.isError, true, "invalid nodes must not render");
    const report = payload(result);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => e.suggestions.includes("dither")));
  } finally { c.kill(); }
});

test("an unknown tool is a protocol error, and the server keeps serving", async () => {
  const c = await ready();
  try {
    const res = await c.send("tools/call", { name: "nope", arguments: {} });
    assert.equal(res.error.code, -32602);
    const after = await c.send("tools/list", {});
    assert.equal(after.result.tools.length, 3, "server stopped serving after a bad call");
  } finally { c.kill(); }
});
