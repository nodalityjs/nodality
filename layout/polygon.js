/*!
 * nodality v1.0.0-beta.103
 * (c) 2025 Filip Vabrousek
 * License: MIT
 */

import { Animator } from "./animator.js";

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
  let str = JSON.stringify(codeObj, null, 2);
  // remove quotes around keys
  str = str.replace(/"([^"]+)":/g, '$1:');
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
    if (opts.margin) this.margin(opts.margin);
    if (opts.padding) this.padding(opts.padding);
    if (opts.background) this.background(opts.background);
    if (opts.center) this.center();

    let obj = opts;

    this.obj = opts;

    // Pass ops (gradient, stroke, transform, etc.) to Animator.chainReact
     let arr = [];
    if (
      obj.stroke ||
      obj.gradient ||
      obj.backgroundOp ||
      obj.layout ||
      obj.marginOp ||
      obj.shadow ||
      obj.animation ||
      obj.filtera ||
      obj.transform
    ) {
      if (obj.gradient) this.globalGradient = obj.gradient.op.gradient;
      if (obj.stroke) super.setAny?.({ globalBlast: `${obj.stroke.op.width} ${obj.stroke.op.color}` });

      let ft = [
        obj.stroke,
        obj.gradient,
        obj.animation,
        obj.backgroundOp,
        obj.layout,
        obj.marginOp,
        obj.shadow,
        obj.animation,
        obj.filtera,
        obj.transform,
      ].filter((el) => el != undefined);

      for (let i = 0; i < ft.length; i++) {
        arr.push({ range: ft[i].range, log: ft[i].op.name, target: ft[i].target, op: ft[i].op });
      }

      let keep = [];
      if (obj.border) keep.push("border");
      if (obj.background) keep.push("background");
      if (obj.mar || obj.margin) keep.push("margin");
      if (obj.animation) keep.push("animation");

      if (obj.gradient.op.direction === "radial") {
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

  center() {
    this.res.style.marginLeft = "auto";
    this.res.style.marginRight = "auto";
    return this;
  }

  color(color) {
    this.res.style.background = color;
    return this;
  }

  border(spec) {
    this.res.style.border =
      typeof spec === "string"
        ? spec
        : `${spec?.width || "1px"} solid ${spec?.color || "black"}`;
    return this;
  }

  margin(m) {
    this.res.style.margin = typeof m === "number" ? m + "px" : m;
    return this;
  }

  padding(p) {
    this.res.style.padding = typeof p === "number" ? p + "px" : p;
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
