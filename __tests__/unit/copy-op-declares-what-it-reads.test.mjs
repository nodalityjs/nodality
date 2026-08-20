// copy-op-declares-what-it-reads.test.mjs — the registry and the mapper
// disagreed about `copy`.
//
// `copy` has two implementations behind one op name. As a raster node it
// is a shader that stamps the texture over itself. As the node attached
// to an element of `type: "copy"` it is handled by ElementMapper.mapCopy,
// which builds the copies as DOM and reads two keys off the node:
// `count` and `animation`.
//
// Only the shader half was declared. So `{ op: "copy", animation: true }`
// — which the documentation teaches, and which measurably changes the
// rendered output — was reported by the validator as an unknown
// parameter. That is the inverse of the 1.2.7 defect: not a mistake
// passing silently, but a working, documented node being rejected. It
// matters because `preview` returns the validation report instead of
// rendering, so a false positive stops the page rather than annotating
// it.
//
// Found by running the 1.2.7 validator over every node array in the
// documentation, which is a corpus of things that are supposed to work.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateNodes, describeOps } from "../../lib/validate-nodes.js";
import { REGISTRY } from "../../lib/raster-ops.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCES = { "element-mapper": path.join(HERE, "..", "..", "lib", "element-mapper.js") };

const E = [{ id: "wheel", type: "copy" }];
const paramsOfCopy = () => {
  const copy = describeOps().ops.find((o) => o.op === "copy");
  assert.ok(copy, "copy missing from the op registry");
  return copy.params.map((p) => p.name);
};

test("the copy op declares every key its DOM mapper reads", () => {
  // mapCopy reads exactly these two off the node. If it grows a third,
  // this fails and the registry has to say so.
  for (const key of ["count", "animation"]) {
    assert.ok(paramsOfCopy().includes(key),
      `copy does not declare "${key}", so a node using it is reported as unknown`);
  }
});

test("the documented copy node validates", () => {
  // Verbatim from docs/nodes/copy.md, "Animating items".
  const r = validateNodes([{ op: "copy", animation: true }], E);
  assert.equal(r.ok, true, r.errors.map((e) => `${e.code}@${e.path}`).join(", "));
});

test("a typo in it is still caught", () => {
  // Declaring the key must not turn the check off — the point is to
  // report the mistake and not the correct spelling.
  const r = validateNodes([{ op: "copy", animaton: true }], E);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors[0].suggestions, ["animation"]);
});

test("animation is declared with a unit that cannot be read as keyframes", () => {
  // isKeyframed() treats an array of two or more numbers as keyframes
  // when the declared unit is a scalar quantity. `animation` is a flag,
  // so it takes the `bool` unit deliberately: a numeric unit here would
  // give array values a meaning the mapper does not implement.
  const copy = describeOps().ops.find((o) => o.op === "copy");
  const animation = copy.params.find((p) => p.name === "animation");
  assert.equal(animation.unit, "bool");
  assert.equal(animation.default, false);
});

test("a param that names another reader is genuinely read there", () => {
  // The other half of the exemption in raster-doc.test.mjs test C. That
  // check scans raster-ops.js and skips any param carrying `readBy`;
  // without this one, `readBy` would be a way to document a parameter
  // that nothing reads at all.
  const missing = [];
  for (const [op, def] of Object.entries(REGISTRY)) {
    for (const [key, meta] of Object.entries(def.doc?.params || {})) {
      if (!meta.readBy) continue;
      const file = SOURCES[meta.readBy];
      assert.ok(file, `${op}.${key} names an unknown reader "${meta.readBy}"`);
      const src = fs.readFileSync(file, "utf8");
      // Matches `ft.animation` and `ft?.animation` alike.
      if (!new RegExp(`\\??\\.\\s*${key}\\b`).test(src)) missing.push(`${op}.${key} in ${meta.readBy}`);
    }
  }
  assert.deepEqual(missing, [], `declared readBy but not found: ${missing.join(", ")}`);
});
