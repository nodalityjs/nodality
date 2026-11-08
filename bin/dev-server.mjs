// bin/dev-server.mjs — `npx nodality dev`: serve the site with the inspector.
//
//   npx nodality dev [--upload=DIR] [--port=4000] [--watch=src,pages] [--no-reload]
//
// Serves the upload folder (from nodality.config.json, else `upload/`) on
// 127.0.0.1 only, and adds two things to every HTML page it serves:
//
//   1. `window.__NODALITY_DEV__`, defined before any page script runs. The
//      Designer sees it and annotates the page and registers its (E, N)
//      pair. Nothing else defines it, so a built page never carries it.
//   2. lib/dev-inspector.js, the in-page toolbar (S select, C comment).
//
// What the person points at lands in `.nodality/` in the folder this was
// started from (the project root, never the upload folder, so it is never
// deployed): current.json and comments.json, read by the agent through the
// MCP tools current_selection / list_comments / resolve_comment, or directly.
//
// A change to any file under the upload folder (or a --watch folder)
// reloads the open pages, so an agent's edit shows as soon as it is built.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readComments, writeCurrent, addComment, normalizePage, STATE_DIR } from "../lib/dev-state.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INSPECTOR = path.join(HERE, "..", "lib", "dev-inspector.js");
const API = "/__nodality";
const MAX_BODY = 64 * 1024;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".avif": "image/avif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml",
};

// `sourceOf` turns a stack into the page's own line that created a component
// (pages/index.js:60:5): the first frame on this origin that is not the
// library (dist/, lib/, layout/, the bundle) or the inspector. It has to exist
// before any page script runs, so it lives here rather than in the inspector.
const SOURCE_OF = `function(stack){var ls=String(stack||"").split("\\n");for(var i=0;i<ls.length;i++){` +
  `var m=/(https?:\\/\\/[^\\s()]+?):(\\d+):(\\d+)/.exec(ls[i]);if(!m)continue;var u;try{u=new URL(m[1])}catch(e){continue}` +
  `if(u.origin!==location.origin)continue;var p=u.pathname;` +
  `if(/\\/(dist|lib|layout|__nodality)\\//.test(p)||/lib\\.bundle|node_modules/.test(p))continue;` +
  `return p.replace(/^\\//,"")+":"+m[2]+":"+m[3]}return null}`;

export const DEV_SNIPPET =
  `<script>window.__NODALITY_DEV__=window.__NODALITY_DEV__||{pages:[],annotate:true,sourceOf:${SOURCE_OF}};</script>` +
  `<script src="${API}/inspector.js" defer></script>`;

/** Put the snippet first inside <head>, so it runs before any page script. */
export function injectDev(html) {
  const m = /<head(\s[^>]*)?>/i.exec(html);
  if (m) return html.slice(0, m.index + m[0].length) + DEV_SNIPPET + html.slice(m.index + m[0].length);
  const d = /<!doctype[^>]*>/i.exec(html);
  return d ? html.slice(0, d.index + d[0].length) + DEV_SNIPPET + html.slice(d.index + d[0].length) : DEV_SNIPPET + html;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}

// Only a page served from this machine's own name may read or write. The Host
// header is checked against loopback names first: with DNS rebinding an
// attacker's name resolves to 127.0.0.1 and sends its own Host, so comparing
// Origin with Host alone would let it read upload/ and post notes.
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
function loopbackHost(req) {
  try { return LOOPBACK.has(new URL(`http://${req.headers.host || ""}`).hostname); } catch { return false; }
}
// Browsers send Origin on cross-site POSTs, so a foreign one is refused too.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

/**
 * The server, not yet listening — so tests can bind it to port 0.
 * @param {{ root: string, upload: string }} opts
 */
export function createDevServer({ root, upload }) {
  const uploadDir = path.resolve(upload);
  const clients = new Set();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const p = url.pathname;
    if (!loopbackHost(req)) return send(res, 403, "nodality dev answers to localhost only", TYPES[".txt"]);
    try {
      if (p === `${API}/inspector.js`) return send(res, 200, fs.readFileSync(INSPECTOR), TYPES[".js"]);
      if (p === `${API}/events`) {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        res.write(": nodality dev\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (p === `${API}/comments` && req.method === "GET") {
        const page = normalizePage(url.searchParams.get("page") || "/");
        return send(res, 200, readComments(root).filter((c) => normalizePage(c.page) === page));
      }
      if ((p === `${API}/current` || p === `${API}/comments`) && req.method === "POST") {
        if (!sameOrigin(req)) return send(res, 403, { ok: false, error: { code: "FOREIGN_ORIGIN" } });
        let body;
        try { body = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: { code: "BAD_BODY", detail: e.message } }); }
        if (p === `${API}/current`) return send(res, 200, { ok: true, current: writeCurrent(root, body, { uploadDir }) });
        const r = addComment(root, body, { uploadDir });
        return send(res, r.ok ? 200 : 400, r);
      }
      if (p.startsWith(API)) return send(res, 404, { ok: false, error: { code: "NOT_FOUND" } });
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "method not allowed", TYPES[".txt"]);

      // Static files, confined to the upload folder.
      let rel;
      try { rel = decodeURIComponent(p); } catch { return send(res, 400, "bad path", TYPES[".txt"]); }
      let file = path.resolve(uploadDir, "." + path.posix.normalize("/" + rel));
      if (file !== uploadDir && !file.startsWith(uploadDir + path.sep)) return send(res, 403, "outside the upload folder", TYPES[".txt"]);
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file) && !path.extname(file) && fs.existsSync(file + ".html")) file += ".html";
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, "not found", TYPES[".txt"]);
      const ext = path.extname(file).toLowerCase();
      if (ext === ".html") return send(res, 200, injectDev(fs.readFileSync(file, "utf8")), TYPES[".html"]);
      return send(res, 200, fs.readFileSync(file), TYPES[ext] || "application/octet-stream");
    } catch (e) {
      return send(res, 500, { ok: false, error: { code: "DEV_SERVER_FAILED", detail: String(e && e.message || e) } });
    }
  });

  server.reload = () => { for (const c of clients) c.write("event: reload\ndata: {}\n\n"); };
  server.uploadDir = uploadDir;
  return server;
}

function watchForReload(server, dirs) {
  let timer = null;
  const fire = (file) => {
    if (file && (String(file).includes(STATE_DIR) || /\.tmp$/.test(String(file)))) return;
    clearTimeout(timer);
    timer = setTimeout(() => server.reload(), 150);
  };
  const watchers = [];
  for (const d of dirs) {
    try { watchers.push(fs.watch(d, { recursive: true }, (_e, f) => fire(f))); }
    catch (e) { console.warn(`[nodality] dev: cannot watch ${d} (${e.message}); reload by hand there`); }
  }
  server.on("close", () => watchers.forEach((w) => w.close()));
}

export async function runDev(args) {
  const flag = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
  const root = process.cwd();
  let upload = flag("upload");
  if (!upload) {
    try { upload = JSON.parse(fs.readFileSync(path.join(root, "nodality.config.json"), "utf8")).uploadDir; } catch {}
  }
  upload = path.resolve(root, upload || "upload");
  if (!fs.existsSync(upload)) {
    console.error(`[nodality] dev: no upload folder at ${upload}. Pass --upload=DIR.`);
    process.exitCode = 1;
    return;
  }
  const port = Number(flag("port") || 4000);
  const server = createDevServer({ root, upload });
  if (!args.includes("--no-reload")) {
    const extra = (flag("watch") || "").split(",").filter(Boolean).map((d) => path.resolve(root, d));
    watchForReload(server, [upload, ...extra]);
  }
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  }).catch((e) => {
    console.error(`[nodality] dev: cannot listen on 127.0.0.1:${port} (${e.code || e.message}). Try --port=4001.`);
    process.exit(1);
  });
  console.log(`[nodality] dev: http://localhost:${server.address().port}/  (serving ${path.relative(root, upload) || "."})`);
  console.log(`[nodality] dev: S select · C comment · Esc off. Picks and notes go to ${path.join(STATE_DIR, "current.json")} and ${path.join(STATE_DIR, "comments.json")}.`);
  console.log(`[nodality] dev: add ${STATE_DIR}/ to .gitignore if the notes should stay on this machine.`);
  await new Promise(() => {});
}
