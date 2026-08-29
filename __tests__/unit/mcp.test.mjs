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

test("tools/list advertises every tool, each with a schema", async () => {
  const c = await ready();
  try {
    const { result } = await c.send("tools/list", {});
    assert.deepEqual(result.tools.map((t) => t.name).sort(),
      ["get_schema", "list_ops", "parse_html", "preview", "validate_nodes"]);
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

// ── the chain form ──────────────────────────────────────────────────
//
// `chain` shipped in 1.1.14 and the validator was never taught it, so the
// tool server rejected the multi-edge node the library actually documents:
// UNKNOWN_PARAM on `chain`, plus MISSING_FIELD on the `from`/`to` that a
// chain node correctly does not have. An agent following the reference
// would have been told the reference is wrong.

const CHAIN_ELEMENTS = [
  { id: "topnav", type: "nav" },
  { id: "work", type: "wrap", children: [{ id: "work-t", type: "h3", text: "Work" }] },
  { id: "aurora", type: "wrap", children: [{ id: "aurora-t", type: "h3", text: "Aurora" }] },
  { id: "contact", type: "wrap", children: [{ id: "contact-t", type: "h3", text: "Contact" }] },
];

/** The chain exactly as the documentation and the dissertation print it. */
const CHAIN_NODE = {
  op: "morph", effect: "t-vhs", duration: 620, back: true,
  chain: [
    { from: "topnav", to: { Work: "work", Contact: "contact" } },
    { from: "work", to: { Aurora: "aurora" }, effect: "t-split" },
    { from: "aurora", to: { Contact: "contact" }, effect: "t-bloom" },
  ],
};

const validate = async (nodes, elements = CHAIN_ELEMENTS) => {
  const c = await ready();
  try {
    const { result } = await c.send("tools/call",
      { name: "validate_nodes", arguments: { nodes, elements } });
    return payload(result);
  } finally { c.kill(); }
};

test("the documented chain node validates", async () => {
  const report = await validate([CHAIN_NODE]);
  assert.equal(report.ok, true,
    `the shipped chain form was rejected: ${JSON.stringify(report.errors)}`);
});

test("an id in selector form is accepted, because the runtime accepts it", async () => {
  // `bareId` in morph-node.js reduces "#work" and "work" to one key, so
  // both spellings resolve. The validator has to agree: while it accepted
  // "#work" and the runtime did not, this reported ok on a node that
  // silently never morphed.
  const report = await validate([{
    op: "morph", chain: [
      { from: "#topnav", to: { Work: "#work" } },
      { from: "work", to: { Aurora: "aurora" } },
    ],
  }]);
  assert.equal(report.ok, true,
    `selector-form ids were rejected: ${JSON.stringify(report.errors)}`);
});

test("a typo inside a chain EDGE is caught, at the edge's own path", async () => {
  const report = await validate([{
    op: "morph",
    chain: [{ from: "topnav", to: { Work: "work" }, duraton: 620 }],
  }]);
  assert.equal(report.ok, false, "an unknown edge parameter must not validate");
  const err = report.errors.find((e) => e.path === "nodes[0].chain[0].duraton");
  assert.ok(err, `expected an error on the edge, got ${JSON.stringify(report.errors)}`);
  assert.ok(err.suggestions.includes("duration"),
    `expected a suggestion of "duration", got ${JSON.stringify(err.suggestions)}`);
});

test("a dead id inside a chain edge is caught, with the id it meant", async () => {
  const report = await validate([{
    op: "morph",
    chain: [
      { from: "topnav", to: { Work: "work" } },
      { from: "wrok", to: { Aurora: "aurora" } },
    ],
  }]);
  assert.equal(report.ok, false, "an unresolvable edge source must not validate");
  const err = report.errors.find((e) => e.path === "nodes[0].chain[1].from");
  assert.ok(err, `expected an error on chain[1].from, got ${JSON.stringify(report.errors)}`);
  assert.ok(err.suggestions.includes("work"),
    `expected a suggestion of "work", got ${JSON.stringify(err.suggestions)}`);
});

test("`from`/`to` written beside a chain are reported as ignored", async () => {
  // `normalizeEdges` takes a non-empty chain and never reads the
  // node-level pair, so the page works — using the chain — while the
  // ignored pair looks as though it took effect.
  const report = await validate([{
    op: "morph", from: "topnav", to: { Work: "work" },
    chain: [{ from: "topnav", to: { Work: "work" } }],
  }]);
  assert.equal(report.ok, false, "a dead from/to pair must be reported");
  for (const path of ["nodes[0].from", "nodes[0].to"]) {
    const err = report.errors.find((e) => e.path === path);
    assert.ok(err, `expected ${path} to be reported, got ${JSON.stringify(report.errors)}`);
    assert.equal(err.code, "IGNORED_FIELD");
  }
});

test("a flag written as a string is caught, not silently dropped", async () => {
  // `live` is compared by identity — `opt("live") === true` — so
  // `live: "true"` leaves the live backend off, the snapshot backend
  // renders a perfectly good transition, and nothing reports anything.
  const report = await validate([{
    op: "morph", from: "topnav", to: { Work: "work" }, live: "true",
  }]);
  assert.equal(report.ok, false, 'live: "true" must not validate');
  const err = report.errors.find((e) => e.path === "nodes[0].live");
  assert.ok(err, `expected an error on .live, got ${JSON.stringify(report.errors)}`);
  assert.deepEqual(err.valid, ["true", "false"]);
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

test("preview reports the surface an operating agent would be handed", async () => {
  // The two loops meet in one artefact: the model WRITING the page sees
  // the tools a model USING the page will get, and can tell before
  // shipping that the form it meant to expose derived nothing.
  const c = await ready();
  try {
    const { result } = await c.send("tools/call", {
      name: "preview",
      arguments: {
        elements: [
          { id: "home", type: "wrap", children: [{ id: "h", type: "h3", text: "Home" }] },
          { id: "about", type: "wrap" },
          { id: "cf", type: "form", children: [
            { id: "cf-mail", type: "input", inputType: "email", name: "email",
              required: true }] },
        ],
        nodes: [
          { op: "morph", chain: [{ from: "home", to: { About: "about" } }] },
          { op: "agent-surface", name: "demo", forms: ["cf"] },
        ],
      },
    });
    assert.notEqual(result.isError, true, result.content[0].text);
    const out = payload(result);
    assert.ok(out.surface, `no surface reported: ${JSON.stringify(out)}`);
    assert.deepEqual(out.surface.tools.map((t) => t.name).sort(),
      ["demo_go_back", "demo_navigate", "demo_read_view", "demo_submit_cf"]);
    assert.equal(out.surface.views.root, "home");
    assert.match(out.note, /operating this page/);
  } finally { c.kill(); }
});

test("a surface node naming a form that does not exist is refused", async () => {
  const c = await ready();
  try {
    const { result } = await c.send("tools/call", {
      name: "validate_nodes",
      arguments: {
        nodes: [{ op: "agent-surface", forms: ["contat"] }],
        elements: [{ id: "contact", type: "form" }],
      },
    });
    const report = payload(result);
    assert.equal(report.ok, false);
    const err = report.errors.find((e) => e.code === "UNKNOWN_FORM");
    assert.ok(err, JSON.stringify(report.errors));
    assert.ok(err.suggestions.includes("contact"));
  } finally { c.kill(); }
});

test("an unknown tool is a protocol error, and the server keeps serving", async () => {
  const c = await ready();
  try {
    const res = await c.send("tools/call", { name: "nope", arguments: {} });
    assert.equal(res.error.code, -32602);
    const after = await c.send("tools/list", {});
    assert.equal(after.result.tools.length, 5, "server stopped serving after a bad call");
  } finally { c.kill(); }
});

// ── the agent surface for Stages 1-5 ────────────────────────────────
//
// The five stages shipped a data format, a schema, repairable errors and a
// round-trip, and then shipped them into a server that advertised none of
// them. An agent meets the tool list, not the library: a capability no tool
// names does not exist as far as the caller is concerned. These tests are the
// check that the surface keeps up with the format.

test("the tool list advertises the schema and the round-trip", async () => {
  const c = client();
  try {
    await c.send("initialize", {
      protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    c.notify("notifications/initialized");
    const res = await c.send("tools/list");
    const names = res.result.tools.map((t) => t.name);
    for (const want of ["list_ops", "validate_nodes", "preview", "get_schema", "parse_html"]) {
      assert.ok(names.includes(want), `tools/list is missing "${want}": ${names.join(", ")}`);
    }
  } finally { c.kill(); }
});

test("get_schema answers for one type, and reports an unknown one", async () => {
  const c = client();
  try {
    await c.send("initialize", {
      protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    c.notify("notifications/initialized");

    const good = payload((await c.send("tools/call", {
      name: "get_schema", arguments: { type: "cards" },
    })).result);
    assert.equal(good.type, "cards");
    assert.ok(good.params.some((p) => p.name === "items"),
      "get_schema('cards') did not report the slot that carries its content");

    // Property 2 is only worth anything if one type is much cheaper than all
    // of them; assert the shape that makes that true.
    const all = payload((await c.send("tools/call", {
      name: "get_schema", arguments: {},
    })).result);
    assert.ok(Object.keys(all.types).length > 30, "the full schema should cover every type");
    assert.ok(JSON.stringify(good).length * 10 < JSON.stringify(all).length,
      "one type must be far cheaper than the whole schema, or on-demand buys nothing");

    // An unknown type comes back as a report, in the same shape as every
    // other report, rather than as an error envelope.
    const bad = payload((await c.send("tools/call", {
      name: "get_schema", arguments: { type: "cardz" },
    })).result);
    assert.equal(bad.ok, false);
    assert.equal(bad.errors[0].code, "UNKNOWN_ELEMENT_TYPE");
    assert.ok(bad.errors[0].suggestions.includes("cards"),
      `no did-you-mean for "cardz": ${JSON.stringify(bad.errors[0].suggestions)}`);
  } finally { c.kill(); }
});

test("parse_html reads a page back and says which tier it got", async () => {
  const c = client();
  try {
    await c.send("initialize", {
      protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    c.notify("notifications/initialized");

    const res = await c.send("tools/call", {
      name: "parse_html",
      arguments: { html: '<h2 style="x">Hi</h2><a href="#d">Go</a><div></div>' },
    });
    const out = payload(res.result);

    // jsdom is a build-time dependency; where it is absent the server must
    // still answer in the report shape rather than throwing prose.
    if (out.errors?.[0]?.code === "MISSING_PEER_DEPENDENCY") return;

    assert.equal(out.exact, false, "unannotated HTML cannot be an exact read");
    assert.deepEqual(out.spec.map((e) => e.type), ["h2", "a"]);
    assert.equal(out.spec[1].url, "#d");
    // The bare div is a composite with nothing to identify it. It must be
    // reported, not guessed: the caller re-renders whatever comes back.
    assert.deepEqual(out.unrecovered, [{ index: 2, tag: "div" }]);
    assert.equal(out.ok, false, "a partial read must not report itself complete");
  } finally { c.kill(); }
});
