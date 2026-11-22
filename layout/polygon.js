/*!
 * nodality v1.5.7
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import { Animator } from "./animator.js";

import { toObjectSource } from "../lib/codegen.js";
class Polygon extends Animator {
  constructor(obj = {}) {
    super();
    this.res = null;
    this.options = {};
    this.code = [];
    this.elCSS = [];
    this.html = [];
    this.react = [];
    this.setup(obj);
    this.code.push(`new Polygon(${JSON.stringify(obj)})`);
  }

  setup(obj = {}) {
    const el = document.createElement("div");
    if (obj.id) el.setAttribute("id", obj.id);
    this.res = el;
    this.res.style.padding = 0;
    this.res.style.margin = 0;
    this.res.style.display = obj.inline ? "inline-block" : "block";
    return this;
  }

   toCode(){
   const codeObj = this.options || {};
  // stringify with indentation
  let str = toObjectSource(codeObj, 2);
  return `new Polygon().set(${str})`;
  }

    getType() {
    return "LayoutWrapperElement"; // Circles are drawn with a DIV
  }

  // --- unified setter ---
  set(opts = {}) {
    this.options = { ...this.options, ...opts };

    if (opts.id) this.res.id = opts.id;
    if (opts.class) this.res.className = opts.class;
    if (opts.sides) this.sides(opts.sides);
    if (opts.size) this.size(opts.size.width || opts.size, opts.size.height);
    if (opts.color) this.color(opts.color);
    if (opts.border) this.border(opts.border);
    if (opts.margin) this.mar([{a: opts.margin}]);
    if (opts.padding) this.pad([{a: opts.padding}]);
    if (opts.background) this.background(opts.background);
    if (opts.center) this.center();

    let obj = opts;
    // The shadow design node comes in as `shadowOp` (see Circle); one still
    // passed as `shadow` is recognised by its shape. A plain string `shadow`
    // is not a node and must not reach chainReact (it crashed on `.op.name`).
    //@ polygon.shadowOp: A shadow design node targeting the polygon (set by the mapper).
    const shadowNode = obj.shadowOp && typeof obj.shadowOp === "object" && obj.shadowOp.op ? obj.shadowOp
      : (obj.shadow && typeof obj.shadow === "object" && obj.shadow.op ? obj.shadow : undefined);
    // A CSS transform STRING is a plain transform (see Circle).
    if (typeof obj.transform === "string") this.res.style.transform = obj.transform;

    this.obj = opts;

    // Pass ops (gradient, stroke, transform, etc.) to Animator.chainReact
     let arr = [];
    if (
      obj.stroke ||
      obj.gradient ||
      obj.backgroundOp ||
      obj.layout ||
      obj.marginOp ||
      shadowNode ||
      obj.animation ||
      obj.filtera ||
      (obj.transform && typeof obj.transform === "object")
    ) {
      if (obj.gradient && obj.gradient.op) this.globalGradient = obj.gradient.op.gradient;
      if (obj.stroke) super.setAny?.({ globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}` });

      let ft = [
        obj.stroke,
        obj.gradient,
        obj.animation,
        obj.backgroundOp,
        obj.layout,
        obj.marginOp,
        shadowNode,
        obj.animation,
        obj.filtera,
        obj.transform,
      ].filter((el) => el != undefined && typeof el === "object" && el.op);

      for (let i = 0; i < ft.length; i++) {
        arr.push({ range: ft[i].range, log: ft[i].op.name, target: ft[i].target, op: ft[i].op });
      }

      let keep = [];
      if (obj.border) keep.push("border");
      if (obj.background) keep.push("background");
      if (obj.mar || obj.margin) keep.push("margin");
      if (obj.animation) keep.push("animation");

      if (obj.gradient?.op?.direction === "radial") {
					this.globalGradient = "radial-gradient(circle at center, orange, green)";
				}

     

      this.chainReact(arr, this.options.id, keep);
    }

    return this;
  }

  // --- shape methods ---
  size(w, h = w) {
    this.res.style.width = typeof w === "number" ? w + "px" : w;
    this.res.style.height = typeof h === "number" ? h + "px" : h;
    return this;
  }

  sides(n) {
    if (n < 3) n = 3;
    this.res.style.clipPath = Polygon.makePolygon(n);
    return this;
  }

  static makePolygon(n) {
    const step = (2 * Math.PI) / n;
    const points = [];
    for (let i = 0; i < n; i++) {
      const x = 50 + 50 * Math.cos(i * step - Math.PI / 2);
      const y = 50 + 50 * Math.sin(i * step - Math.PI / 2);
      points.push(`${x}% ${y}%`);
    }
    return `polygon(${points.join(",")})`;
  }


  // Text colour, matching every other component. It set `background` here,
  // duplicating background() two methods below and leaving no way to set the
  // text colour.
  color(color) {
    this.res.style.color = color;
    return this;
  }

  border(spec) {
    this.res.style.border =
      typeof spec === "string"
        ? spec
        : `${spec?.width || "1px"} solid ${spec?.color || "black"}`;
    return this;
  }



    background(p) {
    this.res.style.background = p;
    return this;
  }

  render(target) {
    if (typeof target === "string") {
      document.querySelector(target).appendChild(this.res);
    } else if (target instanceof HTMLElement) {
      target.appendChild(this.res);
    }
    return this;
  }
}

export { Polygon };
