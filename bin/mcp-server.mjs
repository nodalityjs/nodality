// mcp-server.mjs — M5, the agent harness.
//
// A Model Context Protocol server over stdio exposing the two-array API
// to agent IDEs. Three tools, and no rendering or vocabulary knowledge of
// its own: when a tool needed something the library did not have — a
// validator for a node INSTANCE, as opposed to the op-definition check
// that already existed — that validator was added to the library rather
// than to this file. The rule is the plan's: if a tool needs code the
// core does not have, the core is missing something.
//
// WHY THIS IS HAND-ROLLED
//
// The MCP SDK is a dependency, and this package takes none. The stdio
// transport is newline-delimited JSON-RPC 2.0 with a Content-Length
// framing option; the newline form is small enough to own outright,
// which is the same reasoning applied to the allocator. What follows is
// the whole protocol surface this server needs: a handshake, a tool
// list, and a dispatch.
//
// WHY THE ERROR REPORT MATTERS MORE THAN THE HAPPY PATH
//
// `validateNodes` returns a machine-readable report — a code, the path
// that failed, what was found, and did-you-mean suggestions drawn from
// the live registry. That report is the entire point of the server. An
// agent that writes `"dithr"` should get back `dither` and repair itself
// in one turn, rather than receiving nothing at all and concluding the
// effect does not work — which is what happened before, because an
// unknown op is silent. So tool-level failures return `isError: true`
// carrying that same report, never a thrown exception and never prose.

// WHAT THIS SERVER IS POINTED AT
//
// The shipped two-array API: `E` describes what exists, `N` describes
// what is done to it, and `N` carries the composable raster chain and
// the `{ op: "morph" }` transition node — the navbar-becomes-a-card
// surface. An earlier draft of this server wrapped `layout/morph.js`,
// which is a different thing that shares the word: a layout-variant spec
// DSL of grid bones and 0-1 axes. Both ship, but this is the one an
// agent writing a page actually needs, and the one whose vocabulary is
// large enough that guessing at it fails.
import { inspect } from "node:util";
import { validateNodes, describeOps } from "../lib/validate-nodes.js";

const PROTOCOL = "2025-06-18";
// Versions whose envelope this server is known to speak. A client asking
// for one of these gets its own version echoed back; anything else gets
// ours, which is what the specification asks for.
const KNOWN = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

const pkgVersion = async () => {
  try {
    const { readFile } = await import("node:fs/promises");
    const url = new URL("../package.json", import.meta.url);
    return JSON.parse(await readFile(url, "utf8")).version || "0.0.0";
  } catch { return "0.0.0"; }
};

// ── the three tools ──────────────────────────────────────────────────

const ELEMENTS_SCHEMA = {
  type: "array",
  description:
    "E — what exists. Each item is an element descriptor: `type` picks " +
    "the component, `id` is the handle nodes aim at, `children` nests " +
    "further descriptors, and every other key is forwarded to that " +
    "component. Nothing in E names an effect.",
  items: { type: "object" },
};

const NODES_SCHEMA = {
  type: "array",
  description:
    "N — what happens to it. Three families, told apart by `op`: " +
    "`{ op: \"dither\", target: [\"hero\"], levels: 6 }` is a raster op " +
    "(several aimed at one element compose into a single shader pass, in " +
    "array order); `{ op: { name: \"shadow\" }, target: [...] }` is a " +
    "design node; `{ op: \"morph\", from: \"topnav\", to: { \"About\": " +
    "\"about\" }, effect: \"t-vhs\", duration: 900, back: true }` is a " +
    "transition — one element becomes another on interaction. Nothing in " +
    "N names a component; the two arrays meet only through `target`, " +
    "`from` and `to`. Call list_ops first for the exact vocabulary.",
  items: { type: "object" },
};

const TOOLS = [
  {
    name: "list_ops",
    description:
      "The vocabulary, as data: every raster op with its pipeline stage " +
      "and its parameters (name, default, unit, whether changing it " +
      "rebuilds the shader), plus the parameters every node inherits " +
      "(target, by, side, ease...), the driver names, the easing names " +
      "and the unit names. Read this before writing nodes — it is " +
      "assembled from the live registry, so it cannot drift from what " +
      "the pipeline accepts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "validate_nodes",
    description:
      "Check an N array before applying it, and return a machine-readable " +
      "report. Never throws: malformed input IS a report. Each error " +
      "carries a code, the path that failed, the offending value, " +
      "did-you-mean suggestions and the valid vocabulary for that " +
      "position — enough to repair without re-reading the docs. Pass " +
      "elements too and targets are checked against real ids, which " +
      "catches the other silent failure: a correctly spelled op aimed at " +
      "an element that does not exist.",
    inputSchema: {
      type: "object",
      properties: { nodes: NODES_SCHEMA, elements: ELEMENTS_SCHEMA },
      required: ["nodes"],
    },
  },
  {
    name: "preview",
    description:
      "Render an (E, N) pair to a self-contained HTML file through the " +
      "build-time prerenderer (jsdom; no browser is launched). Returns " +
      "{ path, bytes, note }. Invalid nodes return the validation report " +
      "instead. Note the boundary: prerendering produces the DOM and the " +
      "morph scaffolding, but raster effects and transitions need a GPU " +
      "and run only when the file is opened in a browser.",
    inputSchema: {
      type: "object",
      properties: {
        elements: ELEMENTS_SCHEMA,
        nodes: NODES_SCHEMA,
        output: {
          type: "string",
          description:
            "Where to write the HTML. Defaults to a file in the system " +
            "temp directory.",
        },
      },
      required: ["elements"],
    },
  },
];

// ── tool implementations ─────────────────────────────────────────────

/** Shape a validation report as a failed tool result. */
const reportAsError = (report) => ({
  content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
  isError: true,
});
const ok = (value) => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

const IMPL = {
  list_ops: async () => ok(describeOps()),

  // Verbatim: the report is the product, and reshaping it here would put
  // this server's opinion between the core and the agent.
  validate_nodes: async ({ nodes, elements }) =>
    ok(validateNodes(nodes, elements)),

  preview: async ({ elements, nodes, output }) => {
    const N = nodes || [];
    const report = validateNodes(N, elements);
    if (!report.ok) return reportAsError(report);

    const [{ prerender }, { writeFile, mkdtemp, readFile }, { tmpdir }, { join }] =
      await Promise.all([
        import("../layout/prerender.js"),
        import("node:fs/promises"),
        import("node:os"),
        import("node:path"),
      ]);

    const dir = await mkdtemp(join(tmpdir(), "nodality-preview-"));
    const template = join(dir, "index.html");
    const out = output || join(dir, "preview.html");

    // The prerenderer wants a template on disk and a build function; it
    // renders into `mount` and writes the result. Going through the
    // documented SSG entry point rather than reaching into jsdom keeps
    // this server free of any rendering knowledge of its own.
    await writeFile(template,
      `<!DOCTYPE html><html><head><meta charset="utf-8">` +
      `<title>Nodality preview</title></head><body>` +
      `<div id="mount"></div></body></html>`, "utf8");

    await prerender({
      template,
      mount: "#mount",
      output: out,
      // `build` is handed the jsdom window and is expected to render
      // into it. The Designer is imported HERE, inside the callback,
      // rather than at module scope: prerender installs the DOM globals
      // before calling this, and library modules read `document` as they
      // load, so an earlier import would bind to a document that does
      // not exist yet.
      build: async () => {
        const { Des } = await import("../lib/designer.js");
        new Des().nodes(N).add(elements).set({ mount: "#mount", code: false });
      },
    });

    const bytes = (await readFile(out)).length;
    return ok({
      path: out, bytes,
      // Said plainly, because an agent cannot see the result and would
      // otherwise report a shader that never ran as working.
      note: "Prerendered DOM only. Raster effects and morph transitions " +
            "need a GPU and run when this file is opened in a browser.",
    });
  },
};

// ── JSON-RPC 2.0 over newline-delimited stdio ────────────────────────

const write = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const reply = (id, result) => write({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) =>
  write({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;

  // Notifications carry no id and expect no reply. `initialized` is the
  // one every client sends; answering it is a protocol error.
  if (id === undefined || id === null) return;

  if (method === "initialize") {
    const asked = params && params.protocolVersion;
    return reply(id, {
      protocolVersion: KNOWN.has(asked) ? asked : PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: { name: "nodality-morph", version: await pkgVersion() },
    });
  }

  if (method === "tools/list") return reply(id, { tools: TOOLS });

  if (method === "tools/call") {
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    const impl = IMPL[name];
    // -32602 is "invalid params" — the right code for a tool that does
    // not exist, as distinct from a tool that ran and rejected its input.
    if (!impl) return fail(id, -32602, `Unknown tool: ${name}`);
    try {
      return reply(id, await impl(args));
    } catch (e) {
      // A throw here is an environment problem, not bad input — bad input
      // became a report above. It still has to arrive as JSON in the same
      // report shape as everything else: an agent parses every result the
      // same way, and handing it a stack trace where it expects an object
      // breaks it as surely as a crash would. Found end-to-end, where a
      // clean install had no jsdom and this path returned prose.
      const message = String((e && e.message) || e);
      const missing = /Cannot find package '([^']+)'|(jsdom) is required/.exec(message);
      const errors = missing
        ? [{
            code: "MISSING_PEER_DEPENDENCY",
            path: name,
            got: missing[1] || missing[2],
            suggestions: [`npm install --save-dev ${missing[1] || missing[2]}`],
            valid: [],
            // The tool that needs it, said plainly, so the agent can
            // decide whether to install or to stop calling this tool.
            detail: `\`${name}\` renders through the build-time ` +
              `prerenderer, which needs this package in the project it ` +
              `runs in. The library does not bundle it: it is required ` +
              `only for prerendering, and bundling it would put a large ` +
              `dependency into every browser install that never uses it.`,
          }]
        : [{ code: "TOOL_FAILED", path: name, got: message,
             suggestions: [], valid: [] }];
      return reply(id, { ...reportAsError({ ok: false, errors }) });
    }
  }

  return fail(id, -32601, `Method not found: ${method}`);
}

/**
 * stdout belongs to the protocol, and to nothing else.
 *
 * This is not a precaution, it is a fix. `preview` renders through the
 * prerenderer, and the component layer prints as it renders — a single
 * `console.log` of an options object lands in the middle of a JSON-RPC
 * frame, the host fails to parse it, and the connection dies with an
 * error that names JSON rather than the component that spoke. Every
 * console method is therefore rebound to stderr, where a host displays
 * it as server log output and where it can do no damage.
 */
function claimStdout() {
  // `inspect`, not JSON.stringify: what the component layer prints
  // includes DOM nodes and option objects with circular references, and
  // stringify would throw inside the very handler meant to keep the
  // stream clean.
  const fmt = (v) => (typeof v === "string" ? v : inspect(v, { depth: 2 }));
  for (const method of ["log", "info", "warn", "debug", "trace", "dir"]) {
    console[method] = (...args) =>
      process.stderr.write(args.map(fmt).join(" ") + "\n");
  }
}

export function serve(input = process.stdin, output = process.stdout) {
  if (output !== process.stdout) throw new Error("serve: stdout only");
  claimStdout();
  let buffer = "";
  input.setEncoding("utf8");
  input.on("data", async (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        write({ jsonrpc: "2.0", id: null,
                error: { code: -32700, message: "Parse error" } });
        continue;
      }
      await handle(msg);
    }
  });
  // A closed stdin means the host is gone; exiting keeps no orphans.
  input.on("end", () => process.exit(0));
}

// Run when invoked directly (`node bin/mcp-server.mjs`), so the server
// can be driven without the CLI wrapper — which is what the tests do.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  serve();
}
